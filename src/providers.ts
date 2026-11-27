import { accessSync, constants, existsSync, lstatSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { atomic, checked, requireThat, run, runLong, temporary } from "./files";
import type { TtsConfig } from "./model";

export const hyperframesPin = "0.9.104";
export const officialSkills = ["hyperframes", "hyperframes-cli", "hyperframes-registry", "media-use"];

export interface Command { executable: string; initial: string[] }
export interface Check { name: string; ok: boolean; detail: string; required: boolean }

function executable(path: string): boolean {
  try {
    accessSync(path, constants.X_OK);
    return lstatSync(path).isFile() || lstatSync(path).isSymbolicLink();
  } catch { return false; }
}

export function pathFor(program: string): string | undefined {
  return isAbsolute(program) ? (executable(program) ? program : undefined) : Bun.which(program) ?? undefined;
}

function skillRoot(): string | undefined {
  const configured = process.env.AIPLC_HYPERFRAMES_SKILLS;
  const paths = configured ? [configured] : [join(homedir(), ".agents", "skills")];
  return paths.find(path => isAbsolute(path) &&
    officialSkills.every(skill => existsSync(join(path, skill, "SKILL.md"))));
}

export function mediaEnv(): NodeJS.ProcessEnv {
  const keep = /^(PATH|HOME|USER|LOGNAME|TMPDIR|TMP|TEMP|SHELL|LANG|LC_[A-Z_]+|XDG_[A-Z_]+|SSL_CERT_(FILE|DIR)|HTTPS?_PROXY|NO_PROXY|npm_config_cache|NPM_CONFIG_CACHE|AIPLC_TMP_DIR|HYPERFRAMES_CACHE_DIR|HYPERFRAMES_EXTRACT_CACHE_DIR|PRODUCER_BROWSER_EXECUTABLE_PATH|PUPPETEER_EXECUTABLE_PATH)$/;
  return {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => keep.test(key))),
    HYPERFRAMES_NO_TELEMETRY: "1",
    DO_NOT_TRACK: "1",
  };
}

function nodeInfo() {
  const node = pathFor(process.env.AIPLC_NODE || "node");
  const version = node ? run(node, ["--version"]).stdout.trim() : "";
  const [major, minor] = version.replace(/^v/, "").split(".").map(Number);
  return { node, version, ok: major > 22 || (major === 22 && minor >= 12) };
}

export function hyperframes(): Command {
  const root = skillRoot();
  requireThat(root, "Faltan las skills oficiales de HyperFrames. Configura AIPLC_HYPERFRAMES_SKILLS.");
  const { node, ok } = nodeInfo();
  requireThat(node && ok, "HyperFrames requiere Node.js 22.12 o superior. Configura AIPLC_NODE o PATH.");
  const direct = process.env.AIPLC_HYPERFRAMES_BIN;
  if (direct) {
    requireThat(isAbsolute(direct) && pathFor(direct), "AIPLC_HYPERFRAMES_BIN debe apuntar a la CLI oficial instalada.");
    return { executable: direct, initial: [] };
  }
  const launcher = join(root, "hyperframes", "scripts", "plugin-cli.mjs");
  requireThat(existsSync(launcher), "Las skills de HyperFrames necesitan el launcher oficial de una versión compatible.");
  return { executable: node, initial: [launcher, "--cli-version", hyperframesPin] };
}

export async function callHyperframes(command: Command, args: string[], cwd: string, timeout?: number) {
  const env = mediaEnv();
  const { node } = nodeInfo();
  if (node) env.PATH = join(node, "..") + (process.platform === "win32" ? ";" : ":") + (env.PATH || "");
  return runLong(command.executable, [...command.initial, ...args], { cwd, env, timeout });
}

export async function assertHyperframesVersion(command: Command, cwd: string): Promise<string> {
  const result = await callHyperframes(command, ["--version"], cwd, 90_000);
  const actual = result.stdout.trim();
  requireThat(result.code === 0 && new RegExp(`(?:^|\\s)${hyperframesPin.replaceAll(".", "\\.")}(?:\\s|$)`).test(actual),
    `Se requiere HyperFrames ${hyperframesPin}. ${result.stderr.trim().slice(-600) || actual || "La CLI no respondió."}`);
  return hyperframesPin;
}

export function ttsCheck(config: TtsConfig | undefined, language: string, probe = false): Check {
  const result = (ok: boolean, detail: string): Check => ({ name: "TTS", ok, detail, required: true });
  if (!config) return result(false, "Configura una voz real con config --tts say|command --voice NOMBRE.");
  if (config.provider === "say") {
    if (process.platform !== "darwin" || !pathFor("/usr/bin/say")) return result(false, "say requiere macOS.");
    const list = run("/usr/bin/say", ["-v", "?"]);
    const voices = list.stdout.split("\n").flatMap(line => {
      const match = line.match(/^(.*?)\s+([a-z]{2,3}[-_][A-Z]{2})\s+#/);
      return match ? [{ name: match[1].trim(), locale: match[2].replace("_", "-") }] : [];
    });
    const primary = language.split("-")[0].toLowerCase();
    const voice = voices.find(candidate => candidate.name === config.voice && candidate.locale.split("-")[0] === primary);
    if (!voice) return result(false, `No se encontró la voz ${config.voice} para ${language}; consulta say -v '?'.`);
    if (probe) {
      const dir = temporary("voice");
      try {
        const text = join(dir, "check.txt");
        const audio = join(dir, "check.aiff");
        atomic(text, "Closelly AI PLC.\n");
        synthesize(config, language, text, audio);
        const duration = run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", audio]);
        if (duration.status !== 0 || !(Number(duration.stdout.trim()) > 0)) {
          return result(false, "say no devolvió audio. Ejecuta desde una terminal con acceso a los servicios de voz de macOS.");
        }
      } catch {
        return result(false, "No se pudo sintetizar la frase de diagnóstico con say.");
      } finally { rmSync(dir, { recursive: true, force: true }); }
    }
    return result(true, `say · ${voice.name} (${voice.locale})${probe ? " · síntesis comprobada" : ""}`);
  }
  const binary = process.env.AIPLC_TTS_BIN;
  if (!binary || !isAbsolute(binary) || !pathFor(binary)) return result(false, "Configura AIPLC_TTS_BIN con un proveedor TTS instalado.");
  if (config.credentialEnv && !process.env[config.credentialEnv]) {
    return result(false, `Falta la credencial ${config.credentialEnv}.`);
  }
  if (probe) {
    const check = run(binary, ["--check", "--voice", config.voice, "--language", language],
      { env: ttsEnv(config), timeout: 30_000 });
    if (check.status !== 0) return result(false, "El proveedor TTS rechazó la comprobación de voz o credenciales.");
  }
  return result(true, probe ? "Proveedor externo comprobado." : "Proveedor externo configurado (credencial no verificada).");
}

function ttsEnv(config: TtsConfig): NodeJS.ProcessEnv {
  const env = mediaEnv();
  if (config.credentialEnv) env[config.credentialEnv] = process.env[config.credentialEnv];
  return env;
}

export function synthesize(config: TtsConfig, language: string, input: string, output: string): void {
  if (config.provider === "say") {
    checked("/usr/bin/say", ["-v", config.voice, "-f", input, "-o", output], { timeout: 45_000 });
    return;
  }
  const result = run(process.env.AIPLC_TTS_BIN!, ["--input", input, "--output", output, "--voice", config.voice,
    "--language", language], { env: ttsEnv(config), timeout: 90_000 });
  requireThat(result.status === 0, "El proveedor no pudo sintetizar la narración. Revisa su voz, conexión o credenciales.");
}

export function locateChrome() {
  const configured = process.env.PRODUCER_BROWSER_EXECUTABLE_PATH ?? process.env.PUPPETEER_EXECUTABLE_PATH;
  if (configured) return pathFor(configured);
  return [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome", "chromium", "chromium-browser", "chrome",
  ].map(pathFor).find(Boolean);
}

export async function doctor(cwd: string, language: string, tts: TtsConfig | undefined, probe: boolean, core: boolean): Promise<Check[]> {
  const node = nodeInfo();
  const checkProgram = (name: string, required = true, args = ["--version"]): Check => {
    const location = pathFor(name);
    const result = location && run(location, args);
    return { name, ok: !!result && result.status === 0,
      detail: result && result.status === 0 ? result.stdout.split("\n")[0] : "No disponible en PATH.", required };
  };
  const checks: Check[] = [
    { name: "Bun", ok: !!Bun.version, detail: Bun.version, required: true },
    checkProgram("git"),
    { name: "OpenSSH", ok: !!pathFor("ssh-keygen") && !!pathFor("ssh"), detail: "ssh-keygen -Y (firmas SSH Ed25519; usa OpenSSH 8.2+).", required: true },
    checkProgram("codex", false),
    { name: "Capacidades del harness", ok: true, detail: "Comprueba navegación web, capturas, diseño e interacción en el chat. La CLI no puede inspeccionar tus herramientas del chat.", required: false },
  ];
  if (core) return checks;
  checks.push({ name: "Node.js", ok: node.ok, detail: node.version || "Falta Node.js 22.12+.", required: true });
  checks.push(checkProgram("ffmpeg", true, ["-version"]), checkProgram("ffprobe", true, ["-version"]));
  const chrome = locateChrome();
  const browser: Check = { name: "Chrome y captura", ok: !!chrome, detail: chrome || "Instala Chrome/Chromium o ejecuta el doctor oficial.", required: true };
  checks.push(browser);
  const skills = skillRoot();
  checks.push({ name: "Skills oficiales", ok: !!skills, detail: skills || officialSkills.join(", "), required: true });
  checks.push(ttsCheck(tts, language, probe));
  const renderer: Check = { name: "HyperFrames", ok: false, detail: "", required: true };
  checks.push(renderer);
  try {
    const command = hyperframes();
    renderer.ok = true;
    renderer.detail = `Versión requerida ${hyperframesPin}. Ejecuta doctor --probe para verificar la CLI y el navegador.`;
    if (probe) {
      renderer.detail = await assertHyperframesVersion(command, cwd);
      const result = await callHyperframes(command, ["doctor", "--json"], cwd, 90_000);
      const report = JSON.parse(result.stdout) as { checks: { name: string; ok: boolean; detail: string }[] };
      const found = report.checks.find(item => item.name === "Chrome");
      browser.ok = !!found?.ok;
      browser.detail = found?.detail || "HyperFrames no localizó Chrome.";
    }
  } catch (error) {
    renderer.ok = false;
    renderer.detail = (error as Error).message;
  }
  return checks;
}
