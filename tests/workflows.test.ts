import { afterEach, expect, setDefaultTimeout, test } from "bun:test";
import { atomic, digest, run } from "../src/files";
import { complete, newState, start } from "../src/engine";
import { Lifecycle } from "../src/lifecycle";
import { audit, updateKnowledge } from "../src/knowledge";
import { onboarding, Repository, stateFiles, tag } from "../src/repository";
import { approved, confirmForTests, project, toHandoff, writeInputs } from "./fixtures";
import { join } from "node:path";

setDefaultTimeout(30_000);

const fixtures: ReturnType<typeof project>[] = [];
const setup = () => { const fixture = project(); fixtures.push(fixture); return fixture; };
afterEach(() => { for (const fixture of fixtures.splice(0)) fixture.cleanup(); });

test("pure engine enforces order and role without mutating inputs", () => {
  const fixture = setup();
  const workflow = fixture.po().repo.method.workflows.po;
  const origin = newState("demo", "po");
  const e = { type: "start" as const, actor: "po", at: "2026-11-27T00:00:00.000Z" };
  const before = digest(origin);
  expect(() => complete(origin, workflow, "hash", e)).toThrow("no está activo");
  const open = start(origin, e);
  expect(() => complete(open, { ...workflow, role: "dev" }, "hash", e)).toThrow("no está activo");
  expect(digest(origin)).toBe(before);
  expect(complete(open, workflow, "hash", e)).toEqual(complete(open, workflow, "hash", e));
});

test("CLI creates an isolated product layout and blocks premature or wrong-role commands", async () => {
  const p = setup();
  expect(p.rootEntries()).toEqual([".git", "AGENTS.md", "docs"]);
  expect(p.po().repo.has(stateFiles.dev)).toBe(false);
  await expect(p.dev().onboard()).rejects.toThrow("aún debe cerrar");
  await expect(new Lifecycle(p.dev().repo, p.keyPo).onboard()).rejects.toThrow("no corresponde al DEV");
  await expect(new Lifecycle(p.po().repo, p.keyDev).startPo()).rejects.toThrow("no corresponde al PO");
  await expect(p.po().handoff(false, false, () => {})).rejects.toThrow("no está activo");
  const cli = join(import.meta.dir, "../src/cli.ts");
  const response = run(process.execPath, [cli, "--repo", p.root, "--key", p.keyPo, "--json", "po", "start"]);
  expect(response.status).toBe(0);
  expect(JSON.parse(response.stdout).phase).toBe("discovery");
});

test("human approval is bound to reviewed bytes and reopening clears downstream gates", async () => {
  const p = setup();
  await p.po().startPo();
  writeInputs(p.po().repo, "po");
  await p.po().advance("po");
  writeInputs(p.po().repo, "po");
  await expect(p.po().advance("po")).rejects.toThrow("aprobación humana business");
  const cli = join(import.meta.dir, "../src/cli.ts");
  const nonInteractive = run(process.execPath, [cli, "--repo", p.root, "--key", p.keyPo,
    "po", "approve", "--note", approved]);
  expect(nonInteractive.status).toBe(2);
  expect(nonInteractive.stderr).toContain("terminal interactiva");

  await p.po().accept("po", approved, confirmForTests);
  const definition = p.po().repo.path("docs/aiplc/02-product-definition/product-definition.md");
  atomic(definition, "# Nuevo alcance\n\nEl documento cambió después de la firma.");
  await expect(p.po().advance("po")).rejects.toThrow("desactualizada");
  await p.po().accept("po", approved, confirmForTests);
  await p.po().advance("po");
  await p.po().revise("discovery", "Existe evidencia que requiere revisar el problema.");
  expect(p.po().repo.state("po").completed).toHaveLength(0);
  expect(p.po().repo.state("po").approvals).toHaveLength(0);
});

test("required traceability rejects unresolved testing and unlinked growth changes", async () => {
  const p = setup();
  await p.po().startPo();
  const repo = p.po().repo;
  for (const phase of repo.method.workflows.po.phases.slice(0, 6)) {
    writeInputs(p.po().repo, "po");
    if (phase.gate) await p.po().accept("po", approved, confirmForTests);
    await p.po().advance("po");
  }
  writeInputs(repo, "po");
  const report = repo.path("docs/aiplc/07-validation/validation-results.json");
  atomic(report, JSON.stringify({ results: [{ test: "T1", outcome: "planned", evidence: approved }], openIssues: [] }));
  await expect(p.po().advance("po")).rejects.toThrow("debe pasar");
  writeInputs(repo, "po");
  await p.po().advance("po");
  writeInputs(repo, "po");
  const commercial = "docs/aiplc/08-go-to-market/commercial-plan.json";
  const data = repo.json<object>("commercial-plan", commercial);
  atomic(repo.path(commercial), JSON.stringify({ ...data, growthRequirements: ["UNKNOWN"] }));
  await expect(p.po().accept("po", approved, confirmForTests)).rejects.toThrow("requisitos de growth");
});

test("absent voice and absent credentials block real handoff and leave no tag", async () => {
  const p = setup();
  await toHandoff(p);
  await expect(p.po().handoff(false, false, () => {})).rejects.toThrow("Video bloqueado");
  const repo = p.po().repo;
  expect(repo.has(onboarding + "/product-pitch-deck.pptx")).toBe(true);
  expect(repo.has(onboarding + "/product-walkthrough.mp4")).toBe(false);
  await expect(p.po().accept("po", approved, confirmForTests)).rejects.toThrow("product-walkthrough.mp4");
  expect(repo.state("po").status).toBe("ACTIVE");
  expect(repo.git(["tag", "--list", tag])).toBe("");
  const previous = process.env.AIPLC_TTS_BIN;
  process.env.AIPLC_TTS_BIN = "/usr/bin/true";
  try {
    await p.po().configure({ tts: { provider: "command", voice: "narrador", credentialEnv: "AIPLC_TEST_MISSING_CREDENTIAL" } });
    await expect(p.po().handoff(false, false, () => {})).rejects.toThrow("Falta la credencial");
  } finally {
    if (previous === undefined) delete process.env.AIPLC_TTS_BIN;
    else process.env.AIPLC_TTS_BIN = previous;
  }
});

test("knowledge update checks role, keeps provenance and detects direct drift", async () => {
  const p = setup();
  writeInputs(p.po().repo, "po");
  const from = join(p.temp, "new.md");
  atomic(from, "# Cambio de alcance\n\nNueva evidencia para la definición.");
  const origin = "docs/aiplc/01-discovery/brief.md";
  await expect(updateKnowledge(p.dev(), "business", "revision.md", from, origin, approved, true, "dev", confirmForTests))
    .rejects.toThrow("rol no puede");
  await expect(updateKnowledge(p.dev(), "technical", "proposal.md", from, origin, approved, false, "dev", confirmForTests))
    .rejects.toThrow("aún debe cerrar");
  await updateKnowledge(p.po(), "business", "revision.md", from, origin, approved, true, "po", confirmForTests);
  expect(audit(p.po().repo).issues).toHaveLength(0);
  atomic(p.po().repo.path("docs/business/revision.md"), "# Cambio sin registro");
  expect(audit(p.po().repo).issues.join("\n")).toContain("difiere");
});

test.skipIf(process.env.AIPLC_TEST_MEDIA !== "1")("real HyperFrames → Git handoff → cloned DEV onboarding and readiness", async () => {
  const p = setup();
  await p.po().configure({ tts: { provider: "say", voice: process.env.AIPLC_TEST_VOICE || "Paulina" } });
  await toHandoff(p);
  const packageResult = await p.po().handoff(true, false, console.log);
  expect(packageResult.status).toBe("AWAITING_REVIEW");
  const awaiting = p.po().repo;
  const movie = awaiting.path(onboarding + "/product-walkthrough.mp4");
  expect(awaiting.has(onboarding + "/product-walkthrough.mp4")).toBe(true);
  const frame = (time: string) => run("ffmpeg", ["-hide_banner", "-v", "error", "-ss", time, "-i", movie,
    "-frames:v", "1", "-an", "-f", "framemd5", "-"]).stdout.trim().split(",").at(-1);
  expect(frame("0.15")).toMatch(/^[0-9a-f\s]{32,}$/);
  expect(frame("0.15")).not.toEqual(frame("1.25"));
  expect(awaiting.git(["tag", "--list", tag])).toBe("");
  await p.po().accept("po", approved, confirmForTests);
  expect((await p.po().handoff(false, false, console.log)).status).toBe("AWAITING_DEV");
  await expect(p.po().revise("discovery", approved)).rejects.toThrow("no está activo");

  const clone = join(p.temp, "clonado");
  expect(run("git", ["clone", "--quiet", p.root, clone]).status).toBe(0);
  const repo = new Repository(clone);
  const po = new Lifecycle(repo, p.keyPo);
  const dev = new Lifecycle(repo, p.keyDev);
  await expect(new Lifecycle(repo, p.keyPo).onboard()).rejects.toThrow("no corresponde al DEV");
  expect((await dev.onboard()).status).toBe("ACTIVE");
  await expect(dev.advance("dev")).rejects.toThrow("Completa");
  await expect(dev.acknowledge("video-briefing", approved, confirmForTests)).rejects.toThrow("siguiente paso es welcome");
  const phase = repo.method.workflows.dev.phases[0];
  for (const step of phase.checklist!) await dev.acknowledge(step.id, approved, confirmForTests);
  const question = await dev.clarify("¿Cuándo se considera confirmado un pedido?",
    "docs/aiplc/06-specifications/functional-spec.md", true);
  writeInputs(repo, "dev");
  await expect(dev.accept("dev", approved, confirmForTests)).rejects.toThrow("aclaración bloqueante");
  await po.answer(question.id, "Cuando el prototipo muestra la confirmación fijada en el alcance.", confirmForTests);
  await dev.accept("dev", approved, confirmForTests);
  await dev.advance("dev");
  for (const techPhase of repo.method.workflows.dev.phases.slice(1)) {
    writeInputs(repo, "dev");
    if (!techPhase.final) await dev.advance("dev");
  }
  expect((await dev.accept("dev", approved, confirmForTests, true)).status).toBe("READY");
  expect(audit(repo).issues).toHaveLength(0);
  const source = repo.path(onboarding + "/video-source");
  const reproduced = join(p.temp, "film-reproduced.mp4");
  const reproduction = run("sh", [join(source, "reproduce.sh"), reproduced], { cwd: source, timeout: 160_000 });
  if (reproduction.status !== 0) throw new Error(reproduction.stderr.slice(-4000) || reproduction.stdout.slice(-4000));
  const replay = run("ffprobe", ["-v", "error", "-show_streams", "-show_chapters", "-of", "json", reproduced]);
  expect(replay.status).toBe(0);
  const media = JSON.parse(replay.stdout);
  expect(media.chapters).toHaveLength(4);
  expect(media.streams.map((stream: { codec_type: string }) => stream.codec_type))
    .toEqual(expect.arrayContaining(["video", "audio", "subtitle"]));
  expect(audit(repo).issues).toHaveLength(0);
  atomic(repo.path("docs/aiplc/01-discovery/brief.md"), "# Modificado\n\nNo coincide con el commit sellado.");
  expect(() => dev.status("dev")).toThrow("línea base histórica fue modificada");
}, 360_000);
