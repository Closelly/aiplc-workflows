import { randomUUID } from "node:crypto";
import { cpSync, mkdirSync, realpathSync, rmSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { newState, assertState } from "./engine";
import { enroll, namedIdentity } from "./identity";
import { identify, localPerson, participant } from "./participants";
import { atomic, Blocked, digest, entry, files, git, inside, inventory, readText, requireThat, writeJson } from "./files";
import { distributionDir, Methodology, version } from "./methodology";
import type { Config, Identity, Manifest, PersonSession, Role, State } from "./model";

export const baseline = "docs/aiplc";
export const historical = "docs/aiplc/methodology";
export const handoff = "docs/aiplc/09-handoff";
export const onboarding = handoff + "/onboarding";
export const taggedManifest = handoff + "/handoff-manifest.json";
export const tag = "aiplc-baseline-v1";
export const projectFile = baseline + "/project.json";
export const artifactManifest = baseline + "/artifact-manifest.json";
export const stateFiles = { po: baseline + "/state.json", dev: "docs/technical/aiplc/state.json" } as const;

export const living = {
  business: {
    title: "Negocio vigente",
    detail: "Producto, reglas, perfiles, estrategia comercial, métricas, hipótesis y decisiones vigentes.",
  },
  technical: {
    title: "Técnica vigente",
    detail: "Arquitectura propuesta y en producción, repositorio, datos, servicios, variables sin valores, convenciones y pruebas.",
  },
  operations: {
    title: "Operaciones vigentes",
    detail: "Procedimientos humanos con propósito, frecuencia, responsable, pasos, resultado, escalamiento y evidencia. Al inicio no hay rutinas confirmadas.",
  },
} as const;

function title(name: string): string {
  return name.replace(/[<>\r\n]/g, "");
}

export interface InitOptions {
  target: string;
  poPublicKey?: string;
  devPublicKey?: string;
  poName?: string;
  poEmail?: string;
  poId?: string;
  devId?: string;
  name?: string;
  idea?: string;
  language?: string;
}

export function init(options: InitOptions): string {
  const root = resolve(options.target);
  const parent = dirname(root);
  requireThat(entry(parent)?.isDirectory(), `El directorio padre debe existir: ${parent}`);
  requireThat(!entry(root), `La ruta ya existe. Crea un repositorio nuevo: ${root}`);
  requireThat(!git(parent, ["rev-parse", "--show-toplevel"], true),
    "Crea el producto fuera de cualquier otro repositorio Git.");
  const method = new Methodology(distributionDir());
  const legacy = !!(options.poPublicKey || options.devPublicKey);
  requireThat(!legacy || (!!options.poPublicKey && !!options.devPublicKey && !options.poName), "No mezcles el nombre con las opciones de claves del formato anterior.");
  const po = legacy ? enroll(options.poId ?? "product-owner", options.poPublicKey!) :
    namedIdentity(options.poName ?? "", options.poId ?? "product-owner", options.poEmail);
  const dev = legacy ? enroll(options.devId ?? "developer", options.devPublicKey!) : null;
  if (dev) requireThat(po.id.toLowerCase() !== dev.id.toLowerCase() && po.publicKey !== dev.publicKey,
    "El PO y el DEV requieren identidades distintas.");
  const config: Config = {
    version: legacy ? 1 : 2, methodologyVersion: version, methodologyDigest: method.digest, projectId: randomUUID(),
    name: options.name ?? basename(root), idea: options.idea ?? "", createdAt: new Date().toISOString(),
    roles: { po, dev }, harness: "codex", language: options.language ?? "es-CL",
  };
  requireThat(config.name.trim() && !/[\r\n<>]/.test(config.name), "Usa un nombre de producto en una sola línea.");
  method.schemas.assert("project", config);

  mkdirSync(root);
  try {
    git(root, ["init", "--initial-branch=main", "--template="]);
    atomic(inside(root, "AGENTS.md"), readText(method.root, "templates/product-AGENTS.md")
      .replaceAll("{{PRODUCT}}", () => title(config.name)));
    for (const path of method.snapshots) {
      const target = inside(root, historical + "/" + path);
      mkdirSync(dirname(target), { recursive: true });
      cpSync(inside(method.root, path), target);
    }
    for (const [area, info] of Object.entries(living)) {
      atomic(inside(root, `docs/${area}/README.md`), `# ${info.title}\n\n${info.detail}\n`);
    }
    const phaseLinks = method.workflows.po.phases.map(phase =>
      `- [${phase.title}](${phase.folder.slice(baseline.length + 1)}/README.md)`);
    for (const phase of method.workflows.po.phases) {
      atomic(inside(root, phase.folder + "/README.md"), `# ${phase.title}\n\n${phase.focus}\n`);
    }
    atomic(inside(root, baseline + "/README.md"),
      `# Origen de ${title(config.name)}\n\nLas evidencias y decisiones de definición se preservan aquí al finalizar el PO.\n\n${phaseLinks.join("\n")}\n\nConsulta [la metodología](methodology/methodology/principles.md).\n`);
    writeJson(inside(root, projectFile), config);
    writeJson(inside(root, stateFiles.po), newState(config.projectId, "po"));
    writeJson(inside(root, artifactManifest), { version: 1, projectId: config.projectId, phases: [] });
    if (!legacy) identify(new Repository(root), "po", po.name!);
    return realpathSync(root);
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

export class Repository {
  readonly root: string;
  readonly method: Methodology;
  readonly config: Config;

  constructor(directory: string) {
    const top = git(resolve(directory), ["rev-parse", "--show-toplevel"], true);
    requireThat(top, "Abre un repositorio generado con closelly-aiplc po init o usa --repo.");
    this.root = realpathSync(top);
    requireThat(entry(inside(this.root, projectFile))?.isFile(), "Este Git no es un producto Closelly AI-PLC.");
    this.method = new Methodology(inside(this.root, historical));
    this.config = this.method.schemas.read<Config>("project", this.root, projectFile);
    requireThat(this.method.digest === this.config.methodologyDigest,
      "Las definiciones de la metodología no coinciden con la versión fijada al iniciar.");
    if (this.config.version === 1) {
      requireThat(this.config.roles.dev && this.config.roles.po.publicKey !== this.config.roles.dev.publicKey &&
        this.config.roles.po.id.toLowerCase() !== this.config.roles.dev.id.toLowerCase(),
      "El repositorio requiere identidades PO y DEV distintas.");
    }
  }

  path(path: string): string { return inside(this.root, path); }
  has(path: string): boolean { return !!entry(this.path(path)); }
  identity(role: Role): Identity | null { return participant(this, role); }
  person(): PersonSession | null { return this.config.version === 2 ? localPerson(this) : null; }
  json<T>(schema: string, path: string): T { return this.method.schemas.read<T>(schema, this.root, path); }
  git(args: string[], allowFailure = false): string { return git(this.root, args, allowFailure); }

  state(role: Role): State {
    const value = this.json<State>("state", stateFiles[role]);
    assertState(value, this.method.workflows[role], this.config.projectId);
    return value;
  }

  save(state: State): void {
    this.method.schemas.assert("state", state);
    assertState(state, this.method.workflows[state.role], this.config.projectId);
    writeJson(this.path(stateFiles[state.role]), state);
  }

  async locked<T>(callback: () => T | Promise<T>): Promise<T> {
    const gitDir = this.git(["rev-parse", "--absolute-git-dir"]);
    const lock = resolve(gitDir, "closelly-aiplc.lock");
    try {
      mkdirSync(lock, { mode: 0o700 });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      throw new Blocked(`Hay otra operación AI-PLC en curso. Si terminó abruptamente, verifica el proceso antes de borrar ${lock}.`);
    }
    try {
      writeJson(resolve(lock, "owner.json"), { pid: process.pid, at: new Date().toISOString() });
      // Refresh state and configuration after acquiring the lock.
      const fresh = this.json<Config>("project", projectFile);
      requireThat(digest(fresh) === digest(this.config), "La configuración cambió. Repite el comando.");
      return await callback();
    } finally {
      rmSync(lock, { recursive: true, force: true });
    }
  }

  baselineInventory() {
    return inventory(this.root, files(this.root, baseline).filter(path => path !== taggedManifest));
  }

  createManifest(state: State): Manifest {
    const entries = this.baselineInventory();
    return {
      version: 1, projectId: this.config.projectId, tag, sealedAt: state.sealedAt!,
      digest: digest(entries), files: entries,
    };
  }

  verifyHandoff(): Manifest {
    const state = this.state("po");
    requireThat(state.status === "AWAITING_DEV" && this.has(taggedManifest),
      "El PO aún debe cerrar la entrega. Ejecuta po handoff en el flujo PO.");
    const manifest = this.json<Manifest>("manifest", taggedManifest);
    requireThat(manifest.tag === tag && manifest.projectId === this.config.projectId &&
      manifest.sealedAt === state.sealedAt && manifest.digest === digest(manifest.files) &&
      digest(this.baselineInventory()) === manifest.digest,
    "La línea base histórica fue modificada. Recupera la copia sellada antes de continuar.");
    const commit = this.git(["rev-parse", "--verify", `refs/tags/${tag}^{commit}`], true);
    requireThat(commit, `Sello Git incompleto o tag ausente. Recupera ${tag} o reintenta po handoff.`);
    requireThat(this.git(["merge-base", "HEAD", commit], true) === commit,
      "El commit de entrega no pertenece a la historia de la rama actual.");
    const committed = this.git(["show", `${commit}:${taggedManifest}`]);
    requireThat(digest(JSON.parse(committed)) === digest(manifest), "El manifest no coincide con el tag Git.");
    const expectedPaths = [...manifest.files.map(item => item.path), taggedManifest].sort();
    const actualPaths = this.git(["ls-tree", "-r", "--name-only", "-z", commit, "--", baseline]).split("\0")
      .filter(Boolean).sort();
    requireThat(digest(expectedPaths) === digest(actualPaths) &&
      !this.git(["diff", "--no-ext-diff", "--no-textconv", "--name-only", commit, "--", baseline]),
    "Los archivos históricos no coinciden con el commit sellado.");
    return manifest;
  }
}
