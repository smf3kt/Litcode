// The `ui.render` engine pipeline (`gno`, chunk-n3ykh62m.js [283212,284410), 1,198 units) and the
// closure it reads. The copied bodies live in ./plugin-chain-engine-pipeline-source.ts; this module
// is the typed seam around them and the engine's `RenderAnswerHost` implementation.
//
// `gno` runs one render answer end to end:
//
//   1. raise a tool record (`RFe`), wrap the drawing function as the `core` handler (`Pto`), and
//      dispatch the render argument through the hooks (`aP`), with the `ui.render` site (`Ito`) and
//      the dispatch async store (`ls`);
//   2. when the request is tracked and not aborted, flush what the answer read (`Pb`, `Ai`, `Yf`);
//   3. copy the answer (`ilt`), validate it (`Eur`), and on a problem log, record the refusal
//      (`jss`) and draw the engine's own tree (`Ioe`);
//   4. apply the draw transforms (`nIn`/`dno`), the link pass (`kur`) and the code-row measure
//      (`vur`), then hand the drawn tree and its record to the renderer (`FM`) and the descriptor
//      tables (`bVe`, `Lur`).
//
// The site registration in ./plugin-chain-engine-render-site.ts runs as this module's first import,
// so `Ito` is bound before `gno` can be reached, the way the source's literal `zd` table exists
// before any module body reads it.
import {
  gno, Pto, HD, Mf, M_, AAt, Ito, Pb, jss, Gf, ki, I_, Xf, uno,
} from './plugin-chain-engine-pipeline-source.js';
import { ilt } from './plugin-chain-engine-render-site.js';
import { setRenderAnswerHost } from './plugin-chain-terminal-host.js';
import type { RenderAnswerHost } from './plugin-chain-terminal-host.js';
import { it } from './plugin-chain-host.js';

/** One `ui.render` argument: the component, its tracking id, its surface and props. */
export interface EngineRenderInput {
  component: string;
  requestId: string;
  surface: string;
  props: Record<string, unknown>;
  [key: string]: unknown;
}

/** What the render client passes with an argument (`che({signal, origin})`). */
export interface EngineRenderOptions {
  signal?: AbortSignal;
  origin?: unknown;
}

/** Source `gno`: draw one render answer through the hooks chain and the engine's own passes. */
export async function runEnginePipeline(
  input: EngineRenderInput,
  options: EngineRenderOptions = {},
): Promise<unknown> {
  const signal = options.signal ?? new AbortController().signal;
  return gno({ input, signal, origin: options.origin }) as Promise<unknown>;
}

/** The engine render service the terminal glue's `che`/`dce` call into. */
export const engineRenderHost: RenderAnswerHost = {
  uiRender: (input, options) => runEnginePipeline(input as EngineRenderInput, options),
};

/** Install `gno` as the render answer host; the module body does this as it evaluates. */
export function installEnginePipelineHost(): void {
  setRenderAnswerHost(engineRenderHost);
}

setRenderAnswerHost(engineRenderHost);

/** The `core` handler `gno` dispatches: it keeps the drawn tree and answers `{type:'engine'}`. */
export interface CoreHandler {
  name: 'core';
  isCore: true;
  budgetMs: 0;
  run: (input: unknown) => Promise<{ type: 'engine'; ref: unknown }>;
}

/** Source `Pto`: the engine's own answer, wrapped as the chain's core handler. */
export function coreHandler(
  host: { keep: (value: unknown, made: undefined) => unknown },
  draw: (input: unknown) => unknown,
): CoreHandler {
  return Pto(host, draw) as CoreHandler;
}

/** One drawing instance as `gno` builds it (`HD`). */
export interface DrawingInstance {
  instanceKey: unknown;
  instance: { surface?: string; component: string; requestId: string };
  pluginsOf: () => unknown;
  isInFlight: boolean;
  versionsRead: Map<unknown, unknown>;
}

/** Source `HD`: the instance `Pb` flushes readers for, and `FM` keys the drawn tree by. */
export function drawingInstance(
  instanceKey: unknown,
  input: Pick<EngineRenderInput, 'surface' | 'component' | 'requestId'>,
  pluginsOf: () => unknown,
): DrawingInstance {
  return HD(instanceKey, input, pluginsOf) as DrawingInstance;
}

/** Source `Mf`: a dispatch lifecycle over the given fields, not yet ended. */
export function dispatchLifecycle<T extends object>(extra: T = {} as T): T & { isEnded: boolean } {
  return Mf(extra) as T & { isEnded: boolean };
}

/** Source `ki`: the row-metrics key of one client component. */
export function clientRowKey(client: { plugin: string; key: string }): string {
  return ki(client) as string;
}

/** Source `uno`: the sentence recorded when a hook tree is refused. */
export function invalidTreeText(component: string, problem: string): string {
  return uno(component, problem) as string;
}

/** Source `ilt`: copy the dispatch answer (well-formed strings, shared references kept). */
export function unwrapDispatchAnswer(value: unknown): unknown {
  return ilt(value);
}

/** Source `Gf`: drop these instances' render-version reads from the registry store. */
export function forgetVersionReads(instances: readonly string[]): void {
  Gf(instances);
}

/** One row-metrics store as `M_` builds it. */
export interface RowMetrics {
  clientRows(client: { requestId: string; plugin: string; key: string }): number;
  recordOwn(requestId: string, rows: number): void;
  fits(client: { requestId: string; plugin: string; key: string }, rows: number): boolean;
  recordClient(client: { requestId: string; plugin: string; key: string }, rows: number): void;
  dropClient(client: { requestId: string; plugin: string; key: string }): void;
  onFreed(listener: (requestId: string) => void): () => void;
  clear(): void;
}

/** Source `M_`: the per-request row ledger (own rows plus each client's), closing at `kFe`. */
export function createRowMetrics(): RowMetrics {
  return M_() as RowMetrics;
}

/** The row ledger `gno` records the dialog's measured rows in. */
export const rowMetrics = AAt as RowMetrics;

/** Source `I_`: the request entries the row ledger keeps before dropping the oldest. */
export const REQUEST_ENTRY_LIMIT: number = I_;

/** Source `Xf`: the instance readers one render store keeps. */
export const READER_LIMIT: number = Xf;

/** The `ui.render` site `gno` dispatches against (`Ito`), bound when this module evaluated. */
export const RENDER_SITE: unknown = Ito;

/** Re-exported for callers that need the registry store the pipeline's flush writes. */
export { it as chainRegistry };
