import { copyFileSync, cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { assetGroups, distributionDir } from "../src/methodology";
import { copyLicenses } from "./licenses";
import pkg from "../package.json";

const root = distributionDir();
const output = resolve(root, "dist");
rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });
const result = Bun.spawnSync([process.execPath, "build", "--compile", "src/cli.ts", "--outfile", "dist/closelly-aiplc"],
  { cwd: root, stdout: "inherit", stderr: "inherit" });
if (result.exitCode !== 0) process.exit(result.exitCode);
mkdirSync(resolve(output, "assets"), { recursive: true });
mkdirSync(resolve(output, "vendor"), { recursive: true });
for (const group of assetGroups) cpSync(resolve(root, group), resolve(output, "assets", group), { recursive: true });
copyFileSync(resolve(root, "node_modules/gsap/dist/gsap.min.js"), resolve(output, "vendor/gsap.min.js"));
for (const file of ["LICENSE", "THIRD_PARTY_NOTICES.md", "README.md", "CONTRIBUTING.md", "SECURITY.md", "CHANGELOG.md", "uninstall.sh"]) {
  copyFileSync(resolve(root, file), resolve(output, file));
}
cpSync(resolve(root, "docs"), resolve(output, "docs"), { recursive: true });
copyLicenses(root, output);
writeFileSync(resolve(output, "BUILD.json"), JSON.stringify({ version: pkg.version, bun: Bun.version,
  platform: process.platform, arch: process.arch }, null, 2) + "\n");
