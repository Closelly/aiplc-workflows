import type { Chapter, Scene, Tokens } from "./model";

export interface Cue { text: string; startMs: number; endMs: number; file: string }
export interface TimedScene { scene: Scene; startMs: number; endMs: number; asset?: string }

export function html(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

const sec = (ms: number) => (ms / 1000).toFixed(3);

export function composition(
  chapter: Chapter, tokens: Tokens, scenes: TimedScene[], cues: Cue[], duration: number, language: string,
): string {
  const shots = scenes.map(({ scene, startMs, endMs, asset }, i) => {
    const points = scene.points.map(point => `<li class="beat">${html(point)}</li>`).join("");
    const focus = scene.focus ? `<div class="focus" style="left:${scene.focus.x}%;top:${scene.focus.y}%"></div>` : "";
    const figure = asset ? `<figure class="figure"><img src="${html(asset)}" alt="Captura del prototipo">${focus}</figure>` : "";
    return `<section id="scene-${i}" class="clip scene ${scene.layout} ${asset ? "with-figure" : ""}"
      data-start="${sec(startMs)}" data-duration="${sec(endMs - startMs)}" data-track-index="0">
      <div class="panel"><div class="text">
        <p class="chapter">${html(chapter.title)}</p>
        <h1>${html(scene.title)}</h1><p class="takeaway">${html(scene.takeaway)}</p>
        <ol>${points}</ol>
      </div>${figure}</div>
    </section>`;
  }).join("\n");
  const audio = cues.map((cue, i) =>
    `<audio id="voice-${i}" class="clip" src="${html(cue.file)}" data-start="${sec(cue.startMs)}" data-duration="${sec(cue.endMs - cue.startMs)}" data-track-index="1" data-volume="1"></audio>`,
  ).join("\n");
  const timeline = scenes.map(({ startMs, endMs }, index) => ({
    selector: "#scene-" + index, start: startMs / 1000, length: (endMs - startMs) / 1000,
  }));
  return `<!doctype html>
<html lang="${html(language)}">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${html(chapter.title)}</title>
<script src="lib/gsap.min.js"></script>
<style>
:root{--bg:${tokens.background};--ink:${tokens.text};--surface:${tokens.surface};--accent:${tokens.accent}}
*{box-sizing:border-box}
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:var(--bg);color:var(--ink);font-family:'${tokens.fontFamily}',Arial,sans-serif}
#film{position:relative;width:100%;height:100%;background:var(--bg)}
.scene{position:absolute;inset:0;background:var(--bg);padding:76px 112px 112px}
.panel{width:100%;height:100%;display:grid;grid-template-columns:1fr;align-content:center}
.with-figure .panel{grid-template-columns:minmax(0,0.88fr) minmax(0,1.12fr);gap:64px;align-items:center}
.text{min-width:0}
.chapter{font-size:26px;letter-spacing:.09em;text-transform:uppercase;margin:0 0 28px}
h1{font-size:75px;line-height:1.08;margin:0 0 30px;overflow-wrap:anywhere}
.with-figure h1{font-size:58px}
.takeaway{font-size:37px;line-height:1.22;max-width:1350px;margin:0 0 45px;overflow-wrap:anywhere}
.with-figure .takeaway{font-size:31px}
ol{padding:0;margin:0;list-style:none;counter-reset:point;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.with-figure ol,.insight ol{grid-template-columns:1fr}
.beat{counter-increment:point;display:flex;align-items:center;min-height:72px;padding:16px 22px;font-size:27px;line-height:1.17;background:var(--surface);border-left:6px solid var(--accent);overflow-wrap:anywhere}
.process .beat::before{content:counter(point,decimal-leading-zero);font-size:21px;margin-right:20px;font-variant-numeric:tabular-nums}
.figure{width:100%;aspect-ratio:16/10;display:grid;place-items:center;margin:0;position:relative;overflow:hidden;background:var(--surface);padding:16px}
.figure img{display:block;width:100%;height:100%;object-fit:contain;min-height:0}
.focus{position:absolute;width:64px;height:64px;transform:translate(-50%,-50%);border:5px solid var(--accent);border-radius:50%;box-shadow:0 0 0 4px var(--bg)}
</style>
</head>
<body>
<main id="film" data-composition-id="film" data-start="0" data-duration="${sec(duration)}" data-width="1920" data-height="1080">
${shots}
${audio}
</main>
<script>
const tl = gsap.timeline({paused:true});
const shots = ${JSON.stringify(timeline)};
for (const {selector, start, length} of shots) {
  tl.fromTo(selector+" .chapter",{opacity:0},{opacity:1,duration:0.28},start);
  tl.fromTo(selector+" h1",{opacity:0,y:18},{opacity:1,y:0,duration:0.45,ease:"power2.out"},start+0.08);
  tl.fromTo(selector+" .takeaway",{opacity:0,y:12},{opacity:1,y:0,duration:0.35},start+0.22);
  tl.fromTo(selector+" .beat",{opacity:0,x:-18},{opacity:1,x:0,duration:0.42,stagger:Math.min(0.32,length/12)},start+0.44);
  if (document.querySelector(selector+" .figure")) {
    tl.fromTo(selector+" .figure",{opacity:0,scale:0.97},{opacity:1,scale:1,duration:0.55},start+0.05);
  }
  if (document.querySelector(selector+" .focus")) {
    tl.fromTo(selector+" .focus",{opacity:0,scale:1.6},{opacity:1,scale:1,duration:0.7},start+0.6);
  }
}
window.__timelines = window.__timelines || {};
window.__timelines["film"] = tl;
</script>
</body>
</html>
`;
}
