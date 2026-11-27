import { readFileSync, rmSync } from "node:fs";
import { absoluteFile, assertShareable, atomic, digest, entry, files, fileDigest, readJson, requireThat, safeRelative, writeJson } from "./files";
import { type Confirm, Lifecycle, nonEmpty } from "./lifecycle";
import type { Receipt, Role } from "./model";
import { baseline, living, Repository, stateFiles } from "./repository";
import { verifyReceipt } from "./identity";

interface Change {
  path: string;
  source: string;
  content: string;
  scopeChange: boolean;
  proof: Receipt;
}
type Area = keyof typeof living;
const areas = Object.keys(living) as Area[];

function changes(repo: Repository, area: Area): Change[] {
  const log = `docs/${area}/.aiplc-knowledge.json`;
  if (!repo.has(log)) return [];
  const data = readJson(repo.root, log);
  requireThat(Array.isArray(data), `Historial de conocimiento inválido: ${log}.`);
  return data as Change[];
}

export function audit(repo: Repository) {
  const issues: string[] = [];
  const current = repo.state("po");
  let historical = "IN_PROGRESS";
  if (current.status === "AWAITING_DEV") {
    historical = "SEALED";
    try { repo.verifyHandoff(); }
    catch (error) { historical = "INVALID"; issues.push((error as Error).message); }
  }
  const knowledge = areas.map(area => {
    const base = "docs/" + area;
    if (!entry(repo.path(base + "/README.md"))?.isFile()) issues.push(`Falta el índice ${base}/README.md.`);
    const found = repo.has(base) ? files(repo.root, base) : [];
    const history = changes(repo, area);
    const recent = new Map<string, Change>();
    for (const item of history) {
      const proof = repo.method.schemas.assert<Receipt>("receipt", item.proof);
      const role: Role = area === "business" ? "po" : proof.role;
      try {
        verifyReceipt(repo.config, proof, role, "knowledge:" + area,
          digest({ path: item.path, source: item.source, content: item.content, scopeChange: item.scopeChange }));
        recent.set(item.path, item);
      } catch (error) { issues.push((error as Error).message); }
    }
    for (const item of recent.values()) {
      if (!repo.has(item.path) || fileDigest(repo.path(item.path)) !== item.content) {
        issues.push(`El documento ${item.path} difiere de la última actualización registrada.`);
      }
    }
    return { area, files: found.filter(path => !path.endsWith("/.aiplc-knowledge.json")),
      recordedUpdates: history.length };
  });
  const pending = repo.has(stateFiles.dev) ? repo.state("dev").clarifications.filter(item => !item.answer) : [];
  return { historical, issues, knowledge, pending };
}

export async function updateKnowledge(lifecycle: Lifecycle, area: Area, target: string, from: string,
  source: string, note: string, scopeChange: boolean, requestedRole: Role | undefined, confirm: Confirm) {
  const repo = lifecycle.repo;
  return repo.locked(async () => {
    nonEmpty(note);
    requireThat(!scopeChange || area === "business", "Un cambio de alcance debe registrarse en business.");
    const role = area === "business" ? "po" : area === "technical" ? "dev" : requestedRole ?? "dev";
    requireThat(!requestedRole || requestedRole === role, "Ese rol no puede cambiar esta área.");
    const access = lifecycle.access(role, "knowledge-update");
    if (role === "dev") {
      repo.verifyHandoff();
      requireThat(repo.has(stateFiles.dev) && repo.state("dev").cursor > 0,
        "Completa el onboarding DEV antes de actualizar conocimiento desde ese rol.");
    } else if (repo.state("po").status === "AWAITING_DEV") {
      repo.verifyHandoff();
    }
    const doc = safeRelative(target);
    requireThat(/\.(md|json|ya?ml)$/i.test(doc) && !doc.split("/").some(part => part.startsWith(".")) &&
      (area !== "technical" || !doc.startsWith("aiplc/")),
    "Usa documentación .md, .json o .yaml fuera de las rutas reservadas.");
    const path = `docs/${area}/${doc}`;
    assertShareable(path);
    requireThat(source.startsWith(baseline + "/") && entry(repo.path(source))?.isFile(), "Indica el documento original con --reference.");
    const data = readFileSync(absoluteFile(from));
    requireThat(data.length > 0 && data.length <= 2_000_000 && !data.includes(0), "La documentación debe ser texto de hasta 2 MB.");
    const text = data.toString("utf8");
    requireThat(!/-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----/.test(text), "Retira la clave privada de la documentación.");
    if (doc.endsWith(".json")) JSON.parse(text);
    if (/\.ya?ml$/i.test(doc)) Bun.YAML.parse(text);
    const dest = repo.path(path);
    const old = entry(dest);
    requireThat(!old || old.isFile(), "El destino no es un archivo.");
    const previous = old && readFileSync(dest);
    const request = { path, source, content: new Bun.CryptoHasher("sha256").update(data).digest("hex"), scopeChange };
    const hash = digest(request);
    if (area === "business") await confirm(`Revisa ${from} → ${path}.\nDecisión relacionada: ${source}${scopeChange ? "\nConfirma el cambio de alcance." : ""}`, hash);
    const proof = access.receipt("knowledge:" + area, hash, note);
    const history = changes(repo, area);
    atomic(dest, data);
    try {
      writeJson(repo.path(`docs/${area}/.aiplc-knowledge.json`), [...history, { ...request, proof }]);
    } catch (error) {
      if (previous) atomic(dest, previous);
      else rmSync(dest, { force: true });
      throw error;
    }
    return { ...request, actor: access.actor };
  });
}
