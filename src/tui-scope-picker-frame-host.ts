// The scope-picker frame host (W46-01). The copied frame keeps the source layout and keyboard
// logic; the search input hook, the terminal-focus and declare-cursor contexts, the stray-click
// guard and the visual primitives are host seams, because the product's terminal runtime owns
// input editing and element rendering.
import { Ae, le, qt, y, P, w, b, R, Z } from './plugin-chain-react-hooks.js';

export { ke } from './plugin-chain-input-field-source.js';
export { w, b, y, P, Z, R, le } from './plugin-chain-react-hooks.js';

/** Source `Qc`: whether the terminal holds focus. The provider context is the host's. */
export const terminalFocus = qt<{ isTerminalFocused: boolean }>({ isTerminalFocused: true });
export const Qc = (): boolean => Ae(terminalFocus).isTerminalFocused;

/** Source `nt`: whether the list declares the cursor. The host supplies the context value. */
export const declareCursor = qt<boolean>(false);
export const nt = (): boolean => Ae(declareCursor);

/** The visual primitives the frame composes. Each token is resolved by the host renderer:
 *  `z` a chord hint, `Se` an inline row, `es` a permission-colour provider, `rS` the search input,
 *  and `_C` a clickable row. */
export const z = 'KeyHint';
export const Se = 'InlineRow';
export const es = 'PermissionColor';
export const rS = 'SearchInput';
export const _C = 'ClickableRow';

export interface SearchInputOptions {
  isActive: boolean;
  onExit: () => void;
  onCancel: () => void;
  initialQuery: string;
  backspaceExitsOnEmpty: boolean;
}

export interface SearchInputState {
  query: string;
  cursorOffset: number;
  handleKeyDown(event: any): void;
  handlePaste(text: string): void;
}

export type SearchInputHook = (options: SearchInputOptions) => SearchInputState;

let searchInputHook: SearchInputHook | undefined;

/** Install the host's search input hook; the default keeps the query in hook state. */
export function setSearchInputHook(hook: SearchInputHook | undefined): void {
  searchInputHook = hook;
}

/** The key name a source event carries: `key` for browser events, `name` for the terminal's. */
const keyName = (event: any): string => String(event.name ?? event.key ?? '');

function defaultSearchInput(options: SearchInputOptions): SearchInputState {
  const initial = options.initialQuery ?? '';
  const [query, setQuery] = y(initial);
  const [cursorOffset, setCursorOffset] = y(initial.length);
  const handlePaste = le((text: string) => {
    const next = query.slice(0, cursorOffset) + text + query.slice(cursorOffset);
    setQuery(next);
    setCursorOffset(cursorOffset + text.length);
  }, [query, cursorOffset]);
  const handleKeyDown = le((event: any) => {
    const name = keyName(event);
    if (name === 'backspace') {
      if (cursorOffset === 0) {
        if (options.backspaceExitsOnEmpty) options.onCancel?.();
        return;
      }
      const next = query.slice(0, cursorOffset - 1) + query.slice(cursorOffset);
      setQuery(next);
      setCursorOffset(cursorOffset - 1);
      return;
    }
    if (name === 'delete') {
      if (cursorOffset >= query.length) return;
      setQuery(query.slice(0, cursorOffset) + query.slice(cursorOffset + 1));
      return;
    }
    if (name === 'left') { setCursorOffset(Math.max(0, cursorOffset - 1)); return; }
    if (name === 'right') { setCursorOffset(Math.min(query.length, cursorOffset + 1)); return; }
    if (name === 'home') { setCursorOffset(0); return; }
    if (name === 'end') { setCursorOffset(query.length); return; }
    const text = String(event.text ?? (keyName(event).length === 1 ? keyName(event) : ''));
    if (text === '' || event.ctrl || event.meta) return;
    const next = query.slice(0, cursorOffset) + text + query.slice(cursorOffset);
    setQuery(next);
    setCursorOffset(cursorOffset + text.length);
  }, [query, cursorOffset, options.onCancel, options.backspaceExitsOnEmpty]);
  return { query, cursorOffset, handleKeyDown, handlePaste };
}

/** Source `_y`: the search input state. The host provides the hook; the default keeps the query
 *  in hook state with the edit keys the frame does not handle itself. */
export function _y(options: SearchInputOptions): SearchInputState {
  if (searchInputHook !== undefined) return searchInputHook(options);
  return defaultSearchInput(options);
}

/** Source `aS`: the stray-click guard. A click within 300ms of mount or a window activation is
 *  dropped before a row reacts to it. */
export function aS(): (event: any) => boolean {
  const [mountedAt] = y(() => Date.now());
  return le((event: any) => {
    if (event?.isWindowActivation === true || Date.now() - mountedAt < 300) {
      event?.dropAsStray?.();
      return true;
    }
    return false;
  }, [mountedAt]);
}

export { w as memoCache, b as memoCacheSentinel };
