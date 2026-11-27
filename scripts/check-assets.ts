import { readdirSync } from "node:fs";
import { readText, requireThat, run } from "../src/files";
import { distributionDir, Methodology } from "../src/methodology";

const method = new Methodology(distributionDir());
for (const name of readdirSync(method.root + "/skills")) {
  const raw = readText(method.root, `skills/${name}/SKILL.md`);
  const [blank, header, body] = raw.split(/^---\s*$/m, 3);
  const metadata = Bun.YAML.parse(header) as { name?: string; description?: string };
  requireThat(blank === "" && metadata?.name === name && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) &&
    name.length <= 64 && metadata.description && metadata.description.length <= 1024 && body.trim().length > 25,
  `Skill inválida: ${name}`);
}
requireThat(run("sh", ["-n", "templates/reproduce-film.sh"]).status === 0, "Script de reproducción inválido.");
console.log(`Workflows PO/DEV válidos y ${method.snapshots.length} archivos de metodología verificados.`);
