import JSZip from "jszip";
import { readFileSync } from "node:fs";
import { activePhase } from "./engine";
import { Blocked, digest, entry, files, inventory, readText, requireThat } from "./files";
import { questionDigest, verifyReceipt } from "./identity";
import type { Briefing, FilmPlan, Flows, Phase, Requirements, Role, State, TestCases, TestResults, Tokens } from "./model";
import { artifactManifest, baseline, handoff, onboarding, Repository, stateFiles, taggedManifest } from "./repository";
import { inspectFilm, videoInputs } from "./video";

export const draft = "<!-- AIPLC: BORRADOR -->";
export const ux = baseline + "/05-ux-ui";
export const spec = baseline + "/06-specifications";
export const qa = baseline + "/07-validation";
export const creative = baseline + "/04-brand-creative";
export const gtm = baseline + "/08-go-to-market";

export function unique<T extends { id: string }>(records: T[], label: string): Map<string, T> {
  const result = new Map(records.map(record => [record.id, record]));
  requireThat(result.size === records.length, `Hay identificadores repetidos en ${label}.`);
  return result;
}

function nonDraft(content: string, path: string): void {
  requireThat(!content.includes(draft) && content.trim().length >= 24, `Completa el contenido de ${path}.`);
}

function derivedSnapshot(repo: Repository, folder: string, names: string[]): string {
  return digest(inventory(repo.root, names.map(name => folder + "/" + name)));
}

export function snapshot(repo: Repository, phase: Phase, state: State): string {
  const names = phase.final === "seal" ? [
    "AGENTS.md",
    ...files(repo.root, baseline).filter(path => ![artifactManifest, stateFiles.po, taggedManifest].includes(path)),
  ] : phase.artifacts.flatMap(artifact => files(repo.root, phase.folder + "/" + artifact.path));
  const evidence = (phase.checklist || phase.final === "ready") ? {
    baseline: state.baselineDigest,
    checklist: phase.checklist ? state.checklist : undefined,
  } : undefined;
  return digest({ phase: phase.id, prior: state.completed.slice(0,
    repo.method.workflows[state.role].phases.findIndex(item => item.id === phase.id)),
  files: inventory(repo.root, names), evidence });
}

function proof(repo: Repository, state: State, phase: Phase, current: string): void {
  if (!phase.gate) return;
  const approval = state.approvals.find(item => item.phase === phase.id && item.gate === phase.gate);
  requireThat(approval, `Falta la aprobación humana ${phase.gate}.`);
  verifyReceipt(repo.config, approval.receipt, state.role, "gate:" + phase.gate, current);
}

export function verifyCompleted(repo: Repository, state: State): void {
  for (const completed of state.completed) {
    const phase = repo.method.workflows[state.role].phases.find(item => item.id === completed.phase)!;
    const current = snapshot(repo, phase, state);
    requireThat(current === completed.digest,
      `Cambió un artefacto de ${phase.id}. ${state.role === "po" ? "Usa po revise en la primera fase afectada." : "Restaura el insumo antes de continuar la preparación."}`);
    proof(repo, state, phase, current);
  }
}

async function inspectArtifact(repo: Repository, phase: Phase, artifact: Phase["artifacts"][number]): Promise<void> {
  const path = phase.folder + "/" + artifact.path;
  const stat = entry(repo.path(path));
  requireThat(stat, `Falta ${path}.`);
  if (artifact.type === "dir") {
    requireThat(stat.isDirectory() && files(repo.root, path).length > 0, `Directorio vacío o inválido: ${path}.`);
    return;
  }
  requireThat(stat.isFile() && stat.size > 0, `Archivo vacío o inválido: ${path}.`);
  if (artifact.type === "json") {
    const data = repo.json<Record<string, unknown>>(artifact.schema!, path);
    if (artifact.schema === "research") {
      const sources = data.sources as { id: string; url: string; accessedOn: string }[];
      unique(sources, path);
      requireThat(new Set(sources.map(item => canonicalUrl(item.url))).size >= 2, `Se requieren dos fuentes distintas en ${path}.`);
      sources.forEach(item => date(item.accessedOn));
    }
  }
  if (artifact.type === "md") nonDraft(readText(repo.root, path), path);
  if (artifact.type === "html") {
    const html = readText(repo.root, path);
    requireThat(/<!doctype html|<html[\s>]/i.test(html) && /<(a|button|input|script|form)\b/i.test(html),
      `Se necesita un prototipo navegable en ${path}.`);
  }
  if (artifact.type === "pptx") {
    const archive = await JSZip.loadAsync(readFileSync(repo.path(path))).catch(() => undefined);
    requireThat(archive?.file("[Content_Types].xml") && archive.file("ppt/presentation.xml") &&
      archive.file(/^ppt\/slides\/slide\d+\.xml$/).length >= 3, `PowerPoint incompleto: ${path}.`);
  }
}

function canonicalUrl(value: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Blocked(`URL inválida: ${value}`); }
  requireThat(url.hostname.includes(".") && !/(?:^|\.)(?:example|invalid|test|localhost)(?:\.|$)/i.test(url.hostname),
    `La fuente debe ser pública y real: ${url.hostname}`);
  url.hash = "";
  url.search = "";
  return url.href.replace(/\/$/, "");
}

function date(value: string): void {
  const parsed = new Date(value);
  requireThat(!Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value) && parsed.getTime() <= Date.now(),
    `Fecha de consulta inválida: ${value}`);
}

function png(repo: Repository, path: string): void {
  const data = readFileSync(repo.path(path));
  requireThat(data.length >= 40 && data.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) &&
    data.readUInt32BE(16) >= 320 && data.readUInt32BE(20) >= 180 &&
    data.subarray(-8, -4).toString() === "IEND", `Se necesita una captura PNG legible: ${path}.`);
}

function creativeCheck(repo: Repository): void {
  const research = repo.json<{
    references: { id: string; url: string; asset: string; accessedOn: string }[];
    directions: { id: string; referenceIds: string[]; moodboard: string }[];
  }>("visual-research", creative + "/visual-research.json");
  const selection = repo.json<{ selected: string; participant: string; rejected: { id: string }[] }>(
    "creative-direction", creative + "/direction.json");
  const refs = unique(research.references, "referencias");
  const directions = unique(research.directions, "direcciones");
  requireThat(new Set(research.references.map(ref => canonicalUrl(ref.url))).size >= 3,
    "La investigación necesita tres referencias reales distintas.");
  requireThat(new Set(research.references.map(ref => ref.asset)).size === refs.size &&
    new Set(research.directions.map(item => item.moodboard)).size === directions.size,
  "Cada referencia o dirección debe tener su propio recurso visual.");
  for (const ref of refs.values()) {
    date(ref.accessedOn);
    requireThat(ref.asset.startsWith("references/"), "Conserva capturas en references/.");
    png(repo, creative + "/" + ref.asset);
  }
  for (const direction of directions.values()) {
    requireThat(direction.moodboard.startsWith("moodboards/") && direction.referenceIds.every(id => refs.has(id)),
      "Moodboard o fuentes sin trazabilidad.");
    png(repo, creative + "/" + direction.moodboard);
  }
  requireThat(selection.participant === repo.config.roles.po.id && directions.has(selection.selected),
    "Registra la última dirección y la participación del PO inscrito.");
  const rejected = unique(selection.rejected, "direcciones descartadas");
  requireThat(rejected.size === directions.size - 1 &&
    [...rejected.keys()].every(id => id !== selection.selected && directions.has(id)),
  "Registra por qué se descartó cada alternativa.");
  const tokens = repo.json<Tokens>("design-tokens", creative + "/design-tokens.json");
  const luminance = (hex: string) => [1, 3, 5].map(pos => parseInt(hex.slice(pos, pos + 2), 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a: string, b: string) => {
    const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  requireThat(contrast(tokens.text, tokens.background) >= 4.5 && contrast(tokens.text, tokens.surface) >= 4.5,
    "El color de texto debe alcanzar contraste 4.5:1 sobre fondo y superficie.");
}

export function flowAssets(repo: Repository): Set<string> {
  const data = repo.json<Flows>("flows", ux + "/flows.json");
  unique(data.flows, "flujos UX");
  const shots = data.flows.flatMap(flow => flow.screenshots);
  shots.forEach(path => {
    requireThat(path.startsWith("walkthrough/"), "Conserva las capturas del prototipo en walkthrough/.");
    png(repo, ux + "/" + path);
  });
  return new Set(shots.map(path => ux + "/" + path));
}

function requirements(repo: Repository) {
  const reqs = unique(repo.json<Requirements>("requirements", spec + "/requirements.json").requirements, "requisitos");
  const flows = unique(repo.json<Flows>("flows", ux + "/flows.json").flows, "flujos UX");
  for (const req of reqs.values()) {
    requireThat(req.source.startsWith(baseline + "/") && entry(repo.path(req.source))?.isFile() &&
      !req.source.startsWith(handoff), `El requisito ${req.id} necesita una fuente de definición existente.`);
    requireThat(req.flows.every(flow => flows.has(flow)), `${req.id} referencia un flujo inexistente.`);
  }
  return reqs;
}

function validation(repo: Repository): void {
  const reqs = requirements(repo);
  const tests = unique(repo.json<TestCases>("test-cases", qa + "/test-cases.json").cases, "casos de prueba");
  const outcomes = repo.json<TestResults>("validation-results", qa + "/validation-results.json");
  const results = new Map(outcomes.results.map(result => [result.test, result]));
  requireThat(results.size === tests.size && results.size === outcomes.results.length && [...results.keys()].every(id => tests.has(id)),
    "Cada prueba debe tener exactamente un resultado.");
  for (const test of tests.values()) {
    const req = reqs.get(test.requirement);
    requireThat(req && test.criteria.every(index => index <= req.acceptance.length), `La prueba ${test.id} apunta a requisitos o criterios inexistentes.`);
    const result = results.get(test.id)!;
    requireThat(test.kind !== "prototype" || result.outcome === "pass", `La prueba de prototipo ${test.id} debe pasar.`);
    requireThat(result.outcome !== "fail", `La prueba ${test.id} reporta una falla sin resolver.`);
  }
  for (const req of reqs.values()) {
    requireThat(req.acceptance.every((_, index) => [...tests.values()].some(
      test => test.requirement === req.id && test.criteria.includes(index + 1))),
    `Hay criterios de ${req.id} sin una prueba enlazada.`);
  }
  unique(outcomes.openIssues, "problemas abiertos");
  requireThat(!outcomes.openIssues.some(issue => issue.blocking), "Hay problemas bloqueantes sin resolver en la validación.");
}

function commercial(repo: Repository): void {
  const plan = repo.json<{
    recommendation: string; alternatives: { id: string }[];
    phases: { id: string }[]; humanTasks: { id: string; phase: string; materials: string[]; dependencies: string[] }[];
    experiments: { id: string; cost: number }[]; budget: { monthly: number }; growthRequirements: string[];
  }>("commercial-plan", gtm + "/commercial-plan.json");
  requireThat(unique(plan.alternatives, "alternativas comerciales").has(plan.recommendation),
    "La recomendación comercial debe identificar una alternativa evaluada.");
  const phases = ["prelaunch", "launch", "growth"];
  requireThat(plan.phases.every((phase, i) => phase.id === phases[i]), "Se requieren exactamente prelaunch, launch y growth en ese orden.");
  const tasks = unique(plan.humanTasks, "tareas PO");
  requireThat(phases.every(phase => plan.humanTasks.some(task => task.phase === phase)),
    "Cada fase comercial debe tener tareas humanas concretas del PO.");
  for (const task of tasks.values()) {
    requireThat(task.dependencies.every(id => id !== task.id && tasks.has(id)) &&
      task.materials.every(path => path.startsWith(baseline + "/") && entry(repo.path(path))?.isFile()),
    `Dependencia o material inválido en ${task.id}.`);
  }
  const visit = (id: string, ancestors = new Set<string>()): void => {
    requireThat(!ancestors.has(id), `Hay un ciclo en las dependencias de ${id}.`);
    for (const dependency of tasks.get(id)!.dependencies) visit(dependency, new Set([...ancestors, id]));
  };
  for (const id of tasks.keys()) visit(id);
  unique(plan.experiments, "experimentos");
  const all = requirements(repo);
  requireThat(plan.growthRequirements.every(id => all.get(id)?.flows.length),
    "Los requisitos de growth aprobados deben aparecer en las especificaciones con flujos y pruebas. Revisa la primera fase afectada.");
}

export function inspectBriefing(repo: Repository): Briefing {
  const brief = repo.json<Briefing>("briefing", handoff + "/briefing.json");
  const requiredForDeck = { pitch: [baseline + "/02-product-definition/", gtm + "/"], product: [ux + "/", spec + "/"], marketing: [gtm + "/"] };
  for (const [kind, slides] of Object.entries(brief.decks)) {
    const references = slides.flatMap(slide => slide.sources);
    requireThat(references.every(path => path.startsWith(baseline + "/") && !path.startsWith(handoff) &&
      entry(repo.path(path))?.isFile()) && requiredForDeck[kind as keyof typeof requiredForDeck]
      .every(prefix => references.some(path => path.startsWith(prefix))),
    `Las fuentes del deck ${kind} deben enlazar la definición que presenta.`);
  }
  return brief;
}

export function inspectPlan(repo: Repository, phase: Phase): FilmPlan {
  const inputs = videoInputs(repo);
  const plan = repo.json<FilmPlan>("video-plan", handoff + "/video-plan.json");
  requireThat(plan.language === repo.config.language, "El idioma del guion debe coincidir con el idioma configurado.");
  const evidence: Record<string, string[]> = {
    product: [spec + "/", baseline + "/02-product-definition/"],
    prototype: [ux + "/"], business: [baseline + "/02-product-definition/", baseline + "/01-discovery/"], marketing: [gtm + "/"],
  };
  const allowedFigures = flowAssets(repo);
  unique(plan.chapters, "capítulos de video");
  requireThat(phase.video!.categories.every(category => plan.chapters.some(chapter => chapter.category === category)),
    "El video debe cubrir producto, prototipo, negocio y marketing.");
  for (const chapter of plan.chapters) {
    requireThat(chapter.sources.every(path => inputs.paths.has(path)) &&
      (!evidence[chapter.category] || chapter.sources.some(path => evidence[chapter.category].some(prefix => path.startsWith(prefix)))),
    `Fuentes de contenido incompletas en el capítulo ${chapter.id}.`);
    requireThat(chapter.category !== "prototype" || chapter.scenes.some(scene => scene.layout === "prototype"),
      `El capítulo ${chapter.id} requiere un recorrido visual real.`);
    for (const scene of chapter.scenes) {
      requireThat(scene.layout !== "prototype" || (scene.image && scene.focus && allowedFigures.has(scene.image)),
        `Vincula una captura aprobada del prototipo y su foco en ${scene.title}.`);
      if (scene.image) requireThat(allowedFigures.has(scene.image), `La captura debe venir del flujo UX aprobado: ${scene.image}`);
    }
  }
  return plan;
}

function checksOnboarding(repo: Repository, phase: Phase, state: State): void {
  requireThat(state.checklist.length === phase.checklist!.length, "Completa todos los pasos del onboarding antes de pedir aprobación.");
  requireThat(state.baselineDigest, "Falta el hash de la entrega recibida.");
  const sealed = repo.verifyHandoff();
  requireThat(sealed.digest === state.baselineDigest, "El DEV inició con una línea base distinta.");
  for (const [index, item] of phase.checklist!.entries()) {
    verifyReceipt(repo.config, state.checklist[index], "dev", "onboard:" + item.id, checklistDigest(repo, item, sealed.digest));
  }
  checkClarifications(repo, state);
}

export function checklistDigest(repo: Repository, item: { id: string; resources: string[] }, baselineDigest: string) {
  // The signed digest binds sealed files and the resource paths. Mutable living files may evolve during onboarding.
  return digest({ baseline: baselineDigest, item: item.id, resources: inventory(repo.root,
    item.resources.filter(path => path.startsWith(baseline + "/"))), references: item.resources });
}

export function checkClarifications(repo: Repository, state: State): void {
  for (const question of state.clarifications) {
    if (question.answer) verifyReceipt(repo.config, question.answer, "po", "answer:" + question.id, questionDigest(question));
    else requireThat(!question.blocking, `Falta aclaración bloqueante ${question.id} del PO.`);
  }
}

export async function validatePhase(repo: Repository, role: Role, state: State, requireApproval: boolean): Promise<string> {
  const phase = activePhase(state, repo.method.workflows[role]);
  verifyCompleted(repo, state);
  if (phase.check === "onboarding") checksOnboarding(repo, phase, state);
  const problems: string[] = [];
  for (const artifact of phase.artifacts) {
    try { await inspectArtifact(repo, phase, artifact); }
    catch (error) { problems.push((error as Error).message); }
  }
  requireThat(!problems.length, problems.join("\n"));
  switch (phase.check) {
    case "creative": creativeCheck(repo); break;
    case "ux": flowAssets(repo); break;
    case "specifications": requirements(repo); break;
    case "validation": validation(repo); break;
    case "gtm": commercial(repo); break;
    case "handoff": {
      inspectBriefing(repo);
      inspectPlan(repo, phase);
      inspectFilm(repo, phase);
      const packageReceipt = repo.json<{ inputs: string; files: string }>("package-receipt", handoff + "/package-receipt.json");
      requireThat(packageReceipt.inputs === handoffPackageInputs(repo) && packageReceipt.files === handoffPackageFiles(repo),
        "Los resúmenes, presentaciones o prototipo quedaron desactualizados. Repite po handoff.");
      break;
    }
  }
  if (phase.final === "ready") checkClarifications(repo, state);
  const current = snapshot(repo, phase, state);
  if (requireApproval) proof(repo, state, phase, current);
  return current;
}

export const summaries = ["executive", "business", "product", "critical"] as const;
export const summaryFiles = ["executive-summary.md", "business-summary.md", "product-summary.md", "critical-requirements.md"];
export const decks = ["pitch", "product", "marketing"] as const;
export const deckFiles = ["product-pitch-deck.pptx", "product-presentation.pptx", "marketing-presentation.pptx"];

export function handoffPackageInputs(repo: Repository): string {
  return digest({
    briefing: readText(repo.root, handoff + "/briefing.json"),
    design: readText(repo.root, creative + "/design-tokens.json"),
    prototype: inventory(repo.root, files(repo.root, ux + "/prototype")),
  });
}

export function handoffPackageFiles(repo: Repository): string {
  return digest([
    derivedSnapshot(repo, onboarding, ["START-HERE.md", ...summaryFiles, ...deckFiles]),
    inventory(repo.root, files(repo.root, handoff + "/prototype")),
  ]);
}
