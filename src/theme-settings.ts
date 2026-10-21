import fs from 'node:fs';
import path from 'node:path';
import { atomicWriteFile } from './atomic-write.js';
import { CONFIG_LIMITS, defaultUserDir, readBoundedBytes } from './config.js';
import { parseTheme, type ThemeSetting } from './tui-theme-state.js';
import { editorModeSchema, type EditorMode } from './tui-vim.js';
import type { ConfigUpdate } from './config-panel.js';
import { modelSettingsKey, persistableEffort, type EffortLevel } from './effort-command.js';
import { permissionSettingsPaths, queuePermissionSettingsWrite } from './permission-settings.js';

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

/** D/V -> X9/Pe, 0q6c90q6 [2541,4018)/[4505,5283), 9vcaezw1 [12184,12346)/[13891,14114), UTF-16. */
export function saveEffortSetting(level: EffortLevel | undefined, userDir = defaultUserDir(), model?: string): void {
  if (level === 'max') return;
  updateDisplayFile(path.join(path.resolve(userDir), 'settings.json'), 'effort', settings => {
    if (level === undefined) delete settings.effort;
    else settings.effort = level;
    if (model !== undefined && settings.modelSettings !== undefined) updateModelEffort(settings, model, level);
  });
}

/**
 * The `compactAt` write behind `/autocompact`: the recovered handler persists
 * `autoCompactWindow` into `userSettings` (`Duo` in `chunk-9vcaezw1.js` 1081400) and `auto`
 * clears it. Passing undefined removes the key, so the next session takes the built-in window.
 */
export function saveAutoCompactSetting(window: number | undefined, userDir = defaultUserDir()): void {
  if (window !== undefined && !Number.isSafeInteger(window)) throw new Error('Auto-compact window takes a whole number of tokens');
  saveDisplaySetting('compactAt', window, userDir);
}

/**
 * The stored `compactAt`, or undefined when the file or the key is absent. The dialog needs the
 * authored value rather than the resolved one, because `auto` and `default for this model` are
 * different states with the same effective window.
 */
export function readAutoCompactSetting(userDir = defaultUserDir()): number | undefined {
  const file = path.join(path.resolve(userDir), 'settings.json');
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) return undefined;
    const read = readBoundedBytes(file, CONFIG_LIMITS.settingsBytes);
    if (read.overflow) return undefined;
    const parsed: unknown = JSON.parse(read.buffer.toString('utf8') || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    const value = (parsed as Record<string, unknown>).compactAt;
    return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined;
  } catch { return undefined; }
}

/**
 * The `/model` default. The recovered picker's enter arm calls `onSetDefault`, and the
 * non-interactive handler passes `!isNonInteractiveSession` as the save flag (`xWe` in
 * `chunk-naxwgf3s.js`), so a pick becomes the default for new sessions; the picker's `s` arm
 * skips this write. `src/cli.ts` already reads `settings.model` ahead of the inherited value.
 */
export function saveModelSetting(model: string | undefined, userDir = defaultUserDir()): void {
  if (model !== undefined && (model.trim() === '' || model.length > 256)) {
    throw new Error('Model takes 1 to 256 characters');
  }
  saveDisplaySetting('model', model, userDir);
}

/** vWe W/rows, nybcbd9t [8208,8266)/[12034,12244)/[15295,30405); D6, js2bhabe [1499,1554), UTF-16. */
export async function saveConfigPanelSetting(update: ConfigUpdate, workspace: string, userDir = defaultUserDir()): Promise<void> {
  const paths = permissionSettingsPaths(workspace, userDir);
  // vWe permissionMode [21907,22578), UTF-16: P writes the nested userSettings document.
  if (update.id === 'permissionMode') {
    await queuePermissionSettingsWrite(paths.userSettings!, () => writePermissionDefaultMode(paths.userSettings!, update.value));
    return;
  }
  const file = update.id === 'reduceMotion' ? paths.localSettings! : paths.userSettings!;
  const key = update.id === 'reduceMotion' ? 'prefersReducedMotion' : update.id === 'turnDuration' ? 'showTurnDuration'
    : update.id === 'editor' ? 'editorMode' : update.id === 'autoCompact' ? 'autoCompactEnabled'
    : update.id === 'progressBar' ? 'terminalProgressBarEnabled' : update.id;
  const value = update.id === 'dialogExpiry' && update.value === 'default' ? undefined : update.value;
  await queuePermissionSettingsWrite(file, () => writeDisplayFile(file, key, value));
}

/** Me/X9/Pe/Duo, nybcbd9t [8318,9556), 9vcaezw1 [12184,12346)/[13891,14114), UTF-16. */
export async function saveConfigModelEffort(model: string, effort: EffortLevel, userDir = defaultUserDir()): Promise<void> {
  const value = persistableEffort(effort);
  if (value === undefined) return;
  const file = path.join(path.resolve(userDir), 'settings.json');
  const key = modelSettingsKey(model);
  await queuePermissionSettingsWrite(file, () => updateDisplayFile(file, 'modelSettings', settings => updateModelEffort(settings, key, value)));
}

/** Pe/Duo and us undefined-leaf merge, 9vcaezw1 [12184,12346), x0dc37w9 [102833,105519), UTF-16. */
function updateModelEffort(settings: Record<string, unknown>, model: string, value: Exclude<EffortLevel, 'max'> | undefined): void {
  const key = modelSettingsKey(model);
  if (Object.hasOwn(Object.prototype, key)) {
    if (value === undefined) delete settings.effort; else settings.effort = value;
    return;
  }
  const models: unknown = settings.modelSettings ?? {};
  if (models === null || typeof models !== 'object' || Array.isArray(models)) throw new Error('modelSettings must contain an object');
  const previous: unknown = Object.hasOwn(models, key) ? Reflect.get(models, key) : {};
  if (previous === null || typeof previous !== 'object' || Array.isArray(previous)) throw new Error('Model settings must contain an object');
  const entry = { ...previous, effortLevel: value };
  if (value === undefined) delete entry.effortLevel;
  settings.modelSettings = { ...models, [key]: entry };
}

const SETTING_LABELS = {
  theme: 'saveThemeSetting', editorMode: 'saveEditorMode', diffSidebarOpen: 'saveDiffDisplaySetting',
  diffSidebarBaseMode: 'saveDiffDisplaySetting', effort: 'saveEffortSetting',
  compactAt: 'saveAutoCompactSetting', model: 'saveModelSetting', modelSettings: 'saveConfigModelEffort', thinking: 'saveConfigPanelSetting',
  verbose: 'saveConfigPanelSetting', terminalProgressBarEnabled: 'saveConfigPanelSetting', autoCompactEnabled: 'saveConfigPanelSetting', prefersReducedMotion: 'saveConfigPanelSetting', showTurnDuration: 'saveConfigPanelSetting',
  timeFormat: 'saveConfigPanelSetting', askUserQuestionTimeout: 'saveConfigPanelSetting', dialogExpiry: 'saveConfigPanelSetting',
} as const;

function saveDisplaySetting(key: keyof typeof SETTING_LABELS,
  value: string | number | boolean | undefined, userDir: string): void {
  writeDisplayFile(path.join(path.resolve(userDir), 'settings.json'), key, value);
}

function writeDisplayFile(file: string, key: keyof typeof SETTING_LABELS, value: string | number | boolean | undefined): void {
  updateDisplayFile(file, key, settings => {
    if (value === undefined) delete settings[key];
    else settings[key] = value;
  });
}

function updateDisplayFile(file: string, key: keyof typeof SETTING_LABELS, update: (settings: Record<string, unknown>) => void): void {
  updateSettingsDocument(file, SETTING_LABELS[key], update);
}

function writePermissionDefaultMode(file: string, mode: string): void {
  updateSettingsDocument(file, 'saveConfigPanelSetting', settings => {
    // `us`/`MB` (chunk-x0dc37w9.js, decoded byte 102833): a non-object leaf is replaced by the
    // merged object; the merge only preserves keys of an existing plain object.
    const permissions = settings.permissions;
    const current = permissions !== null && typeof permissions === 'object' && !Array.isArray(permissions)
      ? permissions as Record<string, unknown> : undefined;
    settings.permissions = { ...current, defaultMode: mode };
  });
}

function updateSettingsDocument(file: string, label: string, update: (settings: Record<string, unknown>) => void): void {
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
  update(settings);
  const content = JSON.stringify(settings, null, 2) + '\n';
  if (Buffer.byteLength(content) > CONFIG_LIMITS.settingsBytes) throw new Error('Theme settings exceed the byte limit');
  atomicWriteFile(file, content, { mode, label });
}
