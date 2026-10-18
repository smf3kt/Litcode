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

function saveDisplaySetting(key: 'theme'|'editorMode'|'diffSidebarOpen'|'diffSidebarBaseMode', value: string | boolean, userDir: string): void {
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
  const content = JSON.stringify({ ...settings, [key]:value }, null, 2) + '\n';
  if (Buffer.byteLength(content) > CONFIG_LIMITS.settingsBytes) throw new Error('Theme settings exceed the byte limit');
  atomicWriteFile(file, content, { mode, label: key==='theme'?'saveThemeSetting':'saveEditorMode' });
}
