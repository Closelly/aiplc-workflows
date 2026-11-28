import { randomUUID } from "node:crypto";
import { activePhase, appendEvent, approve, complete, newState, revise, start } from "./engine";
import { preparePackage } from "./briefing";
import { atomic, digest, entry, files, inventory, requireThat, writeJson } from "./files";
import { questionDigest, RoleAccess } from "./identity";
import { identify, invitation, invitationFile, invitationText, joinInvitation, prepareInvitation } from "./participants";
import type { Config, Event, Manifest, Role, State } from "./model";
import { draft, checklistDigest, inspectPlan, validatePhase, verifyCompleted } from "./quality";
import { artifactManifest, handoff, living, projectFile, Repository, tag, taggedManifest } from "./repository";
import { inspectFilm, renderFilm } from "./video";

export type Confirm = (message: string, challenge: string) => Promise<void>;
export type Progress = (message: string) => void;

function event(type: Event["type"], access: RoleAccess, phase?: string, note?: string): Event {
  return { type, actor: access.actor, ...(access.named ? { actorName: access.actorName } : {}), phase, note, at: new Date().toISOString() };
}

function verifyDev(repo: Repository, state: State): Manifest {
  const sealed = repo.verifyHandoff();
  requireThat(state.baselineDigest === sealed.digest, "El DEV está ligado a otra entrega.");
  return sealed;
}

function save(repo: Repository, state: State) {
  repo.save(state);
  if (state.role === "po") {
    writeJson(repo.path(artifactManifest), {
      version: 1, projectId: state.projectId, phases: state.completed,
    });
  }
}

export class Lifecycle {
  constructor(readonly repo: Repository, readonly key?: string) {}

  access(role: Role, command: string): RoleAccess {
    const access = new RoleAccess(this.repo.config, role, this.key, this.repo.identity(role), this.repo.person());
    access.authenticate(command);
    return access;
  }

  current(role: Role) {
    const state = this.repo.state(role);
    if (role === "dev") verifyDev(this.repo, state);
    return { state, phase: activePhase(state, this.repo.method.workflows[role]) };
  }

  async identify(role: Role, name: string) {
    return this.repo.locked(() => ({ role, person: identify(this.repo, role, name).name, status: "IDENTIFIED" }));
  }

  async invite(devName: string) {
    return this.repo.locked(() => {
      requireThat(this.repo.config.version === 2, "El producto anterior conserva sus responsables inscritos.");
      const access = this.access("po", "invite");
      const { state, phase } = this.current("po");
      requireThat(phase.id === "handoff", "El nombre del DEV/OPS se pide al preparar la entrega final.");
      requireThat(!state.approvals.some(item => item.phase === phase.id), "La entrega ya fue aprobada. Reabre handoff antes de cambiar su destinatario.");
      verifyCompleted(this.repo, state);
      const value = prepareInvitation(this.repo, devName);
      save(this.repo, appendEvent(state, event("configure", access, phase.id, `Invitación preparada para ${value.devName}.`)));
      return { project: value.projectName, recipient: value.devName, invitation: invitationText,
        next: "Comparte la invitación junto con el repositorio cuando cierres la entrega." };
    });
  }

  async startPo() {
    return this.repo.locked(() => {
      const access = this.access("po", "start");
      const state = start(this.repo.state("po"), event("start", access, "discovery"));
      save(this.repo, state);
      return this.status("po");
    });
  }

  status(role: Role) {
    if (role === "dev" && !this.repo.has("docs/technical/aiplc/state.json")) {
      this.repo.verifyHandoff();
      return { role, status: "AWAITING_DEV", next: this.repo.config.version === 2 ?
        "Indica tu nombre con closelly-aiplc dev onboard --name TU-NOMBRE para abrir la invitación." : "closelly-aiplc dev onboard" };
    }
    const state = this.repo.state(role);
    if (role === "dev") verifyDev(this.repo, state);
    const phase = this.repo.method.workflows[role].phases[state.cursor];
    let status: string = state.status;
    let integrity: string | undefined;
    if (state.status === "AWAITING_DEV") {
      try { this.repo.verifyHandoff(); }
      catch (error) { status = "SEAL_PENDING"; integrity = (error as Error).message; }
    }
    const item = phase?.checklist?.[state.checklist.length];
    const next = status === "INITIALIZED" ? "closelly-aiplc po start" :
      status === "SEAL_PENDING" ? "closelly-aiplc po handoff" :
      status === "AWAITING_DEV" ? (this.repo.config.version === 2 ? "Comparte la invitación y el repositorio con el DEV/OPS indicado." :
        "Entrega el repositorio y su tag al DEV. El DEV ejecuta closelly-aiplc dev onboard.") :
      status === "READY" ? "Continúa con tu proceso de desarrollo habitual." :
      item ? `closelly-aiplc dev ack ${item.id} --prepare --note "Revisión del paso" --json` :
      phase?.final === "seal" ? "closelly-aiplc po handoff" :
      phase?.final === "ready" ? "closelly-aiplc dev ready --prepare --note \"Revisión de preparación técnica\" --json" :
      phase?.gate && !state.approvals.some(a => a.phase === phase.id) ?
        `closelly-aiplc ${role} approve --prepare --note "Revisión de la fase" --json` : `closelly-aiplc ${role} advance`;
    return {
      project: this.repo.config.name, role, status, next, integrity, phase: phase?.id, title: phase?.title,
      gate: phase?.gate, checklistCurrent: item, checklistDone: state.checklist.length,
      completed: state.completed.map(item => item.phase),
      approvals: state.approvals.map(item => ({ gate: item.gate, actor: item.receipt.actorName ?? item.receipt.actor, at: item.receipt.at })),
      pendingClarifications: state.clarifications.filter(q => !q.answer),
      missing: [...(phase?.artifacts.filter(artifact => !this.repo.has(phase.folder + "/" + artifact.path))
        .map(artifact => phase.folder + "/" + artifact.path) ?? []),
        ...(this.repo.config.version === 2 && phase?.id === "handoff" ? [invitationFile, invitationText].filter(path => !this.repo.has(path)) : [])],
      lastEvent: state.events.at(-1),
    };
  }

  async onboard(name?: string, email?: string) {
    return this.repo.locked(() => {
      let access: RoleAccess | undefined;
      if (this.repo.config.version === 1) access = this.access("dev", "onboard");
      const sealed = this.repo.verifyHandoff();
      verifyCompleted(this.repo, this.repo.state("po"));
      if (this.repo.config.version === 2) {
        const current = this.repo.person();
        const declared = name ?? (current?.role === "dev" ? current.name : "");
        requireThat(declared, "¿Cómo te llamas? Indícalo con dev onboard --name NOMBRE para comprobar la invitación.");
        joinInvitation(this.repo, declared, email);
        access = this.access("dev", "onboard");
      }
      if (!this.repo.has("docs/technical/aiplc/state.json")) {
        const state = start({ ...newState(this.repo.config.projectId, "dev"), baselineDigest: sealed.digest },
          event("start", access!, "developer-onboarding"));
        save(this.repo, state);
      }
      return this.status("dev");
    });
  }

  async acknowledge(id: string, note: string, confirm: Confirm) {
    return this.repo.locked(async () => {
      const { state, phase } = this.current("dev");
      const access = this.access("dev", "acknowledge");
      const item = phase.checklist?.[state.checklist.length];
      requireThat(item && item.id === id, `El siguiente paso es ${item?.id ?? "la aprobación de onboarding"}.`);
      for (const path of item.resources) requireThat(entry(this.repo.path(path))?.isFile(), `Falta el recurso ${path}.`);
      const hash = checklistDigest(this.repo, item, state.baselineDigest!);
      await confirm(id === "video-briefing" ? "Confirma que viste el MP4 y revisaste su voz, capítulos y subtítulos." :
        `Confirma que revisaste ${item.title}.\n${item.resources.join("\n")}`, hash);
      requireThat(checklistDigest(this.repo, item, state.baselineDigest!) === hash,
        "Los recursos cambiaron durante la revisión. Presenta la versión actual antes de confirmar.");
      const receipt = access.receipt("onboard:" + id, hash, note);
      save(this.repo, appendEvent({ ...state, checklist: [...state.checklist, receipt] },
        event("acknowledge", access, id)));
      return this.status("dev");
    });
  }

  async accept(role: Role, note: string, confirm: Confirm, final = false) {
    return this.repo.locked(async () => {
      const { state, phase } = this.current(role);
      requireThat(phase.gate, "Esta fase no tiene gate. Usa advance después de validar.");
      requireThat(final ? phase.final === "ready" : phase.final !== "ready",
        "Usa dev ready para confirmar y cerrar la preparación técnica.");
      const access = this.access(role, final ? "ready" : "approve");
      const hash = await validatePhase(this.repo, role, state, false);
      await confirm(`${access.actorName}, revisa ${phase.title} y confirma el gate ${phase.gate}.\n${phase.artifacts.map(item =>
        "  " + phase.folder + "/" + item.path).join("\n")}`, hash);
      requireThat(await validatePhase(this.repo, role, state, false) === hash,
        "Los artefactos cambiaron mientras se revisaban. Repite la aprobación.");
      const receipt = access.receipt("gate:" + phase.gate, hash, note);
      const workflow = this.repo.method.workflows[role];
      let next = approve(state, workflow, { phase: phase.id, gate: phase.gate, receipt },
        event("approve", access, phase.id));
      if (final) next = complete(next, workflow, hash, event("ready", access, phase.id));
      save(this.repo, next);
      return this.status(role);
    });
  }

  async advance(role: Role) {
    return this.repo.locked(async () => {
      const { state, phase } = this.current(role);
      const access = this.access(role, "advance");
      requireThat(!phase.final, `Esta fase se cierra con ${role === "po" ? "po handoff" : "dev ready"}.`);
      const hash = await validatePhase(this.repo, role, state, true);
      save(this.repo, complete(state, this.repo.method.workflows[role], hash, event("complete", access, phase.id)));
      return this.status(role);
    });
  }

  async revise(id: string, note: string) {
    return this.repo.locked(() => {
      const { state } = this.current("po");
      const access = this.access("po", "revise");
      nonEmpty(note);
      const next = revise(state, this.repo.method.workflows.po, id, event("revise", access, id, note));
      verifyCompleted(this.repo, next);
      save(this.repo, next);
      return this.status("po");
    });
  }

  async scaffold(role: Role) {
    return this.repo.locked(() => {
      const { state, phase } = this.current(role);
      this.access(role, "scaffold");
      verifyCompleted(this.repo, state);
      const written: string[] = [];
      for (const a of phase.artifacts) {
        const path = phase.folder + "/" + a.path;
        if (a.generated || a.type !== "md" || this.repo.has(path)) continue;
        atomic(this.repo.path(path), `# ${a.path.split("/").at(-1)!.replace(/\.md$/, "").replaceAll("-", " ")}\n\n${draft}\n\n${phase.focus}\n\n## Evidencia y decisiones\n\n## Pendientes\n`);
        written.push(path);
      }
      return { role, phase: phase.id, written };
    });
  }

  async validate(role: Role) {
    const { state, phase } = this.current(role);
    return { phase: phase.id, gate: phase.gate, snapshot: await validatePhase(this.repo, role, state, false) };
  }

  async handoff(prepare: boolean, forceRender: boolean, progress: Progress) {
    return this.repo.locked(async () => {
      const access = this.access("po", "handoff");
      const state = this.repo.state("po");
      if (state.status === "AWAITING_DEV") return this.finishSeal(state);
      const phase = activePhase(state, this.repo.method.workflows.po);
      requireThat(phase.final === "seal", "Completa las ocho primeras fases antes de preparar el handoff.");
      if (this.repo.config.version === 2) invitation(this.repo);
      verifyCompleted(this.repo, state);
      const plan = inspectPlan(this.repo, phase);
      await preparePackage(this.repo);
      let needsRender = forceRender;
      if (!needsRender) {
        try { inspectFilm(this.repo, phase); }
        catch { needsRender = true; }
      }
      if (needsRender) await renderFilm(this.repo, phase, plan, progress);
      const detail = {
        phase: phase.id, status: "AWAITING_REVIEW",
        productPackage: onboardingPath(), commercialPackage: handoff + "/commercial-handoff.md",
        next: "Revisa el paquete y completa validation-report.md. Prepara po approve con --prepare, presenta la revisión en el chat y registra la respuesta explícita con --review y --chat-response antes de repetir po handoff.",
      };
      if (prepare) return detail;
      const approved = state.approvals.some(approval => approval.phase === phase.id);
      if (!approved) return detail;
      const hash = await validatePhase(this.repo, "po", state, true);
      this.gitPreflight(false);
      const sealed = complete(state, this.repo.method.workflows.po, hash, event("seal", access, phase.id));
      save(this.repo, sealed);
      return this.finishSeal(sealed);
    });
  }

  private gitPreflight(recovery: boolean) {
    requireThat(this.repo.git(["symbolic-ref", "--quiet", "HEAD"], true), "Abre una rama Git antes de sellar.");
    if (!recovery) requireThat(!this.repo.git(["tag", "--list", tag]), "Ya existe el tag de entrega en este repositorio.");
    this.repo.git(["var", "GIT_AUTHOR_IDENT"]);
    this.repo.git(["var", "GIT_COMMITTER_IDENT"]);
    const staged = this.repo.git(["diff", "--cached", "--name-only", "-z"]).split("\0").filter(Boolean);
    requireThat(!staged.length || (recovery && staged.every(path => path === "AGENTS.md" || path.startsWith("docs/"))),
      "Hay cambios staged. Haz commit o sácalos del área de preparación antes de sellar.");
  }

  private finishSeal(state: State) {
    const existing = this.repo.git(["rev-parse", "--verify", `refs/tags/${tag}^{commit}`], true);
    if (!existing) {
      verifyCompleted(this.repo, state);
      this.gitPreflight(true);
      const phases = { version: 1, projectId: state.projectId, phases: state.completed };
      writeJson(this.repo.path(artifactManifest), phases);
      const manifest = this.repo.createManifest(state);
      if (this.repo.has(taggedManifest)) {
        const old = this.repo.json<Manifest>("manifest", taggedManifest);
        requireThat(digest(old) === digest(manifest), "La línea base cambió desde que se inició el sellado.");
      } else {
        this.repo.method.schemas.assert("manifest", manifest);
        writeJson(this.repo.path(taggedManifest), manifest);
      }
      const releasePaths = ["AGENTS.md", ...files(this.repo.root, "docs")];
      inventory(this.repo.root, releasePaths);
      this.repo.git(["-c", "core.autocrlf=false", "add", "--", "AGENTS.md", "docs"]);
      const indexed = new Set(this.repo.git(["ls-files", "-z", "--", "AGENTS.md", "docs"]).split("\0"));
      requireThat(releasePaths.every(path => indexed.has(path)), "Git ignoró un archivo de la entrega. Revisa sus reglas de exclusión.");
      if (this.repo.git(["diff", "--cached", "--name-only", "-z"])) {
        this.repo.git(["-c", "core.autocrlf=false", "commit", "-m", "Seal Closelly AI-PLC product definition"]);
      }
      this.repo.git(["tag", "-a", tag, "-m", "Closelly AI-PLC original product definition"]);
    }
    const verified = this.repo.verifyHandoff();
    return {
      status: "AWAITING_DEV", role: "po", tag, digest: verified.digest,
      next: this.repo.config.version === 2 ? "Comparte la invitación y el repositorio con el DEV/OPS. Se identificará con su nombre al abrirlos." :
        "Entrega el repositorio y este tag al DEV. El DEV ejecuta closelly-aiplc dev onboard.",
      ...(this.repo.config.version === 2 ? { invitation: invitationText, recipient: invitation(this.repo).devName } : {}),
      commercialPackage: handoff + "/commercial-handoff.md", productPackage: onboardingPath(),
    };
  }

  async clarify(note: string, reference: string, blocking: boolean) {
    return this.repo.locked(() => {
      const access = this.access("dev", "clarify");
      const { state, phase } = this.current("dev");
      nonEmpty(note);
      requireThat(reference.startsWith("docs/") && entry(this.repo.path(reference))?.isFile(), "Indica un documento del producto con --reference.");
      const id = "Q-" + randomUUID().slice(0, 8);
      const question = { id, question: note.trim(), reference, blocking };
      save(this.repo, appendEvent({ ...state, clarifications: [...state.clarifications, question] },
        event("clarify", access, phase.id, id + ": " + note)));
      return question;
    });
  }

  async answer(id: string, note: string, confirm: Confirm) {
    return this.repo.locked(async () => {
      const access = this.access("po", "answer");
      const state = this.repo.state("dev");
      verifyDev(this.repo, state);
      requireThat(state.status === "ACTIVE", "El flujo técnico ya cerró la preparación.");
      const question = state.clarifications.find(item => item.id === id);
      requireThat(question && !question.answer, "La pregunta no existe o ya fue respondida.");
      const hash = questionDigest(question);
      await confirm(`Aclaración ${id}\n${question.question}\nRespuesta propuesta: ${note}\nSi cambia el alcance, registra primero la decisión aprobada en docs/business y cítala en la respuesta.`, hash);
      const answer = access.receipt("answer:" + id, hash, note);
      const clarifications = state.clarifications.map(item => item.id === id ? { ...item, answer } : item);
      save(this.repo, appendEvent({ ...state, clarifications }, event("answer", access, undefined, id)));
      return { id, answer };
    });
  }

  async configure(values: Partial<Pick<Config, "harness" | "tts" | "language">>) {
    return this.repo.locked(() => {
      const access = this.access("po", "configure");
      const state = this.repo.state("po");
      requireThat(state.status !== "AWAITING_DEV", "La configuración histórica se conserva sellada.");
      const config: Config = { ...this.repo.config, ...values };
      this.repo.method.schemas.assert("project", config);
      requireThat(!config.tts?.voice.trim().startsWith("-"), "El identificador de voz no puede empezar por guion.");
      writeJson(this.repo.path(projectFile), config);
      save(this.repo, appendEvent(state, event("configure", access)));
      return config;
    });
  }
}

function onboardingPath() { return handoff + "/onboarding/START-HERE.md"; }

export function nonEmpty(note: string) {
  requireThat(note.trim().length >= 8 && note.length <= 4000, "Incluye una nota de entre 8 y 4000 caracteres.");
}

export function assertArea(value: string): asserts value is keyof typeof living {
  requireThat(Object.hasOwn(living, value), "Usa business, technical u operations.");
}
