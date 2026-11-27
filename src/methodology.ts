import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import pkg from "../package.json";
import { digest, files, inside, inventory, readText, requireThat, safeRelative } from "./files";
import type { Role, Workflow } from "./model";
import { Schemas } from "./schemas";

export const version = pkg.version;
export const assetGroups = ["agents", "skills", "schemas", "workflows", "methodology", "templates", "integrations", "harnesses"];
const installed = join(dirname(process.execPath), "assets");

export function distributionDir(): string {
  if (existsSync(join(installed, "workflows", "po.yaml"))) return installed;
  return resolve(import.meta.dir, "..");
}

export class Methodology {
  readonly schemas: Schemas;
  readonly workflows: Record<Role, Workflow>;
  readonly snapshots: string[];
  readonly digest: string;

  constructor(readonly root: string) {
    this.schemas = new Schemas(inside(root, "schemas"));
    for (const filename of readdirSync(this.schemas.root).filter(file => file.endsWith(".schema.json"))) {
      this.schemas.compile(filename.slice(0, -".schema.json".length));
    }
    this.workflows = { po: this.load("po"), dev: this.load("dev") };
    this.snapshots = assetGroups.flatMap(group => files(root, group));
    this.digest = digest(inventory(root, this.snapshots));
  }

  private load(role: Role): Workflow {
    const path = `workflows/${role}.yaml`;
    const raw = Bun.YAML.parse(readText(this.root, path));
    const data = this.schemas.assert<Workflow>("workflow", raw, path);
    requireThat(data.role === role, `El rol de ${path} no coincide.`);
    const ids = new Set<string>();
    const gates = new Set<string>();
    for (const [index, phase] of data.phases.entries()) {
      requireThat(!ids.has(phase.id), `Fase duplicada: ${phase.id}`);
      ids.add(phase.id);
      if (phase.gate) {
        requireThat(!gates.has(phase.gate), `Gate duplicado: ${phase.gate}`);
        gates.add(phase.gate);
      }
      safeRelative(phase.folder);
      requireThat(phase.folder.startsWith(role === "po" ? "docs/aiplc/" : "docs/technical/") ||
        (role === "dev" && phase.folder === "docs/technical"),
      `La ruta de la fase ${phase.id} no pertenece a su rol.`);
      requireThat(index === data.phases.length - 1 ? phase.final === (role === "po" ? "seal" : "ready") && phase.gate : !phase.final,
        `Final inválido en ${phase.id}.`);
      for (const agent of [phase.lead, ...phase.contributors]) {
        requireThat(readText(this.root, `agents/${agent}.md`).trim().length > 30, `Agente vacío: ${agent}`);
      }
      for (const skill of phase.skills) {
        const value = readText(this.root, `skills/${skill}/SKILL.md`);
        requireThat(value.startsWith(`---\nname: ${skill}\n`) && value.includes("\ndescription: "),
          `Skill inválida: ${skill}`);
      }
      const paths = new Set<string>();
      for (const artifact of phase.artifacts) {
        safeRelative(artifact.path);
        requireThat(!paths.has(artifact.path), `Artefacto duplicado: ${phase.id}/${artifact.path}`);
        paths.add(artifact.path);
        requireThat((artifact.type === "json") === !!artifact.schema, `Declaración de schema inválida: ${artifact.path}`);
        if (artifact.schema) this.schemas.compile(artifact.schema);
      }
      if (phase.checklist) {
        requireThat(role === "dev" && index === 0 && phase.gate &&
          new Set(phase.checklist.map(item => item.id)).size === phase.checklist.length, "Checklist inválido.");
        phase.checklist.flatMap(item => item.resources).forEach(safeRelative);
      }
    }
    if (role === "po") {
      requireThat(data.phases.length === 9 && ["business", "creative", "experience", "commercial", "handoff"].every(g => gates.has(g)),
        "El workflow PO exige nueve fases y sus cinco gates.");
      const final = data.phases.at(-1)!;
      requireThat(final.video && final.check === "handoff" &&
        ["product", "prototype", "business", "marketing"].every(category =>
          final.video!.categories.includes(category as NonNullable<typeof final.video>["categories"][number])),
      "El handoff debe exigir el video HyperFrames y sus contenidos.");
    } else {
      requireThat(data.phases.length === 6 && !!data.phases[0].checklist && data.phases[0].gate === "onboarding",
        "El workflow DEV debe comenzar con onboarding y tener seis fases.");
    }
    return data;
  }
}
