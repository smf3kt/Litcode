// The AbovePrompt local state seam (W152): the pieces of the pane that read the session draft,
// the viewed agent, the settled draw budget and the key press table. Copied bodies live in
// ./plugin-chain-above-prompt-local-source.ts:
//
//   - chunk-24k7d6mw.js [299367,299397) 30 units — `vp`, the per-session draft store hook;
//   - [299493,299598) 105 units — `IV`, the draft text with the long-input marker;
//   - [299468,299493) 25 units — `KCt`, the long-input marker;
//   - [447122,447223) 101 units — `AFe`, the viewed agent id selector;
//   - [447223,447294) 71 units — `q1`, its memoized `{agentId}` projection;
//   - [450435,450470) 35 units — `Z1`, the settled-budget store;
//   - [450686,450848) 162 units — `Pne`, the press table lookup;
//   - [450848,450963) 115 units — `tK`, the press table pre-dispatch registration;
//   - [453589,453644) 55 units — `cK`, release when the hold index reaches the offset;
//   - [453648,453782) 134 units — `Ine`, release when the draft text changes;
//   - chunk-sxm1dh4y.js [709,865) 156 units — `p`, the draft store's initial state;
//   - [865,887) 22 units — `a`, the session-keyed draft store registry;
//   - [887,917) 30 units — `oI`, the registry lookup;
//   - chunk-4bw62nzm.js [56759,56979) 220 units — `lt`, the weak-keyed store registry;
//   - chunk-sfn1dbxq.js [1699480,1699936) 456 units — `Att`, the agent task summary.
//
// Total 15 blocks, 1,717 UTF-16 units. Imports are the hook surface, the source helpers `Ge`/`bs`,
// the pre-dispatch client, the press dispatcher, the session and app-state seams, the store
// factory `gs`, and the typed-text classifier `k0` from W150.
import {
  vp,
  IV,
  q1,
  tK,
  cK,
  Ine,
  Z1,
  oI,
  KCt,
  Pne,
  AFe,
  Att,
} from './plugin-chain-above-prompt-local-source.js';

/** The draft state `p()` initializes and the pane mutates. */
export interface DraftState {
  value: string;
  active: boolean;
  launchWarning: unknown;
  linkSuppliedTexts: Set<unknown>;
  submittedLinkPrefill: unknown;
  vimMode: string;
  stash: unknown;
  cameBack: boolean;
}

/** The store shape `gs` builds. */
export interface DraftStore {
  getSnapshot(): DraftState;
  getState(): DraftState;
  setState(next: DraftState | ((previous: DraftState) => DraftState)): void;
  subscribe(onChange: () => void): () => void;
}

/** Modifier flags the press table reads. */
export interface KeyMods {
  ctrl?: boolean;
  meta?: boolean;
  super?: boolean;
  escape?: boolean;
  tab?: boolean;
  return?: boolean;
  [key: string]: unknown;
}

/** Source `vp`: the draft store of the current session's project. */
export function useSessionDraftStore(): DraftStore {
  return vp() as DraftStore;
}

/** Source `oI`: the draft store of an explicit session/project object (the hook calls this with
 *  `useSession()`). Stores are keyed by `root` and created on first use. */
export function sessionDraftOf(session: unknown): DraftStore {
  return oI(session) as DraftStore;
}

/** Source `IV`: the draft text, or the long-input marker once it exceeds one character. */
export function useLongerInputValue(): string {
  return IV() as string;
}

/** Source `KCt`: the long-input marker. */
export const LONGER_INPUT_MARKER = KCt as string;

/** Source `AFe`: the agent id of the task the host is viewing. */
export function viewedAgentTaskId(state: unknown): string | undefined {
  return AFe(state) as string | undefined;
}

/** Source `q1`: `{}` or `{agentId}` for the viewed task, memoized by the id. */
export function useViewedAgentId(): { agentId?: string } {
  return q1() as { agentId?: string };
}

/** Source `Z1`: the settled-budget store; `set` clears it to undefined. */
export const settledBudgetStore = Z1 as { set(value?: unknown): void; get(): unknown };

/** Source `Pne`: the handlers bound to a text press, or `[]` when any character is unbound. */
export function hotkeyPresses(
  text: string,
  mods: KeyMods,
  bindings: Map<string, unknown>,
): unknown[] {
  return Pne(text, mods, bindings) as unknown[];
}

/** Source `tK`: register the press table as a pre-dispatch handler while active. */
export function useHotkeyPresses(bindings: Map<string, unknown>, isActive: boolean): void {
  tK(bindings, isActive);
}

/** Source `cK`: release the hold once the focused index reaches the content offset. */
export function useReleaseGoneHold(
  index: number | null,
  maxOffset: number,
  release: () => void,
): void {
  cK(index, maxOffset, release);
}

/** Source `Ine`: release when the draft text changes away from its first observed value. */
export function useReleaseOnEdit(
  store: Pick<DraftStore, 'getState' | 'subscribe'>,
  key: string | null,
  release: () => void,
): void {
  Ine(store, key, release);
}

/** The summary `Att` builds from an agent task. */
export interface AgentTaskSummary {
  id: string;
  teammateId?: string;
  description?: unknown;
  type?: string;
  parentId?: string;
  name?: string;
}

/** Source `Att`: normalize a local agent or in-process teammate task. */
export function agentTaskSummary(task: unknown): AgentTaskSummary | undefined {
  return Att(task) as AgentTaskSummary | undefined;
}
