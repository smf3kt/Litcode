// Host boundary for the wheel settings read and the JediTerm input context (W157c).
//
// The settings read `hs` (chunk-js2bhabe.js) walks the enabled source order from the end, skips
// project settings when they resolve to the user settings file, reads each source through `fe`
// (the product settings store in ./plugin-chain-settings-store.ts), then falls back to the legacy
// ~/.claude.json values for the sixteen keys in `lSe`. Three of those steps are host facts:
//
//   Lo() — source `function Lo(){…}` in chunk-wtch2p0g.js: the enabled sources, derived from the
//          `--setting-sources` flag. This product has no such flag surface, so the app binds the
//          order it actually reads; unbound, the read refuses because it has no precedence to walk.
//   w_() — source `function w_(){let e=yn("projectSettings"),n=yn("userSettings");return!!e&&!!n&&
//          ye(e)===ye(n)}` in chunk-x0dc37w9.js: whether project and user settings name the same
//          file. Same binding reason; unbound refuses alongside `Lo`.
//   ce()/wR/parseLegacy — the legacy global-config store and its per-key schema registry (`TN`,
//          `yw`, `bw`) in chunk-bk5ct2gw.js. That store is a separate subsystem; the host supplies
//          its current values (or `{}` when unbound, the fresh-config answer) and the per-key
//          parse. `ten`, `lbe` and `DOt` keep the source bodies, quoted below.
//
// The internal stdin context `Gfe` (chunk-z7whhrje.js `var R=qt({stdin:process.stdin,
// internal_eventEmitter:new o$t,setRawMode(){},isRawModeSupported:!1,internal_querier:null,
// internal_jediTermInput:tgt()});R.displayName="InternalStdinContext";var Gfe=R;`) travels with this
// package because `QO=Ae(Gfe)` is the wheel state's context reader. Only `internal_jediTermInput`
// is read here; the stdin, emitter and querier fields belong to the input subsystem, so the token
// carries the one field and keeps the source's display name.
import { qt } from './plugin-chain-react-hooks.js';
import { newJediTermWheelState } from './plugin-chain-wheel-acceleration.js';
import { t } from './plugin-chain-host.js';

/** Source `Gfe`: the internal stdin context, narrowed to the wheel field its reader takes. */
export const Gfe = qt({ internal_jediTermInput: newJediTermWheelState() });
(Gfe as unknown as { displayName: string }).displayName = 'InternalStdinContext';

export interface WheelSettingsHost {
  /** Source `Lo()`: the enabled settings sources, lowest precedence first. */
  sourceOrder(): string[];
  /** Source `w_()`: whether project settings resolve to the user settings file. */
  projectSharesUserSettings(): boolean;
  /** Source `ce()`: the legacy global config. Unbound answers `{}`. */
  legacyConfig(): Record<string, unknown>;
  /** Source `wR`: the default global config the legacy values are compared against. */
  legacyDefaults(): Record<string, unknown>;
  /** Source `yw(key, value)`: the per-key legacy schema parse — the parsed value, or undefined. */
  parseLegacySetting(key: string, value: unknown): unknown;
}

let bound: WheelSettingsHost | undefined;

/** Bind the settings facts the copied read asks. Binding undefined restores the refusals. */
export function bindWheelSettingsHost(host: WheelSettingsHost | undefined): void {
  bound = host;
  warned.clear();
}

const unbound = 'the wheel settings host is not bound; bindWheelSettingsHost() installs one';

/** Source `Lo()`: the enabled sources. Unbound, the read refuses (it has no order to walk). */
export function Lo(): string[] {
  if (bound === undefined) throw new Error(unbound);
  return bound.sourceOrder();
}

/** Source `w_()`: project settings equal the user settings file. Unbound, the read refuses. */
export function w_(): boolean {
  if (bound === undefined) throw new Error(unbound);
  return bound.projectSharesUserSettings();
}

/** Source `ce()`: the legacy global config; unbound is the source's empty config. */
export function ce(): Record<string, unknown> {
  return bound === undefined ? {} : bound.legacyConfig();
}

/** Source `wR`: the default global config. A read-through proxy keeps the host's values live the
 *  way the source's one module-level object is. Unbound answers undefined for every key. */
export const wR: Record<string, unknown> = new Proxy({} as Record<string, unknown>, {
  get: (_target, key) => (bound === undefined ? undefined : bound.legacyDefaults()[String(key)]),
});

// Source `var jB=["remoteControlAtStartup","autoUploadSessions"]` (chunk-bk5ct2gw.js).
const jB = ['remoteControlAtStartup', 'autoUploadSessions'];

/** Source `ten(e)`: whether a legacy value of false counts as "off" rather than "unset". */
export function ten(e: string): boolean {
  return jB.includes(e);
}

// Source `var zB=new q(()=>new Set)`; one host here, so one process set.
const warned = new Set<string>();

// Source `bw(e,n)`: warn once per invalid legacy key and clear the note when it becomes valid.
function bw(e: string, valid: boolean): void {
  if (valid) {
    warned.delete(e);
    return;
  }
  if (warned.has(e)) return;
  warned.add(e);
  const s = ten(e) ? 'it counts as off' : 'it counts as unset';
  t(`Ignoring "${e}" in ~/.claude.json: its value is not valid for this setting, so ${s}. Set it with /config or in settings.json.`);
}

// Source `yw(e,n)`: the parsed legacy value, or undefined. Unbound means no legacy store, so the
// read answers "nothing configured" without a warning — the source's fresh-config answer.
function yw(e: string, n: unknown): unknown {
  if (bound === undefined) return undefined;
  return bound.parseLegacySetting(e, n) ?? undefined;
}

/** Source `lbe(e,n)`: the parsed value, warning when it did not parse. */
export function lbe(e: string, n: unknown): unknown {
  if (n === undefined) return;
  const r = yw(e, n);
  bw(e, r !== undefined);
  return r;
}

/** Source `DOt(e,n)`: the parsed value for a boolean legacy key, false when it did not parse. */
export function DOt(e: string, n: unknown): unknown {
  if (n === undefined) return;
  const r = yw(e, n);
  bw(e, r !== undefined);
  return r ?? false;
}
