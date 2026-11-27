import { deflateSync } from "node:zlib";
import { readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { atomic, checked, temporary, writeJson } from "../src/files";
import { Lifecycle, type Confirm } from "../src/lifecycle";
import type { Role } from "../src/model";
import { baseline, init, Repository } from "../src/repository";
import { creative, gtm, spec, ux } from "../src/quality";

export const confirmForTests: Confirm = async () => {};
export const evidence = "Fixture de integración: alcance, fuentes y evidencia controlada.";
export const approved = "Confirmación emitida con las claves temporales de las pruebas.";

export function project() {
  const temp = temporary("test");
  const keyPo = join(temp, "po");
  const keyDev = join(temp, "dev");
  for (const path of [keyPo, keyDev]) checked("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", path]);
  const root = init({ target: join(temp, "demo"), poPublicKey: keyPo + ".pub", devPublicKey: keyDev + ".pub",
    poId: "po-fixture", devId: "dev-fixture", name: "Taller de pedidos", language: "es-CL" });
  const repo = new Repository(root);
  repo.git(["config", "user.name", "Closelly AI-PLC Test"]);
  repo.git(["config", "user.email", "aiplc@example.invalid"]);
  return {
    temp, root, keyPo, keyDev,
    po: () => new Lifecycle(new Repository(root), keyPo),
    dev: () => new Lifecycle(new Repository(root), keyDev),
    cleanup: () => rmSync(temp, { recursive: true, force: true }),
    rootEntries: () => readdirSync(root).sort(),
  };
}

export type Fixture = ReturnType<typeof project>;

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

export function testPng(variant: number): Buffer {
  const width = 640;
  const height = 400;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const rows = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * (1 + width * 3) + 1 + x * 3;
      const panel = x > 46 && x < 594 && y > 40 && y < 356;
      const tile = x > 82 && x < 558 && y > 160 && y < 278;
      rows[index] = tile ? 98 : panel ? 240 : 8 + variant;
      rows[index + 1] = tile ? 191 : panel ? 242 : 27;
      rows[index + 2] = tile ? 175 : panel ? 255 : 44;
    }
  }
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)), chunk("IEND", Buffer.alloc(0))]);
}

const domainUrls = ["https://www.w3.org/WAI/", "https://www.designsystem.digital.gov/", "https://design-system.service.gov.uk/"];
const techEvidence = "Propuesta de prueba. La ejecución y verificación del documento corresponden al equipo técnico.";
const day = () => new Date().toISOString().slice(0, 10);
const research = () => ({
  sources: domainUrls.slice(0, 2).map((url, i) => ({
    id: "S" + i, title: "Fuente de prueba " + i, url, accessedOn: day(), observation: evidence,
  })),
  hypotheses: [{ claim: "Los talleres necesitan un lugar para registrar pedidos.", test: "Comparar el tiempo con y sin el prototipo." }],
  limitations: "Fuentes usadas como datos de prueba del validador. No constituyen investigación de mercado.",
});

const definition = baseline + "/02-product-definition/product-definition.md";

export function writeInputs(repo: Repository, role: Role) {
  const state = repo.state(role);
  const phase = repo.method.workflows[role].phases[state.cursor];
  for (const a of phase.artifacts.filter(a => a.type === "md" && !a.generated)) {
    atomic(repo.path(phase.folder + "/" + a.path), "# " + phase.title + "\n\n" + (role === "po" ? evidence : techEvidence) + "\n");
  }
  const json = (name: string, data: unknown) => writeJson(repo.path(phase.folder + "/" + name), data);

  switch (phase.id) {
    case "discovery": json("research.json", research()); break;
    case "ai-native": json("opportunities.json", { opportunities: [], decisionBasis: "Se aplaza IA para aislar la prueba de usabilidad." }); break;
    case "brand-creative":
      json("visual-research.json", {
        references: domainUrls.map((url, i) => ({
          id: "R" + i, title: "Referencia " + i, url, accessedOn: day(), observation: evidence,
          asset: `references/test-${i}.png`, usage: "Fixture gráfica sintética." ,
        })),
        directions: domainUrls.map((_, i) => ({
          id: "D" + i, title: "Dirección " + i, referenceIds: ["R" + i],
          moodboard: `moodboards/test-${i}.png`, tradeoff: "Equilibrio entre densidad y énfasis.",
        })),
      });
      json("direction.json", {
        selected: "D0", participant: repo.config.roles.po.id, feedback: ["Se prefirió una navegación con menos pasos."],
        rationale: "El pedido tiene un camino evidente y directo.",
        rejected: [{ id: "D1", reason: "Oculta la acción frecuente." }, { id: "D2", reason: "Requiere revisar demasiadas opciones." }],
      });
      json("design-tokens.json", {
        background: "#14273B", text: "#F8FAFC", surface: "#233D57", accent: "#70DDC4", fontFamily: "Inter",
        rationale: "Contraste alto para operar en ambientes con reflejos.",
      });
      for (let i = 0; i < 3; i++) {
        atomic(repo.path(creative + `/references/test-${i}.png`), testPng(i));
        atomic(repo.path(creative + `/moodboards/test-${i}.png`), testPng(i + 5));
      }
      break;
    case "ux-ui":
      atomic(repo.path(ux + "/prototype/index.html"), `<!doctype html><html lang="es"><meta charset="utf-8">
<title>Taller de pedidos</title><main style="max-width:720px;margin:80px auto;padding:32px;font:24px system-ui;background:#edf2f7">
<h1>Taller de pedidos</h1><p>Centraliza los pedidos entrantes.</p>
<form id="order"><label>Pedido <input required></label> <button>Registrar pedido</button></form><p role="status" id="status"></p>
</main><script>order.addEventListener("submit", e => { e.preventDefault(); status.textContent="Pedido registrado"; });</script></html>`);
      atomic(repo.path(ux + "/walkthrough/new-order.png"), testPng(10));
      json("flows.json", { flows: [{
        id: "F1", title: "Nuevo pedido", user: "Operador", steps: ["Escribir pedido y registrar."],
        states: ["Espera, formulario y estado de confirmación."],
        screenshots: ["walkthrough/new-order.png"], accessibility: "Acción disponible desde teclado.",
      }] });
      break;
    case "specifications":
      json("requirements.json", { requirements: [{
        id: "R1", title: "Registrar pedido", description: "Registrar una solicitud y confirmar su recepción.",
        source: definition, priority: "critical", flows: ["F1"], acceptance: ["Mostrar confirmación al guardar."],
      }] });
      break;
    case "validation":
      json("test-cases.json", { cases: [{
        id: "T1", requirement: "R1", criteria: [1], kind: "prototype", steps: ["Registrar una orden válida."],
        expected: "Se presenta la confirmación.",
      }] });
      json("validation-results.json", { results: [{ test: "T1", outcome: "pass", evidence }], openIssues: [] });
      break;
    case "go-to-market":
      json("research.json", research());
      json("commercial-plan.json", {
        alternatives: [
          { id: "direct", name: "Venta directa", upside: "Aprendizaje cercano del problema.", tradeoff: "Consume tiempo del PO." },
          { id: "organic", name: "Contenido útil", upside: "Funciona con un presupuesto menor.", tradeoff: "Toma más tiempo para llegar." },
        ],
        recommendation: "direct", rationale: "La prioridad es conocer objeciones antes de invertir.",
        budget: { currency: "CLP", monthly: 15000, allocation: "Probar comunicación y materiales directos.", poWeeklyHours: 3 },
        phases: ["prelaunch", "launch", "growth"].map(id => ({
          id, objective: "Confirmar disposición a probar.", activities: ["Validar con talleres."],
          metrics: [{ name: "Entrevistas", target: "Cinco contactos", measurement: "Registrar notas con permiso.", owner: "PO" }],
          exitCriteria: "Tener evidencia de una necesidad concreta.",
        })),
        humanTasks: ["prelaunch", "launch", "growth"].map((phase, i) => ({
          id: "H" + i, phase, owner: "po", objective: "Conversar con el segmento.",
          instructions: "Mostrar la propuesta y registrar objeciones.", due: "Semana " + (i + 1),
          effortHours: 1, materials: [], dependencies: i ? ["H" + (i - 1)] : [], expected: "Obtener decisión de seguimiento.",
          evidence: "Notas redactadas y permiso explícito.",
        })),
        experiments: [{ id: "E1", hypothesis: "Una demo concreta aumenta las solicitudes.", channel: "Búsqueda", cost: 0,
          duration: "14 días", metric: "Solicitudes", target: "10 demos", continueIf: "Reciben valor una mayoría de usuarios.",
          stopIf: "La tasa de interés no aumenta.", impact: "medium", confidence: "low", effort: "low" }],
        growthRequirements: ["R1"],
      });
      break;
    case "handoff": {
      const slide = (title: string, sources: string[]) => ({
        title, keyMessage: "El equipo puede registrar pedidos en un solo recorrido.",
        points: ["Una confirmación clara", "El PO mide valor y demanda"], notes: "El ejemplo es un insumo de la prueba.", sources,
      });
      const deck = (sources: string[]) => ["Objetivo", "Recorrido", "Qué sigue"].map(title => slide(title, sources));
      json("briefing.json", {
        summaries: Object.fromEntries(["executive", "business", "product", "critical"].map(k => [k, [evidence]])),
        decks: {
          pitch: deck([definition, gtm + "/strategy.md"]),
          product: deck([ux + "/flows.json", spec + "/requirements.json"]),
          marketing: deck([gtm + "/commercial-plan.json"]),
        },
      });
      const topics = {
        product: ["El producto", spec + "/requirements.json", "El taller registra un pedido y recibe confirmación."],
        prototype: ["Recorrido", ux + "/flows.json", "En el prototipo, pulsa registrar y observa la confirmación."],
        business: ["El negocio", definition, "El usuario reúne los pedidos en un solo punto."],
        marketing: ["Salida al mercado", gtm + "/commercial-plan.json", "El equipo parte con entrevistas y mide la conversión."],
      };
      json("video-plan.json", {
        language: "es-CL",
        chapters: Object.entries(topics).map(([category, [title, source, text]]) => ({
          id: category, category, title, sources: [source], scenes: [{
            title, takeaway: text, points: ["Pedido registrado", "Seguir la señal de avance"], narration: [text],
            layout: category === "prototype" ? "prototype" : "process",
            ...(category === "prototype" ? { image: ux + "/walkthrough/new-order.png", focus: { x: 55, y: 59 } } : {}),
          }],
        })),
      });
      break;
    }
  }
}

export async function toHandoff(fixture: Fixture) {
  await fixture.po().startPo();
  const workflow = fixture.po().repo.method.workflows.po;
  for (const phase of workflow.phases.slice(0, -1)) {
    writeInputs(fixture.po().repo, "po");
    if (phase.gate) await fixture.po().accept("po", approved, confirmForTests);
    await fixture.po().advance("po");
  }
  writeInputs(fixture.po().repo, "po");
}
