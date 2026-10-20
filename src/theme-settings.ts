import fs from 'node:fs';
import path from 'node:path';
import { atomicWriteFile } from './atomic-write.js';
import { CONFIG_LIMITS, defaultUserDir, readBoundedBytes } from './config.js';
import { parseTheme, type ThemeSetting } from './tui-theme-state.js';
import { editorModeSchema, type EditorMode } from './tui-vim.js';

/** Source D6 writes userSettings; retain all authored fields in the owned store. */
export function saveThemeSetting(theme: ThemeSetting, userDir = defaultUserDir()): void {
  if (parseTheme(theme) === undefined) throw new Error('Theme takes the name of a theme');
  saveDisplaySetting('theme',theme,userDir);
}

export function saveEditorMode(mode: EditorMode, userDir = defaultUserDir()): void {
  if(editorModeSchema.parse(mode)===undefined)throw new Error('Editor mode takes normal or vim');
  saveDisplaySetting('editorMode',mode,userDir);
}

export function saveDiffDisplaySetting(key: 'diffSidebarOpen' | 'diffSidebarBaseMode', value: boolean | 'session' | 'uncommitted' | 'branch',
  userDir = defaultUserDir()): void {
  saveDisplaySetting(key, value, userDir);
}

/**
 * The `X9` settings write at `chunk-9vcaezw1.js` 13965 reaches `we` at 13897, which stores
 * `userSettings.effort`; `Z_e` at 8999 keeps `max` out of it. Passing undefined is the recovered
 * `auto` path and removes the key, so the next session has no effort of its own.
 */
export function saveEffortSetting(level: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | undefined,
  userDir = defaultUserDir()): void {
  saveDisplaySetting('effort', level, userDir);
}

const SETTING_LABELS = {
  theme: 'saveThemeSetting', editorMode: 'saveEditorMode', diffSidebarOpen: 'saveDiffDisplaySetting',
  diffSidebarBaseMode: 'saveDiffDisplaySetting', effort: 'saveEffortSetting',
} as const;

function saveDisplaySetting(key: keyof typeof SETTING_LABELS, value: string | boolean | undefined, userDir: string): void {
  const file = path.join(path.resolve(userDir), 'settings.json');
  let settings: Record<string, unknown> = {}, mode = 0o600;
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Theme settings must be a regular file');
    mode = stat.mode & 0o777;
    const read = readBoundedBytes(file, CONFIG_LIMITS.settingsBytes);
    if (read.overflow) throw new Error('Theme settings exceed the byte limit');
    const text = read.buffer.toString('utf8');
    const parsed: unknown = text.trim() ? JSON.parse(text) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Theme settings must contain an object');
    settings = parsed as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (value === undefined) delete settings[key];
  else settings[key] = value;
  const content = JSON.stringify(settings, null, 2) + '\n';
  if (Buffer.byteLength(content) > CONFIG_LIMITS.settingsBytes) throw new Error('Theme settings exceed the byte limit');
  atomicWriteFile(file, content, { mode, label: SETTING_LABELS[key] });
}
