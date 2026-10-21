import { externalMode } from './tui-footer-source.js';

/**
 * `BBt`, chunk-nw76x9y3.js [1071,1371), zero-based UTF-16 half-open: the next live permission
 * mode for `chat:cycleMode` (shift+tab). The source spells the bypass mode `bypassPermissions`;
 * `externalMode` in `src/tui-footer-source.ts` carries the same spelling for the chip.
 */
export type CycleMode = 'acceptEdits' | 'auto' | 'bypassPermissions' | 'default' | 'dontAsk' | 'plan';

/**
 * `UBt` [1005,1071): bypass is offered only when the session made it available. The source also
 * checks `Iv`, its settings `disableBypassPermissionsMode` gate; this host has no such settings
 * key, and `isBypassPermissionsModeAvailable` is already false unless the session was launched in
 * bypass (`buildSessionPermissionUpdates`, src/permissions.ts), which is the source's other half.
 */
export function bypassModeAvailable(state: { isBypassPermissionsModeAvailable: boolean }): boolean {
  return state.isBypassPermissionsModeAvailable;
}

/**
 * `Dj` [805,1005) under a local adapter. The source ANDs `isAutoModeAvailable` with `O_`
 * (chunk-sfn1dbxq.js 3605667), whose circuit-breaker, settings and model-capability checks have
 * no counterpart here; `/permissions` offers auto unconditionally, so the cycle treats it as
 * available.
 */
export function autoModeAvailable(): boolean {
  return true;
}

/** One `chat:cycleMode` step; an unknown or unchanged mode falls through to `default`. */
export function nextPermissionMode(mode: string | undefined, options: { bypassAvailable?: boolean; autoAvailable?: boolean } = {}): CycleMode {
  switch (mode) {
    case 'default': return 'acceptEdits';
    case 'acceptEdits': return 'plan';
    case 'plan':
      if (options.bypassAvailable === true) return 'bypassPermissions';
      if (options.autoAvailable !== false) return 'auto';
      return 'default';
    case 'bypassPermissions':
      if (options.autoAvailable !== false) return 'auto';
      return 'default';
    case 'dontAsk': return 'default';
    default: return 'default';
  }
}

/** The product policy's spelling for a cycle result; only the bypass name differs (`V3`/`vc`). */
export function internalCycleMode(mode: CycleMode): string {
  return mode === 'bypassPermissions' ? 'bypass' : mode;
}

/** The `chat:cycleMode` command string, or undefined when the live mode has no next step. */
export function permissionCycleCommand(state: { mode?: string; isBypassPermissionsModeAvailable: boolean }): string | undefined {
  const current = externalMode(state.mode) ?? 'default';
  const next = nextPermissionMode(current, {
    bypassAvailable: bypassModeAvailable(state), autoAvailable: autoModeAvailable() });
  if (next === current) return undefined;
  return `/permissions ${internalCycleMode(next)}`;
}
