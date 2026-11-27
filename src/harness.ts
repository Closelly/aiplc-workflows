import { readText } from "./files";
import type { Phase, Role } from "./model";
import { historical, Repository } from "./repository";

export interface WorkOrder {
  project: string;
  role: Role;
  phase: string;
  title: string;
  focus: string;
  methodology: string;
  agents: { id: string; path: string; instruction: string }[];
  skills: string[];
  inputs: string[];
  outputs: { path: string; type: string; schema?: string; generated: boolean }[];
  humanGate?: string;
  step?: { id: string; title: string; resources: string[] };
}

export interface HarnessAdapter {
  readonly id: string;
  instructions(order: WorkOrder): string;
}

const common = (order: WorkOrder) =>
  `Trabaja en ${order.title} para ${order.project}. Tu rol es ${order.role.toUpperCase()}. ${order.focus}
Lee los insumos y usa el encargo estructurado para elaborar las salidas no generadas. Organiza las perspectivas como roles del mismo harness.
No firmes ni representes decisiones humanas. Para un gate, presenta la evidencia al responsable y pídele que confirme en su terminal.
Preserva las fuentes y las decisiones dentro del repo. Si falta una capacidad, reporta el bloqueo con el insumo o comando faltante.
${order.step ? "Guía solo el paso actual y espera al DEV antes de registrar la revisión: " + order.step.title : ""}`;

const adapters: Record<string, HarnessAdapter> = {
  codex: {
    id: "codex",
    instructions: order => common(order) + `
Usa $closelly-aiplc-${order.role} si está instalado. Navega y captura con las herramientas que este chat tenga habilitadas.
Entrega las rutas para revisión. El operador ejecuta el comando del gate con su clave de rol.`,
  },
  portable: {
    id: "portable",
    instructions: common,
  },
};

export function workOrder(repo: Repository, role: Role, phase: Phase, checklistIndex: number) {
  const order: WorkOrder = {
    project: repo.config.name, role, phase: phase.id, title: phase.title, focus: phase.focus,
    methodology: historical + "/methodology/principles.md",
    agents: [phase.lead, ...phase.contributors].map(id => {
      const path = historical + `/agents/${id}.md`;
      return { id, path, instruction: readText(repo.root, path) };
    }),
    skills: phase.skills.map(id => historical + `/skills/${id}/SKILL.md`),
    inputs: [
      "AGENTS.md", "docs/business/README.md", "docs/technical/README.md", "docs/operations/README.md",
      ...repo.method.workflows[role].phases.slice(0, repo.method.workflows[role].phases.indexOf(phase))
        .flatMap(p => p.artifacts.filter(artifact => !artifact.generated).map(artifact => p.folder + "/" + artifact.path)),
    ],
    outputs: phase.artifacts.map(artifact => ({
      path: phase.folder + "/" + artifact.path, type: artifact.type,
      schema: artifact.schema ? historical + "/schemas/" + artifact.schema + ".schema.json" : undefined,
      generated: !!artifact.generated,
    })),
    humanGate: phase.gate,
    step: phase.checklist?.[checklistIndex],
  };
  const adapter = adapters[repo.config.harness];
  return { adapter: adapter.id, prompt: adapter.instructions(order), order };
}
