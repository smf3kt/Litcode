// The `$` call table's ui floors (W45-24, W45-26). The copied bodies live in
// ./plugin-chain-ui-source.ts and ./plugin-chain-toast-source.ts; this module is the host seam
// around them.
//
// Source: the entries of the plugin-method table `Iqo(state)` (chunk-sfn1dbxq.js, its literal
// opened by `var Iqo=(e)=>szt({…})` at [2346570,…)), taken verbatim — the ui.toast entry, its own
// span chunk-sfn1dbxq.js [2351998,2352180) 182 units:
//
//   "ui.toast":{check:(n)=>{let r=n?.timeoutMs!==void 0&&!yro(n.timeoutMs,F2e);return LVe(n?.text)??(r?`timeoutMs is a whole number of ms, 1 to ${F2e}`:void 0)},run:lJt("ui.toast",Kxo)},
//
// and the W45-24 entries — chunk-sfn1dbxq.js [2352180,2352478) 298 units:
//
//   "ui.status":{check:(n)=>n?.text===void 0?void 0:LVe(n.text),run:lJt("ui.status",(n,r)=>LWt(n.text,r))},
//   "ui.log":{check:(n)=>LVe(n?.text)??Izo(n?.to),run:(n,r)=>{let s=n.to==="debug";return s?Pzo(r.plugin,n.text):mce(r.plugin,n.text),$2e(r.plugin,"ui.log",s?void 0:n.text),Promise.resolve(void 0)}},
//
// W45-47 adds the selection read, chunk-sfn1dbxq.js [2353525,2353549) 24 units, whose body is the
// copied `u2t` (chunk-sfn1dbxq.js [1869714,1869767) 53 units):
//
//   "ui.selection":{run:u2t}
//
// This entry is the one shape in this slice with no `check` and no floor of its own: its `run` is
// `u2t` itself, so the dispatch's whole floor is `()=>Promise.resolve(bI()?.selection?.read())` —
// the selection the bound loader context holds, read through that context's own accessor, and
// `undefined` (not a throw) when no context is bound or the bound one holds no selection.
//
// The table's entries carry a third field, `stamp`, and this package models it: the entry in the same
// literal is `"ui.notify":{check:Dzo,stamp:Fzo,run:Nzo}` (chunk-sfn1dbxq.js [2353653,2353694) 41 units),
// where `Fzo` fills an absent title with the plugin name before the run. Its consumer is `G2e`
// ([2356082,…)), the plugin-facing `$` dispatcher, which applies `h.raise?.(caller)` and then
// `h.stamp?.(raised, caller)` before `run` — so a check sees the raw argument and a run the stamped one.
// `Hze`, the hooks-then-floor path this seam raises through, never reads the field, so `raiseUiCall`
// leaves it to the dispatcher a later package ports. The neighbouring
// `"ui.copy":{check:wGo,stamp:uzo,run:dzo}` ([2353613,2353652) 39 units) still carries one this product
// has no body for.
//
// W45-58 adds the last ui entry in this literal, chunk-sfn1dbxq.js [2353695,2353752) 57 units:
//
//   "ui.blit":{check:fNs,run:(n,r)=>bFo(n)?kFo(n,r):mNs(n,r)}
//
// It is the one floor that paints a mounted surface, and it is two floors behind one entry: `bFo` sends
// an argument that carries a `source` to `kFo` (the Image's `swap`) and everything else to `mNs` (the
// Raster's `paint`). Both look the plugin's own mounted row up by `e5t`'s NUL-joined key
// (`QJt` = `String.fromCharCode(0)`), and both answer `xDe(refusal)` — `{deny: text}` — instead of
// throwing: no row for this key (naming the other plugin that holds one, when one does), a size the
// mounted element does not have, more than `ZPn` (120) blits in `ab` (1000 ms), or cells that are not
// the base64 of exactly `columns * rows` cells of 12 bytes. A blit that lands paints that many cells on
// every mounted element of the size and answers `{}`. The bodies are the copy's
// ./plugin-chain-ui-blit-source.ts; the mounted rows are `it().mountedRasters` / `it().mountedImages`,
// which the site mount writes (`Yto` with `hNs` / `ELs`, chunk-n3ykh62m.js [256991,…) — the package
// after this one).
//
// The entries could not be copied as a block: the generator emits each block as a top-level
// statement, and `"ui.toast":{…}` is a table fragment, not one. Their bodies are ported here
// verbatim as the arrows above, with the keys the source gives them.
//
// What the ported bodies do, all measured from the source:
//  · `Kxo` is the ui.toast floor: the same gate, around `s.toast(plugin, BDe(text), timeoutMs)` —
//    the plugin, the text truncated at the remote limit, and the timeout the plugin asked for
//    (absent when it asked for none). Its `check` refuses a text that is not a string, and a
//    `timeoutMs` that is present but not a whole number of ms from 1 to `F2e` (60000).
//  · `LWt` runs `Vyt`, the gate every ui write passes: `bI()` is the session bound in `DT`
//    (chunk-sfn1dbxq.js [450137,450155), carried in ./plugin-chain-loader-source.ts). With none
//    bound it logs `${event} (${plugin}): no session bound; dropped: ${text}` and writes nothing;
//    otherwise it logs the redacted text and hands the session to the writer.
//  · `LWt`'s writer is `r.status(plugin, text===void 0 ? text : BDe(text))` — a cleared status when
//    the plugin passes no text, and a redacted one otherwise. `lJt` then notices a text longer than
//    `N6` (2000) through `$2e` → `Yb` → `CK` → `zz`, one notice per plugin and spelling.
//  · `ui.log` routes by `to`: `mce` (the product's own chain-log sink, carried at
//    ./plugin-chain-records.ts) for a transcript line, `Pzo` for a debug line. Only the transcript
//    route reaches the length notice; the source passes `void 0` in its place for `to:"debug"`.
//  · `check` runs only when a handler is in the chain: with no handler `Hze` short-circuits to the
//    floor's `run` with the caller's own object (W45-20). Then a refusal is thrown by `Hze` as
//    `${event}: ${text} (host check)`.
//
// This package binds the table's three ui event names. What a surface does with an admitted toast
// (the notification bar itself: its store, its zod schema, its React clock driver `TK` at
// chunk-24k7d6mw.js [478823,…)) is the host's own and stays outside the port; the admission policy
// the host consults is re-exported below from ./plugin-chain-toast-source.ts, and the source's own
// integration site is `chunk-24k7d6mw.js` [179559,…), where a toast that gives way is reported
// before `this.requireHost().addNotification({key,kind:"event",text,priority:fLs,waitsItsTurn})`.
import { mce } from './plugin-chain-records.js';
import { DT, bI } from './plugin-chain-loader-source.js';
import { raiseHostCall, type HostCallBottom, type HostCallCaller } from './plugin-chain-host-call.js';
import { bFo, fNs, kFo, mNs } from './plugin-chain-ui-blit-source.js';
import { $2e, Dzo, Fzo, GCn, Izo, LVe, LWt, Nzo, Pzo, lJt, u2t } from './plugin-chain-ui-source.js';
import { F2e, Kxo, yro } from './plugin-chain-toast-source.js';

/** One table entry as `Hze` reads it: `check` refuses an argument with a text, `run` is the floor.
 *  `stamp` is the third field the source's entries may carry (`"ui.notify":{check:Dzo,stamp:Fzo,run:Nzo}`
 *  at chunk-sfn1dbxq.js [2336352,…)). The other dispatcher — the plugin-facing `$` path — applies it
 *  as `h.stamp?.(raised, caller)` after `raise` and before `run`, so `run` sees the stamped argument
 *  while `check` sees the raw one. `Hze`, the hooks-then-floor path this seam mirrors, never reads it,
 *  so the field is carried for fidelity and for a later package that ports that dispatcher. */
export type UiCallEntry = HostCallBottom & {
  stamp?: (args: any, caller: HostCallCaller) => unknown;
};

/** The ui names this package's table slice holds. */
export type UiCallEvent = 'ui.toast' | 'ui.status' | 'ui.log' | 'ui.selection' | 'ui.notify' | 'ui.blit';

/** The session surface these floors reach. Every ui write needs one bound: `Vyt` drops the write
 *  with a log line otherwise. The source's session carries its other surfaces too (mcp servers,
 *  agents, the composer); a later package binds those by the same slot. */
export interface PluginUiSession {
  /** `$.ui.status`'s write: `undefined` clears the plugin's status line. */
  status: (plugin: string, text: string | undefined) => unknown;
  /** `$.ui.toast`'s write: the text with the remote limit applied, and the timeout the plugin asked
   *  for — `undefined` when it asked for none, which the source's own bar reads as `Sqt` (4000 ms). */
  toast: (plugin: string, text: string, timeoutMs: number | undefined) => unknown;
  /** The selection `$.ui.selection` reads: the context's own accessor, called as `read()`. A bound
   *  context without one answers `undefined`, which is what the source's `?.` chain does. */
  selection?: { read: () => unknown };
  /** `$.ui.notify`'s write: the session's terminal-notification write. Its answer is the channel
   *  name the notify floor maps with `qQt` — `iterm2`, `iterm2_with_bell`, `kitty`, `ghostty` or
   *  `terminal_bell` for a send, `disabled`, `none`/`no_method_available` and `error` for the three
   *  refusals. A session without one answers `undefined`, which the floor reads as `no_surface`. */
  notify?: (request: { message: string; title: string; notificationType: 'plugin_notification' }, origin: unknown) => unknown;
}

/** The table slice, ported verbatim from the source's literal above. */
export function uiCallTable(): Record<UiCallEvent, UiCallEntry> {
  return {
    'ui.toast': {
      check: (n: any) => {
        const r = n?.timeoutMs !== void 0 && !yro(n.timeoutMs, F2e);
        return LVe(n?.text) ?? (r ? `timeoutMs is a whole number of ms, 1 to ${F2e}` : void 0);
      },
      run: lJt('ui.toast', Kxo),
    },
    'ui.status': {
      check: (n: any) => n?.text === void 0 ? void 0 : LVe(n.text),
      run: lJt('ui.status', (n: any, r: any) => LWt(n.text, r)),
    },
    'ui.log': {
      check: (n: any) => LVe(n?.text) ?? Izo(n?.to),
      run: (n: any, r: any) => {
        const s = n.to === 'debug';
        s ? Pzo(r.plugin, n.text) : mce(r.plugin, n.text);
        $2e(r.plugin, 'ui.log', s ? void 0 : n.text);
        return Promise.resolve(void 0);
      },
    },
    // The source's entry for this name is `{run:u2t}` — the floor is the copied body itself, with no
    // check in front of it, so an argument is never refused and the answer is always a promise.
    'ui.selection': { run: u2t as UiCallEntry['run'] },
    // Ported verbatim from the same literal: `"ui.notify":{check:Dzo,stamp:Fzo,run:Nzo}`. The check
    // reads only `title` and `text`; the run is gated on `wn()` — the committed flag — before it
    // touches the session, and answers the `{isSent, reason|channel}` object `qQt` maps.
    'ui.notify': {
      check: Dzo as UiCallEntry['check'],
      stamp: Fzo as UiCallEntry['stamp'],
      run: Nzo as UiCallEntry['run'],
    },
    // Ported verbatim from the same literal: `"ui.blit":{check:fNs,run:(n,r)=>bFo(n)?kFo(n,r):mNs(n,r)}`.
    // The two runs answer `{deny: text}` rather than throwing, so a refused blit reaches the caller as
    // an answer. Neither path needs a session: the mounted rows live on the host registry `it()`.
    'ui.blit': {
      check: fNs as UiCallEntry['check'],
      run: (n: any, r: any) => bFo(n) ? kFo(n, r) : mNs(n, r),
    },
  };
}

/** Raise one `$` ui call the way the plugin-method dispatcher does: the table entry for the name is
 *  the chain's floor, so a plugin's hooks may answer first and `next()` reaches the floor. */
export async function raiseUiCall(request: {
  event: UiCallEvent;
  args: unknown;
  caller: HostCallCaller;
  raise?: unknown;
}): Promise<unknown> {
  return raiseHostCall({
    event: request.event,
    args: request.args,
    caller: request.caller,
    bottom: uiCallTable()[request.event],
    raise: request.raise,
  });
}

/** Bind the session `Vyt` reads, and return the unbind. `DT` is the source's own single-slot
 *  binding (chunk-sfn1dbxq.js [450137,450155) via ./plugin-chain-loader-source.ts), so a rebind
 *  replaces the previous session and `release` only clears the one it was bound with. */
export function bindPluginSession(session: PluginUiSession): () => void {
  DT.bind(session);
  return () => DT.release(session);
}

/** The session currently bound, or `undefined`. */
export function currentPluginSession(): PluginUiSession | undefined {
  return bI() as PluginUiSession | undefined;
}

/** One `$.ui.log` line as `mce` reports it: the plugin, the text with the session's own redaction
 *  applied, and `again` when the line was held before this subscriber arrived. */
export interface PluginUiLogRecord {
  plugin: string;
  text: string;
}

/** Take the `$.ui.log` lines `mce` reports, and return the unbind. Source `GCn`
 *  (chunk-sfn1dbxq.js [2338505,2338661) 156 units): the sink is bound, everything held until then is
 *  flushed with the `again` state, and the unbind clears only the sink it set. `mce` still writes its
 *  own `[plugin] $.ui.log: text` line either way, and holds lines only while no sink is bound. */
export function onPluginUiLog(handler: (record: PluginUiLogRecord, state: 'again' | string) => void): () => void {
  return GCn(handler as (record: PluginUiLogRecord, state: string) => void) as () => void;
}

/** The toast admission policy, re-exported under the names a surface reads them by. Every one is
 *  the source body verbatim from ./plugin-chain-toast-source.ts (chunk-sfn1dbxq.js ranges recorded
 *  in research/ports/W45-toast-blocks.plan.json):
 *
 *   · `TOASTS_PER_PLUGIN` (`ACn`, 50) — the waiting toasts one plugin may hold.
 *   · `toastThatGivesWay` (`DWt`, queue, plugin) — once a plugin holds that many, the key of the
 *     waiting toast that gives way, else `undefined`.
 *   · `TOAST_PRIORITY` (`fLs`, "immediate") — what every plugin toast is added under.
 *   · `DEFAULT_TOAST_TIMEOUT_MS` (`Sqt`, 4000) — what a plugin that asked for no timeout gets.
 *   · `TOAST_TIMEOUT_MAX_MS` (`F2e`, 60000) — the entry's `timeoutMs` upper bound.
 *   · `pluginOfToastKey` (`sI`, key) — the plugin a `plugin-toast-<id>:<plugin>` key names.
 *   · `splitToastQueue` (`sLs`, queue, isHidden, defaultMs) — the current toast, the waiting ones.
 *   · `toastKey` (`gLs`, plugin, id) — the key a toast is added under, id before plugin.
 *   · `toastAdmission` (`hLs`, queue, plugin) — `{isWaiting, givesWay, isCutShort}` for an arriving
 *     toast: whether it waits its turn, which waiting toast gives way for it, and whether it cuts
 *     the running one short.
 *   · `reportToastGiveWay` (`mLs`, {key, plugin, isCutShort}) — writes `$.ui.toast (plugin): key
 *     gave way, cut short|unseen` and, unless cut short, notices it once per plugin and spelling.
 *     The notice is a transcript line (`CK`), so it reaches a plugin only while a plugin source is
 *     installed; with none the log line above is all a give-way produces.
 *   · `noteToastOnce` (`AQo`, key, plugin, run) — runs `run` the first time this spelling is seen
 *     for this plugin and environment.
 */
export {
  ACn as TOASTS_PER_PLUGIN,
  DWt as toastThatGivesWay,
  fLs as TOAST_PRIORITY,
  Sqt as DEFAULT_TOAST_TIMEOUT_MS,
  F2e as TOAST_TIMEOUT_MAX_MS,
  sI as pluginOfToastKey,
  sLs as splitToastQueue,
  gLs as toastKey,
  hLs as toastAdmission,
  mLs as reportToastGiveWay,
  AQo as noteToastOnce,
} from './plugin-chain-toast-source.js';

/** The ui.blit surface, re-exported under the names a mount site or a record reads them by. Every one
 *  is the source body verbatim from ./plugin-chain-ui-blit-source.ts (chunk-n3ykh62m.js ranges
 *  recorded in research/ports/W45-ui-blit-blocks.plan.json):
 *
 *   · `BLITS_PER_SECOND` (`ZPn`, 120) and `BLIT_WINDOW_MS` (`ab`, 1000) — the per-site window: the
 *     `blits` count on a mounted row resets once `BLIT_WINDOW_MS` has passed, and the 121st blit
 *     inside one window is refused.
 *   · `mountedRasterSites` (`hs`) / `mountedImageSites` (`Yj`) — the two host registries, keyed by
 *     `e5t`'s NUL-joined `plugin\0requestId\0key`. A row is `{rasters: Set, windowStart, blits}` (the
 *     Image side holds `images`), which is what the site mount writes.
 *   · `blitRefusalText` (`Kto`, kind, args, isOtherPlugins) — the two denial sentences.
 *   · `decodeBlitCells` (`fur`, cells, columns, rows) — `{words}` or `{problem}`: `columns * rows`
 *     cells of 12 bytes, each a width-1 code point and two colors that are `0xRRGGBB` or the default.
 *   · `validateImageSource` (`Mss`, source) — the ImageSource validator, and
 *     `CELLS_BASE64_LENGTH` (`rb`, columns, rows) the character count it holds `cells` to.
 */
export {
  ZPn as BLITS_PER_SECOND,
  ab as BLIT_WINDOW_MS,
  Kto as blitRefusalText,
  fur as decodeBlitCells,
  rb as CELLS_BASE64_LENGTH,
  Mss as validateImageSource,
  hs as mountedRasterSites,
  Yj as mountedImageSites,
} from './plugin-chain-ui-blit-source.js';
