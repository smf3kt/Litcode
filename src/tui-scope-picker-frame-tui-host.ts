// @ts-nocheck
// The scope-picker frame host for the product TUI runtime (W46-02). The frame body is the same
// copied source as W46-01; this seam binds it to the document renderer's hooks and elements.
import { Ae, le, qt, y, Z } from './tui-react-runtime.js';
import { jsx as e, jsxs as r } from './tui-jsx.js';
import { s as BaseBox, n as BaseText } from './tui-base-components.js';

/** The document tree has no focus manager, so host elements drop interaction props; the picker
 *  routes keys and clicks itself. */
const focusProps = new Set(['autoFocus', 'tabIndex', 'onClick', 'onHoverChange', 'onMouseLeave', 'onWheel',
  'onKeyDown', 'onPaste', 'onKeyUp', 'onFocus', 'onBlur']);
const layout = (props: any): any => {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props ?? {})) if (!focusProps.has(key)) out[key] = value;
  return out;
};
export const s = (props: any): unknown => e(BaseBox, layout(props));
export const n = (props: any): unknown => e(BaseText, layout(props));

/** The compiler's memo-cache sentinel and cache. The document runtime has no compiler runtime, so
 *  one hook slot per `w` call keeps the array across renders; the copied bodies mutate it in place. */
export const b = Symbol.for('react.memo_cache_sentinel');
export function w(size: number): unknown[] {
  return Z(() => new Array(size).fill(b), []);
}

/** The terminal size the frame reads. The picker supplies it before each host render. */
let frameSize = { columns: 80, rows: 24 };
export function setFrameSize(size: { columns: number; rows: number }): void { frameSize = size; }
export const ke = (): { columns: number; rows: number } => frameSize;

/** Source `Qc`: the picker is focused while its overlay is up. */
export const terminalFocus = qt<{ isTerminalFocused: boolean }>({ isTerminalFocused: true });
export const Qc = (): boolean => Ae(terminalFocus).isTerminalFocused;

/** Source `nt`: whether the list declares the cursor. The host sets it when the overlay owns it. */
export const declareCursor = qt<boolean>(false);
export const nt = (): boolean => Ae(declareCursor);

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
export function setSearchInputHook(hook: SearchInputHook | undefined): void { searchInputHook = hook; }

const keyName = (event: any): string => String(event.name ?? event.key ?? '');
function defaultSearchInput(options: SearchInputOptions): SearchInputState {
  const initial = options.initialQuery ?? '';
  const [query, setQuery] = y(initial);
  const [cursorOffset, setCursorOffset] = y(initial.length);
  const handlePaste = le((text: string) => {
    const next = query.slice(0, cursorOffset) + text + query.slice(cursorOffset);
    setQuery(next); setCursorOffset(cursorOffset + text.length);
  }, [query, cursorOffset]);
  const handleKeyDown = le((event: any) => {
    const name = keyName(event);
    if (name === 'backspace') {
      if (cursorOffset === 0) { if (options.backspaceExitsOnEmpty) options.onCancel?.(); return; }
      setQuery(query.slice(0, cursorOffset - 1) + query.slice(cursorOffset));
      setCursorOffset(cursorOffset - 1); return;
    }
    if (name === 'delete') {
      if (cursorOffset >= query.length) return;
      setQuery(query.slice(0, cursorOffset) + query.slice(cursorOffset + 1)); return;
    }
    if (name === 'left') { setCursorOffset(Math.max(0, cursorOffset - 1)); return; }
    if (name === 'right') { setCursorOffset(Math.min(query.length, cursorOffset + 1)); return; }
    if (name === 'home') { setCursorOffset(0); return; }
    if (name === 'end') { setCursorOffset(query.length); return; }
    const text = String(event.text ?? (name.length === 1 ? name : ''));
    if (text === '' || event.ctrl || event.meta) return;
    setQuery(query.slice(0, cursorOffset) + text + query.slice(cursorOffset));
    setCursorOffset(cursorOffset + text.length);
  }, [query, cursorOffset, options.onCancel, options.backspaceExitsOnEmpty]);
  return { query, cursorOffset, handleKeyDown, handlePaste };
}

export function _y(options: SearchInputOptions): SearchInputState {
  if (searchInputHook !== undefined) return searchInputHook(options);
  return defaultSearchInput(options);
}

/** Source `aS`: a click within 300ms of mount or a window activation is dropped. */
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

/** The visual primitives, drawn with the document renderer's Box and Text. */
export const es = (props: any): unknown => props?.children ?? null;
export const Se = (props: any): unknown => e(n, { children: props?.children });
export const z = (props: any): unknown => {
  const raw = Array.isArray(props?.chord) ? props.chord.join('/') : String(props?.chord ?? '');
  // The hint row shares one Text line; a narrow picker clips it, so movement keeps its glyph and
  // drops the repeated action word.
  if (raw === 'up/down') return r(n, { dimColor: true, children: ['↕ '] });
  const chord = raw === 'enter' ? 'Enter' : raw === 'escape' ? 'Esc' : raw === 'tab' ? 'Tab'
    : raw === 'ctrl+s' ? 'Ctrl+S' : raw;
  return r(n, { dimColor: true, children: [chord, ' ', String(props?.action ?? ''), ' '] });
};
/** The frame's search field is the only element that carries its key handler. The host captures the
 *  handler during render so the picker can drive movement without a focus manager; the frame keeps
 *  owning query, focus and window state. */
let frameKeyDown: ((event: any) => void) | undefined;
export function dispatchFrameKey(event: any): boolean {
  if (frameKeyDown === undefined) return false;
  frameKeyDown(event);
  return true;
}
export const rS = (props: any): unknown => {
  if (typeof props?.onKeyDown === 'function') frameKeyDown = props.onKeyDown;
  return e(n, {
    color: props?.isFocused ? 'suggestion' : undefined,
    children: props?.query ? String(props.query) : String(props?.placeholder ?? ''),
  });
};
export const _C = (props: any): unknown => e(s, {
  flexDirection: 'row',
  children: [
    e(n, { children: props?.isFocused ? '>' : ' ' }),
    props?.showScrollUp ? e(n, { dimColor: true, children: '^ ' }) : null,
    props?.children,
    props?.showScrollDown ? e(n, { dimColor: true, children: ' v' }) : null,
  ],
});
