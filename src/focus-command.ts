// `/focus` — `Toggle focus view: just your prompt, summary, and response`.
//
// Two recovered registrations share the name:
//
// - `bEo`, chunk-sfn1dbxq.js 1659965 (SHA-256 4c74137e…): `{type:"local-jsx", name:"focus",
//   immediate:!0, requires:{ink:!0}, terminalOriented:!0}`. Its fullscreen arm toggles the live
//   flag and reports `Focus view enabled` / `Focus view disabled`; its other arm is the
//   non-fullscreen message this host can never reach.
// - `PWe`, same module, the `local` twin with `argumentHint:"[on|off]"` and
//   `supportsNonInteractive:!0`; body `r`, chunk-4jr9rxry.js [4693,5262): the argument grammar,
//   the `XMn` write, `apply_flag_settings {briefTranscript:e}`, the `VTt()` re-read and the
//   managed-override message.
//
// The effective value is `iTe` (chunk-2bcyxj9q.js 43499): flag settings' `viewMode` when set,
// else the live `briefTranscript`. `XMn` (43708) writes `viewMode: "focus"|"default"`; `VTt`
// (43580) is the gate the text twin re-reads; `VLe` (43662) is the label.
//
// The renderer reads the live flag. `vNt` (chunk-3gz7s57c.js 9299) computes
// `focusFoldHoldsPreview = loading && brief && screen !== "transcript" && fullscreen &&
// (tailBlank || streamingToolUses > 0 || iQo(messages))`, where `iQo`
// (chunk-sfn1dbxq.js 4209226) is true when the last assistant message carries a `tool_use`.
// The preview is the in-flight streaming block, so the fold holds it back while tools run.
import fs from 'node:fs';
import path from 'node:path';
import { atomicWriteFile } from './atomic-write.js';
import { CONFIG_LIMITS, defaultUserDir, readBoundedBytes } from './config.js';
import type { SessionConfig } from './session.js';

export const FOCUS_DESCRIPTION = 'Toggle focus view: just your prompt, summary, and response';

export const FOCUS_MODES = ['default', 'verbose', 'focus'] as const;
export type FocusMode = (typeof FOCUS_MODES)[number];

/** Source `XMn`'s argument: the two values the command can write. */
export function focusModeFor(enabled: boolean): FocusMode {
  return enabled ? 'focus' : 'default';
}

/** Source `iTe`: the effective value. This host has one config, so both reads land on it. */
export function briefTranscriptEnabled(config: Pick<SessionConfig, 'viewMode'>): boolean {
  return config.viewMode === 'focus';
}

export type FocusArgument =
  | { readonly kind: 'set'; readonly enabled: boolean }
  | { readonly kind: 'unknown'; readonly argument: string };

/** Source `r`'s grammar: `on`, `off`, an empty argument (toggle), or the invalid line. */
export function parseFocusArgument(text: string, current: boolean): FocusArgument {
  const argument = text.trim().toLowerCase();
  if (argument === 'on') return { kind: 'set', enabled: true };
  if (argument === 'off') return { kind: 'set', enabled: false };
  if (argument === '') return { kind: 'set', enabled: !current };
  return { kind: 'unknown', argument };
}

export function focusUnknownArgument(argument: string): string {
  return `Unknown argument "${argument}". Use: /focus [on|off]`;
}

export const FOCUS_ENABLED = 'Focus view enabled';
export const FOCUS_DISABLED = 'Focus view disabled';

export function focusReport(enabled: boolean): string {
  return enabled ? FOCUS_ENABLED : FOCUS_DISABLED;
}

function settingsFile(userDir: string): string {
  return path.join(path.resolve(userDir), 'settings.json');
}

/** Source `XMn` through `fU`: the flag settings' `viewMode`, which is this host's settings file. */
export function saveViewModeSetting(mode: FocusMode, userDir = defaultUserDir()): void {
  const file = settingsFile(userDir);
  let fileMode = 0o600;
  let settings: Record<string, unknown> = {};
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Focus settings must be a regular file');
    fileMode = stat.mode & 0o777;
    const read = readBoundedBytes(file, CONFIG_LIMITS.settingsBytes);
    if (read.overflow) throw new Error('Focus settings exceed the byte limit');
    const text = read.buffer.toString('utf8');
    const parsed: unknown = text.trim() ? JSON.parse(text) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Focus settings must contain an object');
    settings = parsed as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  settings.viewMode = mode;
  const content = JSON.stringify(settings, null, 2) + '\n';
  if (Buffer.byteLength(content) > CONFIG_LIMITS.settingsBytes) throw new Error('Focus settings exceed the byte limit');
  atomicWriteFile(file, content, { mode: fileMode, label: 'saveViewModeSetting' });
}
