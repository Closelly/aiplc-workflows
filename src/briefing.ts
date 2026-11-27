import PptxGenJS from "pptxgenjs";
import { cpSync, rmSync } from "node:fs";
import { atomic, readText, writeJson } from "./files";
import type { Slide, Tokens } from "./model";
import { baseline, handoff, onboarding, Repository } from "./repository";
import { creative, deckFiles, decks, gtm, handoffPackageFiles, handoffPackageInputs, inspectBriefing, summaries, summaryFiles, ux } from "./quality";

const reviewTitles = ["Resumen ejecutivo", "Resumen de negocio", "Resumen de producto", "Requisitos críticos"];
const deckTitles = ["Pitch de producto", "Presentación del producto", "Presentación comercial"];

async function writeDeck(repo: Repository, filename: string, deckTitle: string, slides: Slide[], tokens: Tokens) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = deckTitle + " · " + repo.config.name;
  pptx.subject = "Onboarding de producto";
  pptx.author = "Closelly AI-PLC";
  const colors = {
    paper: tokens.background.slice(1), ink: tokens.text.slice(1),
    surface: tokens.surface.slice(1), accent: tokens.accent.slice(1),
  };
  for (const [position, data] of slides.entries()) {
    const slide = pptx.addSlide();
    slide.background = { color: colors.paper };
    const common = { color: colors.ink, fontFace: tokens.fontFamily, margin: 0, valign: "middle" as const };
    slide.addText(repo.config.name + "  /  " + deckTitle, {
      ...common, x: 0.75, y: 0.52, w: 11.4, h: 0.3, fontSize: 13,
    });
    slide.addShape(pptx.ShapeType.rect, {
      x: 0.75, y: 1.06, w: 0.95, h: 0.06, fill: { color: colors.accent }, line: { transparency: 100 },
    });
    slide.addText(data.title, { ...common, x: 0.75, y: 1.24, w: 11.75, h: 1.12, fontSize: 39, bold: true, fit: "shrink" });
    slide.addText(data.keyMessage, { ...common, x: 0.75, y: 2.61, w: 11.65, h: 0.95, fontSize: 22, fit: "shrink" });
    for (const [index, point] of data.points.entries()) {
      const y = 3.84 + index * 0.71;
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.75, y, w: 11.82, h: 0.58, fill: { color: colors.surface }, line: { transparency: 100 },
      });
      slide.addText(point, { ...common, x: 0.98, y: y + 0.05, w: 11.10, h: 0.48, fontSize: 16, fit: "shrink" });
    }
    slide.addText(`${position + 1} / ${slides.length}`, {
      ...common, x: 11.14, y: 7.01, w: 1.36, h: 0.2, fontSize: 10, align: "right",
    });
    slide.addNotes(data.notes + "\n\nFuentes: " + data.sources.join(" · "));
  }
  const bytes = await pptx.write({ outputType: "uint8array", compression: true });
  atomic(repo.path(onboarding + "/" + filename), bytes as Uint8Array);
}

function startHere(repo: Repository): string {
  return `# Onboarding · ${repo.config.name}

1. Lee el [resumen ejecutivo](executive-summary.md) y el [resumen de negocio](business-summary.md).
2. Revisa el [pitch](product-pitch-deck.pptx), la [presentación de producto](product-presentation.pptx) y la [presentación comercial](marketing-presentation.pptx).
3. Reproduce la [película](product-walkthrough.mp4). Tiene voz sintetizada, capítulos y subtítulos seleccionables. También están el [índice](video-chapters.json), los [subtítulos](video-subtitles.srt) y la [transcripción](video-transcript.md).
4. Abre el [prototipo interactivo](../prototype/index.html) y recorre sus flujos con el [resumen de producto](product-summary.md).
5. Contrasta los [requisitos críticos](critical-requirements.md) con las [especificaciones](../../06-specifications/requirements.json) y sus [pruebas](../../07-validation/test-cases.json).
6. Revisa la [estructura del repositorio](../../../../AGENTS.md) y registra tus preguntas con closelly-aiplc dev clarify.

Después de recibir el tag aiplc-baseline-v1, ejecuta closelly-aiplc dev onboard para completar el recorrido guiado. El alcance original se conserva en el tag y la documentación vigente se mantiene por separado.
`;
}

function seedLiving(repo: Repository) {
  const seeds = [
    [baseline + "/02-product-definition/product-definition.md", "docs/business/product.md"],
    [baseline + "/02-product-definition/business-rules.md", "docs/business/business-rules.md"],
    [baseline + "/02-product-definition/outcomes.md", "docs/business/outcomes.md"],
    [gtm + "/strategy.md", "docs/business/commercial-strategy.md"],
    [gtm + "/commercial-plan.json", "docs/business/commercial-plan.json"],
  ];
  for (const [from, to] of seeds) {
    if (!repo.has(to)) atomic(repo.path(to), readText(repo.root, from));
  }
}

export async function preparePackage(repo: Repository) {
  const inputs = handoffPackageInputs(repo);
  try {
    const current = repo.json<{ inputs: string; files: string }>("package-receipt", handoff + "/package-receipt.json");
    if (current.inputs === inputs && current.files === handoffPackageFiles(repo)) {
      seedLiving(repo);
      return;
    }
  } catch {
    // Missing or modified generated files are rebuilt from their inputs.
  }
  const brief = inspectBriefing(repo);
  const tokens = repo.json<Tokens>("design-tokens", creative + "/design-tokens.json");
  const prototype = repo.path(handoff + "/prototype");
  rmSync(repo.path(handoff + "/package-receipt.json"), { force: true });
  rmSync(prototype, { recursive: true, force: true });
  cpSync(repo.path(ux + "/prototype"), prototype, { recursive: true });
  atomic(repo.path(onboarding + "/START-HERE.md"), startHere(repo));
  for (const [index, key] of summaries.entries()) {
    atomic(repo.path(onboarding + "/" + summaryFiles[index]),
      `# ${reviewTitles[index]} · ${repo.config.name}\n\n${brief.summaries[key].join("\n\n")}\n`);
  }
  for (const [index, key] of decks.entries()) {
    await writeDeck(repo, deckFiles[index], deckTitles[index], brief.decks[key], tokens);
  }
  writeJson(repo.path(handoff + "/package-receipt.json"), { inputs, files: handoffPackageFiles(repo) });
  seedLiving(repo);
}
