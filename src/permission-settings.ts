import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { atomicWriteFile } from './atomic-write.js';
import { createSettingsWriteQueue } from './plugin-chain-settings-schema.js';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolveChain } from './path-identity.js';
import { parsePermissionRule, serializePermissionRule } from './permission-state.js';
import type { PermissionUpdate } from './permissions.js';

const objectSchema = z.record(z.unknown());
const queues = createSettingsWriteQueue();
/** ta, x0dc37w9 [102253,102464), UTF-16: rule and auto-mode writes share the file queue. */
export function queuePermissionSettingsWrite<T>(file: string, write: () => T | Promise<T>): Promise<T> {
  return queues.run(path.resolve(file), write);
}
const execute = promisify(execFile);
export type PermissionIgnoreResult = { written: boolean; effective: boolean;
  reason?: 'already_tracked' | 'excludesfile_not_read'; error?: string; warning?: string };
export type PermissionPersistenceOwner = { workspace: string; schedule(work: Promise<PermissionIgnoreResult>): void };

/** YAr/KAr/zr/jr/Mt/kt, chunk-x0dc37w9 [4806,6677), zero-based UTF-16.
 * Node filesystem/process hosts replace source facades; TO [401146,401294) uses neutral paths. */
export async function ignorePermissionSettings(relative: string, workspace: string): Promise<PermissionIgnoreResult> {
  const git = async (args: string[]) => {
    try { const result = await execute('git', args, { cwd: workspace, encoding: 'utf8', windowsHide: true });
      return { code: 0, stdout: result.stdout }; }
    catch (error) {
      if (error instanceof Error && 'code' in error && typeof error.code === 'number') return { code: error.code, stdout: '' };
      throw error;
    }
  };
  try {
    // NCo/ur/Vn/Ue, chunk-bf3z2ftn [67287,68113), [71908,71934), UTF-16.
    let directory = path.resolve(workspace), repository = false;
    for (;;) {
      try {
        const entry = path.join(directory, '.git');
        const resolved = resolveChain(directory, entry), stat = fs.statSync(resolved.path);
        if (stat.isFile() || stat.isDirectory()) { repository = true; break; }
      } catch { /* Continue the source ancestor search. */ }
      const parent = path.dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
    if (!repository) return { written: false, effective: false };
    const normalized = relative.replaceAll('\\', '/'), pattern = `**/${normalized}`;
    const probe = normalized.endsWith('/') ? `${normalized}sample-file.txt` : normalized;
    const effective = async () => (await git(['check-ignore', '--', probe])).code === 0;
    if (await effective()) return { written: false, effective: true };
    const configured = await git(['config', '--global', '--get', 'core.excludesfile']);
    const value = configured.code === 0 ? configured.stdout.trim() : '';
    const file = value === '~' || value.startsWith('~/') ? path.join(os.homedir(), value.slice(2))
      : path.isAbsolute(value) ? value
      : process.env.XDG_CONFIG_HOME && path.isAbsolute(process.env.XDG_CONFIG_HOME)
        ? path.join(process.env.XDG_CONFIG_HOME, 'git', 'ignore') : path.join(os.homedir(), '.config', 'git', 'ignore');
    const ineffective = async (written: boolean): Promise<PermissionIgnoreResult> => {
      const reason = (await git(['ls-files', '--error-unmatch', '--', probe])).code === 0
        ? 'already_tracked' : 'excludesfile_not_read';
      return { written, effective: false, reason,
        warning: reason === 'already_tracked'
          ? `'${probe}' is tracked in the index; gitignore rules do not apply to tracked files`
          : 'core.excludesfile may point elsewhere' };
    };
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    try {
      if ((await fs.promises.readFile(file, 'utf8')).includes(pattern)) return await ineffective(false);
      await fs.promises.appendFile(file, `\n${pattern}\n`);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') await fs.promises.writeFile(file, `${pattern}\n`, 'utf8');
      else throw error;
    }
    if (!await effective()) return await ineffective(true);
    return { written: true, effective: true };
  } catch (error) {
    return { written: false, effective: false, error: `Failed to add gitignore entry to global gitignore: ${error instanceof Error ? error.message : String(error)}` };
  }
}
export type PermissionWriteResult = { destination: PermissionUpdate['destination']; file?: string;
  outcome: 'written' | 'unchanged' | 'skipped' | 'error'; error?: string; warning?: string };
export type PermissionFilePaths = Partial<Record<PermissionUpdate['destination'], string>> & { legacyLocalSettings?: string };

/** Adapt TP/Fs/gt/Xn, chunk-x0dc37w9 [4100,4455), chunk-bf3z2ftn [68045,69892), UTF-16.
 * Native paths and neutral settings names replace the source filesystem facade. */
export function permissionSettingsPaths(workspace: string, userDir: string): PermissionFilePaths {
  let root = path.resolve(workspace), canonical = root;
  for (;;) {
    const entry = path.join(root, '.git');
    if (fs.existsSync(entry)) {
      canonical = root;
      try {
        if (fs.lstatSync(entry).isFile()) {
          const text = fs.readFileSync(entry, 'utf8').trim();
          if (text.startsWith('gitdir:')) {
            const gitDir = path.resolve(root, text.slice(7).trim());
            const common = path.resolve(gitDir, fs.readFileSync(path.join(gitDir, 'commondir'), 'utf8').trim());
            const backlink = path.resolve(gitDir, fs.readFileSync(path.join(gitDir, 'gitdir'), 'utf8').trim());
            if (path.dirname(gitDir) === path.join(common, 'worktrees') && fs.realpathSync(backlink) === fs.realpathSync(entry)) {
              canonical = path.basename(common) === '.git' ? path.dirname(common) : common;
            }
          }
        }
      } catch { canonical = root; }
      break;
    }
    const parent = path.dirname(root);
    if (parent === root) { canonical = path.resolve(workspace); break; }
    root = parent;
  }
  // RN/pTr/Z$s, chunk-3cynezh1 [398611,400577), UTF-16. Ownership is checked per load.
  const cwd = path.resolve(workspace);
  try {
    const uid = process.geteuid?.() ?? process.getuid?.();
    const home = fs.realpathSync(os.homedir());
    const owned = (file: string, optional = false) => {
      try { return fs.lstatSync(file).uid === uid; }
      catch (error) { return optional && error instanceof Error && 'code' in error && error.code === 'ENOENT'; }
    };
    if (canonical === home || uid === undefined || !owned(canonical) || !owned(path.join(canonical, '.git')) ||
        !owned(path.join(canonical, '.harness'), true)) canonical = cwd;
  } catch { canonical = cwd; }
  return { userSettings: path.join(userDir, 'settings.json'), projectSettings: path.join(cwd, '.harness', 'settings.json'),
    localSettings: path.join(canonical, '.harness', 'settings.local.json'),
    ...(canonical === cwd ? {} : { legacyLocalSettings: path.join(cwd, '.harness', 'settings.local.json') }) };
}


/** af/ys/ta/us, chunk-2bcyxj9q [197873,199720), chunk-x0dc37w9 [102253,105519), UTF-16.
 * Node atomic writes replace the storageV5 host; raw objects retain unknown fields. */
export function persistPermissionUpdate(update: PermissionUpdate, paths: PermissionFilePaths,
  managedOnly: boolean, owner?: PermissionPersistenceOwner): Promise<PermissionWriteResult> {
  const destination = update.destination;
  if (!['userSettings', 'projectSettings', 'localSettings'].includes(destination) ||
      update.type === 'setMode' && update.mode === 'bypassPermissions' ||
      update.type === 'addRules' && managedOnly) {
    return Promise.resolve({ destination, outcome: 'skipped' });
  }
  const file = paths[destination];
  if (file === undefined) return Promise.resolve({ destination, outcome: 'error', error: 'Permission settings destination has no file' });
  const legacy = destination === 'localSettings' && paths.legacyLocalSettings !== undefined &&
    path.resolve(paths.legacyLocalSettings) !== path.resolve(file) ? paths.legacyLocalSettings : undefined;
  const keys = [...new Set([file, ...(legacy === undefined ? [] : [legacy])].map(value => path.resolve(value)))].sort();
  const run = (index: number): Promise<PermissionWriteResult> => index < keys.length
    ? queues.run(keys[index]!, () => run(index + 1)) : write();
  const transform = (raw: Record<string, unknown>): Record<string, unknown> | null => {
    const permissions = raw.permissions === undefined ? {} : objectSchema.parse(raw.permissions);
    const strings = (key: string): string[] => permissions[key] === undefined ? [] : z.array(z.string()).parse(permissions[key]);
    let patch: Record<string, unknown>;
    switch (update.type) {
      case 'addRules': {
        const old = strings(update.behavior), normalized = new Set(old.map(value => serializePermissionRule(parsePermissionRule(value))));
        const added = update.rules.map(serializePermissionRule).filter(value => !normalized.has(value));
        if (added.length === 0) return null;
        patch = { [update.behavior]: [...old, ...added] }; break;
      }
      case 'replaceRules': patch = { [update.behavior]: update.rules.map(serializePermissionRule) }; break;
      case 'removeRules': {
        const removed = new Set(update.rules.map(serializePermissionRule));
        patch = { [update.behavior]: strings(update.behavior).filter(value => !removed.has(serializePermissionRule(parsePermissionRule(value)))) }; break;
      }
      case 'addDirectories': {
        const old = strings('additionalDirectories'), added = update.directories.filter(value => !old.includes(value));
        if (added.length === 0) return null;
        patch = { additionalDirectories: [...old, ...added] }; break;
      }
      case 'removeDirectories': patch = { additionalDirectories: strings('additionalDirectories').filter(value => !update.directories.includes(value)) }; break;
      case 'setMode': patch = { defaultMode: update.mode }; break;
    }
    return { ...raw, permissions: { ...permissions, ...patch } };
  };
  // us/hr/vxs/Cr, chunk-x0dc37w9 [102833,107795), UTF-16. Run the same
  // transform on each document, then intersect legacy so additions stay canonical.
  const write = async (): Promise<PermissionWriteResult> => {
    try {
      let raw: Record<string, unknown> = {}, mode = 0o600;
      try {
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Permission settings must be a regular file');
        if (stat.size > 1024 * 1024) throw new Error('Permission settings exceed the byte limit');
        mode = stat.mode & 0o777;
        const text = fs.readFileSync(file, 'utf8');
        raw = objectSchema.parse(text.trim() ? JSON.parse(text) : {});
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      }
      const next = transform(raw);
      const changed = next !== null && JSON.stringify(next) !== JSON.stringify(raw);
      if (next !== null) atomicWriteFile(file, JSON.stringify(next, null, 2) + '\n', { mode, label: 'permissionSettings' });
      const revokeLegacy = async (): Promise<PermissionWriteResult> => {
      if (legacy !== undefined) {
        let text: string, legacyMode: number;
        const evaluatedFailure = (phase: 'read' | 'transform', error: unknown): PermissionWriteResult => {
          const message = `Failed to ${phase} legacy permission settings at ${legacy}: ${error instanceof Error ? error.message : String(error)}`;
          // Cr treats every array patch as removal-bearing, including addRules.
          return next !== null && update.type === 'setMode'
            ? { destination, file, outcome: changed ? 'written' : 'unchanged', warning: message }
            : { destination, file, outcome: 'error', error: message };
        };
        try {
          const stat = fs.lstatSync(legacy);
          if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Permission settings must be a regular file');
          if (stat.size > 1024 * 1024) throw new Error('Permission settings exceed the byte limit');
          legacyMode = stat.mode & 0o777;
          text = fs.readFileSync(legacy, 'utf8');
        } catch (error) {
          if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
            return { destination, file, outcome: changed ? 'written' : 'unchanged' };
          }
          return evaluatedFailure('read', error);
        }
        let parsed: unknown;
        try { parsed = JSON.parse(text); } catch { parsed = undefined; }
        const original = objectSchema.safeParse(parsed);
        if (original.success) {
          let transformed: Record<string, unknown> | null;
          try { transformed = transform(structuredClone(original.data)); }
          catch (error) { return evaluatedFailure('transform', error); }
          if (transformed !== null) {
            const revoked = retainLegacyRevocations(original.data, transformed);
            if (JSON.stringify(revoked) !== JSON.stringify(original.data)) {
              try { atomicWriteFile(legacy, JSON.stringify(revoked, null, 2) + '\n', { mode: legacyMode, label: 'permissionSettings' }); }
              catch (error) { return { destination, file, outcome: 'error', error: `Failed to revoke legacy permission settings at ${legacy}: ${error instanceof Error ? error.message : String(error)}` }; }
              return { destination, file, outcome: 'written' };
            }
          }
        }
      }
      return { destination, file, outcome: changed ? 'written' : 'unchanged' };
      };
      const result = await revokeLegacy();
      // us schedules after returned legacy failures, but never after a null transform or thrown write.
      if (next !== null && destination === 'localSettings' && owner) {
        owner.schedule(ignorePermissionSettings('.harness/settings.local.json', owner.workspace));
      }
      return result;
    } catch (error) {
      return { destination, file, outcome: 'error', error: error instanceof Error ? error.message : String(error) };
    }
  };
  return run(0);
}

/** vxs, chunk-x0dc37w9 [107544,107795), zero-based UTF-16. */
function retainLegacyRevocations(original: unknown, transformed: unknown): unknown {
  if (Array.isArray(original) && Array.isArray(transformed)) {
    const retained = new Set(transformed.map(value => JSON.stringify(value)));
    return original.filter(value => retained.has(JSON.stringify(value)));
  }
  const oldObject = objectSchema.safeParse(original), nextObject = objectSchema.safeParse(transformed);
  if (oldObject.success && nextObject.success) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(oldObject.data)) {
      if (!(key in nextObject.data) || nextObject.data[key] === undefined) continue;
      Object.defineProperty(result, key, { value: retainLegacyRevocations(oldObject.data[key], nextObject.data[key]),
        enumerable: true, configurable: true, writable: true });
    }
    return result;
  }
  return original;
}

export async function drainPermissionSettings(): Promise<void> { await queues.drain(); }
