import { readFileSync } from "node:fs";
import { join } from "node:path";
import { atomic, digest, entry, requireThat, writeJson } from "./files";
import { namedIdentity, personName, sameName } from "./identity";
import type { Identity, PersonSession, Role } from "./model";
import type { Repository } from "./repository";

export const invitationFile = "docs/aiplc/09-handoff/invitation.json";
export const invitationText = "docs/aiplc/09-handoff/INVITACION-DEV.md";
export const participantFile = "docs/technical/aiplc/participant.json";
export interface Invitation { version: 1; projectId: string; projectName: string; poName: string; devName: string; createdAt: string }

function sessionPath(repo: Repository): string {
  return join(repo.git(["rev-parse", "--absolute-git-dir"]), "closelly-aiplc-person.json");
}

export function localPerson(repo: Repository): PersonSession | null {
  const path = sessionPath(repo);
  if (!entry(path)) return null;
  const value = JSON.parse(readFileSync(path, "utf8")) as PersonSession;
  requireThat(value.version === 1 && value.projectId === repo.config.projectId && ["po", "dev"].includes(value.role) &&
    typeof value.name === "string", "Vuelve a identificarte indicando tu nombre.");
  personName(value.name);
  return value;
}

export function invitation(repo: Repository): Invitation {
  requireThat(repo.has(invitationFile) && repo.has(invitationText), "Al preparar la entrega, indica quién la recibirá: po invite --dev-name NOMBRE.");
  const value = repo.json<Invitation>("invitation", invitationFile);
  requireThat(value.projectId === repo.config.projectId && value.projectName === repo.config.name && value.poName === repo.config.roles.po.name,
    "La invitación no corresponde a este producto y su PO.");
  return value;
}

export function participant(repo: Repository, role: Role): Identity | null {
  if (role === "po" || repo.config.version === 1) return repo.config.roles[role];
  if (!repo.has(participantFile)) return null;
  const record = repo.json<{ version: 1; projectId: string; identity: Identity; invitationDigest: string; joinedAt: string }>("participant", participantFile);
  const expected = invitation(repo);
  requireThat(record.projectId === repo.config.projectId && record.invitationDigest === digest(expected) &&
    record.identity.id === "developer" && !!record.identity.name && sameName(record.identity.name, expected.devName),
  "La identificación DEV/OPS no coincide con la invitación del PO.");
  return record.identity;
}

export function identify(repo: Repository, role: Role, name: string): Identity {
  requireThat(repo.config.version === 2, "Este producto usa el formato anterior; conserva su identificación original.");
  const expected = participant(repo, role);
  requireThat(expected?.name, "Primero abre la invitación y usa dev onboard --name NOMBRE.");
  requireThat(sameName(name, expected.name), `El nombre debe coincidir con ${expected.name}, la persona indicada como ${role === "po" ? "PO" : "DEV/OPS"}.`);
  const session: PersonSession = { version: 1, projectId: repo.config.projectId, role, name: expected.name };
  // Per-product Git metadata uses the declared name. An optional email stays
  // optional, and existing global signing settings cannot introduce key prompts.
  repo.git(["config", "user.name", expected.name]);
  repo.git(["config", "user.email", expected.email ?? `${expected.id}@aiplc.invalid`]);
  repo.git(["config", "commit.gpgsign", "false"]);
  repo.git(["config", "tag.gpgsign", "false"]);
  writeJson(sessionPath(repo), session);
  return expected;
}

export function prepareInvitation(repo: Repository, devName: string): Invitation {
  const value: Invitation = { version: 1, projectId: repo.config.projectId, projectName: repo.config.name,
    poName: repo.config.roles.po.name!, devName: personName(devName), createdAt: new Date().toISOString() };
  repo.method.schemas.assert("invitation", value);
  writeJson(repo.path(invitationFile), value);
  const escape = (text: string) => text.replace(/[\\`*_{}[\]()#+.!|>]/g, "\\$&");
  atomic(repo.path(invitationText), `# Invitación para ${escape(value.devName)}\n\n` +
    `${escape(value.poName)} te invita a recibir **${escape(value.projectName)}** como DEV/OPS.\n\n` +
    "Abre la carpeta del producto en Codex y envía este mensaje:\n\n" +
    `> Me llamo ${escape(value.devName)}. El PO me invitó a recibir este producto como DEV/OPS. ` +
    "Usa $closelly-aiplc-dev, comprueba que mi nombre coincide con la invitación y guíame por el recorrido.\n\n" +
    "La herramienta comprobará el nombre y te mostrará negocio, producto, materiales, prototipo y decisiones. " +
    "Después prepararás el trabajo técnico y la operación.\n");
  return value;
}

export function joinInvitation(repo: Repository, name: string, email?: string): Identity {
  const expected = invitation(repo);
  requireThat(sameName(name, expected.devName), `Esta entrega está dirigida a ${expected.devName}. Revisa tu nombre con el PO.`);
  const existing = participant(repo, "dev");
  const identity = existing ?? namedIdentity(expected.devName, "developer", email);
  if (!existing) {
    const record = { version: 1, projectId: repo.config.projectId, identity, invitationDigest: digest(expected), joinedAt: new Date().toISOString() };
    repo.method.schemas.assert("participant", record);
    writeJson(repo.path(participantFile), record);
  }
  return identify(repo, "dev", name);
}
