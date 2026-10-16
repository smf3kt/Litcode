// The `$` call table's session read floor (W45-44): the entries a plugin reads its process's
// session through, and the drawing-surface registry behind two of them. The copied bodies live in
// ./plugin-chain-session-source.ts; this module is the host seam around them.
//
// Source: the entries of the plugin-method table `Iqo(state)` (chunk-sfn1dbxq.js, its literal
// opened by `var Iqo=(e)=>szt({…})` at [2346570,…)), taken verbatim, chunk-sfn1dbxq.js:
//
//   "session.cwd":{run:(n,r)=>Bpe(r.plugin,r.cwd).then((s)=>s.cwd)}     [2347677,2347740)  63 units
//   "session.root":{run:(n,r)=>Bpe(r.plugin).then((s)=>s.root)}         [2347741,2347800)  59 units
//   "session.model":{run:(n,r)=>Bpe(r.plugin).then((s)=>s.model)}       [2347801,2347862)  61 units
//   "session.turns":{run:(n,r)=>WAo(r.plugin)}                          [2347863,2347905)  42 units
//   "session.id":{run:(n,r)=>Bpe(r.plugin).then((s)=>s.id)}             [2347906,2347961)  55 units
//   "session.surface":{run:(n,r)=>uMo(r.plugin)}                        [2348063,2348107)  44 units
//   "session.surfaces":{run:(n,r)=>cMo(r.plugin)}                       [2348108,2348153)  45 units
//
// The entries could not be copied as a block: the generator emits each block as a top-level
// statement and `"session.cwd":{…}` is a table fragment, not one. Their bodies are ported here
// verbatim as the arrows above, with the keys the source gives them.
//
// What the ported bodies do, all measured from the source:
//  · `Bpe` is the session record every identity read goes through: `bI()` is the session this
//    process bound (W45-24's slot), and the record it returns is `{id: String(K()), cwd: cwd ??
//    se(), root: Ee(), model: bound?.model() ?? tt()}`. Three of the four come from the process
//    even when a session is bound — only `model` asks the session first — and with none bound it
//    logs `$.session (${plugin}): no session bound; id, cwd and model answered from the process`.
//    The entry's own `.then` is the source's: `Bpe` is an `async function`, so it answers a promise.
//  · `WAo` counts the session's own user turns: `messages()`, kept when `type === "user"`, not
//    `isMeta`, not `isVirtual`, and `T9n(content)` — not tool results. With no session bound it
//    logs `$.session.turns (${plugin}): no session bound; 0` and answers 0.
//  · `Xte` is the surface list: the attached drawing surfaces, with `"terminal"` first when the
//    bound session's own `surface` is `"terminal"`. It is what both `session.surface` and
//    `session.surfaces` read, and it is why a headless process answers `[]`/`null`.
//  · `uMo` is the first of those, or `null`, and `cMo` is all of them — each logging its own
//    `$.session.surface(s)` line when the list is empty.
//  · `F` (chunk-3qabb19b.js [673,732)) is the count `WAo` folds its predicate with; `T9n`
//    (chunk-sfn1dbxq.js [492112,492181)) is the tool-results test, which is true only for a
//    non-string content list holding a `tool_result`.
//  · `ie` (chunk-tvdq3hrk.js [2085,2727)) is the drawing registry behind `Xte`: a map of clients
//    by id, the ones that missed a frame, and the sources-change signal `Oe` a detach reports on.
//    `gE` is the one instance every surface read goes through.
//
// What this package does not bind: the rest of the session entries. `session.messages` (`PAo`, 387
// units) reaches the conversation store, `session.repo` (`MAo`, 170 units) the git work tree,
// `session.authorize` is `oJt`'s one-line `rAo(plugin)`, and `session.compact`/`session.send`/
// `session.append`/`session.usage` write through the turn machinery. Each is its own package.
import { DT, bI } from './plugin-chain-loader-source.js';
import type { PluginUiSession } from './plugin-chain-ui.js';
import { raiseHostCall, type HostCallBottom, type HostCallCaller } from './plugin-chain-host-call.js';
import { Bpe as bpeCopy, F, T9n, WAo, Xte, cMo, gE, uMo } from './plugin-chain-session-source.js';

/** The record `Bpe` answers: the four identity reads the cwd/root/model/id entries take one each. */
export interface PluginSessionIdentity { id: string; cwd: string; root: string; model: string }

/** `Bpe` at the arity the source calls it with: its second argument is the caller's own cwd and is
 *  optional there (`Bpe(r.plugin)`, `Bpe(r.plugin, r.cwd)`), while the copied body, in a
 *  `@ts-nocheck` file, makes every parameter read as required. */
const Bpe: (plugin: string, cwd?: string) => Promise<PluginSessionIdentity> =
  bpeCopy as unknown as (plugin: string, cwd?: string) => Promise<PluginSessionIdentity>;

/** One message as `WAo` reads it: the role, the two flags that mark a message the session made for
 *  itself rather than a person's turn, and the content `T9n` inspects. */
export interface PluginSessionMessage {
  type: string;
  isMeta?: boolean;
  isVirtual?: boolean;
  message: { content: unknown };
}

/** What the floor reads off the bound session: the model it names, its messages, and — for `Xte` —
 *  the surface it draws to. The source's `bI()` is one record carrying every surface, so a host
 *  that binds a session for the ui writes can bind these on the same object. */
export interface PluginSessionReads {
  model(): string;
  messages(): readonly PluginSessionMessage[];
  /** `"terminal"` when this process draws to a terminal, which puts it first in `Xte`'s list. */
  surface?: string;
}

/** The bound session as the whole `$` surface sees it: W45-24's ui writes plus these reads. */
export type PluginSessionRecord = PluginUiSession & PluginSessionReads;

/** One table entry as `Hze` reads it. None of the session entries has a `check`: their arguments
 *  are read by the floor itself (an optional cwd), so a refusal can only come from a handler. */
export type SessionCallEntry = HostCallBottom;

/** The session names this package's table slice holds. */
export type SessionCallEvent =
  | 'session.cwd' | 'session.root' | 'session.model' | 'session.id'
  | 'session.turns' | 'session.surface' | 'session.surfaces';

/** The table slice, ported verbatim from the source's literal above. */
export function sessionCallTable(): Record<SessionCallEvent, SessionCallEntry> {
  return {
    'session.cwd': { run: (n: any, r: any) => Bpe(r.plugin, r.cwd).then((s: any) => s.cwd) },
    'session.root': { run: (n: any, r: any) => Bpe(r.plugin).then((s: any) => s.root) },
    'session.model': { run: (n: any, r: any) => Bpe(r.plugin).then((s: any) => s.model) },
    'session.turns': { run: (n: any, r: any) => WAo(r.plugin) },
    'session.id': { run: (n: any, r: any) => Bpe(r.plugin).then((s: any) => s.id) },
    'session.surface': { run: (n: any, r: any) => uMo(r.plugin) },
    'session.surfaces': { run: (n: any, r: any) => cMo(r.plugin) },
  };
}

/** Raise one `$` session call the way the plugin-method dispatcher does: the table entry for the
 *  name is the chain's floor, so a plugin's hooks may answer first and `next()` reaches the floor. */
export async function raiseSessionCall(request: {
  event: SessionCallEvent;
  args: unknown;
  caller: HostCallCaller;
  raise?: unknown;
}): Promise<unknown> {
  return raiseHostCall({
    event: request.event,
    args: request.args,
    caller: request.caller,
    bottom: sessionCallTable()[request.event],
    raise: request.raise,
  });
}

/** Bind a session record that carries the ui writes and these reads, and return the unbind. The
 *  slot is `bI`'s own single binding (W45-24), so a rebind replaces the previous record and the
 *  unbind clears only the one it was bound with. */
export function bindPluginSessionRecord(record: PluginSessionRecord): () => void {
  DT.bind(record);
  return () => DT.release(record);
}

/** Source `Bpe`: the session record a plugin reads. `cwd` is the caller's own when it passed one. */
export async function sessionRecord(plugin: string, cwd?: string): Promise<PluginSessionIdentity> {
  return Bpe(plugin, cwd);
}

/** Source `WAo`: how many of the session's messages are a person's turns. */
export async function sessionUserTurns(plugin: string): Promise<number> {
  return WAo(plugin);
}

/** Source `F`: the number of members a predicate answers for. */
export function countMatching<T>(list: readonly T[], predicate: (item: T) => unknown): number {
  return F(list, predicate);
}

/** Source `T9n`: whether message content is tool results rather than something a person said. */
export function contentIsToolResults(content: unknown): boolean {
  return T9n(content);
}

/** Source `Xte`: the drawing surfaces this process has — the terminal first when the bound session
 *  draws to one. */
export function drawingSurfaces(): string[] {
  return Xte();
}

/* ------------------------------------------------------------ the drawing registry (`ie`) */

/** One client attached to a drawing surface, as the registry keeps it: the id it attached with, the
 *  surface it draws to, and the viewport and answers a later `attach` with the same id merges. */
export interface PluginDrawingClient {
  clientId: string;
  surface: string;
  viewport?: Record<string, unknown>;
  answers?: unknown;
}

/** Source `ie().attach`: add a client, or merge a later attach's viewport and answers into the one
 *  already there. Answers whether the client is new — `true` for a fresh id, `false` for a merge and
 *  for an attach carrying neither. */
export function attachPluginDrawingClient(client: PluginDrawingClient): boolean {
  return gE.attach(client);
}

/** Source `ie().detach`: drop a client, report the detach on the sources-change signal, and answer
 *  the client that was dropped (or `undefined` when the id was not attached). */
export function detachPluginDrawingClient(clientId: string): PluginDrawingClient | undefined {
  return gE.detach(clientId);
}

/** Source `ie().list`: every attached client. */
export function pluginDrawingClients(): readonly PluginDrawingClient[] {
  return gE.list();
}

/** Source `ie().surfaces` through `gE`: the distinct surface names, in attachment order. */
export function pluginDrawingSurfaceNames(): string[] {
  return gE.surfaces();
}

/** Source `ie().hasSurface`: whether any attached client draws to this surface. */
export function hasPluginDrawingSurface(surface: string): boolean {
  return gE.hasSurface(surface);
}

/** Source `ie().onDetach`: report every detach, and return the unbind. */
export function onPluginDrawingDetach(listener: (clientId: string) => void): () => void {
  return gE.onDetach(listener);
}

/** Source `ie().missed`: mark that a client missed a frame it should have drawn. */
export function markPluginDrawingMissed(clientId: string): void {
  gE.missed(clientId);
}

/** Source `ie().heard`: clear that mark, because the client answered. */
export function markPluginDrawingHeard(clientId: string): void {
  gE.heard(clientId);
}

/** Source `ie().isSilent`: whether the client has a missed frame it has not answered. */
export function isPluginDrawingSilent(clientId: string): boolean {
  return gE.isSilent(clientId);
}
