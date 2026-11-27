import { copyFileSync, cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { assetGroups, distributionDir } from "../src/methodology";

const root = distributionDir();
const output = resolve(root, "dist");
const result = Bun.spawnSync([process.execPath, "build", "--compile", "src/cli.ts", "--outfile", "dist/closelly-aiplc"],
  { cwd: root, stdout: "inherit", stderr: "inherit" });
if (result.exitCode !== 0) process.exit(result.exitCode);
mkdirSync(resolve(output, "assets"), { recursive: true });
mkdirSync(resolve(output, "vendor"), { recursive: true });
for (const group of assetGroups) cpSync(resolve(root, group), resolve(output, "assets", group), { recursive: true });
copyFileSync(resolve(root, "node_modules/gsap/dist/gsap.min.js"), resolve(output, "vendor/gsap.min.js"));
