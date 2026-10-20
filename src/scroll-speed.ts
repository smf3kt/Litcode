import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { atomicWriteFile } from './atomic-write.js';
import { CONFIG_LIMITS, defaultUserDir, readBoundedBytes } from './config.js';
import { pluralize } from './diff-dialog-primitives.js';
import type { TerminalEnvironment } from './plugin-chain-terminal-environment.js';
/**
 * `/scroll-speed` adjusts how far one wheel notch scrolls, ported from the recovered interactive
 * application. Coordinates are zero-based UTF-16 offsets in the extracted module.
 *
 * - `chunk-gz3f33zw.js` (SHA-256
 *   3fd019e969ec8e41ae3c0a33ba98763dfde674951540e32716dbb3d574ac516e): `_t` 6959 the live
 *   environment read, `k` 7024 the snap-and-clamp, `O` 7132 the environment write, `ce` 7210 the
 *   dialog component, `j` 11657 its label row, `Me` 11957 the ruler, `xe` 12078 the terminal
 *   description, `Dt` 12280 the terminal name, `Ve` 12921 the editor row, `call` 13280 the
 *   command body. The four constants sit at 6995 and the environment name at 7099.
 * - `chunk-ax7r0qj7.js` (SHA-256
 *   8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e): `vi` 615 the guarded
 *   repeat, `I` 798 the pluralizer.
 * - `chunk-xaes9ysz.js`: `RPe` 3565 the platform's display name.
 * - `chunk-sfn1dbxq.js` (SHA-256
 *   4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da): `Xfo` 1166855 the
 *   `local-jsx` registration and its gate.
 * - The terminal probe `uq` is already ported in `./plugin-chain-terminal-environment.js`.
 */

/** Source `h`: the variable the whole feature reads and writes. */
export const SCROLL_SPEED_ENV = 'CLAUDE_CODE_SCROLL_SPEED';
/** Source `ge` and `A`, the fine granularity, exact in binary so the snap has no float noise. */
export const SCROLL_SPEED_FINE_STEP = 0.25;
/** Source `me`: the coarse granularity, used once the decay curve is in play. */
export const SCROLL_SPEED_COARSE_STEP = 1;
/** Source `X`: both the clamp ceiling and the ruler's width. */
export const SCROLL_SPEED_LIMIT = 10;

/**
 * Source `v4n`: the base a terminal kind asks for before the environment overrides it. A
 * flooding terminal (Cursor, old VS Code, xterm.js) steps one line; a terminal that reports
 * wheel events honestly steps three.
 */
export function autoScrollSpeed(environment: Pick<TerminalEnvironment, 'xtermJs' | 'wheelFlood' | 'wtSession'>): number {
  return !environment.wheelFlood && (environment.xtermJs || environment.wtSession) ? 3 : 1;
}

/** Source `pe` in `ce`: the granularity this terminal's curve uses. */
export function scrollSpeedStep(environment: Pick<TerminalEnvironment, 'useDecayCurve'>): number {
  return environment.useDecayCurve ? SCROLL_SPEED_COARSE_STEP : SCROLL_SPEED_FINE_STEP;
}

/**
 * Source `k`: snap to the granularity and clamp into `[step, 10]`. A value below one snaps to
 * the fine grid even when the step is coarse, because the clamp lifts it back to at least the
 * step either way.
 */
export function snapScrollSpeed(value: number, step: number): number {
  const snapped = value < 1 ? Math.round(value / SCROLL_SPEED_FINE_STEP) * SCROLL_SPEED_FINE_STEP : Math.round(value);
  return Math.min(Math.max(snapped, step), SCROLL_SPEED_LIMIT);
}

/**
 * Source `ce`'s `J`: one arrow press asks for a quarter line inside the fine range and a whole
 * line above it, then the snap decides whether anything moved. `undefined` is the recovered
 * early return, which leaves the environment alone.
 */
export function adjustScrollSpeed(current: number, direction: -1 | 1, step: number): number | undefined {
  const delta = direction < 0
    ? (current <= 1 ? -SCROLL_SPEED_FINE_STEP : -1)
    : (current < 1 ? SCROLL_SPEED_FINE_STEP : 1);
  const next = snapScrollSpeed(current + delta, step);
  return next === current ? undefined : next;
}

/** Source `Me`: the ten-cell ruler, with a half dot for the fine range below one. `t < 1` is the
 *  recovered early return; above it the filled count is clamped into `[1, 10]`. */
export function scrollSpeedRuler(value: number): string {
  if (value < 1) return `▪${'·'.repeat(SCROLL_SPEED_LIMIT - 1)}`;
  const filled = Math.min(Math.max(Math.round(value), 1), SCROLL_SPEED_LIMIT);
  return '■'.repeat(filled) + '·'.repeat(SCROLL_SPEED_LIMIT - filled);
}

/** Source `I` in the save report: `1 line` and `2 lines`. */
export function scrollSpeedNotch(value: number): string {
  return `${value} ${pluralize(value, 'line')} per notch`;
}

/** Source `ee` in the dialog: the same count, but the dialog says `wheel notch` and indents it. */
export function scrollSpeedDialogNotch(value: number): string {
  return `  ${value} ${pluralize(value, 'line')} per wheel notch`;
}

/** The clause the reset form of the report spells out. */
export function scrollSpeedNotchCount(value: number): string {
  return `${value} ${pluralize(value, 'line')}`;
}

/**
 * Source `ITo`: the askpass path names the Devin Desktop editor family. The recovered predicate
 * also matches `windsurf`, and `Dt` reports both as `Devin Desktop`, so the two stay together.
 */
export function devinDesktopAskpass(askpass: string): boolean {
  const lower = askpass.toLowerCase();
  return lower.includes('windsurf') || lower.includes('devin.app') || lower.includes('devin desktop')
    || lower.includes('devin-desktop') || /appdata[\\/]local[\\/](programs[\\/])?devin[\\/]/.test(lower);
}

/**
 * Source `Dt`: the terminal's name, from the editor-injection variables first and then from
 * `TERM_PROGRAM`. Only the names this host can observe are kept; the recovered list is the same
 * switch.
 */
export function terminalName(environment: Pick<TerminalEnvironment, 'termProgram' | 'termProgramVersion' | 'wtSession' | 'platform'>,
  variables: Record<string, string | undefined> = process.env): string {
  if (variables.CURSOR_TRACE_ID !== undefined) return 'Cursor';
  const askpass = variables.VSCODE_GIT_ASKPASS_MAIN ?? '';
  if (askpass.includes('cursor')) return 'Cursor (remote)';
  if (devinDesktopAskpass(askpass)) return 'Devin Desktop';
  if (askpass.includes('antigravity')) return 'Antigravity';
  if (environment.termProgram === 'vscode') {
    return `VS Code${environment.termProgramVersion !== 'unset' ? ` ${environment.termProgramVersion}` : ''}`;
  }
  switch (environment.termProgram) {
    case 'unset': return environment.wtSession || environment.platform === 'win32' ? 'Windows console' : 'terminal';
    case 'iTerm.app': return 'iTerm2';
    case 'Apple_Terminal': return 'Terminal.app';
    case 'ghostty': return 'Ghostty';
    case 'WezTerm': return 'WezTerm';
    case 'WarpTerminal': return 'Warp';
    default: return environment.termProgram;
  }
}

/** Source `RPe` (chunk-xaes9ysz.js 3565): the platform as the row spells it. */
export function platformName(platform: string): string {
  switch (platform) {
    case 'darwin': return 'macOS';
    case 'win32': return 'Windows';
    case 'linux': return 'Linux';
    default: return platform;
  }
}

/**
 * Source `xe`: the terminal row's value — its name, the platform, and whichever wheel transport
 * the probe found, in the recovered order.
 */
export function terminalDescription(environment: TerminalEnvironment,
  variables: Record<string, string | undefined> = process.env): string {
  const parts = [terminalName(environment, variables), platformName(environment.platform)];
  if (environment.wheelFlood) parts.push('high-rate wheel events');
  else if (environment.xtermJs) parts.push('xterm.js');
  else if (environment.wtSession) parts.push('Windows Terminal');
  return parts.join(' · ');
}

/**
 * Source `Xfo`'s gate: the shortcut is offered unless the terminal already handles wheel
 * scrolling itself. A JetBrains terminal is the case the probe names.
 */
export function scrollSpeedAvailable(environment: TerminalEnvironment): boolean {
  return !environment.jediTerm;
}

/** Every value the snap can reach for this step, in the order the dialog offers them. */
export function scrollSpeedValues(step: number): number[] {
  const values: number[] = [];
  if (step < 1) for (let value = SCROLL_SPEED_FINE_STEP; value < 1; value += SCROLL_SPEED_FINE_STEP) values.push(value);
  for (let value = Math.max(1, step); value <= SCROLL_SPEED_LIMIT; value += 1) values.push(value);
  return values;
}

/**
 * Source `_t` and `ce`'s `U`: the variable is present or it is not. The recovered keeps the raw
 * string and only tests it for `undefined`, so a present but unparseable value still counts as
 * explicit; what that value means is the probe's business, and the probe's `ie` falls back to the
 * terminal's own base for anything it cannot use.
 */
export function scrollSpeedExplicit(variables: Record<string, string | undefined> = process.env): boolean {
  return variables[SCROLL_SPEED_ENV] !== undefined;
}

/**
 * Source `ce`'s `d`: the value the dialog starts on. `d` is `k(u.base, pe)` — the probe's base,
 * which already folds in the environment variable, refuses a non-positive or unparseable one and
 * caps it at 20, then snapped and clamped. So an off-grid or out-of-range stored value is shown
 * as the value that would actually apply.
 */
export function currentScrollSpeed(environment: TerminalEnvironment,
  variables: Record<string, string | undefined> = process.env): { value: number; explicit: boolean } {
  return { value: snapScrollSpeed(environment.base, scrollSpeedStep(environment)),
    explicit: scrollSpeedExplicit(variables) };
}

/**
 * Source `Rs`: a path with the home directory abbreviated to `~`. The recovered report falls back
 * to the bare file name when the settings path is unknown; this host always resolves one.
 */
export function displayPath(file: string): string {
  const home = os.homedir();
  if (file === home) return '~';
  return file.startsWith(home + path.sep) ? `~${file.slice(home.length)}` : file;
}

/** Source `O`: the live write. `undefined` removes the variable, which is the auto arm. */
export function setLiveScrollSpeed(value: number | undefined, variables: Record<string, string | undefined> = process.env): void {
  if (value === undefined) delete variables[SCROLL_SPEED_ENV];
  else variables[SCROLL_SPEED_ENV] = String(value);
}

/** The settings file the recovered `An("userSettings", …)` reaches. */
function settingsFile(userDir: string): string {
  return path.join(path.resolve(userDir), 'settings.json');
}

function readSettings(file: string): { settings: Record<string, unknown>; mode: number } {
  let mode = 0o600;
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Scroll speed settings must be a regular file');
    mode = stat.mode & 0o777;
    const read = readBoundedBytes(file, CONFIG_LIMITS.settingsBytes);
    if (read.overflow) throw new Error('Scroll speed settings exceed the byte limit');
    const text = read.buffer.toString('utf8');
    const parsed: unknown = text.trim() ? JSON.parse(text) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Scroll speed settings must contain an object');
    return { settings: parsed as Record<string, unknown>, mode };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return { settings: {}, mode };
  }
}

/**
 * Source `O`'s persistence through `An("userSettings", {env: {...}})`: the value lives in the
 * settings file's `env` block, under the variable name. `undefined` removes the key. The block
 * itself stays even when it empties, because the recovered customizer deletes only the leaf key
 * whose incoming value is `undefined`.
 */
export function saveScrollSpeedSetting(value: number | undefined, userDir = defaultUserDir()): void {
  if (value !== undefined && (!Number.isFinite(value) || value <= 0)) {
    throw new Error('Scroll speed takes a positive number of lines per notch');
  }
  const file = settingsFile(userDir);
  const { settings, mode } = readSettings(file);
  const env = settings.env;
  if (env !== undefined && (typeof env !== 'object' || env === null || Array.isArray(env))) {
    throw new Error('Scroll speed settings env must contain an object');
  }
  const block: Record<string, unknown> = env === undefined ? {} : { ...(env as Record<string, unknown>) };
  if (value === undefined) delete block[SCROLL_SPEED_ENV];
  else block[SCROLL_SPEED_ENV] = String(value);
  settings.env = block;
  const content = JSON.stringify(settings, null, 2) + '\n';
  if (Buffer.byteLength(content) > CONFIG_LIMITS.settingsBytes) throw new Error('Scroll speed settings exceed the byte limit');
  atomicWriteFile(file, content, { mode, label: 'saveScrollSpeedSetting' });
}

/**
 * The user settings file's `env` block applied to this process, which is where the recovered
 * application's own settings layer put it. Only names the process does not already carry are
 * filled, so a real environment always wins; the returned names are the ones written.
 */
export function applyStoredEnvironment(userDir = defaultUserDir(),
  variables: Record<string, string | undefined> = process.env): string[] {
  let settings: Record<string, unknown>;
  try { settings = readSettings(settingsFile(userDir)).settings; }
  catch { return []; }
  const env = settings.env;
  if (env === undefined || typeof env !== 'object' || env === null || Array.isArray(env)) return [];
  const applied: string[] = [];
  for (const [name, raw] of Object.entries(env as Record<string, unknown>)) {
    if (variables[name] !== undefined) continue;
    if (typeof raw !== 'string') continue;
    variables[name] = raw;
    applied.push(name);
  }
  return applied;
}

/** Source `ce`'s `Y` and `B`: the two save reports and the cancel line, verbatim. */
export function scrollSpeedSaved(value: number, file: string): string {
  return `Scroll speed set to ${scrollSpeedNotch(value)} · saved to \`${displayPath(file)}\``;
}

export function scrollSpeedReset(environment: TerminalEnvironment, file: string): string {
  return `Scroll speed reset to auto (${scrollSpeedNotchCount(autoScrollSpeed(environment))} per notch)`
    + ` · removed from \`${displayPath(file)}\``;
}

/** Source `B`: the cancel line. */
export const SCROLL_SPEED_UNCHANGED = 'Scroll speed unchanged';

/** Source `ce`'s render: the ruler, the indented notch line and the terminal row. */
export function scrollSpeedDetail(current: { value: number; explicit: boolean },
  environment: TerminalEnvironment, variables: Record<string, string | undefined> = process.env): string {
  const suffix = current.explicit ? ` · auto is ${autoScrollSpeed(environment)}` : ' (auto)';
  return [scrollSpeedRuler(current.value), `${scrollSpeedDialogNotch(current.value)}${suffix}`,
    `Terminal  ${terminalDescription(environment, variables)}`].join('\n');
}

/** The settings file the command writes and reports by name. */
export function scrollSpeedSettingsFile(userDir = defaultUserDir()): string {
  return settingsFile(userDir);
}
