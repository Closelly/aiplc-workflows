import { readText } from "./files";
import type { Phase, Role } from "./model";
import { historical, Repository } from "./repository";
import { invitationFile, invitationText } from "./participants";

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
La persona decide en el chat y tú ejecutas los comandos. No inventes respuestas ni aprobaciones.
Pregunta una decisión por vez, con una frase de contexto y 2–3 opciones breves cuando sean útiles. Reutiliza lo ya respondido; evita cuestionarios largos y resúmenes que mezclen preguntas.
Para una aprobación, ejecuta el comando con --prepare --note NOTA --json antes de preguntar. Presenta una síntesis breve, los documentos revisables y una sola pregunta. Espera la respuesta explícita.
Conserva el review y los argumentos de esa preparación. Tras un sí inequívoco, repite el comando sin --prepare, con --review HASH --chat-response RESPUESTA_LITERAL. Tú registras la decisión; la persona no copia comandos ni escribe CONFIRMAR en una consola.
Si cambia la revisión, prepara y presenta la nueva versión. Si pide cambios, edita primero y vuelve a revisar. Nunca registres una opción preseleccionada, el silencio o una respuesta a otra pregunta como aprobación.
Esta pauta de conversación actual sustituye indicaciones antiguas que manden confirmar en una terminal; conserva intactos la metodología fijada, los artefactos y sus verificaciones.
Preserva las fuentes y las decisiones dentro del repo. Si falta una capacidad, reporta el bloqueo con el insumo o comando faltante.
${order.step ? "Guía solo el paso actual y espera al DEV antes de registrar la revisión: " + order.step.title : ""}`;

const adapters: Record<string, HarnessAdapter> = {
  codex: {
    id: "codex",
    instructions: order => common(order) + `
Usa $closelly-aiplc-${order.role} si está instalado. Navega y captura con las herramientas que este chat tenga habilitadas.
Usa el control de preguntas del chat: request_user_input si está habilitado y permitido en el modo actual; si no, request_user_input_async cuando exista, manteniendo la pregunta pendiente hasta recibir respuesta. No cambies de modo para forzarlo. Si no hay control utilizable, haz una pregunta breve con opciones numeradas en el chat.
Cada control contiene una pregunta por defecto; como máximo tres si están estrechamente relacionadas. No imprimas JSON, YAML ni especificaciones de preguntas al usuario.`,
  },
  portable: {
    id: "portable",
    instructions: order => common(order) + "\nUsa el control de preguntas nativo que el entorno tenga habilitado; si no existe, una pregunta breve y opciones numeradas en el chat. No inventes herramientas ni obligues a cambiar de entorno.",
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
  let people = "";
  if (repo.config.version === 2) {
    people = role === "po" ? `\nEl PO es ${repo.config.roles.po.name}. Para empezar solo necesita su nombre; no pidas datos del DEV/OPS ni claves SSH durante Discovery.` :
      "\nEl DEV/OPS se identifica con su nombre. Comprueba que coincide con la invitación del PO; no pidas claves SSH.";
    if (role === "dev") order.inputs.push(invitationFile, invitationText);
    if (role === "po" && phase.id === "handoff") {
      people += "\nAntes de la aprobación final, pregunta al PO quién recibirá el producto. Genera la invitación con po invite --dev-name NOMBRE. La invitación se comparte con el repositorio tras cerrar la entrega.";
      order.outputs.push({ path: invitationFile, type: "json", schema: historical + "/schemas/invitation.schema.json", generated: true },
        { path: invitationText, type: "md", generated: true });
    }
  }
  return { adapter: adapter.id, prompt: adapter.instructions(order) + people, order };
}
