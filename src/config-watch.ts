import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { LoadProjectOptions } from "./config.js";

export type ConfigWatchSources = Pick<LoadProjectOptions, "userDir" | "settingsFile" | "managedSettingsFile"> & {
  /** Loaded instruction, conditional rule and import paths, pinned by the caller. */
  instructionPaths?: readonly string[];
  /** Verified plugin/catalog roots; bytes remain data until reload validation. */
  contentDirectories?: readonly string[];
};
export interface ConfigWatcher { close(): void; addInstructionPaths?(paths: readonly string[]): void }

const MAX_WATCHES = 64;
const MAX_ENTRIES = 2048;
const MAX_DEPTH = 3;
const DEBOUNCE_MS = 250;
const IGNORED = new Set(["memory", "attachments", "workflow", "workflows", ".agent", "oauth"]);
type Mode = "workspace" | "harness" | "user" | "plugins" | "skills" | "rules" | "markdown" | "file" | "content" | "instructions";
interface Scope { directory: string; root: string; mode: Mode; depth: number; file?: string }
interface Entry { watcher: fs.FSWatcher; identity: string; scopes: Scope[]; children: Set<string> }

function within(root: string, target: string): boolean {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}
function ignored(name: string): boolean {
  return name.split(/[\\/]/).some(part => IGNORED.has(part.toLowerCase()));
}

/** Reports local config changes only. The caller owns reload timing and opt-in. */
export function watchProjectConfig(workspace: string, onChange: () => void): ConfigWatcher;
export function watchProjectConfig(workspace: string, configSources: ConfigWatchSources | undefined,
  onChange: () => void, onError?: (error: Error) => void): ConfigWatcher;
export function watchProjectConfig(workspace: string, sourcesOrChange: ConfigWatchSources | (() => void) | undefined,
  callback?: () => void, onError?: (error: Error) => void): ConfigWatcher {
  const sources = typeof sourcesOrChange === "function" ? undefined : sourcesOrChange;
  const onChange = typeof sourcesOrChange === "function" ? sourcesOrChange : callback!;
  const watches = new Map<string, Entry>();
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const report = (error: unknown): void => {
    if (!closed) onError?.(error instanceof Error ? error : new Error(String(error)));
  };
  const close = (): void => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    timer = undefined;
    for (const entry of watches.values()) entry.watcher.close();
    watches.clear();
  };
  const notify = (): void => {
    if (closed) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      if (!closed) {
        try { onChange(); } catch (error) { report(error); }
      }
    }, DEBOUNCE_MS);
  };
  const inspect = (directory: string, root: string): { real: string; identity: string } | undefined => {
    try {
      const real = fs.realpathSync(directory);
      if (!within(root, real)) return undefined;
      const stat = fs.statSync(real);
      if (stat.isDirectory()) return { real, identity: `${stat.dev}:${stat.ino}` };
    } catch (error) {
      if (!["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) report(error);
    }
    return undefined;
  };
  const base: Scope[] = [];
  const knownPaths = new Set<string>();
  let addPath: (file: string) => void = () => {};
  try {
    const root = fs.realpathSync(path.resolve(workspace));
    if (!fs.statSync(root).isDirectory()) throw new Error("Config watch workspace must be a directory");
    base.push({ directory: root, root, mode: "workspace", depth: 0 },
      { directory: path.join(root, ".harness"), root, mode: "harness", depth: 0 });
    // Missing configured roots get a filtered sentinel on the nearest existing
    // parent; once created they remain confined to that pinned real directory.
    const external = (target: string, mode: Mode, file?: string): void => {
      let parent = target;
      let result: ReturnType<typeof inspect>;
      for (let depth = 0; depth < MAX_WATCHES; depth++) {
        try {
          const real = fs.realpathSync(parent);
          result = inspect(parent, real);
          if (result) break;
        } catch (error) {
          if (!["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) { report(error); return; }
        }
        const next = path.dirname(parent);
        if (next === parent) return;
        parent = next;
      }
      if (!result) { report(new Error("Config watch parent depth exceeds 64")); return; }
      const directory = path.resolve(result.real, path.relative(parent, target));
      base.push({ directory, root: result.real, mode, depth: 0, file });
    };
    external(path.resolve(sources?.userDir ?? path.join(os.homedir(), ".harness")), "user");
    if (sources?.settingsFile !== undefined) {
      const file = path.resolve(root, sources.settingsFile);
      external(path.dirname(file), "file", path.basename(file));
    }
    if (sources?.managedSettingsFile !== undefined) {
      const file = path.resolve(root, sources.managedSettingsFile);
      external(path.dirname(file), "file", path.basename(file));
    }
    const instructionPaths = sources?.instructionPaths ?? [];
    const contentDirectories = sources?.contentDirectories ?? [];
    if (contentDirectories.length > MAX_ENTRIES) report(new Error("Config watch content root limit exceeds 2048"));
    for (const directory of contentDirectories.slice(0, MAX_ENTRIES)) {
      if (!path.isAbsolute(directory)) { report(new Error("Config watch content root must be absolute")); continue; }
      external(directory, "content");
    }
    if (instructionPaths.length > MAX_ENTRIES) report(new Error("Config watch instruction path limit exceeds 2048"));
    addPath = file => {
      external(path.dirname(file), "file", path.basename(file));
      if (within(root, file)) external(path.dirname(file), "instructions");
    };
    for (let i = 0; i < Math.min(instructionPaths.length, MAX_ENTRIES); i++) {
      const file = instructionPaths[i];
      if (!path.isAbsolute(file)) { report(new Error("Config watch instruction path must be absolute")); continue; }
      const normalized = path.normalize(file);
      if (knownPaths.has(normalized) || ignored(normalized)) continue;
      knownPaths.add(normalized);
      addPath(normalized);
    }
  } catch (error) { report(error); return { close }; }

  const refresh = (): void => {
    if (closed) return;
    const desired = new Map<string, { identity: string; scopes: Scope[]; children: Set<string> }>();
    const queue = [...base];
    const seen = new Set<string>();
    let entries = 0;
    let limitReported = false;
    const limit = (): void => {
      if (!limitReported) { limitReported = true; report(new Error("Config watch directory or entry limit reached")); }
    };
    for (let i = 0; i < queue.length && !closed; i++) {
      const scope = queue[i];
      let target = inspect(scope.directory, scope.root);
      let active = scope;
      if (!target) {
        // Watch only the immediate missing path component, never unrelated files
        // in the external parent. Symlink escapes stay outside the watched set.
        let parent = path.dirname(scope.directory);
        while (within(scope.root, parent)) {
          target = inspect(parent, scope.root);
          if (target) {
            const name = path.relative(parent, scope.directory).split(path.sep)[0];
            active = { ...scope, directory: parent, mode: "file", file: name };
            break;
          }
          const next = path.dirname(parent);
          if (next === parent) break;
          parent = next;
        }
      }
      if (!target) continue;
      const key = `${target.real}:${active.mode}:${active.file ?? ""}:${active.depth}`;
      if (seen.has(key)) continue;
      seen.add(key);
      let item = desired.get(target.real);
      if (!item) {
        if (desired.size >= MAX_WATCHES) { limit(); continue; }
        item = { identity: target.identity, scopes: [], children: new Set() };
        desired.set(target.real, item);
      }
      active = { ...active, directory: target.real,
        root: active.mode === "file" ? active.root : active.depth === 0 ? target.real : active.root };
      item.scopes.push(active);
      if (active.mode === "workspace") continue;
      if (active.mode === "harness" || active.mode === "user") {
        const catalogs = active.mode === "harness" ? ["rules", "skills", "agents", "plugins"] : ["skills", "agents"];
        for (const name of catalogs) queue.push({ directory: path.join(target.real, name), root: active.root,
          mode: name === "skills" ? "skills" : name === "rules" ? "rules" : name === "plugins" ? "plugins" : "markdown", depth: 0 });
      }
      if (!["skills", "rules", "content"].includes(active.mode) || active.depth >= MAX_DEPTH || entries >= MAX_ENTRIES) continue;
      let directory: fs.Dir | undefined;
      try {
        directory = fs.opendirSync(target.real);
        while (entries < MAX_ENTRIES) {
          const entry = directory.readSync();
          if (!entry) break;
          entries++;
          if (ignored(entry.name) || (!entry.isDirectory() && !entry.isSymbolicLink())) continue;
          const child = path.join(target.real, entry.name);
          if (!inspect(child, active.root)) continue;
          item.children.add(entry.name);
          if (queue.length < MAX_WATCHES * (MAX_DEPTH + 2)) queue.push({ directory: child,
            root: active.root, mode: active.mode, depth: active.depth + 1 });
          else limit();
        }
        if (entries >= MAX_ENTRIES) limit();
      } catch (error) { report(error); }
      finally {
        try { directory?.closeSync(); } catch (error) { report(error); }
      }
    }
    for (const [directory, entry] of watches) {
      if (desired.get(directory)?.identity !== entry.identity) { entry.watcher.close(); watches.delete(directory); }
    }
    for (const [directory, item] of desired) {
      const existing = watches.get(directory);
      if (existing) { existing.scopes = item.scopes; existing.children = item.children; continue; }
      if (closed) break;
      try {
        const watcher = fs.watch(directory, { recursive: false }, (event, filename) => {
          if (closed) return;
          const entry = watches.get(directory);
          if (!entry) return;
          const name = filename?.toString();
          if (name && (ignored(name) || path.basename(name) !== name)) return;
          const relevant = !name || entry.scopes.some(scope => {
            switch (scope.mode) {
              case "workspace": return ["HARNESS.md", "AGENTS.md", ".harness"].includes(name);
              case "harness": return ["settings.json", "settings.local.json", "keybindings.json", "rules", "skills", "agents", "plugins"].includes(name);
              case "user": return ["settings.json", "keybindings.json", "skills", "agents"].includes(name);
              case "plugins": return name === ".index.json";
              case "file": return name === scope.file;
              case "instructions": return name === "HARNESS.md" || name === "AGENTS.md";
              case "content": return true;
              case "markdown": return name.endsWith(".md");
              case "rules": return name.endsWith(".md") || (event === "rename" && scope.depth < MAX_DEPTH &&
                (entry.children.has(name) || !!inspect(path.join(directory, name), scope.root)));
              case "skills": return name === "SKILL.md" || (event === "rename" && scope.depth < MAX_DEPTH &&
                (entry.children.has(name) || !!inspect(path.join(directory, name), scope.root)));
            }
          });
          if (!relevant) return;
          if (event === "rename" || !name) refresh();
          notify();
        });
        watcher.on("error", error => { report(error); });
        watches.set(directory, { ...item, watcher });
      } catch (error) { report(error); }
    }
  };
  refresh();
  return { close, addInstructionPaths(paths) {
    if (closed) return;
    let changed = false;
    for (const file of paths.slice(0, MAX_ENTRIES)) {
      if (!path.isAbsolute(file)) { report(new Error("Config watch instruction path must be absolute")); continue; }
      const normalized = path.normalize(file);
      if (knownPaths.has(normalized) || ignored(normalized)) continue;
      if (knownPaths.size >= MAX_ENTRIES) { report(new Error("Config watch instruction path limit exceeds 2048")); break; }
      knownPaths.add(normalized); addPath(normalized); changed = true;
    }
    if (changed) refresh();
  } };
}
