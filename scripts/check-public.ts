import { readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const response = Bun.spawnSync(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: root });
if (response.exitCode !== 0) throw new Error("No se pudo inspeccionar el contenido público.");
const names = [...new Set(response.stdout.toString().split("\0").filter(Boolean))];
const errors: string[] = [];
for (const name of names) {
  if (/(^|\/)(?:\.env(?:\.|$)|id_(?:rsa|ed25519)$)|\.(?:pem|key|p12|pfx)$/i.test(name) && !name.endsWith(".env.example")) {
    errors.push(`Archivo sensible: ${name}`);
  }
  const path = join(root, name);
  let content: string;
  try { if (!statSync(path).isFile()) continue; content = readFileSync(path, "utf8"); }
  catch { continue; } // Staged deletions are not published as files.
  if (/-----BEGIN (?:OPENSSH |RSA |EC |DSA )?PRIVATE KEY-----/.test(content) ||
      /\bgh[pousr]_[A-Za-z0-9]{36,}\b/.test(content) || /\bgithub_pat_[A-Za-z0-9_]{50,}\b/.test(content)) {
    errors.push(`Posible secreto en ${name}`);
  }
  if (/\/Users\/[A-Za-z0-9._-]+\//.test(content)) errors.push(`Ruta personal en ${name}`);
}
for (const name of ["LICENSE", "README.md", "CONTRIBUTING.md", "SECURITY.md", "CODE_OF_CONDUCT.md", "CHANGELOG.md", "THIRD_PARTY_NOTICES.md"]) {
  if (!names.includes(name)) errors.push(`Falta ${name}`);
}
if (errors.length) throw new Error(errors.join("\n"));
console.log(`${names.length} archivos revisados: documentos públicos presentes y sin patrones de secretos detectados.`);
