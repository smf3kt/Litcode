// The host seam the press-button bodies read (W45-84). The copied bodies live in
// ./plugin-chain-press-button-source.ts; this module supplies the three host bindings they ask for.
//
//   · `u` — the keybinding context `Lc` reads (`function Lc(){return Ae(u)}`, chunk-bwyexfny.js
//     [2128,2143) and [3552,3579)). The service it names is host state: `bindings` is the block list
//     (`{context, bindings}`) `Ds` filters, and `registerHandler({action, context, handler,
//     singleKey, fallback})` returns the unbind. A render mounts the service under this context; with
//     none mounted `Lc()` answers null and `Qt` skips registration, the source's own no-service path.
//   · `ix` — the focus manager of a committed node (`function ix(n){return eun(n).focusManager}`,
//     chunk-06azbynj.js [135640,…)). The manager's `activeElement` is a node and `blur()` clears
//     focus; `_3n` uses both to blur a focused descendant when a button is pressed. This build has
//     no node registry of its own, so a host binds a manager for each node it commits.
//   · `KH` — the focusable action box the Button nests (`var KH=je`, chunk-1r9zp6s1.js): a Box that
//     takes a `ref`, `tabIndex`, `onAction` and a render-prop child `({focused, hovered}) => node`.
//     The host renderer supplies it; this build exposes the token the same way `s`/`n` are tokens.
import { qt } from './plugin-chain-react-hooks.js';

/** One `{context, bindings}` block the keybinding service holds. */
export interface KeybindingBlock {
  context: string;
  bindings: Record<string, string | null>;
}

/** The keybinding service `Lc` answers: the blocks and the handler registration the action keys use. */
export interface KeybindingService {
  bindings?: KeybindingBlock[];
  registerHandler(options: {
    action: string;
    context: string;
    handler: () => boolean;
    singleKey: boolean;
    fallback: boolean;
  }): () => void;
}

/** Source `u` (chunk-bwyexfny.js `var u=qt(null)`): the keybinding-service context. */
export const u = qt<KeybindingService | null>(null);

/** The focus manager `ix` answers for one committed node. */
export interface ChainFocusManager {
  activeElement: unknown;
  blur(): void;
}

const focusManagers = new WeakMap<object, ChainFocusManager>();

/** Source `ix`: the focus manager of a node. A host binds one per committed node; an unbound node
 *  is a host-contract failure rather than a made-up no-op manager. */
export function ix(node: unknown): ChainFocusManager {
  const manager = typeof node === 'object' && node !== null ? focusManagers.get(node) : undefined;
  if (manager === undefined) throw new Error('no focus manager is bound to this node');
  return manager;
}

/** Bind one focus manager under a committed node. Returns the unbind, which removes only the
 *  manager it set. */
export function bindFocusManager(node: object, manager: ChainFocusManager): () => void {
  focusManagers.set(node, manager);
  return () => {
    if (focusManagers.get(node) === manager) focusManagers.delete(node);
  };
}

/** The focusable action box the Button nests under its click box. The renderer resolves this token
 *  to a Box that takes `ref`, `tabIndex`, `onAction` and a render-prop child. */
export const KH = 'ActionBox';
