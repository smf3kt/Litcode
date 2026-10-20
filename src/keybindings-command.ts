import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_KEYBINDINGS } from './terminal.js';

/**
 * `/keybindings` reads and writes the user's shortcuts file, ported from the recovered
 * interactive application. Coordinates are zero-based UTF-16 offsets in the extracted module.
 *
 * - `chunk-askg8yg9.js` (SHA-256
 *   f66d35c67fefda8abd2156a3764b7f5e07e3e16905afbf4a87fdb74ee606ed81): `m` 4976 the
 *   default-stripping pass, `a` 5210 the template builder, `O` 5430 the command body, and the
 *   two report strings at 6218.
 * - `chunk-6ccen3s8.js` (SHA-256
 *   4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d): `w1` 1960 the named
 *   default table, `QOn` 16491 the excluded contexts, `QDe` 17524 the keys that cannot be
 *   rebound, `pqe` 18864 the key-name normalizer, `y9` 26121 the customization gate, `k9t`
 *   26748 the file path, `$oo` 26798 the storage key.
 * - `chunk-7tnkhv2k.js` (SHA-256
 *   9ffb6fdc8861a418299ffa0765be70a40cdb348468f8bcae67d846ea155ee4d9): `Zie` 3081 opens a
 *   file in the editor; `src/external-editor.ts` owns it.
 */

/**
 * `QDe`: the keys a terminal cannot deliver as anything else, so a rebound value would never
 * fire. The recovered list names seven keys; these are the literal sequences they resolve to,
 * which is what this host's reader matches. `ctrl+m` covers both CR and LF and `ctrl+h` both
 * DEL and BS, so the two pairs each expand to two sequences; `capslock` has no sequence at all
 * and so cannot appear in a sequence-keyed file.
 */
export const NON_REBINDABLE_KEYBINDINGS: Readonly<Record<string, string>> = {
  '\r': 'Cannot be rebound - identical to Enter in terminals (both send CR)',
  '\n': 'Cannot be rebound - identical to Enter in terminals (both send CR)',
  '\u0003': 'Cannot be rebound - used for interrupt/exit (hardcoded)',
  '\u0004': 'Cannot be rebound - used for exit (hardcoded)',
  '\u007f': 'Cannot be rebound - identical to Backspace in terminals',
  '\b': 'Cannot be rebound - identical to Backspace in terminals',
  '\u001b': 'Cannot be rebound - identical to Escape in terminals',
  '\u0009': 'Cannot be rebound - identical to Tab in terminals',
};

/** `k9t`: `join(be(), "keybindings.json")`, the file this host's reader loads first. */
export function keybindingsFilePath(userDir: string): string {
  return path.join(path.resolve(userDir), 'keybindings.json');
}

/**
 * `a()`: the file written when none exists. The recovered body groups every context's
 * rebindable defaults under a `bindings` array with a `$schema` and a `$docs` URL; this
 * host's reader takes one flat map of literal sequence to editor command and reads every
 * top-level key as a sequence, so the template is that map and the two vendor URLs are dropped.
 */
export function keybindingsTemplate(): string {
  const bindings: Record<string, string> = {};
  for (const [sequence, command] of Object.entries(DEFAULT_KEYBINDINGS)) {
    if (command === null || sequence in NON_REBINDABLE_KEYBINDINGS) continue;
    bindings[sequence] = command;
  }
  return JSON.stringify(bindings, null, 2) + '\n';
}

/** `call`'s write step: `wx`, where an existing file is the `AlreadyExists` arm. */
export function writeKeybindingsTemplate(file: string): boolean {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try { fs.writeFileSync(file, keybindingsTemplate(), { encoding: 'utf-8', flag: 'wx', mode: 0o600 }); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false; throw error; }
  return true;
}

/** `call`'s two reports, with the editor failure appended when there is one. */
export function keybindingsReport(file: string, created: boolean, error?: string): string {
  if (error !== undefined) return `${created ? 'Created' : 'Opened'} ${file}. ${error}`;
  return created ? `Created ${file} with template. Opened in your editor.`
    : `Opened ${file} in your editor.`;
}
