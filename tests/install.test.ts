import { afterAll, afterEach, beforeAll, expect, setDefaultTimeout, test } from "bun:test";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import pkg from "../package.json";

setDefaultTimeout(120_000);
const root = resolve(import.meta.dir, "..");
const dist = join(root, "dist");
const hasBuild = existsSync(join(dist, "BUILD.json"));
const it = test.skipIf(!hasBuild);
const temps: string[] = [];
let release = "";
const archive = `closelly-aiplc-v${pkg.version}-${process.platform}-${process.arch}.tar.gz`;
const temp = () => { const p = mkdtempSync(join(tmpdir(), "aiplc-install-test-")); temps.push(p); return p; };
beforeAll(() => {
  if (!hasBuild) return;
  release = mkdtempSync(join(tmpdir(), "aiplc-release-test-"));
  const result = Bun.spawnSync([process.execPath, join(root, "scripts/package-release.ts"),
    "--repository", "test-owner/closelly-aiplc-workflows", "--out", release], { cwd: root });
  if (result.exitCode !== 0) throw new Error(result.stderr.toString());
});
afterEach(() => { for (const path of temps.splice(0)) rmSync(path, { recursive: true, force: true }); });
afterAll(() => { if (release) rmSync(release, { recursive: true, force: true }); });
function install(base: string, extra: string[] = [], source = release) {
  mkdirSync(join(base, "profiles"), { recursive: true });
  return Bun.spawnSync(["sh", join(release, "install.sh"), "--from", source,
    "--prefix", join(base, "installed"), "--skills-dir", join(base, "skills"), ...extra], {
    cwd: base, env: { ...process.env, PATH: "/usr/bin:/bin:/usr/sbin:/sbin", SHELL: "/bin/zsh", ZDOTDIR: join(base, "profiles") },
  });
}
function success(result: ReturnType<typeof Bun.spawnSync>) {
  if (result.exitCode !== 0) throw new Error((result.stdout?.toString() ?? "") + (result.stderr?.toString() ?? ""));
}
function metadata(dir: string, body: Uint8Array) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "VERSION"), pkg.version + "\n");
  writeFileSync(join(dir, archive), body);
  writeFileSync(join(dir, "checksums.txt"), createHash("sha256").update(body).digest("hex") + "  " + archive + "\n");
}

it("release installer installs without Bun/Node, supports spaces, and resumes a real isolated product", () => {
  const base = join(temp(), "space and 'quote"); mkdirSync(base);
  success(install(base));
  const cli = join(base, "installed/bin/closelly-aiplc");
  const command = (...args: string[]) => Bun.spawnSync([cli, ...args], { cwd: base });
  success(command("doctor", "--core"));
  expect(readlinkSync(join(base, "skills/closelly-aiplc-po"))).toBe(join(base, "installed/current/assets/skills/closelly-aiplc-po"));
  const loadEnv = Bun.spawnSync(["sh", "-c", '. "$1"; command -v closelly-aiplc', "test-env", join(base, "installed/env")]);
  success(loadEnv); expect(loadEnv.stdout.toString().trim()).toBe(cli);
  const product = join(base, "product");
  success(command("po", "init", product, "--po-name", "Luis", "--name", "Installation smoke test"));
  success(command("--repo", product, "po", "start"));
  const resumed = command("--repo", product, "--json", "po", "resume"); success(resumed);
  const status = JSON.parse(resumed.stdout.toString());
  expect(status.status).toBe("ACTIVE"); expect(status.phase).toBe("discovery");
  expect(status.approvals).toHaveLength(0);
  expect(existsSync(join(product, "docs/technical/aiplc/state.json"))).toBe(false);
});

it("repeat installs keep existing profile content and add the PATH line once", () => {
  const base = temp(); mkdirSync(join(base, "profiles"));
  const profile = join(base, "profiles/.zshrc"); writeFileSync(profile, "# existing configuration\n");
  success(install(base)); success(install(base));
  const contents = readFileSync(profile, "utf8");
  expect(contents.startsWith("# existing configuration\n")).toBe(true);
  expect(contents.match(/# closelly-aiplc/g)).toHaveLength(1);
});

it("checksum failure leaves the destination untouched", () => {
  const base = temp(); const source = join(base, "corrupt");
  const original = readFileSync(join(release, archive)); metadata(source, original);
  appendFileSync(join(source, archive), "corruption");
  const result = install(base, [], source);
  expect(result.exitCode).not.toBe(0); expect(result.stderr.toString()).toContain("SHA-256");
  expect(existsSync(join(base, "installed"))).toBe(false);
});

it("conflicting skills and unrelated installation folders are preserved", () => {
  const base = temp(); const skill = join(base, "skills/closelly-aiplc-po"); mkdirSync(skill, { recursive: true });
  writeFileSync(join(skill, "SKILL.md"), "user content");
  const result = install(base);
  expect(result.exitCode).not.toBe(0); expect(result.stderr.toString()).toContain("skill ajena");
  expect(readFileSync(join(skill, "SKILL.md"), "utf8")).toBe("user content");
  expect(existsSync(join(base, "installed"))).toBe(false);
  mkdirSync(join(base, "installed")); writeFileSync(join(base, "installed/sentinel"), "keep");
  const other = install(base, ["--no-skills"]);
  expect(other.exitCode).not.toBe(0);
  expect(readFileSync(join(base, "installed/sentinel"), "utf8")).toBe("keep");
});

it("offline packages cannot extract traversal paths or symlinks", () => {
  const base = temp(); const source = join(base, "unsafe");
  // Minimal ustar archive with a valid checksum and an unsafe member name.
  const header = Buffer.alloc(512);
  header.write("closelly-aiplc/../../escaped"); header.write("0000644\0", 100);
  header.write("0000000\0", 108); header.write("0000000\0", 116);
  header.write("00000000001\0", 124); header.write("00000000000\0", 136);
  header.fill(32, 148, 156); header.write("0", 156); header.write("ustar\0", 257);
  const sum = header.reduce((a, b) => a + b, 0);
  header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);
  metadata(source, gzipSync(Buffer.concat([header, Buffer.from("x"), Buffer.alloc(511 + 1024)])));
  const result = install(base, [], source);
  expect(result.exitCode).not.toBe(0); expect(result.stderr.toString()).toContain("rutas no admitidas");
  expect(existsSync(join(base, "escaped"))).toBe(false);
  expect(existsSync(join(base, "installed"))).toBe(false);

  const staging = join(base, "staging/closelly-aiplc"); mkdirSync(staging, { recursive: true });
  success(Bun.spawnSync(["ln", "-s", "/tmp", join(staging, "link")]));
  success(Bun.spawnSync(["tar", "-czf", join(source, archive), "-C", join(base, "staging"), "closelly-aiplc"]));
  metadata(source, readFileSync(join(source, archive)));
  const linked = install(base, [], source);
  expect(linked.exitCode).not.toBe(0); expect(linked.stderr.toString()).toContain("enlaces");
});

it("no-modify-path and no-skills are honored; uninstall preserves products and foreign skills", () => {
  const base = temp(); success(install(base, ["--no-modify-path", "--no-skills"]));
  expect(existsSync(join(base, "profiles/.zshrc"))).toBe(false);
  expect(existsSync(join(base, "skills"))).toBe(false);
  success(install(base, ["--no-modify-path"]));
  mkdirSync(join(base, "skills/foreign")); writeFileSync(join(base, "skills/foreign/SKILL.md"), "keep");
  writeFileSync(join(base, "product-sentinel"), "keep");
  success(Bun.spawnSync(["sh", join(base, "installed/uninstall.sh"), "--prefix", join(base, "installed")]));
  expect(existsSync(join(base, "installed"))).toBe(false);
  expect(existsSync(join(base, "skills/closelly-aiplc-po"))).toBe(false);
  expect(readFileSync(join(base, "skills/foreign/SKILL.md"), "utf8")).toBe("keep");
  expect(readFileSync(join(base, "product-sentinel"), "utf8")).toBe("keep");
});

it("local distributions install and refuse to overwrite changed content under the same version", () => {
  const base = temp();
  const args = ["sh", join(root, "install.sh"), "--dist", dist, "--prefix", join(base, "installed"),
    "--skills-dir", join(base, "skills"), "--no-modify-path"];
  success(Bun.spawnSync(args));
  const current = readlinkSync(join(base, "installed/current"));
  const readme = join(base, "installed/current/README.md");
  appendFileSync(readme, "\nlocal modification\n");
  const result = Bun.spawnSync(args);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr.toString()).toContain("contenido diferente");
  expect(readlinkSync(join(base, "installed/current"))).toBe(current);
  expect(readFileSync(readme, "utf8")).toContain("local modification");
  success(Bun.spawnSync([join(base, "installed/bin/closelly-aiplc"), "version"]));
});
