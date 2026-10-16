// Host surface for the copied chain runner in ./plugin-chain-source.ts.
//
// The copied bodies name twenty-five bindings that live outside the copied ranges. Each one is
// either a verbatim copy of the source body (marked `copy`) or an owned port with the reason the
// source body could not be carried (marked `port`). This module deliberately does not import the
// copied bodies: the source file imports it, and one direction keeps module evaluation order
// simple. Sources: research/ports/W45-chain-runner.md, block ledger W45-chain-runner-blocks.json.
import { PFs } from './tui-border.js';
import { createPluginRegistryState } from './plugin-chain-registry-state.js';
import type { PluginRegistryState, PluginStateStore, RegistryStore } from './plugin-chain-registry-state.js';
import type { ChainEnvironmentHost, ChainHandler, ChainLogRecord, ChainModule, ChainModuleRecord, ChainRun, ChainSite, ChainStreamLinksInput } from './plugin-chain-types.js';

// The registry state's own types live with it (./plugin-chain-registry-state.ts), where the fields
// the source's literal installs are named; these two are re-exported because the seams and tests
// written against the store import them from this module.
export type { PluginStateStore, RegistryStore };

/* -------------------------------------------------------- pattern layer (copy) */

// chunk-m4qpskd4.js event-pattern layer, carried here rather than in the source file because
// chunk-nyce03br.js uses the same name `uo` for the 32000-unit log text ceiling and one file cannot
// declare both. Bodies copied verbatim, with the host's TypeScript annotations added because this
// file is type-checked; identifiers, literals and expressions are the source's:
//   [47716,47860) 144 units  var fo=…            (identifier pattern)
//   [48272,48358)  86 units  function MFs(e,o){…} (tier floor lookup)
//   [49595,49628)  33 units  var zt=…            (anchored event-name pattern)
//   [49725,50306) 581 units  function co(e){…}   (pattern problem text)
//   [50306,50381)  75 units  function uo(e){…}   (pattern parse; throws the hooks error)
//   [50521,50708) 187 units  function Wde(e,o){…} (pattern match)
// and, from the log module, `t` at chunk-gyf58rwf.js [59393,59438) (see its own comment below).
const fo = String.raw`(?!\p{Default_Ignorable_Code_Point})[\p{ID_Start}$_]` + String.raw`(?:(?!\p{Default_Ignorable_Code_Point})[\p{ID_Continue}$])*`;
const zt = new RegExp(`^${fo}$`, 'u');
type Pattern = { isNegated: boolean; selection: { kind: string; prefix?: string; name?: string } };
function co(e: unknown): string | Pattern {
  if (typeof e !== 'string') return `${typeof e} is not an event name or a pattern (a string)`;
  const o = e.startsWith('!'), r = o ? e.slice(1) : e;
  if (o && r === '*') return `"${e}" is not a pattern: it selects no event`;
  if (o && r.startsWith('!')) return `"${e}" is not a pattern: "!" negates once`;
  const t = r === '*', n = r.endsWith('.*'), s = (n ? r.slice(0, -2) : r).split('.');
  if (!(t || s.every((i) => zt.test(i)))) return `"${e}" is not an event name or a pattern ("*", "<prefix>.*", or "!" before either)`;
  return { isNegated: o, selection: t ? { kind: 'every' } : n ? { kind: 'prefix', prefix: s.join('.') } : { kind: 'name', name: r } };
}
function uo(e: unknown): Pattern {
  const o = co(e);
  if (typeof o === 'string') throw new HooksError(o);
  return o;
}
/** Source `Wde(e, name)`: whether an event pattern selects this event name. */
export function Wde(e: unknown, name: string): boolean {
  const { isNegated: r, selection: t } = uo(e);
  let n: boolean;
  switch (t.kind) {
    case 'every': n = true; break;
    case 'prefix': n = name.startsWith(`${t.prefix}.`); break;
    default: n = name === t.name;
  }
  return r ? !n : n;
}

/* ---------------------------------------------------- event catalog (copy) */

// The catalog and the registration predicates, copied verbatim with the host's annotations. Same
// three modules as the pattern layer above: chunk-3cynezh1.js carries the classic hook list the
// catalog extends, chunk-m4qpskd4.js the catalog and the predicates, chunk-3qabb19b.js the dedupe.
//   chunk-3cynezh1.js [74700,75328) 628 units  var xp=[…]        (the classic hook names)
//   chunk-m4qpskd4.js [45815,45826)   11 units  var Ewr=xp;
//   chunk-m4qpskd4.js [45826,45862)   36 units  var ao=…          (`classic.<name>`)
//   chunk-m4qpskd4.js [45862,46732)  870 units  var Q$n=[…]       (the second roster)
//   chunk-m4qpskd4.js [46732,47457)  725 units  var J3e=[…]       (the catalog both make up)
//   chunk-m4qpskd4.js [47631,47716)   85 units  var Bt=…          (the prefixes of its dotted names)
//   chunk-m4qpskd4.js [47860,47910)   50 units  var Gt=…          (a two-segment event name)
//   chunk-m4qpskd4.js [47910,47970)   60 units  var Z$n=…         (that name, outside a known prefix)
//   chunk-m4qpskd4.js [49628,49686)   58 units  var Q3e=…         (a wildcard or negated pattern)
//   chunk-m4qpskd4.js [49686,49725)   39 units  var lo=…          (the telemetry prefix)
//   chunk-m4qpskd4.js [50381,50457)   76 units  function eEs(e){…} (the name a pattern selects)
//   chunk-m4qpskd4.js [50457,50521)   64 units  function Awr(e){…} (the problem a pattern has)
//   chunk-m4qpskd4.js [50708,50764)   56 units  var lIt=…         (does this pattern select this event)
//   chunk-3qabb19b.js [883,919)       36 units  function D(n){…}   (dedupe)
const xp = ['PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'PostToolBatch', 'Notification', 'UserPromptSubmit', 'UserPromptExpansion', 'SessionStart', 'SessionEnd', 'Stop', 'StopFailure', 'SubagentStart', 'SubagentStop', 'PreCompact', 'PostCompact', 'PreModelSwitch', 'PostModelSwitch', 'PermissionRequest', 'PermissionDenied', 'Setup', 'TeammateIdle', 'TaskCreated', 'TaskCompleted', 'Elicitation', 'ElicitationResult', 'ConfigChange', 'WorktreeCreate', 'WorktreeRemove', 'InstructionsLoaded', 'CwdChanged', 'FileChanged', 'DirectoryAdded', 'MessageDisplay'];
const Ewr = xp;
const ao = Ewr.map((e) => `classic.${e}`);
const Q$n = ['model.complete', 'model.classify', 'model.fork', 'audio.play', 'audio.speak', 'mcp.call', 'mcp.connect', 'session.cwd', 'session.root', 'session.model', 'session.turns', 'session.id', 'session.messages', 'session.repo', 'session.surface', 'session.surfaces', 'session.authorize', 'session.usage', 'session.version', 'turn.abort', 'prompt.read', 'flag.value', 'tool.list', 'tool.register', 'command.list', 'command.register', 'config.list', 'agent.list', 'agent.register', 'ui.toast', 'ui.status', 'ui.log', 'ui.notice', 'ui.invalidate', 'ui.open', 'ui.close', 'ui.panes', 'ui.selection', 'ui.copy', 'ui.notify', 'ui.blit', 'fs.read', 'fs.write', 'fs.list', 'fs.exists', 'fs.stat', 'fs.ancestors', 'store.get', 'store.set', 'store.delete', 'store.keys', 'state.get', 'state.set', 'clock.now', 'clock.sleep', 'clock.after', 'clock.every', 'http.fetch', 'process.run', 'process.spawn', 'settings.read', 'env.get', 'env.set'];
const J3e: readonly string[] = [...ao, 'tool.call', 'tool.check', 'ui.render', 'ui.resolve', 'ui.press', 'ui.input', 'ui.select', 'ui.message', 'ui.fault', 'ui.scroll', 'ui.focus', 'agent.offer', 'agent.spawn', 'prompt.submit', 'prompt.fill', 'prompt.suggest', 'prompt.edit', 'prompt.autocomplete', 'prompt.section', 'prompt.context', 'prompt.attachment', 'prompt.mention', 'prompt.compose', 'tool.describe', 'command.run', 'command.describe', 'config.set', 'config.describe', 'telemetry.log', 'telemetry.mark', 'skill.prompt', 'attribution.text', 'session.start', 'session.receive', 'session.append', 'session.send', 'session.compact', 'session.attach', 'session.detach', 'session.measure', 'session.end', 'plugin.register', 'turn.start', 'turn.step', 'turn.complete', 'engine.create', ...Q$n];
const Bt = new Set(J3e.filter((e) => e.includes('.')).map((e) => e.slice(0, e.indexOf('.'))));
const Gt = new RegExp(String.raw`^${fo}\.${fo}$`, 'u');
const Z$n = (e: string): boolean => Gt.test(e) && !Bt.has(e.slice(0, e.indexOf('.')));
const Q3e = (e: string): boolean => e === '*' || e.endsWith('.*') || e.startsWith('!');
const lo = (e: string): boolean => e.startsWith('telemetry.');
/** Source `eEs(pattern)`: the event name a pattern selects, or nothing for a wildcard. */
function eEs(e: unknown): string | undefined {
  const { selection: o } = uo(e);
  return o.kind === 'name' ? o.name : undefined;
}
/** Source `Awr(pattern)`: the problem with a pattern, or nothing when it is one. */
function Awr(e: unknown): string | undefined {
  const o = co(e);
  return typeof o === 'string' ? o : undefined;
}
/** Source `lIt(pattern, name, {isBuiltin})`: whether this pattern selects this event. */
export const lIt = (e: unknown, o: string, r: { isBuiltin?: boolean }): boolean =>
  Wde(e, o) && (r.isBuiltin === true || !lo(o) || lo(String(e)));
function D<T>(n: readonly T[]): readonly T[] {
  return [...new Set(n)];
}

/* ------------------------------------------------------- tier model (copy) */

/** Source `MFs(e, o)` (chunk-m4qpskd4.js [48272,48358)): the floor a tier is answered below. */
export function MFs(floors: readonly { from: string; to: string; plugin: string }[], tier: string): string | undefined {
  const r = glt(tier);
  return floors.find((t) => glt(t.from) < r && r < glt(t.to))?.plugin;
}

/** Source chunk-m4qpskd4.js, SHA-256 730cbd0e42d685bf16a3b53c020b479670597d6bef6db2ab594049eea3e782ae.
 *  `ry` [48162,48214), `glt` [48245,48272), zero-based UTF-16; typed declaration adaptation. */
const ry = ['prepend', 'user', 'append', 'builtin', 'core'];
export function glt(tier: string): number {
  return ry.indexOf(tier);
}

/* ------------------------------------------------------------- error seam (port) */

/** The copied bodies throw the hooks error copied into ./plugin-chain-source.ts; the registry wires it. */
class ChainError extends Error {
  constructor(message: string) {
    super(message);
  }
}
let HooksError: new (message: string) => Error = ChainError;

/** Called once by ./plugin-chain-registry.ts with the copied `He` so both sides share one class. */
export function setChainErrorClass(ctor: new (message: string) => Error): void {
  HooksError = ctor;
}

/** Source `au` (chunk-886tf6ja.js [2162,2300)) extends the vendor API error class. Port: no vendor base. */
export class au extends Error {
  constructor({ message }: { message?: string } = {}) {
    super(message || 'Request was aborted.');
    this.name = 'AbortError';
  }
}

/** Source `kn` (chunk-76anb6yt.js) returns `r(name)`, a redaction from an unported chunk. Port: shape gate only. */
export function kn(name: string): string {
  return name;
}

/* ------------------------------------------------------------------ logging (port) */

const records: ChainLogRecord[] = [];
const listeners = new Set<(record: ChainLogRecord) => void>();

/** Source `Nl()` is the logger the runner reports through (`Nl().log`, `Nl().hookFailed`). */
export function Nl() {
  return {
    log(message: string, level = 'info') {
      push({ kind: 'log', level, message });
    },
    hookFailed(record: Record<string, unknown>) {
      push({ kind: 'hookFailed', ...record } as ChainLogRecord);
    },
  };
}
function push(record: ChainLogRecord): void {
  records.push(record);
  for (const listener of listeners) listener(record);
}
export function chainRecords(): readonly ChainLogRecord[] {
  return records;
}
export function clearChainRecords(): void {
  records.length = 0;
}
/** The product's own log sink; the copied runner keeps reporting through `Nl()` as it always did. */
export function onChainRecord(listener: (record: ChainLogRecord) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* ----------------------------------------- module inventory and seats (W45-2) */

const loadedModules: ChainModuleRecord[] = [];
const moduleSeats = new Map<string, string>();
const registeredAgents = new Map<string, unknown>();
const moduleListeners = new Set<() => void>();

/** Source `OL()` is the store the composer's `Jl("prompt.edit")` selection reads; in this product the
 *  thing that changes is the loaded-module inventory, so installs notify it. */
export function onChainModulesChanged(listener: () => void): () => void {
  moduleListeners.add(listener);
  return () => moduleListeners.delete(listener);
}
function modulesChanged(): void {
  for (const listener of moduleListeners) listener();
}

/** One `$.ui.log` line as it reaches the registry sink, and the sink itself. */
export type PluginUiLogSink = ((record: { plugin: string; text: string }, state: string) => void) | null;

/** One reader of a stored key (`readers` in the store's own literal): the plugins whose state it
 *  folds, and the instance that draws it — which is what `Ci` classifies into a pace. */
export interface PluginStateReader {
  plugins: string[];
  instance: { surface?: string; component?: string; requestId?: string };
}

/** One pace's fold queue (`folds.steady` / `folds.live`): the stale keys waiting for the next run, the
 *  armed timer when one is pending, and the time the fold last ran. */
export interface PluginStateFold {
  stale: Set<string>;
  pending?: { unref?: () => void } | undefined;
  lastAt: number;
}

/* PluginStateStore and RegistryStore moved to ./plugin-chain-registry.ts with the registry itself
   (W45-35); they are re-exported at the top of this file for the seams and tests written against it. */

/** Source `it()` returns the plugin registry (`a().registry`, the field of the host-scoped instance
 *  `a()` reaches through `r.of(B().host)`): the loaded modules, their seats, the registered agents,
 *  the pending hooks respawns — and the fields the chain writes through, `uiLogSink` and
 *  `pendingUiLog` (chunk-3ph567jx.js [3302,3468)) and `pluginState`, the store the bar's ledger lives
 *  in (`s_` at chunk-n3ykh62m.js [273997,274025)). The source hands back the *same* registry object
 *  every call, which is what lets `GCn` bind a sink one call and `mce` read it from the next, so this
 *  does too.
 *
 *  The state is the source's own literal now (W45-35): `s()` builds all of its fields with the
 *  defaults the source gives them — `pluginState: Zco()`, `toastClock: edo()`, `panes: gs(FDn)`,
 *  `renderVersions`/`notices`/`hoverGroups` as stores, `hooksRespawns` as a Set — where this seam
 *  used to hand-write ten of them with `null`. The three containers below are spread over the ones
 *  `s()` builds, because this module already holds the live references the install and seat
 *  functions write through; the source would have built them per host, and this product has one host
 *  for the process.
 *
 *  Built on the first call, as the source builds it: `class n{registry=s()}` sits inside the lazy
 *  per-host memo `q`, so `s()` runs when `it()` is first reached, never while a module is still
 *  evaluating. That timing is load-bearing — `s()` reads `FDn` out of the fold chunk, and a registry
 *  built at module-init reads it before that chunk's body has assigned it (which is what the W45-35
 *  regression for `it().panes` caught when this seam built it eagerly). */
let registry: PluginRegistryState | null = null;

export function it(): PluginRegistryState {
  if (registry === null) {
    registry = {
      ...createPluginRegistryState(),
      loadedModules,
      moduleSeats,
      registeredAgents,
    };
  }
  return registry;
}
/** Source `Ee` falls back to this table when a module record carries no tier of its own. */
export function setChainModuleSeat(name: string, tier: string): void {
  moduleSeats.set(name, tier);
}

/** Source `Z`/`jDe` collect *module records*, which the source's plugin loader builds while
 *  installing a plugin. This product has no plugin loader yet, so a factory builds the record shape
 *  for the collected module; ./plugin-chain-module-record.ts is that factory, and the registry
 *  installs it here so this module keeps no dependency on the copies. */
let buildRecord: (module: ChainModule) => ChainModuleRecord = (module) =>
  ({
    name: module.name,
    tier: module.tier ?? 'user',
    label: module.name,
    args: { modulePath: module.modulePath },
    status: () => ({ kind: 'live' as const }),
    enter: () => {},
    leave: () => {},
    hooks: (event: string) => module.hooks(event),
    catches: (event: string) => module.hooks(event),
    matcherFor: () => undefined,
    registrationsFor: () => [],
    hasCatch: () => false,
    ...(module.streamLinks !== undefined && { streamLinks: (input: ChainStreamLinksInput) => module.streamLinks?.(input) ?? [] }),
  }) as ChainModuleRecord;

export function setChainRecordFactory(factory: (module: ChainModule) => ChainModuleRecord): void {
  buildRecord = factory;
}

export function installChainModule(module: ChainModule): () => void {
  checkDeclaredPatterns(module);
  const record = buildRecord(module);
  loadedModules.push(record);
  if (module.tier !== undefined) moduleSeats.set(module.name, module.tier);
  modulesChanged();
  return () => {
    const at = loadedModules.indexOf(record);
    if (at >= 0) loadedModules.splice(at, 1);
    moduleSeats.delete(module.name);
    modulesChanged();
  };
}

/** Source `iWt(pluginName, scan, registered)` (chunk-sfn1dbxq.js [1684913,1685296)) is the host check
 *  an install runs over the patterns a module registered. Its first half compares them against the
 *  scan of the module's own source, which this product has no separate scan for; the second half is
 *  the part that is checkable here and is copied verbatim — `Awr` for a pattern that is not one, then
 *  `eEs` for the event it selects and `mlt`/`Z$n` for whether the catalog knows that event. The
 *  messages are the source's, with the plugin name in front as the source puts it. */
function checkDeclaredPatterns(module: ChainModule): void {
  const declared = module.patterns;
  if (declared === undefined) return;
  for (const { pattern } of declared) {
    const problem = Awr(pattern);
    if (problem !== undefined) throw new HooksError(`${module.name}: registered ${problem}`);
    const selected = eEs(pattern);
    if (selected !== undefined && !mlt(selected) && !Z$n(selected)) {
      throw new HooksError(`${module.name}: registered "${pattern}", which is not an event`);
    }
  }
}

/* ------------------------------------------------- abort plumbing the copies reach (ports) */

/* `Ka` and `pwr` were ports here while their ranges were unmapped; both bodies are now copied into
 * ./plugin-chain-source.ts (chunk-yjc18bey.js [2047,2313), chunk-nyce03br.js [158106,158196)), so the
 * collection bodies import them from there. */

/* ---------------------------------------- handler collection: ports the copies reach (W45-2) */

/* The collection bodies (src/plugin-chain-records.ts) are the source's own text. What stays here is
 * the surface they reach but do not declare, each with the reason it is a port and not a copy. */

/** Source `G()` is the application's log sink accessor; `t` reports through it. Port: the product's
 *  own sink is this module's record list, so `G()` returns it in the shape `t` expects. */
export function G(): { log: (message: string, { level }?: { level?: string }) => void } {
  return {
    log(message: string, { level = 'debug' }: { level?: string } = {}) {
      push({ kind: 'log', level, message });
    },
  };
}

/** Source `t(e, n = {level: "debug"})` (chunk-gyf58rwf.js [59393,59438) 45 units, body sha256
 *  49982516daa9951f…): one module log line, `G().log(e, n)`. Carried here rather than in a generated
 *  file because it is the only body of its module this product needs, and it is annotated for the
 *  host's type check; identifiers, literals and the call are the source's. */
export function t(e: string, n: { level?: string } = { level: 'debug' }): void {
  G().log(e, n);
}

/** Source `g(e, r)` (chunk-2hb5361r.js [5466,5529) 63 units, body sha256 7320b43f398d50f2…): the
 *  feature recorder — `i("tengu_feature_ok", {...r, feature_name: d(e)})`, an analytics dispatcher
 *  this product does not carry. Port: the event is recorded in the same record list `t` writes to,
 *  so `AQo`'s once-per-plugin thunk still fires exactly where the source fires it. */
export function featureUsed(feature: string, fields: Record<string, unknown> = {}): void {
  push({ kind: 'log', level: 'debug', message: `feature ${feature}`, ...fields } as ChainLogRecord);
}

/** Source `a` (chunk-yvnhkg35.js [68762,68887)) is the environment/config object the seat resolver
 *  reads (`a.CLAUDE_CODE_PLUGIN_DIR_WATCH`). Port: the product reads its own environment. */
export const a: Record<string, string | undefined> = new Proxy({} as Record<string, string | undefined>, {
  get: (_target, key) => process.env[String(key)],
});

/** Source `ve()` (chunk-4bw62nzm.js [92857,92917)) asks whether the session is interactive. */
export function ve(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/** Source `sA()` / `mU()` (chunk-4bw62nzm.js) list the inline plugin sources with and without
 *  MCP-only entries. Port: this product installs plugin modules through installChainModule. */
export function sA(): string[] {
  return loadedModules.map((m) => m.name);
}
export function mU(): string[] {
  return [];
}

/* ------------------------------------------------- instruction text the sites reach (port) */

/** Source `rse(e)` (chunk-m7864yc0.js [2196,2237) 41 units) is `z().neutralize(e)`, where `z`
 *  (chunk-m7864yc0.js [2068,2196)) is the auto-memory provider accessor. Port: this product carries
 *  no auto-memory provider, and the only body that reaches `rse` is the copied `Loe`
 *  (chunk-btcaa7nx.js [1595,1628)), which `Nbr` calls for instruction files of kind `"AutoMem"`.
 *  No such record exists here, so the port hands the text `Loe` already normalized through. */
export function rse(e: string): string {
  return e;
}

/* ------------------------------------------------------------ registries (port) */

/** Source `TDe` (chunk-n3ykh62m.js [266967,267031) 64 units) is `(e) => tIt(e, {copies: new Map,
 *  nodes: 0, depth: 0, isKeyed: !1})`, the subtree-copy walk `ga` applies to the four names in `_yt`
 *  (config.describe, command.describe, tool.describe, agent.offer). It lived here as a pass-through
 *  placeholder while `tIt` was uncarried; W45-20 carried the copier with the module-to-host call path
 *  and `TDe` moved to ./plugin-chain-host-call-source.ts, where the two generated callers
 *  (./plugin-chain-entry.ts and ./plugin-chain-source.ts) now import it. It is not re-exported from
 *  here: this module sits below that copy (`Hze` reads `Z$n`), and re-exporting would close the cycle
 *  into a module-evaluation order that leaves the host's own consts uninitialized. */

const cores = new Map<string, ChainHandler>();
const sites = new Map<string, ChainSite>();

/** Source `yyt()` returns the installed core for each chain name; the registry installs them. */
export function yyt(): Record<string, ChainHandler | undefined> {
  return Object.fromEntries(cores);
}
export function registerChainCore(name: string, core: ChainHandler): void {
  cores.set(name, core);
}

/** Source `zd` is the event site table (chunk-nyce03br.js [110271,110960)) and `$be()` picks by
 *  chain name (chunk-sfn1dbxq.js [3070826,3071708)). Port: sites are registered as they land. */
export const zd: Record<string, ChainSite> = new Proxy({} as Record<string, ChainSite>, {
  get: (_target, key) => sites.get(String(key)),
  has: (_target, key) => sites.has(String(key)),
  ownKeys: () => [...sites.keys()],
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});
export function $be(): Record<string, ChainSite> {
  return zd;
}
export function registerChainSite(name: string, site: ChainSite): void {
  sites.set(name, site);
}

/** Source `rQt = new Set(PFs)` (chunk-nyce03br.js [1994,2019)) is the border style table, whose names
 *  the product already carries in ./tui-border.ts; the copied `rQt` is that same `new Set(PFs)`. */
export const rQt: ReadonlySet<string> = new Set(PFs);

/** Source `mlt(name)` is `J3e.includes(name)` (chunk-m4qpskd4.js [47506,47535)): whether the event
 *  catalog knows this name. The copied `Syt` is computed from it while ./plugin-chain-entry.ts is
 *  evaluated, so the catalog above has to be the source's own roster. */
export function mlt(name: string): boolean {
  return J3e.includes(name);
}

/** Source `kyt` (chunk-sfn1dbxq.js [480772,480868)): the names the catalog carries that no chain
 *  answers for, so `Syt` excludes them. */
export const kyt: ReadonlySet<string> = new Set([
  'plugin.register', 'telemetry.log', 'telemetry.mark', 'ui.scroll', 'ui.focus',
]);

/* -------------------------------------- module loader surface: ports (W45-5) */

/* The copied loader (src/plugin-chain-loader-source.ts) is the source's own text. What stays here is
 * the surface it reaches but does not declare. Each entry names the source body it stands in for and
 * why that body is not the one being called. */

/** Source `Te()` (chunk-4bw62nzm.js [108175,108201)) is `fj()`, which asks the host's launch options
 *  whether this run is diskless; a diskless run has no plugin directory, so no hooks module loads.
 *  Port: the product has no managed launch options, and its plugin directory is the user's. */
export function Te(): boolean {
  return false;
}

/** Source `Gc(storageId)` (chunk-nrk8z90j.js [12539,12686)) parses a `<name>@<marketplace>` id: its
 *  split is the source's own `iB` on the same module ([11835,11948), `lastIndexOf("@")`), carried here
 *  verbatim; what is dropped is `Gc`'s guard after it — `(Tlt(t)||t===Pi||t===mn) && !CO().safeParse(e).success`
 *  returns the name alone — so a builtin-shaped id keeps its marketplace field here. Unobservable while
 *  `Fv` finds no builtin plugin, and named so it is not mistaken for the source's whole function. */
function chainStorageId(storageId: string): { name: string; marketplace?: string } {
  const at = storageId.lastIndexOf('@');
  return at < 0 ? { name: storageId } : { name: storageId.slice(0, at), marketplace: storageId.slice(at + 1) };
}

/** Source `Fv(name)` (chunk-m4qpskd4.js [76200,76249)) is `xr().builtinPlugins.get(name)`: a lookup in
 *  the table the builtin plugin registrar `hb` ([75963,76157)) fills when a builtin plugin module
 *  registers itself. This product ships no builtin plugin modules, so the table is empty and every
 *  name misses — which is the source's own answer for a name that is not a builtin. An *installed*
 *  plugin's hooks module does not live here: the chain reaches it through the descriptor's
 *  `modulePath` (./plugin-chain-registry.ts), the way the source's environment builder `cIo`
 *  (chunk-sfn1dbxq.js [1831564,1831962)) reads `e.modulePath ?? e.pluginRoot`. */
export function Fv(_name: string): undefined {
  return undefined;
}

/** Source `pce(pluginStorageId)` (chunk-tvdq3hrk.js [4074,4152)): whether this id is a builtin
 *  plugin's. Its `Pi` is the builtin marketplace name (chunk-nrk8z90j.js), carried here as the same
 *  literal because the copied module that declares it imports this one. */
export function pce(pluginStorageId: string): boolean {
  const { name, marketplace } = chainStorageId(pluginStorageId);
  return marketplace === 'builtin' && Fv(name) !== undefined;
}

/** Source `Tpe()` (chunk-sfn1dbxq.js [1688508,1688587)) is `xr().agentDefinitions.clear(), await
 *  bI()?.refreshAgents()`: it drops the *derived* agent-definition table and asks the runtime to
 *  re-derive it. Port: the product keeps no derived table — `it().registeredAgents` is the
 *  registrations themselves, already pruned per plugin by the copied `e1e.forget(e)` that calls this
 *  through `hx` — so there is nothing to invalidate, and clearing the table here would drop the
 *  agents of plugins whose modules are still loaded. */
export async function Tpe(): Promise<void> {}

/** Source `c(error)` (chunk-gsnbskq4.js [16284,16747)) hands an error to the application's reporter,
 *  which remembers it and dispatches an error action — and returns early, silently, when the session
 *  runs against Bedrock/Vertex/Foundry or with error reporting disabled. Port: the product's sink is
 *  this module's own record list, and it always reports, so a product session shows an install failure
 *  the source would have swallowed under those settings. */
export function c(error: unknown): void {
  push({ kind: 'log', level: 'error', message: error instanceof Error ? error.message : String(error) });
}

/** Source `h3(name)` (chunk-sfn1dbxq.js [1822302,1822338)) forgets a module's commands and, when it
 *  had any, refreshes the command registry. Port: the product's own command surface is not derived
 *  from chain modules, so a module's teardown has no command entry to drop. */
export function h3(name: string): void {
  void name;
}

/** Source `rWt(label, registered)` (chunk-sfn1dbxq.js [1683468,1683739)) advises on a hooks module's
 *  `ui.render` matchers, checking them against the source's component and surface inventories. Port:
 *  the product's inventory is ./tui-base-components.ts and a matcher there is the module's own
 *  business, so the advice is not carried. */
export function rWt(label: string, registered: readonly { pattern: string; matcher?: unknown }[]): void {
  void label;
  void registered;
}

/** Source `AK = b_()` (chunk-n3ykh62m.js [226254,226265)): the press registry, dropped whole when a
 *  module goes away. Port: `b_()`'s own body is a whole press subsystem this product does not have, and
 *  only `forgetPresses(plugin)` is reached by the copied code; `hold`/`held`/`release` are the product's
 *  own members, and the set they keep is what `forgetPresses` drops. */
const presses = new Map<string, Set<unknown>>();
export const AK = {
  hold(pluginName: string, press: unknown): void {
    const held = presses.get(pluginName) ?? new Set();
    held.add(press);
    presses.set(pluginName, held);
  },
  release(pluginName: string, handles: readonly unknown[]): void {
    const held = presses.get(pluginName);
    if (held === undefined) return;
    for (const handle of handles) held.delete(handle);
    if (held.size === 0) presses.delete(pluginName);
  },
  forgetPresses(pluginName: string): boolean {
    return presses.delete(pluginName);
  },
  held(pluginName: string): readonly unknown[] {
    return [...(presses.get(pluginName) ?? [])];
  },
};

/** Source `o_e()` (chunk-sfn1dbxq.js [2384179,2384245)) picks the environment host kind from
 *  `CLAUDE_CODE_HOOKS_SAME_THREAD`. Port: the product runs every module in process, so it has one
 *  kind, and `lIo` never finds a live host of a different one. */
export function environmentHostKind(): string {
  return 'in-process';
}

/** The product's environment host factory; ./plugin-chain-host.ts cannot import
 *  ./plugin-chain-module-host.ts without a cycle, so the registry installs it, as it installs the
 *  record factory above. One host per chain: the source tells the two hosts apart by object identity
 *  (a record whose hop key is the native host is answered without a kind check), so the product must
 *  hand out a stable object per chain rather than a fresh one per call. */
let createEnvironmentHost: ((chain: unknown) => ChainEnvironmentHost) | undefined;
const hostPerChain = new WeakMap<object, ChainEnvironmentHost>();

export function setChainEnvironmentHostFactory(factory: (chain: unknown) => ChainEnvironmentHost): void {
  createEnvironmentHost = factory;
}
function environmentHost(chain: ChainRun): ChainEnvironmentHost {
  if (createEnvironmentHost === undefined) throw new ChainError('no chain environment host is installed');
  const held = hostPerChain.get(chain);
  if (held !== undefined) return held;
  const host = createEnvironmentHost(chain);
  hostPerChain.set(chain, host);
  return host;
}

/** Source `lIo(chain)` (chunk-sfn1dbxq.js [2423309,2423504)): the environment host for this chain,
 *  reused while it is alive and of the current kind, replaced otherwise. The body is the source's;
 *  what it creates is the product's host rather than the source's `_Ko`/`l6o`. */
export function lIo(chain: ChainRun): ChainEnvironmentHost {
  const kind = environmentHostKind();
  const held = chain.state.environmentHost;
  if (held === undefined || held.died !== undefined || held.kind !== kind) {
    held?.terminate?.();
    const host = environmentHost(chain);
    chain.state.environmentHost = host;
    return host;
  }
  return held;
}

/** Source `dIo(chain)` (chunk-sfn1dbxq.js [2424118,2424242)): the native host, which the plugin
 *  loader uses when the plugin carries a hooks module. Port: the product's host is in process
 *  already, and `Fv` finds no builtin plugin, so this is the same host as `lIo` returns. */
export function dIo(chain: ChainRun): ChainEnvironmentHost {
  const held = chain.state.nativeHost;
  if (held !== undefined && held.died === undefined) return held;
  const host = environmentHost(chain);
  chain.state.nativeHost = host;
  return host;
}

/** The event catalog, and the two predicates over a declared pattern that the record surface uses. */
export const eventCatalog: readonly string[] = J3e;
/** The `xp` copy: the classic hook names the catalog extends. `src/hooks.ts` keeps the product's own
 *  inventory of the same events, and the fixture checks the two agree — a divergence means either a
 *  stale copy or a product event the source's catalog does not carry. */
export const classicHookEvents: readonly string[] = xp;
export { Z$n, Q3e, eEs, Awr, D };

/* ------------------------------------------------- the process identity (host boundary) */

// The four values the `$` session floor answers from when no session is bound. Their source bodies
// read the product's own process state, and each of those callees lives in a chunk this port has
// not carried, so the whole read is bound here as one record:
//
//   chunk-4bw62nzm.js [76686,76729)  43 units  function K(){return h()?.sessionId??n().id}
//   chunk-qr9z1wer.js  [2355,2405)   50 units  function se(){try{return Aon()}catch{return Ee()}}
//   chunk-4bw62nzm.js [79590,79649)  59 units  function Ee(){return h()?.originalCwd??So(n()).originalCwd}
//   chunk-bk5ct2gw.js [357377,357451) 74 units function tt(){let e=Ah();if(e!==void 0&&e!==null)return Dt(e);return Zl()}
//
// What each reaches in the source, read out of the chunks they live in: `h()` is the session the
// runtime binds (its `sessionId`, its `originalCwd`); `n()` the process config record and `So` its
// project; `Aon()` the ambient cwd (`AsyncLocalStorage` store, else `VR()`); `Ah()` the model a
// command asked for, `UIt()` the configured default, `Zl()` `Dt(q_())` the process's own model id.
// The record below carries those four answers, so a rebind replaces all of them the way the
// source's own runtime-bound values would.

/** The process-level answers `K`, `se`, `Ee` and `tt` give: the session id, the cwd, the root the
 *  process started in, and the model a plugin sees when nothing else names one. */
export interface PluginProcessIdentity {
  id: string
  cwd: string
  root: string
  model: string
}

let processIdentity: PluginProcessIdentity = {
  id: '',
  cwd: process.cwd(),
  root: process.cwd(),
  model: '',
};

/** Bind the process identity, and return the unbind. The defaults are the process's own cwd, an
 *  empty id and an empty model — a runtime that wants a plugin to see its session id or model
 *  binds them here. */
export function bindPluginProcessIdentity(identity: Partial<PluginProcessIdentity>): () => void {
  const previous = processIdentity;
  processIdentity = { ...processIdentity, ...identity };
  return () => { processIdentity = previous; };
}

/** Source `K`: the session id. */
export function K(): string { return processIdentity.id; }
/** Source `se`: the cwd a read resolves against. */
export function se(): string { return processIdentity.cwd; }
/** Source `Ee`: the root the process started in. */
export function Ee(): string { return processIdentity.root; }
/** Source `tt`: the model a plugin sees when the session names none. */
export function tt(): string { return processIdentity.model; }
