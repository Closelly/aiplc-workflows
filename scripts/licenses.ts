import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pkg from "../package.json";

export const runtimeVersion = "1.4.5";

export function copyLicenses(root: string, output: string): void {
  if (Bun.version !== runtimeVersion) {
    throw new Error(`Compila con Bun ${runtimeVersion}; al actualizar Bun, actualiza también licenses/bun-LICENSE.md.`);
  }
  mkdirSync(join(output, "licenses/javascript"), { recursive: true });
  copyFileSync(join(root, "licenses/bun-LICENSE.md"), join(output, "licenses/bun-LICENSE.md"));
  const seen = new Set<string>();
  const inventory: { name: string; version: string; license: unknown; files: string[] }[] = [];
  function visit(name: string) {
    if (seen.has(name)) return;
    seen.add(name);
    // Bun's committed lockfile uses the hoisted node_modules layout.
    const dir = join(root, "node_modules", name);
    const info = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
    const dest = join(output, "licenses/javascript", name.replaceAll("/", "__"));
    mkdirSync(dest, { recursive: true });
    const notices = readdirSync(dir, { withFileTypes: true })
      .filter(e => e.isFile() && /^(?:licen[cs]e|copying|notice|copyright)(?:[.-]|$)/i.test(e.name))
      .map(e => e.name);
    for (const file of notices) copyFileSync(join(dir, file), join(dest, file));
    if (name === "gsap") {
      const header = readFileSync(join(dir, "dist/gsap.min.js"), "utf8").split("*/", 1)[0] + "*/\n";
      writeFileSync(join(dest, "NOTICE.txt"), header);
      notices.push("NOTICE.txt");
    }
    writeFileSync(join(dest, "package.json"), JSON.stringify({ name, version: info.version,
      license: info.license, licenses: info.licenses, repository: info.repository, author: info.author }, null, 2) + "\n");
    inventory.push({ name, version: info.version, license: info.license ?? info.licenses, files: notices });
    for (const dependency of Object.keys(info.dependencies ?? {})) visit(dependency);
  }
  for (const name of Object.keys(pkg.dependencies)) visit(name);
  writeFileSync(join(output, "licenses/javascript/INDEX.json"), JSON.stringify(inventory, null, 2) + "\n");
}
