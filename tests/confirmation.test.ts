import { afterEach, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { atomic, digest, files, inventory, run } from "../src/files";
import { project, writeInputs } from "./fixtures";

setDefaultTimeout(30_000);
const fixtures: ReturnType<typeof project>[] = [];
const detail = "Revisión de la definición de negocio.";
const cli = join(import.meta.dir, "../src/cli.ts");
const setup = async () => {
  const p = project({ name: "Luis" }); fixtures.push(p);
  await p.po().startPo(); writeInputs(p.po().repo, "po"); await p.po().advance("po");
  writeInputs(p.po().repo, "po"); return p;
};
afterEach(() => { for (const p of fixtures.splice(0)) p.cleanup(); });
const command = (p: ReturnType<typeof project>, args: string[]) => run(process.execPath, [cli, "--repo", p.root, "--json", ...args]);
const approve = (p: ReturnType<typeof project>, flags: string[] = [], note = detail) =>
  command(p, ["po", "approve", "--note", note, ...flags]);
const preview = (p: ReturnType<typeof project>) => {
  const result = approve(p, ["--prepare"]); expect(result.status).toBe(0);
  return JSON.parse(result.stdout) as { status: string; review: string; message: string };
};
const content = (p: ReturnType<typeof project>) => digest(inventory(p.root, files(p.root, "docs")));

test("a read-only preview and an explicit chat reply record approval without a terminal", async () => {
  const p = await setup(); const before = content(p);
  const request = preview(p);
  expect(request.status).toBe("AWAITING_CONFIRMATION"); expect(request.review).toMatch(/^[a-f0-9]{64}$/);
  expect(content(p)).toBe(before); expect(p.po().repo.state("po").approvals).toHaveLength(0);
  for (const flags of [[], ["--review", request.review], ["--chat-response", "sí"],
    ["--review", request.review, "--chat-response", ""], ["--prepare", "--review", request.review, "--chat-response", "sí"]]) {
    expect(approve(p, flags).status).toBe(2); expect(content(p)).toBe(before);
  }
  expect(approve(p, ["--yes"]).status).not.toBe(0); expect(content(p)).toBe(before);
  const response = "Sí, apruebo esta versión.";
  const result = approve(p, ["--review", request.review, "--chat-response", response]);
  expect(result.status).toBe(0);
  const receipt = p.po().repo.state("po").approvals[0].receipt;
  expect(receipt.actorName).toBe("Luis"); expect(receipt.note).toBe(`${detail}\nRespuesta en el chat: ${response}`);
  expect((await p.po().advance("po")).phase).toBe("ai-native");
});

test("edits and a changed proposal cannot reuse the review the person saw", async () => {
  const p = await setup(); const request = preview(p);
  const flags = ["--review", request.review, "--chat-response", "sí"];
  expect(approve(p, flags, "Otra propuesta para la revisión.").status).toBe(2);
  atomic(p.po().repo.path("docs/aiplc/02-product-definition/product-definition.md"), "# Definición\n\nEl alcance cambió desde que se presentó al PO.");
  const before = content(p);
  const failed = approve(p, flags);
  expect(failed.status).toBe(2); expect(failed.stderr).toContain("revisión cambió");
  expect(content(p)).toBe(before); expect(p.po().repo.state("po").approvals).toHaveLength(0);
  expect(preview(p).review).not.toBe(request.review);
});

test("a knowledge preview does not write the proposed file and rejects changed input", async () => {
  const p = await setup(); const from = join(p.temp, "propuesta.md");
  const source = "docs/aiplc/02-product-definition/product-definition.md";
  atomic(from, "# Regla propuesta\n\nSe agrupan pedidos por fecha de recepción.");
  const args = ["knowledge", "update", "business", "revision.md", "--from", from, "--reference", source, "--note", "Revisión del cambio de negocio."];
  const before = content(p);
  const result = command(p, [...args, "--prepare"]); expect(result.status).toBe(0);
  const request = JSON.parse(result.stdout);
  expect(content(p)).toBe(before); expect(existsSync(p.po().repo.path("docs/business/revision.md"))).toBe(false);
  atomic(from, "# Regla modificada\n\nAhora se agrupan pedidos por cliente.");
  expect(command(p, [...args, "--review", request.review, "--chat-response", "sí"]).status).toBe(2);
  expect(content(p)).toBe(before);
  const fresh = JSON.parse(command(p, [...args, "--prepare"]).stdout);
  expect(command(p, [...args, "--review", fresh.review, "--chat-response", "Apruebo el cambio propuesto."]).status).toBe(0);
  expect(existsSync(p.po().repo.path("docs/business/revision.md"))).toBe(true);
  const noReview = command(p, ["knowledge", "update", "technical", "nota.md", "--from", from, "--reference", source,
    "--note", detail, "--prepare"]);
  expect(noReview.status).toBe(2); expect(existsSync(p.po().repo.path("docs/technical/nota.md"))).toBe(false);
});
