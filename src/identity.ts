import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { absoluteFile, checked, digest, requireThat, run, stable, temporary } from "./files";
import type { Config, Identity, Receipt, ReceiptBody, Role } from "./model";

export const namespace = "closelly-aiplc";

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

  constructor(readonly config: Config, readonly role: Role, key?: string) {
    this.key = key ?? (role === "po" ? process.env.AIPLC_PO_KEY : process.env.AIPLC_DEV_KEY) ?? "";
    this.actor = config.roles[role].id;
    requireThat(this.key, `Usa la clave del ${role.toUpperCase()} con --key, AIPLC_${role.toUpperCase()}_KEY o un .pub cargado en ssh-agent.`);
  }

  authenticate(action: string): void {
    const body = stable({ action, projectId: this.config.projectId, role: this.role, nonce: randomUUID() });
    const signature = sign(body, this.key);
    requireThat(verifies(body, signature, this.config.roles[this.role]),
      `La firma de la clave no corresponde al ${this.role.toUpperCase()} inscrito (${this.actor}).`);
  }

  receipt(purpose: string, snapshot: string, note: string): Receipt {
    requireThat(note.trim().length >= 8 && note.length <= 4000,
      "La nota debe explicar lo revisado o decidido (8–4000 caracteres).");
    const body: ReceiptBody = {
      projectId: this.config.projectId, role: this.role, actor: this.actor,
      purpose, digest: snapshot, note: note.trim(), at: new Date().toISOString(),
    };
    const receipt = { ...body, signature: sign(stable(body), this.key) };
    verifyReceipt(this.config, receipt, this.role, purpose, snapshot);
    return receipt;
  }
}

export function verifyReceipt(config: Config, receipt: Receipt, role: Role, purpose: string, snapshot: string): void {
  const { signature, ...body } = receipt;
  const identity = config.roles[role];
  requireThat(body.projectId === config.projectId && body.role === role && body.actor === identity.id &&
    body.purpose === purpose && body.digest === snapshot && verifies(stable(body), signature, identity),
  `Firma inválida o desactualizada para ${purpose} (${role.toUpperCase()}).`);
}

export function questionDigest(question: { id: string; question: string; reference: string; blocking: boolean }): string {
  return digest({ id: question.id, question: question.question, reference: question.reference, blocking: question.blocking });
}
