// The list's host bindings (W172). Two recovered names read surfaces this build does not keep:
//
//   - `Wo` (chunk-7n39kxwj.js sha256 d61cd8ea…, [1540,1576) 36u, body d9532139…,
//     `function Wo(e){return Re(Ae(sx),e)}`) selects from the app state. `sx` is the same
//     app-state context this build carries, and `Re` the hover selector; the body is reproduced
//     against those two exports, not the source's module scope.
//   - `Mct` (chunk-mrf41zrh.js sha256 e800c49b…, [4416,4462) 46u, body d267c486…,
//     `function Mct(){return r().isArrowNavEnabled()}`) asks the host service `r`
//     (`function r(){return x.of(B().host)}`, [4351,4386) 35u, body 809b1bb4…) whether arrow
//     navigation is enabled. This build binds no such host service; its select already navigates
//     with the arrow keys, so the local answer is true and the numeric-only path stays unused.
//   - `$h` (chunk-f37m98yh.js sha256 207b107a452d54c816419d533bc258f2c8567f8ccfc255cebc390160bb4c900d,
//     [21892,22233) 341u, body 4be627f69ae5e595b029e9c94a9c5653251fd17939fda50f4507fa9602dc5ebb) focuses
//     the ref node while enabled and keeps focus inside it. The source runtime stamps `focusManager`
//     onto the host node from a FocusManagerProvider; the hook runner's committed elements carry no
//     such provider, so `ix` throws there. The body keeps every source step and resolves the manager
//     through `ix` first, then through the mounted app context (`Zy`, whose default has a null
//     manager) the same way the source's own focus readers do.
import { Ae, P } from './plugin-chain-react-hooks.js';
import { Re } from './plugin-chain-hover-source.js';
import { sx } from './plugin-chain-app-state-source.js';
import { ix } from './diff-dialog-frame-scope-source.js';
import { Zy } from './plugin-chain-press-button-source.js';

/** Source `Wo`: apply a selector to the mounted app state. */
export function Wo<T>(selector: (state: unknown) => T): T {
  return Re(Ae(sx), selector) as T;
}

/** Source `Mct`: the host's arrow-navigation setting. Local select navigates with the arrows. */
export function Mct(): boolean {
  return true;
}

interface SourceFocusManager {
  activeElement: unknown;
  focus(node: unknown): void;
  blur(): void;
  subscribe(listener: () => void): () => void;
}

interface FocusNode {
  parentNode?: FocusNode | null;
}

function managerFor(node: FocusNode, fallback: SourceFocusManager | null): SourceFocusManager | null {
  try {
    return ix(node as never) as SourceFocusManager;
  } catch {
    return fallback;
  }
}

/** Source `$h`: focus the ref node while enabled and follow focus changes inside it. */
export function $h(
  ref: { current: FocusNode | null },
  enabled: boolean,
  blurOnDisable = false,
): void {
  const context = Ae(Zy) as { focusManager?: SourceFocusManager | null } | null;
  P(() => {
    const node = ref.current;
    if (!node) return;
    const manager = managerFor(node, context?.focusManager ?? null);
    if (manager === null) return;
    if (!enabled) {
      if (blurOnDisable && manager.activeElement === node) manager.blur();
      return;
    }
    manager.focus(node);
    return manager.subscribe(() => {
      const live = ref.current;
      if (!live || manager.activeElement === live) return;
      if (!manager.activeElement) {
        manager.focus(live);
        return;
      }
      let parent = live.parentNode;
      while (parent) {
        if (parent === manager.activeElement) {
          manager.focus(live);
          return;
        }
        parent = parent.parentNode;
      }
    });
  }, [enabled, ref, blurOnDisable]);
}
