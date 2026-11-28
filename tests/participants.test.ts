import { afterEach, expect, setDefaultTimeout, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { approve, complete } from "../src/engine";
import { atomic, run, writeJson } from "../src/files";
import { sameName, verifyReceipt } from "../src/identity";
import { Lifecycle } from "../src/lifecycle";
import { invitationFile, invitationText, participantFile } from "../src/participants";
import { snapshot } from "../src/quality";
import { Repository, stateFiles, tag, taggedManifest } from "../src/repository";
import { approved, confirmForTests, project, toHandoff, writeInputs } from "./fixtures";

const fixtures: ReturnType<typeof project>[] = [];
setDefaultTimeout(30_000);
const setup = () => { const p = project({ name: "Luis Pérez" }); fixtures.push(p); return p; };
afterEach(() => { for (const p of fixtures.splice(0)) p.cleanup(); });

test("the PO starts alone with a name, without generating SSH keys or enrolling DEV", async () => {
  const p = setup();
  expect(p.po().repo.config.version).toBe(2);
  expect(p.po().repo.config.roles.po.name).toBe("Luis Pérez");
  expect(p.po().repo.config.roles.dev).toBeNull();
  expect(existsSync(p.keyPo)).toBe(false); expect(existsSync(p.keyDev)).toBe(false);
  const status = await p.po().startPo();
  expect(status.phase).toBe("discovery");
  expect(status.lastEvent?.actorName).toBe("Luis Pérez");
  expect(status.approvals).toHaveLength(0);
  expect(p.po().repo.has(invitationFile)).toBe(false);
  await expect(p.po().invite("Ana Muñoz")).rejects.toThrow("entrega final");
  await expect(p.dev().onboard("Ana Muñoz")).rejects.toThrow("aún debe cerrar");
});

test("name confirmations retain document-version checks and cannot be recorded by an unidentified role", async () => {
  const p = setup(); await p.po().startPo();
  writeInputs(p.po().repo, "po"); await p.po().advance("po");
  writeInputs(p.po().repo, "po"); await p.po().accept("po", approved, confirmForTests);
  const proof = p.po().repo.state("po").approvals[0].receipt;
  expect(proof.actorName).toBe("Luis Pérez"); expect(proof.confirmation).toBe("name"); expect(proof.signature).toBeUndefined();
  expect(() => verifyReceipt(p.po().repo.config, { ...proof, actorName: "Otra persona" }, "po", proof.purpose, proof.digest)).toThrow("inválida");
  atomic(p.po().repo.path("docs/aiplc/02-product-definition/product-definition.md"), "# Cambio\n\nAlcance modificado después de revisar.");
  await expect(p.po().advance("po")).rejects.toThrow("desactualizada");
  await expect(p.po().identify("po", "Otra persona")).rejects.toThrow("debe coincidir");
});

// This fixture seals synthetic content to test identity transfer and Git integrity.
// It does not claim to render or validate a real onboarding movie.
async function sealedIdentityFixture(p: ReturnType<typeof project>) {
  await toHandoff(p);
  await p.po().invite("Ana Muñoz");
  const repo = p.po().repo;
  for (const step of repo.method.workflows.dev.phases[0].checklist!) {
    for (const path of step.resources) if (!repo.has(path)) atomic(repo.path(path), "Synthetic onboarding fixture\n");
  }
  const state = repo.state("po"), phase = repo.method.workflows.po.phases.at(-1)!;
  const hash = snapshot(repo, phase, state);
  const receipt = p.po().access("po", "fixture").receipt("gate:handoff", hash, approved);
  const event = { type: "approve" as const, actor: receipt.actor, actorName: receipt.actorName, phase: phase.id, at: new Date().toISOString() };
  const accepted = approve(state, repo.method.workflows.po, { phase: phase.id, gate: "handoff", receipt }, event);
  const sealed = complete(accepted, repo.method.workflows.po, hash, { ...event, type: "seal" });
  repo.save(sealed); writeJson(repo.path(taggedManifest), repo.createManifest(sealed));
  repo.git(["add", "AGENTS.md", "docs"]); repo.git(["commit", "-m", "Seal synthetic identity fixture"]);
  repo.git(["tag", "-a", tag, "-m", "Identity fixture"]);
  repo.verifyHandoff();
  const clone = join(p.temp, "dev-clone");
  expect(run("git", ["clone", "--quiet", p.root, clone]).status).toBe(0);
  return new Repository(clone);
}

test("the PO names the recipient at handoff; DEV joins a clone using only the matching name", async () => {
  const p = setup(); const repo = await sealedIdentityFixture(p);
  const dev = new Lifecycle(repo);
  expect(repo.has(invitationText)).toBe(true);
  await expect(dev.onboard()).rejects.toThrow("Cómo te llamas");
  await expect(dev.onboard("Pedro")).rejects.toThrow("dirigida a Ana Muñoz");
  expect(repo.has(participantFile)).toBe(false); expect(repo.has(stateFiles.dev)).toBe(false);
  expect((await dev.onboard("  ana   munoz ")).phase).toBe("developer-onboarding");
  expect(repo.identity("dev")?.name).toBe("Ana Muñoz");
  expect(repo.git(["config", "--local", "user.name"])).toBe("Ana Muñoz");
  expect(repo.git(["config", "--local", "user.email"])).toBe("developer@aiplc.invalid");
  expect(repo.state("dev").events.at(-1)?.actorName).toBe("Ana Muñoz");
  expect(repo.config.roles.dev).toBeNull();
  await expect(dev.startPo()).rejects.toThrow("Identifícate");
  await dev.acknowledge("welcome", approved, confirmForTests);
  expect(repo.state("dev").checklist[0].actorName).toBe("Ana Muñoz");
  expect(repo.verifyHandoff().projectId).toBe(repo.config.projectId);
});

test("the sealed invitation and accepted participant stay bound to the named recipient", async () => {
  const p = setup(); const repo = await sealedIdentityFixture(p); const dev = new Lifecycle(repo);
  await dev.onboard("Ana Muñoz");
  const record = repo.json<any>("participant", participantFile);
  writeJson(repo.path(participantFile), { ...record, identity: { ...record.identity, name: "Pedro" } });
  expect(() => repo.identity("dev")).toThrow("no coincide");
  expect(sameName("Ana Muñoz", "ana munoz")).toBe(true);
  expect(sameName("Ana Muñoz", "Otra Ana")).toBe(false);
});
