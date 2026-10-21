/**
 * The `/memory` panel. Recovered from `chunk-xmmahshv.js` sha256
 * `d05e6c429ee5b651d745505d90121bd96c379ab9cff423e58a8e31ddac03f2f0`: the
 * local editor dialog `kn` at 45274 and its path display `eo` at 45107; the row
 * model `ecn` in `chunk-chvcdc26.js` sha256
 * `aaa89855b78d0faf7fc7a17c11ca0192af4f8a917f43b803912ab4e4ee51947b` at 1124;
 * the open helper `eWe` in `chunk-7tnkhv2k.js` sha256
 * `9ffb6fdc8861a418299ffa0765be70a40cdb348468f8bcae67d846ea155ee4d9` at 1876.
 * Offsets are zero-based UTF-16 code units.
 *
 * The vendor rows name CLAUDE.md because that is the file its loader reads.
 * This host's loader reads `HARNESS.md` and `AGENTS.md` (src/config.ts
 * `INSTRUCTION_FILES`), so the labels and placeholder paths below follow the
 * same row rules over those names.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { InstructionFile } from './config.js';
import type { ExternalEditorResult } from './external-editor.js';

export const MEMORY_TITLE = 'Memory';
export const MEMORY_CANCELLED = 'Cancelled memory editing';
export const MEMORY_EDITOR_HINT = '> To use a different editor, set the $EDITOR or $VISUAL environment variable.';

const INSTRUCTION_NAMES = ['HARNESS.md', 'AGENTS.md'] as const;

export interface MemoryPanelRow {
  path: string;
  label: string;
  description: string;
  exists: boolean;
}

export interface MemoryPanelInput {
  instructions: readonly InstructionFile[];
  workspace: string;
  userDir: string;
  home?: string;
  checkedIn?: boolean;
}

/** `eo`: prefer the shorter of the home-relative and workspace-relative spellings. */
export function memoryDisplayPath(file: string, workspace: string, home = os.homedir()): string {
  const absolute = path.resolve(file);
  const homePath = absolute.startsWith(home + path.sep) ? '~' + absolute.slice(home.length) : null;
  const root = path.resolve(workspace);
  const workspacePath = absolute.startsWith(root + path.sep) ? './' + path.relative(root, absolute) : null;
  if (homePath !== null && workspacePath !== null) {
    return homePath.length <= workspacePath.length ? homePath : workspacePath;
  }
  return homePath ?? workspacePath ?? absolute;
}

function instructionKind(file: string, workspace: string, home: string): 'user' | 'project' | 'local' | 'other' {
  const parent = path.dirname(file);
  const name = path.basename(file);
  if (parent === home && (INSTRUCTION_NAMES as readonly string[]).includes(name)) return 'user';
  if (parent === path.resolve(workspace)) {
    if ((INSTRUCTION_NAMES as readonly string[]).includes(name)) return 'project';
    if (name === 'HARNESS.local.md' || name === 'AGENTS.local.md') return 'local';
  }
  return 'other';
}

/**
 * `ecn`: loaded files in load order, indented by their import depth, then the
 * absent user and project instruction files so choosing one can create it.
 */
export function memoryPanelRows(input: MemoryPanelInput): MemoryPanelRow[] {
  const home = input.home ?? os.homedir();
  const workspace = path.resolve(input.workspace);
  const checkedIn = input.checkedIn ?? fs.existsSync(path.join(workspace, '.git'));
  const seen = new Set<string>();
  const depth = new Map<string, number>();
  const rows: MemoryPanelRow[] = [];
  for (const file of input.instructions) {
    const absolute = path.resolve(file.path);
    if (seen.has(absolute)) continue;
    seen.add(absolute);
    const parentDepth = file.parent === undefined ? 0 : (depth.get(path.resolve(file.parent)) ?? 0) + 1;
    const level = file.parent === undefined ? 0 : parentDepth;
    depth.set(absolute, level);
    const display = memoryDisplayPath(absolute, workspace, home);
    const kind = instructionKind(absolute, workspace, home);
    const label = kind === 'user' ? 'User instructions'
      : kind === 'project' ? 'Project instructions'
        : level > 0 ? `${'  '.repeat(level)}L ${display}` : display;
    const description = kind === 'user' ? `Saved in ${display}`
      : kind === 'project' ? `${checkedIn ? 'Checked in at' : 'Saved in'} ${display}`
        : file.parent !== undefined ? '@-imported' : '';
    rows.push({ path: absolute, label, description, exists: true });
  }
  const userFile = path.join(home, 'HARNESS.md');
  if (!seen.has(userFile)) {
    rows.push({ path: userFile, label: 'User instructions',
      description: `Saved in ${memoryDisplayPath(userFile, workspace, home)}`, exists: false });
  }
  const projectFile = path.join(workspace, 'HARNESS.md');
  if (!seen.has(projectFile)) {
    rows.push({ path: projectFile, label: 'Project instructions',
      description: `${checkedIn ? 'Checked in at' : 'Saved in'} ${memoryDisplayPath(projectFile, workspace, home)}`,
      exists: false });
  }
  return rows;
}

/** `kn`: create the file when absent, then hand it to the user's editor. */
export async function openMemoryFile(file: string, signal: AbortSignal, workspace: string,
  open: (file: string, signal: AbortSignal, workspace: string) => Promise<ExternalEditorResult>,
  editorConfigured: () => boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try { fs.writeFileSync(file, '', { encoding: 'utf8', flag: 'wx' }); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    if (!editorConfigured()) return { ok: false };
    const result = await open(file, signal, workspace);
    return result.error === undefined ? { ok: true } : { ok: false, error: result.error };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/** `kn`'s report: the opened path, then the editor source and its change hint. */
export function memoryOpenedMessage(file: string, workspace: string,
  environment: NodeJS.ProcessEnv = process.env, home = os.homedir()): string {
  const display = memoryDisplayPath(file, workspace, home);
  const visual = environment.VISUAL;
  const editor = environment.EDITOR;
  const hint = visual !== undefined && visual !== ''
    ? `> Using $VISUAL="${visual}". To change editor, set $EDITOR or $VISUAL environment variable.`
    : editor !== undefined && editor !== ''
      ? `> Using $EDITOR="${editor}". To change editor, set $EDITOR or $VISUAL environment variable.`
      : MEMORY_EDITOR_HINT;
  return `Opened ${display}\n\n${hint}`;
}

export function memoryOpenFailedMessage(file: string, workspace: string, home = os.homedir()): string {
  return `Couldn't open ${memoryDisplayPath(file, workspace, home)} in an editor. `
    + 'If no editor is configured, set $EDITOR or $VISUAL, then run /memory again.';
}

/** The command has no non-interactive sibling; a piped session still reads the same rows. */
export function memoryPanelReport(rows: readonly MemoryPanelRow[]): string {
  return [MEMORY_TITLE,
    ...rows.map(row => `  ${row.label}${row.description === '' ? '' : `  ${row.description}`}`)].join('\n');
}
