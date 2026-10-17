// The React layer's host seam (W45-72). This build carries no React runtime, so the site components'
// hook calls are served here: element creation (`Tc`/`s`/`n`), the hooks (`y`/`Z`/`R`/`en`/`Ae`), the
// context token (`qt`), and the two ink node helpers `_o` calls (`tI`/`ZFt`).
//
// A component is run by `runComponent`: fresh hook slots, one render, the element tree committed
// (which is what binds a `ref` to its node), then the queued effects; `unmount` runs their cleanups in
// reverse. The source bodies live in ./plugin-chain-react-surface-source.ts and import this file, so
// nothing here may import that one.
//
// The two node helpers are ported, not copied: they are declarators inside a large `var` statement in
// chunk-06azbynj.js, so no statement range holds them alone. The source text is quoted above each.

/** Source `qt` (React.createContext): the context token the focus/request value travels in. */
/** Source `qt` (chunk-kexg5hxg.js, `qt=function(e){return e={$$typeof:Pt,_currentValue:e,…,
 *  Provider:null,…},e.Provider=e,e.Consumer={…},e}`): a context is its own provider, so copied
 *  bodies that write `X.Provider` build the same element the source does. The runner resolves a
 *  context's value from the render's `contexts` map; a provider element in the tree is structural. */
export interface SurfaceContext<T> {
  readonly defaultValue: T;
  readonly Provider: SurfaceContext<T>;
}
export function qt<T>(defaultValue: T): SurfaceContext<T> {
  const context = { defaultValue } as { defaultValue: T; Provider: SurfaceContext<T> };
  context.Provider = context as SurfaceContext<T>;
  return context;
}

/** Source `s` and `n`: the Box and Text element kinds, kept as tokens the host renderer paints. */
export const s = 'Box';
export const n = 'Text';

/** Source `X` (chunk-d5st5fww.js) and `Zc` (chunk-kexg5hxg.js): `Symbol.for("react.fragment")`,
 *  the transparent group a component returns around sibling children. */
export const fragment = Symbol.for('react.fragment');

/** Source `bn` (chunk-txt1tvjz.js): `Symbol.for("react.early_return_sentinel")`, the marker a
 *  component uses to distinguish "memo is empty" from the value it computed. */
export const earlyReturn = Symbol.for('react.early_return_sentinel');

/** Source `em` (chunk-kexg5hxg.js `D`): whether a value is a rendered element. Elements here are
 *  the `{type, props, children}` records `Xe`/`Tc` build. */
export function isValidElement(value: unknown): value is SurfaceElement {
  return typeof value === 'object' && value !== null && 'type' in value && 'props' in value;
}

function flattenChildren(children: unknown): unknown[] {
  return (children === undefined ? [] : [children].flat(Infinity))
    .filter((child) => child !== null && child !== undefined && typeof child !== 'boolean')
    .map((child) => typeof child === 'number' ? String(child) : child);
}

/** Source `xy` (chunk-kexg5hxg.js `Wt`): `React.Children`. `toArray` flattens the child tree and
 *  drops the entries React does not render; the elements already carry the keys `Xe` assigned, so
 *  no key prefixing is needed here. */
export const Children = {
  toArray(children: unknown): unknown[] {
    return flattenChildren(children);
  },
  map<T>(children: unknown, fn: (child: unknown, index: number) => T): T[] {
    return flattenChildren(children).map(fn);
  },
  forEach(children: unknown, fn: (child: unknown, index: number) => void, thisArg?: unknown): void {
    flattenChildren(children).forEach((child, index) => fn.call(thisArg, child, index));
  },
  count(children: unknown): number {
    return flattenChildren(children).length;
  },
  only(children: unknown): SurfaceElement {
    if (!isValidElement(children)) {
      throw new Error('React.Children.only expected to receive a single React element child.');
    }
    return children;
  },
};

export interface SurfaceElement {
  type: unknown;
  props: Record<string, unknown>;
  children: unknown[];
  /** The jsx runtime's key; absent for elements `Tc` (createElement) built. */
  key?: string | null;
}

export interface SurfaceNode {
  nodeName: string;
  attributes: Record<string, unknown>;
  parentNode: SurfaceNode | null;
  dirty: boolean;
  yogaMarks: number;
  onRenderCalls: number;
  yogaNode: { markDirty(): void; getComputedWidth(): number; getComputedHeight(): number };
  onRender(): void;
  children: SurfaceNode[];
}

/** Source `Tc` (React.createElement): an element is its kind, its props and its children. The source
 *  passes children either after the props or as `props.children`; both forms are read here. */
export function Tc(type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]): SurfaceElement {
  const held = children.length > 0 ? children : props?.children;
  return { type, props: props ?? {}, children: flattenChildren(held) };
}

/** Source `e`/`r` (react/jsx-runtime `jsx`/`jsxs`): the compiler's own element factory. Children
 *  travel inside `props.children`; the third argument is the element key, not a child. */
export function Xe(type: unknown, props?: Record<string, unknown> | null, key?: unknown): SurfaceElement {
  const held = props?.children;
  return {
    type,
    props: props ?? {},
    children: flattenChildren(held),
    key: key === undefined ? null : String(key),
  };
}

export interface EffectSlot {
  deps?: readonly unknown[];
  cleanup?: () => void;
}

export interface QueuedEffect {
  slot: EffectSlot;
  effect: () => void | (() => void);
}

export interface HookRuntime {
  contexts: ReadonlyMap<unknown, unknown>;
  slots: unknown[];
  effects: QueuedEffect[];
  cursor: number;
  nodes: SurfaceNode[];
  /** Set by a state setter whose value changed; the runner renders one more pass after the effects. */
  dirty: boolean;
}

let active: HookRuntime | undefined;

function requireRuntime(): HookRuntime {
  if (active === undefined) throw new Error('a chain site hook was called outside a component render');
  return active;
}

function slotAt<T>(runtime: HookRuntime, index: number, make: () => T): T {
  if (runtime.slots[index] === undefined) runtime.slots[index] = make();
  return runtime.slots[index] as T;
}

function sameDeps(a: readonly unknown[] | undefined, b: readonly unknown[]): boolean {
  return a !== undefined && a.length === b.length && a.every((value, at) => Object.is(value, b[at]));
}

/** Source `y` (React.useState): one slot, an initializer run once when the source passes a function,
 *  the value itself otherwise (`y(!1)` and `y()` are the source's other two forms), and a setter.
 *  A setter argument that is a function is the updater form React defines, not a function-valued
 *  state: it receives the previous value. The recovered picker frame relies on that form. */
export function y<T>(init?: (() => T) | T): [T, (next: T | ((previous: T) => T)) => void] {
  const runtime = requireRuntime();
  const initial = typeof init === 'function' ? (init as () => T)() : init as T;
  const slot = slotAt(runtime, runtime.cursor++, () => ({ value: initial }));
  return [slot.value, (next: T | ((previous: T) => T)) => {
    const value = typeof next === 'function' ? (next as (previous: T) => T)(slot.value) : next;
    if (Object.is(slot.value, value)) return;
    slot.value = value;
    runtime.dirty = true;
  }];
}

/** Source `Z` (React.useMemo): recompute when a dependency changes, keep the value otherwise. */
export function Z<T>(fn: () => T, deps: readonly unknown[] = []): T {
  const runtime = requireRuntime();
  const at = runtime.cursor++;
  const held = runtime.slots[at] as { deps: readonly unknown[]; value: T } | undefined;
  if (held === undefined || !sameDeps(held.deps, deps)) {
    runtime.slots[at] = { deps: [...deps], value: fn() };
  }
  return (runtime.slots[at] as { value: T }).value;
}

/** Source `R` (React.useRef): one stable box across renders. */
export function R<T>(value: T): { current: T } {
  const runtime = requireRuntime();
  return slotAt(runtime, runtime.cursor++, () => ({ current: value }));
}

/** Source `en` (React.useEffect): queue the effect on mount or a dependency change. It runs after the
 *  element tree is committed, so a ref already points at its node; a dependency change runs the
 *  previous effect's cleanup first, the way React does. An effect called without a dependency array
 *  runs after every render, as React defines it — the source relies on that for its handler refs
 *  (`en(()=>{t.handler=e})`). */
export function en(effect: () => void | (() => void), deps?: readonly unknown[]): void {
  const runtime = requireRuntime();
  const at = runtime.cursor++;
  const held = runtime.slots[at] as EffectSlot | undefined;
  if (deps !== undefined && held !== undefined && held.deps !== undefined && sameDeps(held.deps, deps)) return;
  const slot: EffectSlot = { deps: deps === undefined ? undefined : [...deps], cleanup: held?.cleanup };
  runtime.slots[at] = slot;
  runtime.effects.push({ slot, effect });
}

/** Source `P` (React.useEffect): queue an effect on mount or a dependency change. The source uses it
 *  beside `en` for subscriptions; both run after the commit, in the order the component queued them. */
export function P(effect: () => void | (() => void), deps?: readonly unknown[]): void {
  en(effect, deps);
}

/** Source `fye` (chunk-kexg5hxg.js `p.H.useImperativeHandle`): publish a handle to the caller's ref
 *  after the tree is committed. A dependency change re-publishes it; unmount clears an object ref or
 *  calls a function ref with null, the way React does. */
export function useImperativeHandle<T>(ref: unknown, create: () => T, deps: readonly unknown[] = []): void {
  const runtime = requireRuntime();
  const at = runtime.cursor++;
  const held = runtime.slots[at] as EffectSlot | undefined;
  if (held !== undefined && held.deps !== undefined && sameDeps(held.deps, deps)) return;
  const slot: EffectSlot = { deps: [...deps], cleanup: held?.cleanup };
  runtime.slots[at] = slot;
  runtime.effects.push({
    slot,
    effect: () => {
      const handle = create();
      if (typeof ref === 'function') {
        (ref as (value: T | null) => void)(handle);
        return () => (ref as (value: T | null) => void)(null);
      }
      if (ref !== null && typeof ref === 'object') {
        const box = ref as { current: T | null };
        box.current = handle;
        return () => { box.current = null; };
      }
    },
  });
}

/** Source `cZr` (chunk-kexg5hxg.js `p.H.useId`): one stable identity per hook slot. The recovered
 *  focus scope keys its rendered-scope map by it. */
export function useId(): string {
  const runtime = requireRuntime();
  const at = runtime.cursor++;
  return slotAt(runtime, at, () => `:r${at}:`);
}

/** Source `To` (chunk-kexg5hxg.js `p.H.useEffectEvent`): a stable callable whose body is always the
 *  latest render's callback. The two-press gesture keeps its confirm callback current this way. */
export function To<T extends (...args: never[]) => unknown>(fn: T): T {
  const runtime = requireRuntime();
  const at = runtime.cursor++;
  const held = slotAt(runtime, at, () => {
    const state = { fn };
    const call = (...args: never[]) => state.fn(...args);
    return { state, call: call as unknown as T };
  });
  held.state.fn = fn;
  return held.call;
}

/** The compiler runtime's `w` slot count and sentinel. Compiled source bodies check a cache slot
 *  against `b` before filling it; the sentinel is React's, taken from the registry so the source's
 *  own comparison stays exact. */
export const b = Symbol.for('react.memo_cache_sentinel');

/** Source `w` (`react/compiler-runtime` `useMemoCache`): one array of `size` slots, filled with `b`,
 *  kept across renders. The compiled bodies write it directly. */
export function w(size: number): unknown[] {
  const runtime = requireRuntime();
  return slotAt(runtime, runtime.cursor++, () => new Array(size).fill(b));
}

/** Source `km` (React.memo): this runner calls components directly, so the wrapper is the component
 *  itself and the source body stays callable. */
export function km<T>(component: T): T {
  return component;
}

/** Source `N` (chunk-kexg5hxg.js): the one-time React symbol install. This runner carries its own
 *  element and context symbols, so the call keeps its place and does nothing else. */
export function N(): void {}

/** Source `Rt` (React.useSyncExternalStore): the snapshot, with the store's subscription held while
 *  the component is mounted. A store that changes marks the runtime dirty, so the runner renders
 *  again. */
export function Rt<T>(subscribe: (onChange: () => void) => () => void, getSnapshot: () => T): T {
  const runtime = requireRuntime();
  const at = runtime.cursor++;
  const held = runtime.slots[at] as { subscribe?: unknown; cleanup?: () => void; value?: T } | undefined;
  const slot = held ?? { value: undefined as T | undefined };
  if (slot.subscribe !== subscribe) {
    if (typeof slot.cleanup === 'function') slot.cleanup();
    slot.subscribe = subscribe;
    slot.cleanup = subscribe(() => { runtime.dirty = true; });
  }
  slot.value = getSnapshot();
  runtime.slots[at] = slot;
  return slot.value as T;
}

/** Source `hh` (React.useReducer): one state slot; a dispatched action runs the reducer and marks
 *  the runtime dirty when the state changed. The source's `kc` dispatches with no action. */
export function hh<S, A>(reducer: (state: S, action: A) => S, initialArg: S, init?: (arg: S) => S): [S, (action: A) => void] {
  const runtime = requireRuntime();
  const initial = init === undefined ? initialArg : init(initialArg);
  const slot = slotAt(runtime, runtime.cursor++, () => ({ value: initial }));
  return [slot.value, (action: A) => {
    const next = reducer(slot.value, action);
    if (Object.is(slot.value, next)) return;
    slot.value = next;
    runtime.dirty = true;
  }];
}

/** Source `le` (React.useCallback): keep the function the same while its dependencies do. The Image
 *  resolver hands the result to the mount writer, whose effect compares it by identity. */
export function le<T extends (...args: never[]) => unknown>(fn: T, deps: readonly unknown[] = []): T {
  const runtime = requireRuntime();
  const at = runtime.cursor++;
  const held = runtime.slots[at] as { deps: readonly unknown[]; value: T } | undefined;
  if (held === undefined || !sameDeps(held.deps, deps)) {
    runtime.slots[at] = { deps: [...deps], value: fn };
  }
  return (runtime.slots[at] as { value: T }).value;
}

/** Source `Ae` (React.useContext): the mounted value, or the context's own default. */
export function Ae<T>(context: SurfaceContext<T>): T {
  const runtime = active;
  const mounted = runtime?.contexts.get(context);
  return mounted === undefined ? context.defaultValue : mounted as T;
}

/** Source `tI` (chunk-06azbynj.js, `tI=(n)=>{let u=n,f=!1;while(u){…}}`, [173047,173232)): mark the
 *  node and its ancestors dirty, and the first text/raw-ansi ancestor's yoga node with them. */
export function tI(node: SurfaceNode | null): void {
  let u: SurfaceNode | null = node;
  let marked = false;
  while (u !== null) {
    if (u.nodeName !== '#text') {
      u.dirty = true;
      if (!marked && (u.nodeName === 'ink-text' || u.nodeName === 'ink-raw-ansi')) {
        u.yogaNode.markDirty();
        marked = true;
      }
    }
    u = u.parentNode;
  }
}

/** Source `ZFt` (chunk-06azbynj.js, `ZFt=(n)=>{let u=n;while(u?.parentNode)u=u.parentNode;…}`,
 *  [173232,173328)): walk to the root node and ask it to render. */
export function ZFt(node: SurfaceNode | null): void {
  let u: SurfaceNode | null = node;
  while (u?.parentNode) u = u.parentNode;
  if (u !== null && u.nodeName !== '#text') u.onRender();
}

/** Build the node for one element and bind every `ref` in the tree, then the children. */
function commit(element: SurfaceElement | string, parentNode: SurfaceNode | null): SurfaceNode {
  const props = typeof element === 'string' ? {} : element.props;
  const node: SurfaceNode = {
    nodeName: typeof element === 'string' ? '#text' : String(element.type),
    attributes: { ...props },
    parentNode,
    dirty: false,
    yogaMarks: 0,
    onRenderCalls: 0,
    yogaNode: {
      markDirty: () => { node.yogaMarks += 1; },
      getComputedWidth: () => 0,
      getComputedHeight: () => 0,
    },
    onRender: () => { node.onRenderCalls += 1; },
    children: [],
  };
  const ref = props.ref as { current: unknown } | undefined;
  if (ref !== undefined && ref !== null && typeof ref === 'object') ref.current = node;
  if (typeof element !== 'string') {
    for (const child of element.children) {
      // A render-prop child belongs to the component that receives it (the focusable action box does
      // not render one here); it is not a node of its own.
      if (typeof child === 'function') continue;
      node.children.push(commit(child as SurfaceElement | string, node));
    }
  }
  return node;
}

export interface ComponentRun<T> {
  result: T;
  root: SurfaceElement | undefined;
  runtime: HookRuntime;
  unmount(): void;
}

/** Render one source component with the hook seam: slots fresh, then per pass one render, one commit
 *  (which is what binds every `ref`), and the effects queued by that pass. A state setter marks the
 *  runtime dirty and the runner renders again, the way React re-renders after an effect; the limit
 *  stops a component that would update forever. */
export function runComponent<T>(
  render: () => T,
  options: { contexts?: ReadonlyMap<unknown, unknown> } = {},
): ComponentRun<T> {
  const runtime: HookRuntime = {
    contexts: options.contexts ?? new Map(),
    slots: [],
    effects: [],
    cursor: 0,
    nodes: [],
    dirty: false,
  };
  const previous = active;
  let result: T;
  let root: SurfaceElement | undefined;
  for (let pass = 0; pass < 50; pass += 1) {
    runtime.cursor = 0;
    runtime.dirty = false;
    active = runtime;
    try {
      result = render();
    } finally {
      active = previous;
    }
    root = typeof result === 'object' && result !== null && 'type' in result
      ? result as unknown as SurfaceElement
      : undefined;
    if (root !== undefined) runtime.nodes[0] = commit(root, null);
    const effects = runtime.effects;
    runtime.effects = [];
    for (const { slot, effect } of effects) {
      if (typeof slot.cleanup === 'function') slot.cleanup();
      slot.cleanup = undefined;
      const cleanup = effect();
      if (typeof cleanup === 'function') slot.cleanup = cleanup;
    }
    if (!runtime.dirty) break;
  }
  return {
    result: result!,
    root,
    runtime,
    unmount: () => {
      for (let at = runtime.slots.length - 1; at >= 0; at -= 1) {
        const slot = runtime.slots[at] as EffectSlot | undefined;
        if (typeof slot?.cleanup === 'function') slot.cleanup();
        if (slot !== undefined) slot.cleanup = undefined;
      }
    },
  };
}
