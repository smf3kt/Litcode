// The AbovePrompt select keyboard and its field/select hooks (W150). Copied bodies live in
// ./plugin-chain-above-prompt-select-keys-source.ts:
//
//   - chunk-tvdq3hrk.js [6302,6379) 77 units — `fpr`, the control-character pattern; [6379,6403)
//     24 units — `QT`, its test;
//   - chunk-24k7d6mw.js [450586,450686) 100 units — `k0`, isTypedText;
//     [451414,451598) 184 units — `C0`, the per-site field store hook;
//     [451598,452484) 886 units — `nK`, the input-field hook;
//     [452484,452663) 179 units — `rK`, isFieldOwnKey; [452663,452750) 87 units — `sK`, isFieldText;
//     [452750,453585) 835 units — `lK`, the pre-dispatch handler for keys ahead of the render;
//     [453782,453812) 30 units — `Ene`, optionText; [453812,453946) 134 units — `Nne`, the select
//     key handlers; [453950,456049) 2,099 units — `uK`, the select-field hook;
//   - chunk-kjfwbh4w.js [45639,45712) 73 units — `kNo`, selectFromTerminal;
//   - chunk-sfn1dbxq.js [2336077,2336117) 40 units — `Ihe`, focusableAt;
//   - chunk-yygmb66g.js [23446,23642) 196 units — `fd`, the controlled-state hook; [23642,23686)
//     44 units — `kd`; [23686,23730) 44 units — `Md`, the function tests `fd` reads.
//
// Total 16 blocks, 5,032 UTF-16 units. The public names are the AbovePrompt module's export table.
import {
  C0,
  nK,
  rK,
  sK,
  lK,
  Ene,
  Nne,
  uK,
  kNo,
  Ihe,
  fd,
  k0,
} from './plugin-chain-above-prompt-select-keys-source.js';
import type { SiteFields, StoreSlot } from './plugin-chain-above-prompt-select.js';
import type { FocusableSeat } from './plugin-chain-above-prompt-seats.js';

/** The modifier flags a key event carries. */
export interface KeyMods {
  ctrl?: boolean;
  meta?: boolean;
  super?: boolean;
  shift?: boolean;
  alt?: boolean;
  tab?: boolean;
  return?: boolean;
  escape?: boolean;
  backspace?: boolean;
  delete?: boolean;
  leftArrow?: boolean;
  rightArrow?: boolean;
  home?: boolean;
  end?: boolean;
  pageUp?: boolean;
  pageDown?: boolean;
  wheelUp?: boolean;
  wheelDown?: boolean;
  [key: string]: unknown;
}

/** A state setter that takes a value or an updater, as the hook surface's `y` returns. */
export type StateSetter<V> = (next: V | ((previous: V) => V)) => void;

/** Source `C0`: the per-site field store for one component/request, with its setter. */
export function useSiteFields<V>(
  store: StoreSlot<SiteFields<V>>,
  component: string,
  requestId: string,
): [Map<string, V>, StateSetter<Map<string, V>>] {
  return C0(store, component, requestId) as [Map<string, V>, StateSetter<Map<string, V>>];
}

/** The element a field edit or submit names. */
export interface InputTarget {
  plugin: string;
  handle: string;
  element: string;
}

/** The element a field's current text is read for. */
export interface InputValueTarget {
  plugin: string;
  element: string;
  value?: string;
}

/** What `nK`'s `fields` cell holds. */
export interface InputFieldHandlers {
  textOf(plugin: string, handle: string): string | undefined;
  edit(target: InputTarget, value: string): void;
}

/** The input-field hook's result. */
export interface InputFields {
  fields: InputFieldHandlers;
  textNow(target: InputValueTarget): string;
  submit(target: InputTarget & { value?: string }): void;
}

/** Source `nK`: the input-field hook; edits dispatch `ui.input` with kind `change`, submits with
 *  `submit` and clear the field only when the dispatch did not answer. */
export function useInputFields(
  seats: readonly FocusableSeat[],
  component: string,
  requestId: string,
): InputFields {
  return nK(seats, component, requestId) as InputFields;
}

/** A keybinding resolution. */
export interface KeyResolution {
  type: string;
  action?: string;
}

/** The keybinding service `Lc` reads from context. */
export interface KeybindingServiceLike {
  resolve(key: string, mods: KeyMods, contexts: readonly string[]): KeyResolution;
  registerPreDispatch(entry: {
    handler: (key: string, mods: KeyMods, context: string) => boolean | void;
  }): () => void;
}

/** What `lK` reads from its caller. */
export interface KeysAheadInput {
  contextNow(): string | null;
  isAhead(): boolean;
  handlers: Record<string, Record<string, (() => void) | undefined>>;
  focusedNow(): FocusableSeat | null;
  selectKeys(key: string, mods: KeyMods): boolean;
  inputs: InputFields;
  contextRendered(): string | null;
  focusedRendered(): FocusableSeat | null;
}

/** Source `lK`: register a pre-dispatch handler for keys that arrive before the render. */
export function useKeysAheadOfRender(input: KeysAheadInput): void {
  lK(input);
}

/** The select's open state inside `uK`'s fields cell. */
export interface SelectOpenState {
  plugin: string;
  handle: string;
  highlight: number;
}

/** What `uK`'s `fields` cell holds. */
export interface SelectFieldsCell {
  pickedOf(plugin: string, element: string): unknown;
  open: SelectOpenState | null;
}

/** The select key bindings `Nne` builds. */
export interface SelectKeyHandlers {
  'abovePrompt:highlightNext': () => void;
  'abovePrompt:highlightPrevious': () => void;
  'abovePrompt:press': () => void;
}

/** The select-field hook's result. */
export interface SelectFields {
  fields: SelectFieldsCell;
  handlers: SelectKeyHandlers;
  intercept(key: string, mods: KeyMods): boolean;
}

/** What `uK` reads from its caller. */
export interface SelectFieldsInput {
  focusables: readonly FocusableSeat[];
  focusIndex: number | null;
  focusIndexNow(): number | null;
  setFocusIndex(update: () => number | null): void;
  working: boolean;
  component: string;
  requestId: string;
}

/** Source `uK`: the select-field hook (open state, highlight movement, press, typed-ahead match). */
export function useSelectFields(input: SelectFieldsInput): SelectFields {
  return uK(input) as SelectFields;
}

/** Source `kNo`: dispatch a ui.select for the held element on the terminal surface, quietly. */
export function selectFromTerminal(request: {
  plugin: string;
  [key: string]: unknown;
}): Promise<void> {
  return kNo(request) as Promise<void>;
}

/** Source `Ihe`: the focusable at an index, or null for a null index or a miss. */
export function focusableAt<T>(list: readonly T[], index: number | null): T | null {
  return Ihe(list, index) as T | null;
}

/** Source `rK`: whether a key belongs to the field itself (movement, delete, named chords). */
export function isFieldOwnKey(key: string, mods: KeyMods): boolean {
  return rK(key, mods) as boolean;
}

/** Source `sK`: whether a key is text a field should take. */
export function isFieldText(key: string, mods: KeyMods): boolean {
  return sK(key, mods) as boolean;
}

/** Source `k0`: whether a key is typed text (no modifiers, one printable run). */
export function isTypedText(key: string, mods: KeyMods): boolean {
  return k0(key, mods) as boolean;
}

/** Source `Ene`: an option's label, else its value. */
export function optionText(option: { label?: string; value: string }): string {
  return Ene(option) as string;
}

/** Source `Nne`: the select key handlers over a mover and a presser. */
export function selectKeyHandlers(input: {
  move: (delta: number) => void;
  press: () => void;
}): SelectKeyHandlers {
  return Nne(input) as SelectKeyHandlers;
}

/** Source `fd`: state seeded once from a value or initializer, with a setter and a getter. */
export function useControlledState<T>(
  initial: T | (() => T),
): [T, StateSetter<T>, () => T] {
  return fd(initial) as [T, StateSetter<T>, () => T];
}
