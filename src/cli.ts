#!/usr/bin/env bun
import { parseArgs } from "node:util";
import { createInterface } from "node:readline/promises";
import { Blocked, requireThat } from "./files";
import { workOrder } from "./harness";
import { audit, updateKnowledge } from "./knowledge";
import { Lifecycle, assertArea, type Confirm } from "./lifecycle";
import { version } from "./methodology";
import type { Config, Role, TtsConfig } from "./model";
import { doctor } from "./providers";
import { init, Repository } from "./repository";

const help = `closelly-aiplc ${version}

Uso: closelly-aiplc [--repo PATH] [--json] grupo comando [argumentos]
El PO se identifica al crear el producto. El DEV/OPS se incorpora por invitación al final.

PO
  po init PATH --po-name TU-NOMBRE [--name PRODUCTO --idea IDEA --po-email CORREO]
  po identify --name TU-NOMBRE
  po start | resume | status | scaffold | validate | advance
  po approve --note NOTA
  po revise FASE --note MOTIVO
  po handoff [--prepare] [--force-render]
  po invite --dev-name NOMBRE-DEL-DEV
  po answer Q-ID --note RESPUESTA

DEV
  dev onboard --name TU-NOMBRE [--email CORREO]
  dev identify --name TU-NOMBRE
  dev resume | status | scaffold | validate | advance
  dev ack PASO --note NOTA
  dev approve --note NOTA
  dev clarify --note PREGUNTA --reference RUTA [--blocking]
  dev architect | plan
  dev ready --note NOTA

Compartidos
  doctor [--core] [--probe] [--tts say|command --voice NOMBRE --language es-CL]
  config [--harness codex|portable] [--tts say|command --voice NOMBRE [--credential-env VARIABLE]] [--language es-CL]
  harness context po|dev
  knowledge audit
  knowledge update business|technical|operations RUTA --from ARCHIVO --reference ORIGEN --note MOTIVO [--as po|dev] [--scope-change]
  version | help
`;

const string = { type: "string" as const };
const bool = { type: "boolean" as const };
const allOptions = {
  repo: string, json: bool, key: string, help: bool, version: bool,
  "po-key": string, "dev-key": string, "po-id": string, "dev-id": string, name: string,
  "po-name": string, "po-email": string, "dev-name": string, email: string,
  idea: string, language: string, note: string, prepare: bool, "force-render": bool, reference: string,
  blocking: bool, harness: string, tts: string, voice: string, "credential-env": string,
  probe: bool, core: bool, as: string, from: string, "scope-change": bool,
};
const global = ["repo", "json", "key"];
const rules: Record<string, { flags?: (keyof typeof allOptions)[]; count?: number }> = {
  "po init": { flags: ["po-key", "dev-key", "po-id", "dev-id", "name", "idea", "language", "po-name", "po-email"], count: 1 },
  "po identify": { flags: ["name"] }, "dev identify": { flags: ["name"] },
  "po invite": { flags: ["dev-name"] },
  "po start": {}, "po resume": {}, "po status": {}, "po scaffold": {}, "po validate": {}, "po advance": {},
  "po approve": { flags: ["note"] }, "po revise": { flags: ["note"], count: 1 },
  "po handoff": { flags: ["prepare", "force-render"] }, "po answer": { flags: ["note"], count: 1 },
  "dev onboard": { flags: ["name", "email"] }, "dev resume": {}, "dev status": {}, "dev scaffold": {}, "dev validate": {}, "dev advance": {},
  "dev ack": { flags: ["note"], count: 1 }, "dev approve": { flags: ["note"] },
  "dev clarify": { flags: ["note", "reference", "blocking"] }, "dev architect": {}, "dev plan": {},
  "dev ready": { flags: ["note"] },
  "doctor": { flags: ["probe", "core", "tts", "voice", "language", "credential-env"] },
  "config": { flags: ["harness", "tts", "voice", "language", "credential-env"] },
  "harness context": { count: 1 }, "knowledge audit": {},
  "knowledge update": { flags: ["as", "from", "reference", "note", "scope-change"], count: 2 },
};

const confirm: Confirm = async (message, _snapshot) => {
  requireThat(process.stdin.isTTY && process.stderr.isTTY,
    "La aprobación requiere a la persona responsable en una terminal interactiva.");
  const terminal = createInterface({ input: process.stdin, output: process.stderr });
  try {
    const token = "CONFIRMAR";
    process.stderr.write(message + "\n");
    const answer = await terminal.question(`Escribe ${token}: `);
    requireThat(answer.trim() === token, "La confirmación no coincide.");
  } finally { terminal.close(); }
};

function role(value: string): Role {
  requireThat(value === "po" || value === "dev", "El rol debe ser po o dev.");
  return value;
}

function display(data: unknown, json: boolean): void {
  if (typeof data === "string" && !json) {
    console.log(data);
    return;
  }
  if (json || !data || typeof data !== "object") {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  if (Array.isArray(data) && data.every(item => typeof item?.ok === "boolean")) {
    for (const item of data) console.log(`${item.ok ? "OK" : item.required ? "FALTA" : "OPCIONAL"}  ${item.name}  ${item.detail}`);
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}

async function main() {
  const { values, positionals } = parseArgs({ options: allOptions, allowPositionals: true, strict: true });
  const [group, action, ...rest] = positionals;
  if (group === "version" || values.version) return display(version, !!values.json);
  if (!group || values.help || group === "help") return display(help, !!values.json);
  const command = ["po", "dev", "knowledge", "harness"].includes(group) ? group + " " + action : group;
  const args = command === group ? positionals.slice(1) : rest;
  const permitted = rules[command];
  requireThat(permitted, "Comando desconocido. Ejecuta closelly-aiplc help.");
  requireThat(args.length === (permitted.count ?? 0), "Cantidad de argumentos incorrecta. Consulta help.");
  for (const option of Object.keys(values)) {
    requireThat(global.includes(option) || permitted.flags?.includes(option as keyof typeof allOptions),
      `--${option} no se admite en ${command}.`);
  }
  const print = (data: unknown) => display(data, !!values.json);
  const needed = (value: string | undefined, flag: string) => {
    requireThat(typeof value === "string" && value.trim().length > 0, `Falta --${flag}.`);
    return value;
  };
  const tts = (): TtsConfig | undefined => {
    if (!values.tts && !values.voice && !values["credential-env"]) return;
    requireThat(values.tts === "say" || values.tts === "command", "Usa --tts say o --tts command.");
    requireThat(values.tts === "command" || !values["credential-env"], "say no usa credenciales externas.");
    return { provider: values.tts, voice: needed(values.voice, "voice"), credentialEnv: values["credential-env"] };
  };

  if (command === "po init") {
    const path = init({
      target: args[0], poPublicKey: values["po-key"], devPublicKey: values["dev-key"],
      poName: values["po-name"], poEmail: values["po-email"],
      poId: values["po-id"], devId: values["dev-id"], name: values.name, idea: values.idea, language: values.language,
    });
    return print({ status: "INITIALIZED", path, next: "closelly-aiplc po start" });
  }

  if (command === "doctor") {
    let repo: Repository | undefined;
    if (values.repo) repo = new Repository(values.repo);
    else {
      try { repo = new Repository(process.cwd()); }
      catch (error) { if (!(error instanceof Blocked)) throw error; }
    }
    const checks = await doctor(repo?.root ?? process.cwd(), values.language ?? repo?.config.language ?? "es-CL",
      tts() ?? repo?.config.tts, !!values.probe, !!values.core);
    print(checks);
    if (checks.some(check => check.required && !check.ok)) process.exitCode = 2;
    return;
  }

  const repo = new Repository(values.repo ?? process.cwd());
  const lifecycle = new Lifecycle(repo, values.key);
  const note = () => needed(values.note, "note");
  const progress = (message: string) => console.error(message);
  const currentOrder = (forRole: Role, expected?: string) => {
    if (forRole === "dev") lifecycle.access("dev", "work-order");
    const { phase, state } = lifecycle.current(forRole);
    requireThat(!expected || phase.id === expected, `El comando está reservado para ${expected}. Fase actual: ${phase.id}.`);
    return workOrder(repo, forRole, phase, state.checklist.length);
  };

  switch (command) {
    case "po identify": return print(await lifecycle.identify("po", needed(values.name, "name")));
    case "dev identify": return print(await lifecycle.identify("dev", needed(values.name, "name")));
    case "po invite": return print(await lifecycle.invite(needed(values["dev-name"], "dev-name")));
    case "po start": return print(await lifecycle.startPo());
    case "po status": return print(lifecycle.status("po"));
    case "dev status": return print(lifecycle.status("dev"));
    case "po resume":
    case "dev resume": {
      const forRole = role(group);
      const status = lifecycle.status(forRole);
      return print(status.status === "ACTIVE" ? { ...status, ...currentOrder(forRole) } : status);
    }
    case "po scaffold":
    case "dev scaffold": return print(await lifecycle.scaffold(role(group)));
    case "po validate":
    case "dev validate": return print(await lifecycle.validate(role(group)));
    case "po advance":
    case "dev advance": return print(await lifecycle.advance(role(group)));
    case "po approve":
    case "dev approve": return print(await lifecycle.accept(role(group), note(), confirm));
    case "po revise": return print(await lifecycle.revise(args[0], note()));
    case "po handoff": {
      const result = await lifecycle.handoff(!!values.prepare, !!values["force-render"], progress);
      print(result);
      if (result.status === "AWAITING_REVIEW" && !values.prepare) process.exitCode = 2;
      return;
    }
    case "po answer": return print(await lifecycle.answer(args[0], note(), confirm));
    case "dev onboard": return print(await lifecycle.onboard(values.name, values.email));
    case "dev ack": return print(await lifecycle.acknowledge(args[0], note(), confirm));
    case "dev clarify": return print(await lifecycle.clarify(note(), needed(values.reference, "reference"), !!values.blocking));
    case "dev architect": return print(currentOrder("dev", "architecture"));
    case "dev plan": return print(currentOrder("dev", "engineering-planning"));
    case "dev ready": return print(await lifecycle.accept("dev", note(), confirm, true));
    case "harness context": return print(currentOrder(role(args[0])));
    case "knowledge audit": {
      const result = audit(repo);
      print(result);
      if (result.issues.length) process.exitCode = 2;
      return;
    }
    case "knowledge update": {
      assertArea(args[0]);
      return print(await updateKnowledge(lifecycle, args[0], args[1], needed(values.from, "from"),
        needed(values.reference, "reference"), note(), !!values["scope-change"], values.as ? role(values.as) : undefined, confirm));
    }
    case "config": {
      const change: Partial<Pick<Config, "language" | "harness" | "tts">> = {};
      const voice = tts();
      if (voice) change.tts = voice;
      if (values.language) change.language = values.language;
      if (values.harness) {
        requireThat(values.harness === "codex" || values.harness === "portable", "Harness disponible: codex o portable.");
        change.harness = values.harness;
      }
      return print(Object.keys(change).length ? await lifecycle.configure(change) : repo.config);
    }
  }
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  if (process.argv.includes("--json")) console.error(JSON.stringify({ status: "BLOCKED", message }));
  else console.error("Bloqueado. " + message);
  process.exitCode = error instanceof Blocked ? 2 : 1;
});
