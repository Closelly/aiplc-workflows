import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { absoluteFile, checked, digest, requireThat, run, stable, temporary } from "./files";
import type { Config, Identity, PersonSession, Receipt, ReceiptBody, Role } from "./model";

export const namespace = "closelly-aiplc";

export function personName(value: string): string {
  const name = value.trim().replace(/\s+/g, " ");
  requireThat(name.length > 0 && name.length <= 120 && !/[<>\u0000-\u001f\u007f]/.test(name), "Indica el nombre de la persona, sin saltos de línea.");
  return name;
}

export function sameName(a: string, b: string): boolean {
  const normalize = (value: string) => personName(value).normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("es");
  return normalize(a) === normalize(b);
}

export function namedIdentity(name: string, id: string, email?: string): Identity {
  requireThat(/^[a-zA-Z0-9_.@-]{1,80}$/.test(id), "Identificador de rol inválido.");
  if (email) requireThat(email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), "Revisa el correo o déjalo vacío; es opcional.");
  return { id, name: personName(name), ...(email ? { email } : {}) };
}

export function enroll(id: string, publicFile: string): Identity {
  requireThat(/^[a-zA-Z0-9_.@-]{1,80}$/.test(id), "El identificador del rol debe ser simple y sin espacios.");
  const file = absoluteFile(publicFile);
  const [type, data] = readFileSync(file, "utf8").trim().split(/\s+/);
  requireThat(type === "ssh-ed25519" && /^[A-Za-z0-9+/=]+$/.test(data ?? ""),
    "Usa un archivo de clave pública SSH Ed25519 (.pub).");
  const canonical = Buffer.from(data, "base64");
  requireThat(canonical.length === 51 && canonical.toString("base64") === data,
    "La clave pública Ed25519 no es válida.");
  checked("ssh-keygen", ["-l", "-f", file]);
  return { id, publicKey: type + " " + data };
}

function sign(body: string, key: string): string {
  const dir = temporary("signature");
  try {
    const file = join(dir, "payload");
    writeFileSync(file, body, { mode: 0o600 });
    checked("ssh-keygen", ["-Y", "sign", "-f", absoluteFile(key), "-n", namespace, file], { timeout: 90_000 });
    return readFileSync(file + ".sig", "utf8").trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function verifies(body: string, signature: string, identity: Identity): boolean {
  requireThat(identity.publicKey, "El producto anterior no contiene la clave pública de su rol.");
  const dir = temporary("verification");
  try {
    const keys = join(dir, "allowed_signers");
    const proof = join(dir, "proof.sig");
    writeFileSync(keys, `${identity.id} ${identity.publicKey}\n`, { mode: 0o600 });
    writeFileSync(proof, signature + "\n", { mode: 0o600 });
    return run("ssh-keygen", ["-Y", "verify", "-f", keys, "-I", identity.id,
      "-n", namespace, "-s", proof], { input: body }).status === 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export class RoleAccess {
  readonly key: string;
  readonly actor: string;
  readonly identity: Identity;
  readonly named: boolean;

  constructor(readonly config: Config, readonly role: Role, key?: string, identity?: Identity | null, readonly session?: PersonSession | null) {
    this.key = key ?? (role === "po" ? process.env.AIPLC_PO_KEY : process.env.AIPLC_DEV_KEY) ?? "";
    const enrolled = identity ?? config.roles[role];
    requireThat(enrolled, "Primero acepta la invitación indicando tu nombre con dev onboard --name NOMBRE.");
    this.identity = enrolled;
    this.actor = enrolled.id;
    this.named = config.version === 2;
    if (!this.named) requireThat(this.key, "Este producto usa el formato anterior de identificación. Usa su clave de rol o inicia un producto nuevo con tu nombre.");
  }

  get actorName(): string { return this.identity.name ?? this.actor; }

  authenticate(action: string): void {
    if (this.named) {
      requireThat(this.identity.name && this.session?.projectId === this.config.projectId && this.session.role === this.role &&
        sameName(this.session.name, this.identity.name),
      `Identifícate como ${this.identity.name ?? this.role.toUpperCase()} con ${this.role} identify --name NOMBRE.`);
      return;
    }
    const body = stable({ action, projectId: this.config.projectId, role: this.role, nonce: randomUUID() });
    const signature = sign(body, this.key);
    requireThat(verifies(body, signature, this.identity),
      `La firma de la clave no corresponde al ${this.role.toUpperCase()} inscrito (${this.actor}).`);
  }

  receipt(purpose: string, snapshot: string, note: string): Receipt {
    requireThat(note.trim().length >= 8 && note.length <= 4000,
      "La nota debe explicar lo revisado o decidido (8–4000 caracteres).");
    const body: ReceiptBody = {
      projectId: this.config.projectId, role: this.role, actor: this.actor,
      purpose, digest: snapshot, note: note.trim(), at: new Date().toISOString(),
    };
    const receipt: Receipt = this.named ? { ...body, actorName: this.actorName, confirmation: "name" } : { ...body, signature: sign(stable(body), this.key) };
    verifyReceipt(this.config, receipt, this.role, purpose, snapshot, this.identity);
    return receipt;
  }
}

export function verifyReceipt(config: Config, receipt: Receipt, role: Role, purpose: string, snapshot: string, participant?: Identity | null): void {
  const { signature, ...body } = receipt;
  const identity = participant ?? config.roles[role];
  requireThat(identity, "Falta la identificación de la persona responsable.");
  const confirmed = config.version === 2 ? receipt.confirmation === "name" && receipt.actorName === identity.name && !signature :
    !!signature && verifies(stable(body), signature, identity);
  requireThat(body.projectId === config.projectId && body.role === role && body.actor === identity.id &&
    body.purpose === purpose && body.digest === snapshot && confirmed,
  `${config.version === 2 ? "Confirmación" : "Firma"} inválida o desactualizada para ${purpose} (${role.toUpperCase()}).`);
}

export function questionDigest(question: { id: string; question: string; reference: string; blocking: boolean }): string {
  return digest({ id: question.id, question: question.question, reference: question.reference, blocking: question.blocking });
}
