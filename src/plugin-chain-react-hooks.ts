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
export interface SurfaceContext<T> {
  readonly defaultValue: T;
}
export function qt<T>(defaultValue: T): SurfaceContext<T> {
  return { defaultValue };
}

/** Source `s` and `n`: the Box and Text element kinds, kept as tokens the host renderer paints. */
export const s = 'Box';
export const n = 'Text';

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
  yogaNode: { markDirty(): void };
  onRender(): void;
  children: SurfaceNode[];
}

/** Source `Tc` (React.createElement): an element is its kind, its props and its children. The source
 *  passes children either after the props or as `props.children`; both forms are read here. */
export function Tc(type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]): SurfaceElement {
  const held = children.length > 0 ? children : props?.children;
  const list = (held === undefined ? [] : [held].flat(Infinity))
    .filter((child) => child !== null && child !== undefined && typeof child !== 'boolean')
    .map((child) => typeof child === 'number' ? String(child) : child);
  return { type, props: props ?? {}, children: list };
}

/** Source `e`/`r` (react/jsx-runtime `jsx`/`jsxs`): the compiler's own element factory. Children
 *  travel inside `props.children`; the third argument is the element key, not a child. */
export function Xe(type: unknown, props?: Record<string, unknown> | null, key?: unknown): SurfaceElement {
  const held = props?.children;
  const list = (held === undefined ? [] : [held].flat(Infinity))
    .filter((child) => child !== null && child !== undefined && typeof child !== 'boolean')
    .map((child) => typeof child === 'number' ? String(child) : child);
  return { type, props: props ?? {}, children: list, key: key === undefined ? null : String(key) };
}

export interface EffectSlot {
  deps: readonly unknown[];
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
 *  the value itself otherwise (`y(!1)` and `y()` are the source's other two forms), and a setter. */
export function y<T>(init?: (() => T) | T): [T, (next: T) => void] {
  const runtime = requireRuntime();
  const initial = typeof init === 'function' ? (init as () => T)() : init as T;
  const slot = slotAt(runtime, runtime.cursor++, () => ({ value: initial }));
  return [slot.value, (next: T) => {
    if (Object.is(slot.value, next)) return;
    slot.value = next;
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
 *  previous effect's cleanup first, the way React does. */
export function en(effect: () => void | (() => void), deps: readonly unknown[] = []): void {
  const runtime = requireRuntime();
  const at = runtime.cursor++;
  const held = runtime.slots[at] as EffectSlot | undefined;
  if (held !== undefined && sameDeps(held.deps, deps)) return;
  const slot: EffectSlot = { deps: [...deps], cleanup: held?.cleanup };
  runtime.slots[at] = slot;
  runtime.effects.push({ slot, effect });
}

/** Source `P` (React.useEffect): queue an effect on mount or a dependency change. The source uses it
 *  beside `en` for subscriptions; both run after the commit, in the order the component queued them. */
export function P(effect: () => void | (() => void), deps: readonly unknown[] = []): void {
  en(effect, deps);
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
    yogaNode: { markDirty: () => { node.yogaMarks += 1; } },
    onRender: () => { node.onRenderCalls += 1; },
    children: [],
  };
  const ref = props.ref as { current: unknown } | undefined;
  if (ref !== undefined && ref !== null && typeof ref === 'object') ref.current = node;
  if (typeof element !== 'string') {
    for (const child of element.children) node.children.push(commit(child as SurfaceElement | string, node));
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
