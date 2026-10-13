/**
 * Kill ring with emacs-style kill/yank/yank-pop.
 *
 * Ported from the recovered interactive editor's ring reducer
 * (`chunk-p7tzn9jv.js` [765,1813), SHA-256 dc80898e501fcfcbf6616c67d08d7be7079a420eacfa008d6e1a01e2b7c3254b,
 * zero-based UTF-16 coordinates). The reducer is a pure function over
 * `{ring, mode}` and needed no host adaptation, so the transition table,
 * the ten-entry cap, and the coalescing rule are carried over verbatim.
 */

/** The recovered ring keeps the ten most recent kills. */
export const KILL_RING_LIMIT = 10;

export type KillDirection = 'prepend' | 'append';
export type KillRingMode =
  | { type: 'idle' }
  | { type: 'killing' }
  | { type: 'yanked'; start: number; length: number; index: number };

export interface KillRingState {
  ring: string[];
  mode: KillRingMode;
}

export type KillRingAction =
  | { type: 'kill'; text: string; direction?: KillDirection }
  | { type: 'yank'; start: number; length: number }
  | { type: 'yankPop' }
  | { type: 'updateYankLength'; length: number }
  | { type: 'interrupt' };

export const emptyKillRing: KillRingState = { ring: [], mode: { type: 'idle' } };

/**
 * Consecutive kills coalesce onto the head of the ring instead of adding an
 * entry; the direction decides which end the new text joins. An empty kill
 * only ends the current coalescing run.
 */
export function reduceKillRing(state: KillRingState, action: KillRingAction): KillRingState {
  switch (action.type) {
    case 'kill': {
      if (action.text.length === 0) {
        return state.mode.type === 'idle' ? state : { ...state, mode: { type: 'idle' } };
      }
      return {
        ring: state.mode.type === 'killing' && state.ring.length > 0
          ? [action.direction === 'prepend' ? action.text + state.ring[0] : state.ring[0] + action.text,
            ...state.ring.slice(1)].slice(0, KILL_RING_LIMIT)
          : [action.text, ...state.ring].slice(0, KILL_RING_LIMIT),
        mode: { type: 'killing' },
      };
    }
    case 'yank':
      return { ...state, mode: { type: 'yanked', start: action.start, length: action.length, index: 0 } };
    case 'yankPop': {
      if (state.mode.type !== 'yanked' || state.ring.length <= 1) return state;
      const index = (state.mode.index + 1) % state.ring.length;
      return { ...state, mode: { ...state.mode, index } };
    }
    case 'updateYankLength':
      if (state.mode.type !== 'yanked') return state;
      return { ...state, mode: { ...state.mode, length: action.length } };
    case 'interrupt':
      if (state.mode.type === 'idle') return state;
      return { ...state, mode: { type: 'idle' } };
  }
}

/** The text a plain yank inserts: the head of the ring. */
export function killRingHead(state: KillRingState): string {
  return state.ring[0] ?? '';
}

/**
 * The replacement a yank-pop would perform, or null when there is nothing to
 * cycle through. `start`/`length` identify the span the previous yank wrote.
 */
export function nextYank(state: KillRingState): { text: string; start: number; length: number } | null {
  if (state.mode.type !== 'yanked' || state.ring.length <= 1) return null;
  const index = (state.mode.index + 1) % state.ring.length;
  return { text: state.ring[index] ?? '', start: state.mode.start, length: state.mode.length };
}

export interface KillRing {
  readonly state: KillRingState;
  dispatch(action: KillRingAction): void;
}

/** Reducer-backed store, matching the recovered `{get state, dispatch}` actor. */
export function createKillRing(initial: KillRingState = emptyKillRing): KillRing {
  let state = initial;
  return {
    get state(): KillRingState { return state; },
    dispatch(action: KillRingAction): void { state = reduceKillRing(state, action); },
  };
}
