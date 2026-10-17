// The settings config manager state (W157e). `gf` is the per-process record the settings manager
// keeps: the parsed-config cache and its mtime, the enable gate a first read opens, the per-file
// write queues, the freshness-watcher flags, the parse-error dedup set, the boot-phase anchor, and
// the generated user/machine ids. Its methods only move that state; the file reads, schema parse and
// watcher wiring that call them live in the settings subsystem, and the host supplies the clock and
// the two test config surfaces.
//
// The copied bodies live in ./plugin-chain-settings-schema-source.ts: `gf`
// (chunk-bk5ct2gw.js [549808,555356) 5,548 units) and `n`/`Hh`, the per-key write queue over a
// promise chain (chunk-qpxbyxy2.js [849,1269) 420 units). `Oe`, the change signal `installed` is
// built from, is the W45-56 copy in ./plugin-chain-registry-stores-source.ts.
//
// Source: chunk-bk5ct2gw.js constructs one lazily per host,
// `E$s = new q(() => new gf({now: Date.now, testGlobalConfig: {...wR, autoUpdates: !1},
// testProjectConfig: {...bue}}))`; this product has one host, so the seam keeps one lazy instance.
// `wR`/`bue` are the legacy settings default tables and are not carried here, so the seam's default
// state starts with empty test configs; a caller that owns the real tables passes them to the
// factory.
import { Hh, gf } from './plugin-chain-settings-schema-source.js';

/** The state `gf` is: the class instance with its cache, gates, queues and id slots. */
export type SettingsConfigState = InstanceType<typeof gf>;

/** The write queue `Hh` builds: one promise chain per key, with a bounded drain. */
export type SettingsConfigWriteQueue = ReturnType<typeof Hh>;

/** What `gf`'s constructor reads. */
export interface SettingsConfigStateOptions {
  now(): number;
  testGlobalConfig: Record<string, unknown>;
  testProjectConfig: Record<string, unknown>;
}

/** Source `gf`: build one config manager state record. */
export function createSettingsConfigState(
  options: SettingsConfigStateOptions,
): SettingsConfigState {
  return new gf(options);
}

/** Source `Hh`: one per-key write queue. `drain` waits up to the source's five rounds, so work
 *  queued by work already running is picked up on the next round. */
export function createSettingsWriteQueue(): SettingsConfigWriteQueue {
  return Hh() as SettingsConfigWriteQueue;
}

let state: SettingsConfigState | undefined;

/** Source `E$s`/`re()`: the process's one lazily built state. */
export function settingsConfigState(): SettingsConfigState {
  state ??= createSettingsConfigState({
    now: () => Date.now(),
    testGlobalConfig: {},
    testProjectConfig: {},
  });
  return state;
}

/** Bind the state the seam answers with, or nothing to restore the lazy default. */
export function bindSettingsConfigState(next: SettingsConfigState | undefined): void {
  state = next;
}

/** The copied bodies under their source names, for a record or a test that compares the ported
 *  state with the source's own. */
export const SOURCE_BODIES = { gf, Hh };
