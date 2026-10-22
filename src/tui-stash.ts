// The composer's draft stash: the swap itself, its one tip, and the notice that brings a stashed
// draft back. Ported from the recovered interactive application; offsets are zero-based UTF-16
// code units in the extracted module.
//
// - `chunk-24k7d6mw.js` (SHA-256
//   1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31): `stash` 484409 and
//   `popStash` 484692 the draft store's two moves, `qq` 843876 the chord handler, `bJt` 817896
//   the `hasUsedStash` marker, `Ce(bJt,Jr)` 844018 its write, `Yc` 828570 the tip's line gate,
//   `Cl` 828513 the tip's clear, `Pr({key:"stash-hint"…})` 828775 the tip row, `XS` 721485 the
//   tip's 5000 ms, the submit restore 1492930 and the post-command restore 1495345 with their
//   `Draft restored` notification at 1493000 and 1495489, and `#s` 1495345 its body.
// - `chunk-sxm1dh4y.js` (SHA-256
//   4b99782cd2c85d7c09cfd155118e1b9d052d81501a83aa7d672cf8ed1111613e): `t$r` 1640 the stash
//   slot writer, `l9n` 2407 the launch-warning writer the swap carries.
// - `chunk-nh8hd3rr.js` (SHA-256
//   5194b7a0a1b3c5beeae642f9b337330dabb12d436085c4aa52a1cf5ff81d1794): `pt` 800 the key hint.
// - `chunk-0qkpwgr4.js` (SHA-256
//   470fcab1f965a43d7ec6a08213a15a49218e65d7e2cc8b4bef21d8c4622335a6): `z` 3890, which joins a
//   chord and its action with `" to "` (4270).
// - `chunk-z3f0m1q8.js` (SHA-256
//   f035b4067fe457f5a4584fe03292045e6d53134136827d2236d1e1540cc87d1f): `ma` 771, the binding
//   lookup the hint's chord goes through.
// - `chunk-bk5ct2gw.js` (SHA-256
//   efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1): `Ze` 558688, whose
//   global record carries `hasUsedStash:!1`.

import fs from 'node:fs';
import path from 'node:path';
import { atomicWriteFile } from './atomic-write.js';
import { CONFIG_LIMITS, defaultUserDir, readBoundedBytes } from './config.js';

/** Source `XS` (721485): the tip's own timeout. */
export const STASH_HINT_TIMEOUT_MS = 5_000;
/** The submit and post-command restore notifications' `timeoutMs` (1493000, 1495489). */
export const STASH_RESTORED_TIMEOUT_MS = 5_000;
/** Source 1493000/1495489: `text:"Draft restored"`, `kind:"feedback"`, `priority:"high"`. */
export const STASH_RESTORED = 'Draft restored';
/** Source 828775: `["Tip:", " ", <chord chat:stash>]`; `z` joins chord and action with `" to "`. */
export function stashHintText(chord: string): string {
  return `Tip: ${chord} to stash`;
}
/** Source `Kd`/`jN` (828570): the shrink the tip fires on, in draft characters. */
export const STASH_HINT_SHRINK_FROM = 20;
export const STASH_HINT_SHRINK_TO = 5;

/**
 * Source `Yc` (828570): the draft-length effect. `ex` is the last length seen and `ow` the length
 * the gate last evaluated, both seeded with the mount length. A growth only moves the baseline;
 * an empty draft resets it; a shrink from `ow >= 20` to `nh <= 5` raises the tip once, unless the
 * last seen length also qualified (the repeated-render guard `jN`).
 */
export class StashHintGate {
  private last: number | undefined;
  private baseline: number | undefined;

  /** Feed one observed draft length; true when this change raises the tip. */
  observe(length: number): boolean {
    if (this.last === undefined || this.baseline === undefined) {
      this.last = length;
      this.baseline = length;
      return false;
    }
    const previousLast = this.last;
    const previousBaseline = this.baseline;
    this.last = length;
    if (length > previousBaseline) { this.baseline = length; return false; }
    if (length === 0) { this.baseline = 0; return false; }
    const shrunk = previousBaseline >= STASH_HINT_SHRINK_FROM && length <= STASH_HINT_SHRINK_TO;
    const alreadySeen = previousLast >= STASH_HINT_SHRINK_FROM && length <= STASH_HINT_SHRINK_TO;
    if (!shrunk || alreadySeen) return false;
    this.baseline = length;
    return true;
  }
}

function stateFile(userDir: string): string {
  return path.join(path.resolve(userDir), 'settings.json');
}

/**
 * Source `bJt` (817896) through `Ce` (844018): the global record's `hasUsedStash` latch. This host
 * has no global config record, so the latch rides the user settings document the other display
 * flags already use; the value only ever moves from absent to true.
 */
export function markStashUsed(userDir = defaultUserDir()): void {
  const file = stateFile(userDir);
  let mode = 0o600;
  let settings: Record<string, unknown> = {};
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Stash settings must be a regular file');
    mode = stat.mode & 0o777;
    const read = readBoundedBytes(file, CONFIG_LIMITS.settingsBytes);
    if (read.overflow) throw new Error('Stash settings exceed the byte limit');
    const text = read.buffer.toString('utf8');
    const parsed: unknown = text.trim() ? JSON.parse(text) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Stash settings must contain an object');
    settings = parsed as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (settings.hasUsedStash === true) return;
  settings.hasUsedStash = true;
  const content = JSON.stringify(settings, null, 2) + '\n';
  if (Buffer.byteLength(content) > CONFIG_LIMITS.settingsBytes) throw new Error('Stash settings exceed the byte limit');
  atomicWriteFile(file, content, { mode, label: 'markStashUsed' });
}

/** The latch `ce().hasUsedStash` reads. A missing or unreadable document is a record that has not seen a stash. */
export function hasUsedStash(userDir = defaultUserDir()): boolean {
  try {
    const file = stateFile(userDir);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) return false;
    const read = readBoundedBytes(file, CONFIG_LIMITS.settingsBytes);
    if (read.overflow) return false;
    const parsed: unknown = JSON.parse(read.buffer.toString('utf8') || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return false;
    return (parsed as Record<string, unknown>).hasUsedStash === true;
  } catch { return false; }
}
