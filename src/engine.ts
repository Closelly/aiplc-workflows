import { requireThat } from "./files";
import type { Approval, Event, Phase, Role, State, Workflow } from "./model";

export function newState(projectId: string, role: Role): State {
  return {
    version: 1, projectId, role, status: "INITIALIZED", cursor: 0, revision: 0,
    completed: [], approvals: [], events: [], checklist: [], clarifications: [],
  };
}

export function activePhase(state: State, workflow: Workflow): Phase {
  requireThat(state.status === "ACTIVE" && state.role === workflow.role, "El flujo de este rol no está activo.");
  const phase = workflow.phases[state.cursor];
  requireThat(phase, "La fase actual no existe en el workflow.");
  return phase;
}

export function appendEvent(state: State, event: Event): State {
  return { ...state, revision: state.revision + 1, events: [...state.events, event] };
}

export function start(state: State, event: Event): State {
  requireThat(state.status === "INITIALIZED", "El flujo ya comenzó; usa resume.");
  return appendEvent({ ...state, status: "ACTIVE" }, event);
}

export function approve(state: State, workflow: Workflow, approval: Approval, event: Event): State {
  const phase = activePhase(state, workflow);
  requireThat(phase.id === approval.phase && phase.gate === approval.gate, "La aprobación no corresponde al gate actual.");
  return appendEvent({
    ...state, approvals: [...state.approvals.filter(a => a.phase !== phase.id), approval],
  }, event);
}

export function complete(state: State, workflow: Workflow, snapshot: string, event: Event): State {
  const phase = activePhase(state, workflow);
  if (phase.gate) {
    requireThat(state.approvals.some(approval => approval.phase === phase.id && approval.gate === phase.gate &&
      approval.receipt.digest === snapshot), `Falta aprobación vigente del gate ${phase.gate}.`);
  }
  const status = phase.final === "seal" ? "AWAITING_DEV" : phase.final === "ready" ? "READY" : "ACTIVE";
  return appendEvent({
    ...state, status, cursor: state.cursor + 1, completed: [...state.completed, { phase: phase.id, digest: snapshot }],
    ...(phase.final === "seal" ? { sealedAt: event.at } : {}),
  }, event);
}

export function revise(state: State, workflow: Workflow, phaseId: string, event: Event): State {
  activePhase(state, workflow);
  requireThat(state.role === "po", "La revisión de fases pertenece al PO antes de sellar la entrega.");
  const index = workflow.phases.findIndex(phase => phase.id === phaseId);
  requireThat(index >= 0 && index <= state.cursor, "Solo puedes revisar la fase actual o una completada.");
  const completed = state.completed.slice(0, index);
  return appendEvent({
    ...state, cursor: index, completed,
    approvals: state.approvals.filter(approval => completed.some(phase => phase.phase === approval.phase)),
  }, event);
}

export function assertState(state: State, workflow: Workflow, projectId: string): void {
  requireThat(state.projectId === projectId && state.role === workflow.role && state.revision === state.events.length,
    "El estado no corresponde a este proyecto o su historial no coincide.");
  const closed = state.status === "AWAITING_DEV" || state.status === "READY";
  requireThat(state.cursor === state.completed.length && state.cursor <= workflow.phases.length &&
    state.completed.every((item, index) => item.phase === workflow.phases[index].id) &&
    (closed ? state.cursor === workflow.phases.length : state.cursor < workflow.phases.length) &&
    (state.status !== "INITIALIZED" || state.cursor === 0) &&
    (state.status !== "AWAITING_DEV" || (state.role === "po" && !!state.sealedAt)) &&
    (state.status !== "READY" || state.role === "dev") &&
    (state.role === "dev" || (!state.baselineDigest && state.checklist.length === 0 && state.clarifications.length === 0)),
  "Estado inconsistente con la secuencia de fases.");
}
