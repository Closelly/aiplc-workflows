import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import pkg from "../package.json";

const { values } = parseArgs({ options: { repository: { type: "string" }, out: { type: "string" }, dist: { type: "string" } }, strict: true });
const repository = values.repository ?? process.env.GITHUB_REPOSITORY;
if (!repository || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
  throw new Error("Indica --repository OWNER/REPO para generar el instalador de release.");
}
if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) throw new Error("La release necesita una versión X.Y.Z.");
const root = resolve(import.meta.dir, "..");
const dist = resolve(values.dist ?? join(root, "dist"));
const out = resolve(values.out ?? join(root, "release"));
const build = JSON.parse(readFileSync(join(dist, "BUILD.json"), "utf8"));
if (build.version !== pkg.version || !["darwin", "linux"].includes(build.platform) || !["arm64", "x64"].includes(build.arch)) {
  throw new Error("BUILD.json no corresponde a la versión o plataforma soportada.");
}
const name = `closelly-aiplc-v${pkg.version}-${build.platform}-${build.arch}.tar.gz`;
mkdirSync(out, { recursive: true });
const temp = mkdtempSync(join(tmpdir(), "aiplc-release-"));
try {
  cpSync(dist, join(temp, "closelly-aiplc"), { recursive: true });
  const installer = readFileSync(join(root, "install.sh"), "utf8")
    .replace(/^release_repo=.*$/m, `release_repo='${repository}'`)
    .replace("release_version='__RELEASE_VERSION__'", `release_version='${pkg.version}'`);
  // Replace only default declarations, not the marker-detection case patterns.
  writeFileSync(join(out, "install.sh"), installer);
  chmodSync(join(out, "install.sh"), 0o755);
  cpSync(join(root, "uninstall.sh"), join(out, "uninstall.sh"));
  writeFileSync(join(out, "VERSION"), pkg.version + "\n");
  const result = Bun.spawnSync(["tar", "-czf", join(out, name), "-C", temp, "closelly-aiplc"], { stdout: "inherit", stderr: "inherit" });
  if (result.exitCode !== 0) throw new Error("No se pudo crear el archivo de release.");
  const names = [name, "install.sh", "uninstall.sh", "VERSION"];
  writeFileSync(join(out, "checksums.txt"), names.map(file =>
    createHash("sha256").update(readFileSync(join(out, file))).digest("hex") + "  " + file).join("\n") + "\n");
  console.log(`Paquete listo: ${join(out, name)}`);
} finally { rmSync(temp, { recursive: true, force: true }); }
