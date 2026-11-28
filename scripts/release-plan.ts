import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface ReleaseState {
  version: string;
  commit: string;
  existing: { draft: boolean } | null;
  latest: string | null;
  tagCommit: string | null;
}

export function versionParts(value: string): bigint[] {
  if (value.length > 80 || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) {
    throw new Error("La versión debe ser X.Y.Z, sin prefijo v ni ceros iniciales.");
  }
  return value.split(".").map(part => BigInt(part));
}

export function compareVersions(a: string, b: string): number {
  const left = versionParts(a), right = versionParts(b);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}

export function decideRelease(state: ReleaseState): { shouldRelease: boolean; reason: string } {
  versionParts(state.version);
  if (state.existing && !state.existing.draft) {
    return { shouldRelease: false, reason: "Esta versión ya está publicada; se conserva sin cambios." };
  }
  if (state.existing?.draft && state.tagCommit !== state.commit) {
    return { shouldRelease: false, reason: "Ya existe un borrador de esta versión para otro commit. Usa una versión nueva para incluir más cambios." };
  }
  if (state.latest && compareVersions(state.version, state.latest) <= 0) {
    throw new Error(`La nueva versión ${state.version} debe ser mayor que la publicada ${state.latest}.`);
  }
  if (state.tagCommit && state.tagCommit !== state.commit) {
    throw new Error("El tag de esta versión ya apunta a otro commit. No se moverá: aumenta la versión.");
  }
  return { shouldRelease: true, reason: state.existing?.draft ? "Reintentar el borrador del mismo commit." : "Preparar una versión nueva en borrador." };
}

export function releaseNotes(changelog: string, version: string): string {
  versionParts(version);
  const lines = changelog.split(/\r?\n/);
  const header = new RegExp(`^## ${version.replaceAll(".", "\\.")}(?:\\s|$)`);
  const start = lines.findIndex(line => header.test(line));
  if (start < 0) throw new Error(`Falta la sección ${version} en CHANGELOG.md.`);
  let end = start + 1;
  while (end < lines.length && !/^## /.test(lines[end])) end++;
  const body = lines.slice(start + 1, end).join("\n").trim();
  if (!body) throw new Error(`La sección ${version} del changelog está vacía.`);
  return body + "\n";
}

interface TagObject { object: { type: string; sha: string } }
interface Release { draft: boolean; tag_name: string }

export class GitHub {
  constructor(readonly repository: string, readonly token: string, readonly transport: typeof fetch = fetch,
    readonly base = "https://api.github.com") {
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !token) {
      throw new Error("Faltan el repositorio de GitHub o el token del workflow.");
    }
  }

  async request<T>(path: string, body?: unknown): Promise<T | null> {
    const result = await this.transport(`${this.base}/repos/${this.repository}/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json", "X-GitHub-Api-Version": "2022-11-28" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (result.status === 404 && body === undefined) return null;
    if (!result.ok) throw new Error(`GitHub respondió HTTP ${result.status} al consultar ${path}.`);
    return await result.json() as T;
  }

  async tagCommit(tag: string): Promise<string | null> {
    let ref = await this.request<TagObject>(`git/ref/tags/${encodeURIComponent(tag)}`);
    for (let depth = 0; ref && depth < 8; depth++) {
      if (ref.object.type === "commit") return ref.object.sha;
      if (ref.object.type !== "tag") throw new Error("El tag no referencia un commit.");
      ref = await this.request<TagObject>(`git/tags/${ref.object.sha}`);
      if (!ref) throw new Error("No se pudo resolver el tag anotado.");
    }
    if (ref) throw new Error("El tag contiene demasiadas referencias anidadas.");
    return null;
  }

  async releaseByTag(tag: string): Promise<Release | null> {
    const published = await this.request<Release>(`releases/tags/${encodeURIComponent(tag)}`);
    if (published) return published;
    // GitHub documents the tag endpoint for published releases. Look up drafts
    // explicitly so retrying an incomplete draft does not look like a new release.
    for (let page = 1; ; page++) {
      const batch = await this.request<Release[]>(`releases?per_page=100&page=${page}`);
      if (!Array.isArray(batch)) throw new Error("No se pudo consultar la lista de releases.");
      const draft = batch.find(release => release.tag_name === tag);
      if (draft) return draft;
      if (batch.length < 100) return null;
    }
  }

  async ensureTag(tag: string, commit: string): Promise<void> {
    const current = await this.tagCommit(tag);
    if (current) {
      if (current !== commit) throw new Error("El tag apunta a otro commit; no se modificará.");
      return;
    }
    await this.request("git/refs", { ref: `refs/tags/${tag}`, sha: commit });
  }
}

async function main() {
  const root = join(import.meta.dir, "..");
  const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version as string;
  versionParts(version);
  const notes = releaseNotes(readFileSync(join(root, "CHANGELOG.md"), "utf8"), version);
  const command = process.argv[2];
  if (command === "notes") { process.stdout.write(notes); return; }
  if (command !== "plan" && command !== "ensure-tag") throw new Error("Usa plan, notes o ensure-tag.");
  const commit = process.env.GITHUB_SHA ?? "";
  if (!/^[a-f0-9]{40,64}$/.test(commit)) throw new Error("Falta el commit exacto del workflow (GITHUB_SHA).");
  const client = new GitHub(process.env.GITHUB_REPOSITORY ?? "", process.env.GH_TOKEN ?? "", fetch,
    process.env.GITHUB_API_URL ?? "https://api.github.com");
  const tag = `v${version}`;
  if (command === "ensure-tag") { await client.ensureTag(tag, commit); console.log(`Tag ${tag} verificado.`); return; }
  const existing = await client.releaseByTag(tag);
  const [latest, tagCommit] = existing && !existing.draft ? [null, null] : await Promise.all([
    client.request<Release>("releases/latest"), client.tagCommit(tag),
  ]);
  const decision = decideRelease({ version, commit, existing, tagCommit,
    latest: latest?.tag_name.replace(/^v/, "") ?? null });
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `should_release=${decision.shouldRelease}\nversion=${version}\ntag=${tag}\n`);
  }
  console.log(JSON.stringify({ version, tag, ...decision }, null, 2));
}

if (import.meta.main) {
  main().catch(error => { console.error((error as Error).message); process.exitCode = 1; });
}
