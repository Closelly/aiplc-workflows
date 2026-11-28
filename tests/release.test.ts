import { expect, test } from "bun:test";
import { compareVersions, decideRelease, GitHub, releaseNotes, versionParts } from "../scripts/release-plan";

const commit = "a".repeat(40);
const state = { version: "0.1.1", commit, existing: null, latest: "0.1.0", tagCommit: null };

test("a new main version prepares a draft; an already published version is skipped", () => {
  expect(decideRelease(state).shouldRelease).toBe(true);
  expect(decideRelease({ ...state, latest: null }).shouldRelease).toBe(true);
  expect(decideRelease({ ...state, existing: { draft: false }, tagCommit: "b".repeat(40) }).shouldRelease).toBe(false);
});

test("a failed draft can be retried at its commit; later merges preserve its original contents", () => {
  expect(decideRelease({ ...state, existing: { draft: true }, tagCommit: commit }).shouldRelease).toBe(true);
  expect(decideRelease({ ...state, existing: { draft: true }, tagCommit: "b".repeat(40) }).shouldRelease).toBe(false);
  expect(decideRelease({ ...state, tagCommit: "b".repeat(40) }).shouldRelease).toBe(false);
});

test("versions are numeric and must increase, without shell or tag syntax", () => {
  expect(compareVersions("0.1.10", "0.1.9")).toBe(1);
  expect(compareVersions("1.0.0", "0.99.99")).toBe(1);
  expect(() => decideRelease({ ...state, latest: "0.2.0" })).toThrow("mayor");
  expect(() => decideRelease({ ...state, latest: "0.1.1" })).toThrow("mayor");
  for (const version of ["01.1.1", "v0.1.1", "0.1.1-beta", "0.1.1\nother", "0.1.1;echo invalid"]) {
    expect(() => versionParts(version)).toThrow();
  }
});

test("draft notes contain only the matching non-empty changelog section", () => {
  const notes = releaseNotes("# Changes\n\n## Unreleased\nPending\n\n## 0.1.1 — 2026-11-27\n\n### Added\n- New automation.\n\n## 0.1.0\nOld.\n", "0.1.1");
  expect(notes).toBe("### Added\n- New automation.\n");
  expect(() => releaseNotes("## 0.1.0\nOld", "0.1.1")).toThrow("Falta");
  expect(() => releaseNotes("## 0.1.1\n\n## 0.1.0\nOld", "0.1.1")).toThrow("vacía");
});

function client(respond: (url: string, options?: RequestInit) => Response | Promise<Response>) {
  return new GitHub("test-owner/test-repo", "test-token", respond as typeof fetch);
}

test("GitHub permission and service failures are not treated as absent releases", async () => {
  expect(await client(() => new Response(null, { status: 404 })).request("releases/latest")).toBeNull();
  for (const status of [401, 403, 429, 500]) {
    await expect(client(() => new Response(null, { status })).request("releases/latest")).rejects.toThrow(`HTTP ${status}`);
  }
});

test("tag creation binds the checked commit and never moves an existing tag", async () => {
  const calls: { url: string; options?: RequestInit }[] = [];
  const api = client((url, options) => {
    calls.push({ url, options });
    return options?.method === "POST" ? Response.json({ ref: "refs/tags/v0.1.1" }, { status: 201 }) : new Response(null, { status: 404 });
  });
  await api.ensureTag("v0.1.1", commit);
  expect(calls).toHaveLength(2);
  expect(JSON.parse(calls[1].options?.body as string)).toEqual({ ref: "refs/tags/v0.1.1", sha: commit });
  const other = client(() => Response.json({ object: { type: "commit", sha: "b".repeat(40) } }));
  await expect(other.ensureTag("v0.1.1", commit)).rejects.toThrow("no se modificará");
});

test("annotated tags are resolved before deciding whether a draft belongs to this commit", async () => {
  const api = client(url => Response.json({ object: url.includes("git/ref/") ? { type: "tag", sha: "b".repeat(40) } : { type: "commit", sha: commit } }));
  expect(await api.tagCommit("v0.1.1")).toBe(commit);
});

test("draft lookup uses authenticated release listings when the published-tag endpoint returns 404", async () => {
  const api = client(url => url.includes("releases/tags/") ? new Response(null, { status: 404 }) :
    Response.json([{ tag_name: "v0.1.1", draft: true }, { tag_name: "v0.1.0", draft: false }]));
  expect(await api.releaseByTag("v0.1.1")).toEqual({ tag_name: "v0.1.1", draft: true });
  expect(await api.releaseByTag("v0.1.2")).toBeNull();
});

test("an existing draft hidden from a read-only token is still preserved by its tag", async () => {
  const api = client(url => url.includes("releases/tags/") ? new Response(null, { status: 404 }) :
    Response.json([{ tag_name: "v0.1.0", draft: false }]));
  const existing = await api.releaseByTag("v0.1.1");
  expect(existing).toBeNull();
  expect(decideRelease({ ...state, existing, tagCommit: "b".repeat(40) }).shouldRelease).toBe(false);
  expect(decideRelease({ ...state, existing, tagCommit: commit }).shouldRelease).toBe(true);
});
