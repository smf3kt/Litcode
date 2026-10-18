import fs from 'node:fs/promises';
import { AsyncLocalStorage } from 'node:async_hooks';
import { realpathSync, statSync } from 'node:fs';
import os from 'node:os';
import nodePath from 'node:path';
import { HARNESS_DIR, defaultUserDir } from './config.js';

// Local host bindings for the recovered named-workflow catalog
// (chunk-9r54k71g.js, ranges recorded in
// research/ports/W158-named-workflows.plan.json). The source reads user
// workflows through the account storage backend and project workflows through
// the host's project-directory walk; this runtime has no account layer, so
// both read the local `.harness/workflows` trees and the plugin/bundled
// providers are explicit host inputs.

export type NamedWorkflowSource = 'built-in' | 'plugin' | 'userSettings' | 'projectSettings';

export type NamedWorkflowRecord = {
  source: NamedWorkflowSource;
  name: string;
  description: string;
  whenToUse?: string;
  phases?: unknown[];
  script: string;
  filePath: string;
  plugin?: string;
  pluginManifest?: unknown;
  serverPluginId?: string;
};

export type NamedWorkflowPlugin = {
  name: string;
  source?: string;
  manifest?: unknown;
  workflowsPath?: string;
  workflowsPaths?: string[];
  serverPluginId?: string;
};

export type NamedWorkflowHostOptions = {
  userDir?: string;
  plugins?: NamedWorkflowPlugin[];
  bundled?: NamedWorkflowRecord[];
  bundledOnly?: boolean;
  logger?: (message: string, options?: { level?: string }) => void;
  loadPlugins?: () => Promise<{ enabled: NamedWorkflowPlugin[]; errors: unknown[] }>;
  pluginIdentity?: () => string;
};

type PluginRuntime = { workflows?: Promise<NamedWorkflowRecord[]> };

export type NamedWorkflowState = {
  host: NamedWorkflowHostOptions;
  runtime: PluginRuntime;
  allWorkflows: Map<string, Promise<NamedWorkflowRecord[]>>;
};
const states = new AsyncLocalStorage<NamedWorkflowState>();
export function createNamedWorkflowState(options: NamedWorkflowHostOptions = {}): NamedWorkflowState {
  return { host: { ...options, plugins: options.plugins?.map(plugin => ({ ...plugin,
    workflowsPaths: plugin.workflowsPaths && [...plugin.workflowsPaths] })),
    bundled: options.bundled?.map(record => ({ ...record })) }, runtime: {}, allWorkflows: new Map() };
}
const state = (): NamedWorkflowState => {
  const owner = states.getStore();
  if (!owner) throw new Error('Named workflow owner is required');
  return owner;
};
export const withNamedWorkflowState = <T>(owner: NamedWorkflowState, run: () => T): T => states.run(owner, run);

// `it`: the plugin-workflow load memo.
export function it(): PluginRuntime {
  return state().runtime;
}

// `xr`: the session cache table holding `allWorkflows`.
export function xr(): { allWorkflows: Map<string, Promise<NamedWorkflowRecord[]>> } {
  return { allWorkflows: state().allWorkflows };
}

// `cn`: the source asks whether the account namespace can serve user/project
// settings. Locally both namespaces are always readable.
export function cn(_namespace: 'userSettings' | 'projectSettings'): 'local' {
  return 'local';
}

// `br`: the recovered config gate that narrows the catalog to bundled
// workflows only.
export function br(_key: 'workflows'): boolean {
  return state().host.bundledOnly === true;
}

// `ojt`: bundled workflows are a host input; empty by default.
export function ojt(): NamedWorkflowRecord[] {
  return [...(state().host.bundled ?? [])];
}

// `RUn`: the source prefixes its cache key with the account-level workflow
// scope. Locally the scope is constant.
export function RUn(): string {
  return 'local';
}

// `be`: the user configuration root.
export function be(): string {
  return state().host.userDir ?? defaultUserDir();
}

// `a7`: project settings directories from the workspace up to the home
// directory, workspace first. The walk excludes the home directory itself,
// as the recovered project-directory walk does, and terminates at the
// filesystem root.
export async function a7(kind: 'workflows', workspace: string): Promise<string[]> {
  const home = nodePath.resolve(os.homedir());
  const found: string[] = [];
  let current = nodePath.resolve(workspace);
  for (;;) {
    if (current === home) break;
    const candidate = nodePath.join(current, HARNESS_DIR, kind);
    try {
      if (statSync(candidate).isDirectory()) found.push(candidate);
    } catch {
      // A missing or unreadable candidate is not a project workflow root.
    }
    const parent = nodePath.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return found;
}

// `Xs`: plugin discovery. The source enumerates installed plugins; the local
// host supplies them, and an empty list is the default.
export async function Xs(_workspace?: string): Promise<{
  enabled: NamedWorkflowPlugin[]; errors: unknown[];
}> {
  return state().host.loadPlugins?.() ?? { enabled: state().host.plugins ?? [], errors: [] };
}

// `db`: project the plugin-load error to a message.
export function db(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error !== null && typeof error === 'object') return JSON.stringify(error);
  return String(error);
}

// `$pe`: skip a workflow file already visited by this plugin load. The source
// deduplicates by resolved real path.
export function $pe(_fs: unknown, file: string, seen?: Set<string>): boolean {
  let key = nodePath.resolve(file);
  try {
    key = realpathSync(key);
  } catch {
    // A path that cannot be resolved is deduplicated by its absolute form.
  }
  if (seen === undefined) return false;
  if (seen.has(key)) return true;
  seen.add(key);
  return false;
}

export type WorkflowHostFile = {
  readdir(dir: string): Promise<{ name: string; isFile(): boolean; isSymbolicLink(): boolean }[]>;
  stat(file: string): Promise<{ isFile(): boolean; isDirectory(): boolean; size: number }>;
  readFile(file: string, options: { encoding: 'utf8' }): Promise<string>;
  readFileBytes(file: string, max: number): Promise<Buffer>;
};

// `ie`: the filesystem host used by discovery and the regular-file read.
export function ie(): WorkflowHostFile {
  return {
    readdir: async (dir) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      return entries.map(entry => ({
        name: entry.name,
        isFile: () => entry.isFile(),
        isSymbolicLink: () => entry.isSymbolicLink(),
      }));
    },
    stat: async (file) => {
      const stat = await fs.stat(file);
      return {
        isFile: () => stat.isFile(),
        isDirectory: () => stat.isDirectory(),
        size: stat.size,
      };
    },
    readFile: (file, options) => fs.readFile(file, options),
    readFileBytes: async (file, max) => {
      const handle = await fs.open(file, 'r');
      try {
        const stat = await handle.stat();
        const length = Math.min(stat.size, Math.max(0, max));
        const buffer = Buffer.alloc(length);
        const { bytesRead } = await handle.read(buffer, 0, length, 0);
        return buffer.subarray(0, bytesRead);
      } finally {
        await handle.close().catch(() => {});
      }
    },
  };
}

// `t`, `g`, `m`, `f`: workflow logging and telemetry.
function emit(level: string, message: string, options?: { level?: string }): void {
  state().host.logger?.(message, { level: options?.level ?? level });
}

export function t(message: string, options?: { level?: string }): void {
  emit('info', message, options);
}

export function g(event: string, fields?: Record<string, unknown>): void {
  emit('info', fields === undefined ? event : `${event} ${JSON.stringify(fields)}`);
}

export function m(event: string, reason: string, fields?: Record<string, unknown>): void {
  emit('warn', fields === undefined ? `${event}: ${reason}` : `${event}: ${reason} ${JSON.stringify(fields)}`);
}

export function f(event: string, reason: string, fields?: Record<string, unknown>): void {
  emit('info', fields === undefined ? `${event}: ${reason}` : `${event}: ${reason} ${JSON.stringify(fields)}`);
}

// `a`: the configuration object read by `GJe`. The recovered property name is
// kept because the copied body reads it; the value comes from the neutral
// local variable.
export const a: { readonly CLAUDE_WORKFLOW_NAME_ONLY: string | undefined } = {
  get CLAUDE_WORKFLOW_NAME_ONLY() {
    return process.env.HARNESS_WORKFLOW_NAME_ONLY;
  },
};
