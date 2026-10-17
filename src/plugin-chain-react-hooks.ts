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

/** Source `Tc` (React.createElement): an element is its kind, its props and its children. */
export function Tc(type: unknown, props?: Record<string, unknown> | null, ...children: unknown[]): SurfaceElement {
  return { type, props: props ?? {}, children: children.flat(Infinity) };
}

export interface HookRuntime {
  contexts: ReadonlyMap<unknown, unknown>;
  slots: unknown[];
  effects: Array<() => void | (() => void)>;
  cursor: number;
  nodes: SurfaceNode[];
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

/** Source `y` (React.useState): one slot, the initializer run once, a setter that keeps the value. */
export function y<T>(init: () => T): [T, (next: T) => void] {
  const runtime = requireRuntime();
  const slot = slotAt(runtime, runtime.cursor++, () => ({ value: init() }));
  return [slot.value, (next: T) => { slot.value = next; }];
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
 *  element tree is committed, so a ref already points at its node. */
export function en(effect: () => void | (() => void), deps: readonly unknown[] = []): void {
  const runtime = requireRuntime();
  const at = runtime.cursor++;
  const held = runtime.slots[at] as { deps: readonly unknown[] } | undefined;
  if (held !== undefined && sameDeps(held.deps, deps)) return;
  runtime.slots[at] = { deps: [...deps] };
  runtime.effects.push(effect);
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

/** Render one source component with the hook seam: slots fresh, effects after the commit. */
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
  };
  const previous = active;
  active = runtime;
  let result: T;
  try {
    result = render();
  } finally {
    active = previous;
  }
  const root = typeof result === 'object' && result !== null && 'type' in result
    ? result as unknown as SurfaceElement
    : undefined;
  if (root !== undefined) runtime.nodes.push(commit(root, null));
  const cleanups: Array<() => void> = [];
  for (const effect of runtime.effects) {
    const cleanup = effect();
    if (typeof cleanup === 'function') cleanups.push(cleanup);
  }
  runtime.effects.length = 0;
  return {
    result,
    root,
    runtime,
    unmount: () => {
      for (const cleanup of cleanups.reverse()) cleanup();
    },
  };
}
