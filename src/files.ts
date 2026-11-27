import { createHash, randomUUID } from "node:crypto";
import {
  closeSync, existsSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readSync,
  readdirSync, realpathSync, renameSync, rmSync, writeFileSync,
} from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

export class Blocked extends Error {}

export function requireThat(value: unknown, message: string): asserts value {
  if (!value) throw new Blocked(message);
}

export function safeRelative(path: string): string {
  requireThat(path.length > 0 && path.length <= 240 && !isAbsolute(path) && !/[\\:\u0000-\u001f\u007f]/.test(path),
    `Ruta inválida: ${path}`);
  requireThat(path.split("/").every(part => part && part !== "." && part !== ".." && part.toLowerCase() !== ".git"),
    `Ruta fuera del ámbito permitido: ${path}`);
  return path;
}

export function entry(path: string) {
  try {
    return lstatSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export function inside(root: string, local: string): string {
  let current = root;
  const parts = safeRelative(local).split("/");
  for (const [index, part] of parts.entries()) {
    current = join(current, part);
    const stat = entry(current);
    requireThat(!stat || (!stat.isSymbolicLink() && (index === parts.length - 1 || stat.isDirectory())),
      `Ruta no admitida (enlace o directorio inválido): ${local}`);
  }
  return current;
}

export function readText(root: string, local: string): string {
  const file = inside(root, local);
  requireThat(entry(file)?.isFile(), `Falta el archivo ${local}`);
  return readFileSync(file, "utf8");
}

export function readJson(root: string, local: string): unknown {
  const content = readText(root, local);
  try {
    return JSON.parse(content);
  } catch {
    throw new Blocked(`JSON inválido: ${local}`);
  }
}

export function atomic(file: string, data: string | Uint8Array): void {
  mkdirSync(dirname(file), { recursive: true });
  const pending = join(dirname(file), `.aiplc-${randomUUID()}.tmp`);
  try {
    writeFileSync(pending, data, { flag: "wx" });
    renameSync(pending, file);
  } finally {
    rmSync(pending, { force: true });
  }
}

export function writeJson(file: string, data: unknown): void {
  atomic(file, JSON.stringify(data, null, 2) + "\n");
}

export function stable(data: unknown): string {
  if (Array.isArray(data)) return "[" + data.map(stable).join(",") + "]";
  if (data && typeof data === "object") {
    return "{" + Object.entries(data).filter(([, value]) => value !== undefined)
      .sort(([a], [b]) => a < b ? -1 : a === b ? 0 : 1)
      .map(([key, value]) => JSON.stringify(key) + ":" + stable(value)).join(",") + "}";
  }
  return JSON.stringify(data);
}

export function digest(data: unknown): string {
  return createHash("sha256").update(stable(data)).digest("hex");
}

export function fileDigest(file: string): string {
  const hash = createHash("sha256");
  const buffer = Buffer.allocUnsafe(256 * 1024);
  const fd = openSync(file, "r");
  try {
    let count: number;
    while ((count = readSync(fd, buffer)) > 0) hash.update(buffer.subarray(0, count));
    return hash.digest("hex");
  } finally {
    closeSync(fd);
  }
}

export function assertShareable(local: string): void {
  requireThat(!local.split("/").some(part =>
    /^(?:\.env(?:$|\.)|node_modules$|\.DS_Store$|\.aiplc-.*\.tmp$|id_(?:rsa|ed25519|ecdsa)$)|\.(?:pem|p12|pfx|key)$/i.test(part)),
  `Retira el archivo local o sensible antes de entregar: ${local}`);
}

export function files(root: string, path: string): string[] {
  const absolute = inside(root, path);
  const stat = entry(absolute);
  requireThat(stat, `Falta ${path}`);
  if (stat.isFile()) return [path];
  requireThat(stat.isDirectory(), `Tipo de archivo no admitido: ${path}`);
  return readdirSync(absolute).sort().flatMap(part => files(root, path + "/" + part));
}

export interface FileEntry { path: string; bytes: number; sha256: string }

export function inventory(root: string, paths: readonly string[]): FileEntry[] {
  return [...new Set(paths)].sort().map(path => {
    assertShareable(path);
    const file = inside(root, path);
    const stat = entry(file);
    requireThat(stat && stat.isFile(), `Falta ${path}`);
    return { path, bytes: stat.size, sha256: fileDigest(file) };
  });
}

export function temporary(label: string): string {
  return mkdtempSync(join(process.env.AIPLC_TMP_DIR || tmpdir(), `aiplc-${label}-`));
}

export function absoluteFile(path: string): string {
  const absolute = resolve(path);
  requireThat(existsSync(absolute) && lstatSync(realpathSync(absolute)).isFile(), `Falta el archivo ${absolute}`);
  return realpathSync(absolute);
}

export interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string | Buffer;
  timeout?: number;
}

export function run(program: string, args: string[], options: RunOptions = {}) {
  return spawnSync(program, args, {
    cwd: options.cwd, env: options.env, input: options.input, encoding: "utf8",
    timeout: options.timeout ?? 30_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true,
  });
}

export function checked(program: string, args: string[], options?: RunOptions): string {
  const result = run(program, args, options);
  requireThat(result.status === 0, `${program} ${args[0] ?? ""}: ${result.error?.message || result.stderr.trim() || result.stdout.trim() || "falló"}`);
  return result.stdout.trim();
}

export async function runLong(program: string, args: string[], options: RunOptions = {}): Promise<{
  code: number | null; stdout: string; stderr: string;
}> {
  return new Promise((fulfill, reject) => {
    const child = spawn(program, args, {
      cwd: options.cwd, env: options.env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    });
    const maxLog = 4 * 1024 * 1024;
    let stdout = "";
    let stderr = "";
    let expired = false;
    const timer = options.timeout && setTimeout(() => {
      expired = true;
      child.kill("SIGKILL");
    }, options.timeout);
    child.stdout.setEncoding("utf8").on("data", data => { stdout = (stdout + data).slice(-maxLog); });
    child.stderr.setEncoding("utf8").on("data", data => { stderr = (stderr + data).slice(-maxLog); });
    child.once("error", reject);
    child.once("close", code => {
      if (timer) clearTimeout(timer);
      if (expired) reject(new Blocked(`${program}: se agotó el tiempo de la comprobación`));
      else fulfill({ code, stdout, stderr });
    });
  });
}

export function git(root: string, args: string[], allowFailure = false): string {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  const gitArgs = ["-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", ...args];
  const result = run("git", gitArgs, { cwd: root, env: { ...env, GIT_TERMINAL_PROMPT: "0" } });
  if (allowFailure && result.status !== 0) return "";
  requireThat(result.status === 0,
    `git ${args[0]}: ${result.error?.message || result.stderr.trim() || "falló"}`);
  return result.stdout.trimEnd();
}
