import type { FileEntry } from "./files";

export type Role = "po" | "dev";
export interface Identity { id: string; name?: string; email?: string; publicKey?: string }
export interface PersonSession { version: 1; projectId: string; role: Role; name: string }
export interface TtsConfig { provider: "say" | "command"; voice: string; credentialEnv?: string }
export interface Config {
  version: 1 | 2;
  projectId: string;
  methodologyVersion: string;
  methodologyDigest: string;
  name: string;
  idea: string;
  createdAt: string;
  roles: { po: Identity; dev: Identity | null };
  harness: "codex" | "portable";
  language: string;
  tts?: TtsConfig;
}

export type ArtifactType = "md" | "json" | "html" | "dir" | "pptx" | "mp4" | "srt";
export interface Artifact { path: string; type: ArtifactType; schema?: string; generated?: boolean }
export interface ChecklistItem { id: string; title: string; resources: string[] }
export type Category = "product" | "prototype" | "business" | "marketing" | "other";
export interface Phase {
  id: string;
  title: string;
  folder: string;
  lead: string;
  contributors: string[];
  skills: string[];
  focus: string;
  gate?: string;
  check?: string;
  final?: "seal" | "ready";
  video?: { renderer: "hyperframes"; required: true; categories: Category[]; maxDuration: null };
  artifacts: Artifact[];
  checklist?: ChecklistItem[];
}
export interface Workflow { version: 1; role: Role; phases: Phase[] }

export interface ReceiptBody {
  projectId: string;
  role: Role;
  actor: string;
  purpose: string;
  digest: string;
  note: string;
  at: string;
}
export interface Receipt extends ReceiptBody { signature?: string; actorName?: string; confirmation?: "name" }
export interface Approval { phase: string; gate: string; receipt: Receipt }
export interface Clarification {
  id: string; question: string; reference: string; blocking: boolean; answer?: Receipt;
}
export interface Event {
  type: "start" | "approve" | "complete" | "revise" | "seal" | "ready" |
    "acknowledge" | "clarify" | "answer" | "configure";
  at: string;
  actor: string;
  actorName?: string;
  phase?: string;
  note?: string;
}
export interface State {
  version: 1;
  projectId: string;
  role: Role;
  status: "INITIALIZED" | "ACTIVE" | "AWAITING_DEV" | "READY";
  cursor: number;
  revision: number;
  completed: { phase: string; digest: string }[];
  approvals: Approval[];
  events: Event[];
  checklist: Receipt[];
  clarifications: Clarification[];
  sealedAt?: string;
  baselineDigest?: string;
}
export interface Manifest {
  version: 1; projectId: string; tag: string; sealedAt: string; digest: string; files: FileEntry[];
}

export interface Flows { flows: { id: string; screenshots: string[] }[] }
export interface Requirements { requirements: {
  id: string; source: string; priority: string; flows: string[]; acceptance: string[];
}[] }
export interface TestCases { cases: {
  id: string; requirement: string; criteria: number[]; kind: "prototype" | "implementation";
}[] }
export interface TestResults {
  results: { test: string; outcome: "pass" | "fail" | "planned"; evidence: string }[];
  openIssues: { id: string; blocking: boolean }[];
}

export interface Tokens { background: string; text: string; surface: string; accent: string; fontFamily: string }
export interface Slide { title: string; keyMessage: string; points: string[]; notes: string; sources: string[] }
export interface Briefing {
  summaries: Record<"executive" | "business" | "product" | "critical", string[]>;
  decks: Record<"pitch" | "product" | "marketing", Slide[]>;
}
export interface Scene {
  title: string; takeaway: string; layout: "process" | "insight" | "prototype";
  points: string[]; narration: string[]; image?: string; focus?: { x: number; y: number };
}
export interface Chapter { id: string; title: string; category: Category; sources: string[]; scenes: Scene[] }
export interface FilmPlan { language: string; chapters: Chapter[] }
export interface ChapterTime { id: string; title: string; category: Category; startMs: number; endMs: number }
export interface ChapterIndex { version: 1; language: string; durationMs: number; chapters: ChapterTime[] }
export interface MediaReceipt {
  version: 1;
  renderer: "hyperframes";
  rendererVersion: string;
  nodeVersion: string;
  ffmpegVersion: string;
  language: string;
  tts: TtsConfig;
  inputs: string;
  video: string;
  source: string;
  transcript: string;
  subtitles: string;
  chapters: string;
  checks: { chapter: string; runtime: "passed"; sha256: string }[];
}
