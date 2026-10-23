/**
 * The mid-conversation switch confirmation and the two cache-miss gates that raise it. Every
 * string is recovered; the offsets are zero-based UTF-16 code units into the named module.
 *
 * | Module | SHA-256 | Range | Contents |
 * | --- | --- | --- | --- |
 * | `chunk-24k7d6mw.js` | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` | `BJt` 858708, `cie` 858783 | the dialog, its two titles, body, warning and button labels |
 * | ↳ | | 858961 / 858977 / 859375 / 859561 / 859795 / 859954 | the two titles, the warning, the body and the two button labels |
 * | `chunk-hh0bresc.js` | `676add2366d870ee2f7ed3405c6ca095d9079f0cf20aebf11fabb56a52ddb455` | `KJn` 13170 | the model gate |
 * | `chunk-9vcaezw1.js` | `eccb69a1f121aa90407d23fbd69b3167178da1b759c1a4cd8b29609d15cb98e0` | `FNe` 13584 | the effort gate |
 * | `chunk-sfn1dbxq.js` | `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da` | `ple` 1681312, `air` 1681409, `Vqt` 1681010, `x7` 1680764 | the cache-warm test and the recent response |
 * | `chunk-tcpnppq7.js` | `97b2c9f0a7b1e068647ff67d1dc9b080e2295cfe694cfe832f82b4d7131572db` | `B1` 7812, `cR` 7822 | the 5-minute and 1-hour cache lifetimes |
 * | `chunk-4bw62nzm.js` | `1a8788672a623975dc4a807604528e46b128f16b5ec159495c0ec2370f805713` | `Fg` 83409 | `costLedger.totalOutputTokens()` |
 * | `chunk-51w556q5.js` | `936e82f9b226fcfd2f5e397cb01a04cb683196239269d4fecee39066649d521a` | `Dn` 1471 | `[1m]`/`[2m]` stripped for family comparison |
 * | `chunk-76jkr621.js` | `09c383199652e7be3cc3b79215c6616e6653f6fa65c265ebe5e99e7dc43ae04e` | 18701 | the effort cancel notice |
 *
 * Recovered source:
 *
 * ```js
 * function KJn(e,o,r,s,n){if(n===void 0)return!1;let d=Fg();if(d===0||d===s)return!1;
 *   let i=Dn(iae(e));if(i===Dn(iae(R7({mainLoopModel:o,mainLoopModelForSession:r}))))return!1;
 *   let c=n.response?.message.model;
 *   return!(typeof c==="string"&&(c===i||sin(i)?.has(c)===!0))}
 * function FNe(e,n,r,s,f){if(!f)return!1;let d=Fg();if(d===0||d===s)return!1;if(!Vb(r))return!1;
 *   if(typeof kE(r,e)!=="number"&&typeof kE(r,n)!=="number"&&BUn(r,We(r)))return!1;
 *   if(kE(r,e,{carriedEffort:null})===kE(r,n))return!1;
 *   if(ll()&&e!==void 0&&Z_e(typeof e==="string"?Y9(e,r):e)===void 0)return!1;return!0}
 * ```
 *
 * Four recovered branches are out. `sin` (the host's requested-to-served model latch) has no
 * local counterpart, so the family test is exact. `Vb`/`kE`/`BUn` read a per-model effort
 * capability table this host has no source for (W212), so every model supports every level and
 * `kE` reduces to the effective level itself. `ll()` is the remote transport, absent here.
 * `Z_e` (the persistable set) only affects a remote session's default write.
 */

/** Source `cie` 858961: `Switch model?`. */
export const SWITCH_MODEL_TITLE = 'Switch model?';
/** Source `cie` 858977: `Change effort level?`. */
export const SWITCH_EFFORT_TITLE = 'Change effort level?';
/** Source `cie` 859375: the subtitle every switch confirmation carries. */
export const SWITCH_CACHE_WARNING = 'Your next response will be slower and use more tokens';
/** Source `cie` 859954: `No, go back`. */
export const SWITCH_CANCEL_LABEL = 'No, go back';
/**
 * Source `B1` 7812 / `cR` 7822 in `chunk-tcpnppq7.js`: the 5-minute and 1-hour cache lifetimes.
 * `ple` 1681312 picks `cR` on the main thread and `B1` elsewhere; this host has one conversation,
 * so the main-thread value applies.
 */
export const CACHE_TTL_MS = 3_600_000;

/** Source `Dn` in `chunk-51w556q5.js` 1471: the long-context suffix does not change the family. */
export function modelFamilyKey(model: string): string {
  return model.replace(/\[(1|2)m\]/gi, '').trim().toLowerCase();
}

export type CacheMissState = {
  /** `Fg()`: the session's total output tokens. */
  totalOutputTokens: number;
  /** The total the user last confirmed a switch at, absent before the first confirmation. */
  ackedAtOutputTokens?: number;
  /** `x7(e).message.model`: the model that produced the most recent response. */
  lastResponseModel?: string;
  /** `ple(...)`: prompt caching is on and the cache is no longer warm. */
  cacheCold: boolean;
};

/**
 * Source `KJn` at `chunk-hh0bresc.js` 13170. The dialog appears only when the cache is cold, the
 * conversation has produced tokens since the last acknowledgement, and the new model is a
 * different family from the one that answered last.
 */
export function cacheMissGate(state: CacheMissState & { nextModel: string; currentModel: string }): boolean {
  if (!state.cacheCold) return false;
  const total = state.totalOutputTokens;
  if (total === 0 || total === state.ackedAtOutputTokens) return false;
  const next = modelFamilyKey(state.nextModel);
  if (next === modelFamilyKey(state.currentModel)) return false;
  const served = state.lastResponseModel;
  return !(served !== undefined && modelFamilyKey(served) === next);
}

/**
 * Source `FNe` at `chunk-9vcaezw1.js` 13584. The effort dialog appears when the cache is cold,
 * the conversation has produced tokens since the last acknowledgement, and the effective level
 * would actually change.
 */
export function effortChangeGate(state: CacheMissState & { nextEffort?: string; currentEffort?: string }): boolean {
  if (!state.cacheCold) return false;
  const total = state.totalOutputTokens;
  if (total === 0 || total === state.ackedAtOutputTokens) return false;
  return (state.nextEffort ?? 'auto') !== (state.currentEffort ?? 'auto');
}

export type SwitchConfirmRequest = {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
};

/** Source `cie` 858961 for `kind:"model"`. */
export function modelSwitchConfirm(model: string): SwitchConfirmRequest {
  return {
    title: SWITCH_MODEL_TITLE,
    body: `This conversation is cached for the current model. Switching to ${model} means the full history gets re-read on your next message.`,
    confirmLabel: `Yes, switch to ${model}`,
    cancelLabel: SWITCH_CANCEL_LABEL,
  };
}

/** Source `cie` 858961 for `kind:"effort"`. */
export function effortSwitchConfirm(level: string): SwitchConfirmRequest {
  return {
    title: SWITCH_EFFORT_TITLE,
    body: `This conversation is cached for the current effort level. Switching to ${level} means the full history gets re-read on your next message.`,
    confirmLabel: `Yes, switch to ${level}`,
    cancelLabel: SWITCH_CANCEL_LABEL,
  };
}
/** Source `chunk-76jkr621.js` 18501: the cancel path's notice. */
export function effortKeptMessage(level: string | undefined): string {
  return `Kept effort level as ${level ?? 'auto'}`;
}

/** Source `Bze` 4359965 in `chunk-sfn1dbxq.js`: the model cancel path's notice. */
export function modelKeptMessage(model: string): string {
  return `Kept model as ${model}`;
}

/** Source `FQ` 712145 over `Sqe` 712217 in `chunk-24k7d6mw.js`: the pinned max-effort row. */
export function maxEffortTip(note: string): string {
  return `Max effort · ${note} · /effort to change`;
}

/** Source `fde` 4151 in `chunk-9vcaezw1.js`: the reminder gate. */
export function maxEffortReminderEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.LITCODE_MAX_EFFORT_REMINDER;
  if (raw === undefined) return false;
  if (raw === '0' || raw === 'false') return false;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase().trim());
}

/** Source `fle` 4359891 and `gne` 4359921 in `chunk-sfn1dbxq.js`: the switch notice. */
export const MODEL_SET_PREFIX = 'Set model to ';
export const MODEL_SAVED_SUFFIX = ' and saved as your default for new sessions';

/**
 * The notice builder at `chunk-f5wjy38g.js` 23096: `Set model to X`, then either the saved
 * suffix or ` for this session only`, then the effort clause. `x_t`'s failure text replaces the
 * saved suffix when the default write failed.
 */
export function modelNotice(model: string, options: {
  saved: boolean; effort?: string; effortPersistable?: boolean; saveFailure?: string;
}): string {
  let text = `${MODEL_SET_PREFIX}${model}${options.saved ? MODEL_SAVED_SUFFIX : ' for this session only'}`;
  if (options.effort !== undefined) {
    text += options.saved && options.effortPersistable === false
      ? ` · ${options.effort} effort for this session only`
      : ` with ${options.effort} effort`;
  }
  return options.saveFailure === undefined ? text : `${text}${options.saveFailure}`;
}

type JournalEvent = { kind: string; response?: { model?: string; usage?: { output_tokens?: number } };
  duration?: { timestamp?: string } };

/** Source `Fg()`: the session's total output tokens. */
export function totalOutputTokens(events: readonly JournalEvent[]): number {
  let total = 0;
  for (const event of events) total += event.response?.usage?.output_tokens ?? 0;
  return total;
}

/** Source `x7(e)`: the model of the most recent response. */
export function lastResponseModel(events: readonly JournalEvent[]): string | undefined {
  for (let index = events.length - 1; index >= 0; index--) {
    const model = events[index]!.response?.model;
    if (model !== undefined && model !== '') return model;
  }
  return undefined;
}

/**
 * Source `ple` 1681312 over `Vqt` 1681106: prompt caching is on and the newest response is older
 * than the cache lifetime. The recovered reads the last assistant message's own timestamp; this
 * host stamps no per-message time, so the turn's `turn_end` time stands in for it.
 */
export function cacheIsCold(events: readonly JournalEvent[], cachingEnabled: boolean, now: number,
  ttlMs = CACHE_TTL_MS): boolean {
  if (!cachingEnabled) return false;
  for (let index = events.length - 1; index >= 0; index--) {
    const stamp = events[index]!.kind === 'turn_end' ? events[index]!.duration?.timestamp : undefined;
    if (stamp === undefined) continue;
    const at = Date.parse(stamp);
    if (!Number.isFinite(at)) continue;
    return now - at >= ttlMs;
  }
  return false;
}
