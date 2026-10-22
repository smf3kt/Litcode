import fs from 'node:fs';
import path from 'node:path';
import { CONFIG_LIMITS, defaultUserDir, readBoundedBytes } from './config.js';
import { permissionSettingsPaths } from './permission-settings.js';
import type { ConfigPanelInput, ConfigPanelState, ConfigRowId } from './config-panel.js';
import type { SessionConfig } from './session.js';

/** ke/vWe, nybcbd9t [4744,4817)/[26484,26977), UTF-16: a higher authored timeout source hides its row. */
export function configPanelInput(config: SessionConfig, state?: ConfigPanelState): ConfigPanelInput {
  const userDir = config.configSources?.userDir ?? defaultUserDir();
  const files = permissionSettingsPaths(config.workspace, userDir);
  const higher = [files.projectSettings, files.legacyLocalSettings, files.localSettings,
    config.configSources?.settingsFile === undefined ? undefined : path.resolve(config.workspace, config.configSources.settingsFile)];
  const hidden = new Set<ConfigRowId>();
  for (const file of [...new Set(higher)]) {
    if (file === undefined) continue;
    if (!fs.existsSync(file)) continue;
    const read = readBoundedBytes(file, CONFIG_LIMITS.settingsBytes);
    if (read.overflow) throw new Error('Settings exceed the byte limit');
    const text = read.buffer.toString('utf8');
    const settings: unknown = JSON.parse(text.trim() ? text : '{}');
    if (settings === null || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('Settings must contain an object');
    if ('askUserQuestionTimeout' in settings && settings.askUserQuestionTimeout !== undefined) hidden.add('askUserQuestionTimeout');
    if ('dialogExpiry' in settings && settings.dialogExpiry !== undefined) hidden.add('dialogExpiry');
  }
  return { config: { model: config.model, thinking: config.thinking, verbose: config.verbose,
    terminalProgressBarEnabled: config.terminalProgressBarEnabled, permissions: config.permissions,
    autoCompactEnabled: config.autoCompactEnabled, spinnerTipsEnabled: config.spinnerTipsEnabled,
    theme: config.theme, editorMode: config.editorMode,
    timeFormat: config.timeFormat, prefersReducedMotion: config.prefersReducedMotion, showTurnDuration: config.showTurnDuration,
    askUserQuestionTimeout: config.askUserQuestionTimeout, dialogExpiry: config.dialogExpiry }, hidden: [...hidden], state };
}
