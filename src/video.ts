import { copyFileSync, cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { atomic, checked, digest, entry, fileDigest, files, inventory, readText, requireThat, temporary, writeJson } from "./files";
import type { Chapter, ChapterIndex, FilmPlan, MediaReceipt, Phase, Tokens } from "./model";
import { assertHyperframesVersion, callHyperframes, hyperframes, hyperframesPin, locateChrome, synthesize, ttsCheck } from "./providers";
import { baseline, handoff, onboarding, projectFile, Repository } from "./repository";
import { composition, type Cue, type TimedScene } from "./video-composition";

const videoFile = onboarding + "/product-walkthrough.mp4";
const chapterFile = onboarding + "/video-chapters.json";
const transcriptFile = onboarding + "/video-transcript.md";
const subtitleFile = onboarding + "/video-subtitles.srt";
const sourceDir = onboarding + "/video-source";
const mediaReceipt = onboarding + "/video-receipt.json";
const tokensPath = baseline + "/04-brand-creative/design-tokens.json";

export function videoInputs(repo: Repository) {
  const paths = new Set(repo.method.workflows.po.phases.slice(0, -1).flatMap(phase =>
    phase.artifacts.flatMap(artifact => files(repo.root, phase.folder + "/" + artifact.path))));
  const hash = digest({
    version: hyperframesPin,
    inputs: inventory(repo.root, [...paths, handoff + "/video-plan.json", projectFile]),
  });
  return { paths, hash };
}

interface Probe {
  format: { duration: string; format_name: string };
  streams: { codec_type: string; codec_name: string; width?: number; height?: number }[];
  chapters?: { start_time: string; end_time: string; tags?: { title?: string } }[];
}

function probe(path: string): Probe {
  return JSON.parse(checked("ffprobe", ["-v", "error", "-show_format", "-show_streams", "-show_chapters",
    "-of", "json", path])) as Probe;
}

function durationFor(media: Probe): number {
  const ms = Math.round(Number(media.format.duration) * 1000);
  requireThat(Number.isSafeInteger(ms) && ms > 0 && media.streams.some(stream => stream.codec_type === "audio"),
    "El archivo audiovisual no contiene audio de duración verificable.");
  return ms;
}

function assertAudible(path: string): void {
  const result = Bun.spawnSync(["ffmpeg", "-hide_banner", "-nostdin", "-nostats", "-i", path, "-map", "0:a:0", "-af", "volumedetect", "-f", "null", "-"],
    { stdout: "ignore", stderr: "pipe" });
  const peak = /max_volume:\s*(-?\d+(?:\.\d+)?) dB/.exec(result.stderr.toString());
  requireThat(result.exitCode === 0 && peak && Number(peak[1]) > -45, "La narración sintetizada está vacía o no se puede oír.");
}

function timestamp(ms: number) {
  const hours = String(Math.floor(ms / 3_600_000)).padStart(2, "0");
  const minutes = String(Math.floor(ms / 60_000) % 60).padStart(2, "0");
  const seconds = String(Math.floor(ms / 1000) % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds},${String(ms % 1000).padStart(3, "0")}`;
}

function cueText(text: string) {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (line.length && line.length + word.length + 1 > 48) {
      lines.push(line);
      line = word;
    } else line += (line.length ? " " : "") + word;
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

function subtitle(cues: Cue[]) {
  return cues.map((cue, i) =>
    `${i + 1}\n${timestamp(cue.startMs)} --> ${timestamp(cue.endMs)}\n${cueText(cue.text)}\n`).join("\n");
}

function meta(text: string) {
  return text.replace(/([\\\n=;#])/g, "\\$1");
}

function mediaMetadata(index: ChapterIndex) {
  return ";FFMETADATA1\n" + index.chapters.map(chapter => [
    "[CHAPTER]", "TIMEBASE=1/1000", `START=${chapter.startMs}`, `END=${chapter.endMs}`,
    `title=${meta(chapter.title)}`,
  ].join("\n")).join("\n") + "\n";
}

function tts(repo: Repository, speech: string, caption: string, raw: string, wav: string) {
  atomic(caption, speech + "\n");
  synthesize(repo.config.tts!, repo.config.language, caption, raw);
  requireThat(entry(raw)?.isFile(), "El proveedor de voz no generó el audio solicitado.");
  checked("ffmpeg", ["-v", "error", "-nostdin", "-y", "-i", raw, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
    "-ac", "1", "-ar", "48000", "-c:a", "pcm_s16le", wav], { timeout: 60_000 });
  assertAudible(wav);
  return durationFor(probe(wav));
}

function publicCheck(raw: string, chapter: string, folder: string) {
  try {
    return JSON.parse(raw.replaceAll(folder + "/", "")) as {
      ok?: boolean; browserSkipped?: boolean; runtime?: { ok?: boolean }; layout?: { ok?: boolean };
    };
  } catch {
    throw new Error(`HyperFrames no devolvió un informe JSON para ${chapter}.`);
  }
}

async function renderChapter(repo: Repository, chapter: Chapter, tokens: Tokens, source: string, temp: string,
  command: ReturnType<typeof hyperframes>, progress: (message: string) => void) {
  const folder = join(source, "hyperframes", chapter.id);
  const scripts = join(source, "scripts", chapter.id);
  mkdirSync(join(folder, "audio"), { recursive: true });
  mkdirSync(join(folder, "assets"), { recursive: true });
  mkdirSync(join(folder, "lib"), { recursive: true });
  const installedAsset = join(dirname(process.execPath), "vendor", "gsap.min.js");
  const gsap = entry(installedAsset)?.isFile() ? installedAsset : require.resolve("gsap/dist/gsap.min.js");
  copyFileSync(gsap, join(folder, "lib", "gsap.min.js"));

  let next = 0;
  const cues: Cue[] = [];
  const scenes: TimedScene[] = [];
  for (const [position, scene] of chapter.scenes.entries()) {
    const startMs = next;
    next += 250;
    let asset: string | undefined;
    if (scene.image) {
      asset = `assets/prototype-${position + 1}.png`;
      copyFileSync(repo.path(scene.image), join(folder, asset));
    }
    for (const line of scene.narration) {
      const key = `cue-${cues.length + 1}`;
      const file = `audio/${key}.wav`;
      const raw = join(temp, "speech." + (repo.config.tts!.provider === "say" ? "aiff" : "wav"));
      rmSync(raw, { force: true });
      const span = tts(repo, line, join(scripts, key + ".txt"), raw, join(folder, file));
      cues.push({ text: line, startMs: next, endMs: next + span, file });
      next += span + 140;
    }
    next = Math.ceil((next + 200) / 100) * 100;
    scenes.push({ scene, startMs, endMs: next, asset });
  }

  atomic(join(folder, "index.html"), composition(chapter, tokens, scenes, cues, next, repo.config.language));
  writeJson(join(source, "storyboard", chapter.id + ".json"), { ...chapter, scenes, cues });
  progress(`Comprobando la composición HyperFrames: ${chapter.title}`);
  const check = await callHyperframes(command, ["check", "--no-cache", "--json", "."], folder, 180_000);
  const report = publicCheck(check.stdout, chapter.title, folder);
  requireThat(check.code === 0 && report?.ok && report.browserSkipped === false && report.runtime?.ok && report.layout?.ok,
    `HyperFrames check bloqueó ${chapter.title}: ${JSON.stringify(report).slice(0, 2400)}`);
  writeJson(join(source, "checks", chapter.id + ".json"), report);
  const path = join(temp, chapter.id + ".mp4");
  progress(`Renderizando: ${chapter.title}`);
  const render = await callHyperframes(command,
    ["render", ".", "-o", path, "--fps=30", "--workers=1", "--quality=looks",
      "--experimental-fast-capture=false", "--no-browser-gpu", "--json"], folder);
  requireThat(render.code === 0 && entry(path)?.isFile(),
    `Falló el render de ${chapter.title}: ${(render.stderr || render.stdout).trim().slice(-2000)}`);
  rmSync(join(folder, ".hyperframes"), { recursive: true, force: true });
  const duration = durationFor(probe(path));
  requireThat(duration + 100 >= cues.at(-1)!.endMs, `El render truncó la voz en ${chapter.title}.`);
  return { duration, cues, path };
}

function publishDir(from: string, to: string) {
  // The receipt is published last. An interrupted copy is detected and regenerated.
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

export async function renderFilm(repo: Repository, phase: Phase, plan: FilmPlan, progress: (message: string) => void) {
  const configuredVoice = ttsCheck(repo.config.tts, repo.config.language, true);
  requireThat(configuredVoice.ok, `Video bloqueado. ${configuredVoice.detail}`);
  requireThat(locateChrome(), "Video bloqueado. Instala Chrome/Chromium o configura el ejecutable de Chromium.");
  const ffmpegVersion = checked("ffmpeg", ["-version"]).split("\n")[0];
  checked("ffprobe", ["-version"]);
  const command = hyperframes();
  const temp = temporary("film");
  try {
    const version = await assertHyperframesVersion(command, temp);
    const inputs = videoInputs(repo).hash;
    const source = join(temp, "video-source");
    const tokens = repo.json<Tokens>("design-tokens", tokensPath);
    mkdirSync(source, { recursive: true });
    const index: ChapterIndex = { version: 1, language: plan.language, durationMs: 0, chapters: [] };
    const outputs: string[] = [];
    const allCues: Cue[] = [];
    const checks: MediaReceipt["checks"] = [];
    const transcript = ["# Transcripción", "", "Narración producida por síntesis de voz (TTS).", ""];

    for (const chapter of plan.chapters) {
      const result = await renderChapter(repo, chapter, tokens, source, temp, command, progress);
      const startMs = index.durationMs;
      const endMs = startMs + result.duration;
      index.chapters.push({ id: chapter.id, title: chapter.title, category: chapter.category, startMs, endMs });
      index.durationMs = endMs;
      transcript.push(`## ${chapter.title} · ${timestamp(startMs)}`, "", result.cues.map(cue => cue.text).join(" "), "");
      allCues.push(...result.cues.map(cue => ({ ...cue, startMs: cue.startMs + startMs, endMs: cue.endMs + startMs })));
      checks.push({ chapter: chapter.id, runtime: "passed", sha256: fileDigest(result.path) });
      outputs.push(`file '${chapter.id}.mp4'\nduration ${(result.duration / 1000).toFixed(3)}`);
    }
    const srt = subtitle(allCues);
    atomic(join(source, "captions.srt"), srt);
    atomic(join(source, "chapters.ffmeta"), mediaMetadata(index));
    atomic(join(source, "chapter-order.txt"), plan.chapters.map(chapter => chapter.id).join("\n") + "\n");
    atomic(join(source, "reproduce.sh"), readText(repo.method.root, "templates/reproduce-film.sh"));
    atomic(join(source, "README.md"),
      `# Fuentes de la película\n\nMotor HyperFrames ${version}, Node 22.12+, Chrome y FFmpeg. Cada carpeta hyperframes/<capítulo> contiene una composición, los WAV ya sintetizados y las capturas que usa. Los guiones y storyboards están separados.\n\nEjecuta sh reproduce.sh /ruta/film.mp4 con las skills oficiales y la CLI configuradas. El resultado visual es reproducible con las fuentes incluidas. La codificación y fuentes del sistema pueden cambiar entre versiones.\n`);
    writeJson(join(source, "video-plan.json"), plan);

    const concat = join(temp, "concat.txt");
    atomic(concat, outputs.join("\n") + "\n");
    const movie = join(temp, "final.mp4");
    checked("ffmpeg", ["-v", "error", "-nostdin", "-y", "-f", "concat", "-safe", "1", "-i", concat,
      "-i", join(source, "captions.srt"), "-f", "ffmetadata", "-i", join(source, "chapters.ffmeta"),
      "-map", "0:v:0", "-map", "0:a:0", "-map", "1:s:0", "-map_chapters", "2", "-c:v", "copy", "-c:a", "copy",
      "-c:s", "mov_text", "-movflags", "+faststart", movie], { timeout: Math.max(60_000, index.durationMs) });
    inspectStreams(movie, index);
    assertAudible(movie);
    requireThat(videoInputs(repo).hash === inputs, "Los insumos cambiaron durante el render. Repite po handoff.");

    mkdirSync(repo.path(onboarding), { recursive: true });
    rmSync(repo.path(mediaReceipt), { force: true });
    publishDir(source, repo.path(sourceDir));
    copyFileSync(movie, repo.path(videoFile));
    writeJson(repo.path(chapterFile), index);
    atomic(repo.path(transcriptFile), transcript.join("\n"));
    atomic(repo.path(subtitleFile), srt);
    const receipt: MediaReceipt = {
      version: 1, renderer: "hyperframes", rendererVersion: version,
      nodeVersion: checked(process.env.AIPLC_NODE || "node", ["--version"]), ffmpegVersion,
      language: plan.language, tts: repo.config.tts!, inputs, video: fileDigest(repo.path(videoFile)),
      source: digest(inventory(repo.root, files(repo.root, sourceDir))), transcript: fileDigest(repo.path(transcriptFile)),
      subtitles: fileDigest(repo.path(subtitleFile)), chapters: fileDigest(repo.path(chapterFile)), checks,
    };
    writeJson(repo.path(mediaReceipt), receipt);
    inspectFilm(repo, phase);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

function inspectStreams(path: string, index: ChapterIndex): void {
  const info = probe(path);
  const duration = durationFor(info);
  requireThat(Math.abs(duration - index.durationMs) < 650 && info.format.format_name.split(",").includes("mp4") &&
    info.streams.some(stream => stream.codec_type === "video" && (stream.width ?? 0) >= 1920 && (stream.height ?? 0) >= 1080) &&
    info.streams.some(stream => stream.codec_type === "subtitle" && stream.codec_name === "mov_text") &&
    info.chapters?.length === index.chapters.length &&
    info.chapters.every((chapter, position) => {
      const expected = index.chapters[position];
      return chapter.tags?.title === expected.title && Math.abs(Number(chapter.start_time) * 1000 - expected.startMs) <= 80 &&
        Math.abs(Number(chapter.end_time) * 1000 - expected.endMs) <= 80;
    }),
  "MP4 inválido: se requieren video 1080p, voz, pista de subtítulos y capítulos reproducibles.");
}

export function inspectFilm(repo: Repository, phase: Phase): void {
  const receipt = repo.json<MediaReceipt>("media-receipt", mediaReceipt);
  const index = repo.json<ChapterIndex>("chapters", chapterFile);
  const plan = repo.json<FilmPlan>("video-plan", handoff + "/video-plan.json");
  requireThat(receipt.rendererVersion === hyperframesPin && receipt.language === plan.language && plan.language === index.language &&
    receipt.inputs === videoInputs(repo).hash && receipt.video === fileDigest(repo.path(videoFile)) &&
    receipt.source === digest(inventory(repo.root, files(repo.root, sourceDir))) &&
    receipt.transcript === fileDigest(repo.path(transcriptFile)) &&
    receipt.subtitles === fileDigest(repo.path(subtitleFile)) && receipt.chapters === fileDigest(repo.path(chapterFile)),
  "El video o sus insumos cambiaron. Renderiza la versión vigente con po handoff.");
  requireThat(phase.video!.categories.every(category => index.chapters.some(item => item.category === category)) &&
    index.chapters.length === plan.chapters.length && receipt.checks.length === plan.chapters.length &&
    index.durationMs === index.chapters.at(-1)?.endMs &&
    index.chapters.every((chapter, i) => chapter.id === plan.chapters[i].id && chapter.title === plan.chapters[i].title &&
      chapter.category === plan.chapters[i].category && chapter.startMs === (index.chapters[i - 1]?.endMs ?? 0) &&
      chapter.endMs > chapter.startMs && receipt.checks[i].chapter === chapter.id &&
      entry(repo.path(`${sourceDir}/hyperframes/${chapter.id}/index.html`))?.isFile() &&
      entry(repo.path(`${sourceDir}/checks/${chapter.id}.json`))?.isFile()),
  "Capítulos o fuentes audiovisuales incompletos.");
  const captions = readText(repo.root, subtitleFile);
  requireThat(captions.includes(" --> ") && captions === readText(repo.root, sourceDir + "/captions.srt") &&
    readText(repo.root, transcriptFile).includes("TTS"), "Faltan subtítulos o transcripción de la voz.");
  inspectStreams(repo.path(videoFile), index);
}
