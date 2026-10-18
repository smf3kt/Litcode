// The Code site component's host seam (W45-77). The copied bodies live in
// ./plugin-chain-code-source.ts, ./plugin-chain-code-block-source.ts and ./plugin-chain-code-diff-source.ts;
// this module serves the hooks and context reads they make, the way W45-76's image host did.
//
// Source, chunk-1r9zp6s1.js, copied here because the W44 modules carry the same functions against
// the TUI's own React runtime, whose dispatcher this runner does not install:
//
//   function kc(o){let{subscribeLayout:r}=Ae(Zy),l=Rt(r,o),[,u]=hh((c)=>c+1,0);
//     return en(()=>{if(!Object.is(o(),l))u()}),l}                       [25001,25120) 119 units
//
//   var zo=(o)=>({width:o.yogaNode?.getComputedWidth()??0,height:o.yogaNode?.getComputedHeight()??0}),
//   Ys=zo;                                                               [28445,28549) 104 units
//
//   function Mi(){return HT()==="fullscreen"}                            [2581,2622) 41 units
//
//   function Tj(){let o=Ae(Se),r=R(null);if(o)return o;return r.current??=Re(),r.current}
//                                                                        [2876,2961) 85 units
//
//   function nt(){return Ae(y4n)}                                        [19734,19763) 29 units
//
// Source, chunk-wz8v981w.js:
//
//   function hr(){let s=w(3),{currentTheme:o,setThemeSetting:r}=Ae(i),n;
//     if(s[0]!==o||s[1]!==r)n=[o,r],s[0]=o,s[1]=r,s[2]=n;else n=s[2];return n}
//                                                                        [4088,4228) 140 units
//
//   function Qdn(){return Ae(i).activeThemeOverrides}                    [4481,4530) 49 units
//
// Native mounts subscribe through the terminal app context. Isolated runs keep the explicit
// layout stub. The structured code and diff highlighters
// (`rDr`/`CNo`) are gated in the source by `CLAUDE_CODE_SYNTAX_HIGHLIGHT`; this host does not expose
// that flag, so the seam answers null, exactly the value the source answers when it is unset, and
// the copied renderers take their non-structured path.
import { Ae, R, Rt, en, hh, qt, w } from './plugin-chain-react-surface.js';
import { nativeComponentRender } from './plugin-chain-react-hooks.js';
import { Zy as AppContext } from './plugin-chain-press-button-source.js';
import { Ae as nativeContext } from './tui-react-runtime.js';
import { ThemeContext as i } from './tui-theme.js';
import { RenderSettingsContext, y4n } from './tui-component-host.js';
import { RenderCacheContext as Se, createRenderCache as Re } from './tui-base-components.js';

/** The layout context `Zy`: only `subscribeLayout` is read by the copied body. */
const Zy = qt({ subscribeLayout: (_listener: () => void) => () => {} });

/** A product context carries its value in `_currentValue` (the TUI runtime's React shape), not in
 *  this runner's `defaultValue`; the source reads them through `Ae` inside the TUI runtime. */
const readContext = <T>(context: { _currentValue?: unknown }): T => nativeComponentRender()
  ? nativeContext(context) as T : context._currentValue as T;

/** Source `kc`: subscribe to the layout and re-render when the reader's answer changes. */
export function kc<T>(read: () => T): T {
  const { subscribeLayout: r } = Ae(nativeComponentRender() ? AppContext : Zy);
  const l = Rt(r, read);
  const [, u] = hh((c: number) => c + 1, 0);
  en(() => { if (!Object.is(read(), l)) u(0); });
  return l;
}

/** Source `Ys` (`zo`): a node's computed width and height, zero until it is laid out. */
export const Ys = (node: { yogaNode?: { getComputedWidth?(): number; getComputedHeight?(): number } } | null): { width: number; height: number } => ({
  width: node?.yogaNode?.getComputedWidth?.() ?? 0,
  height: node?.yogaNode?.getComputedHeight?.() ?? 0,
});

/** Source `Mi` is true during a native fullscreen component render. */
export const Mi = (): boolean => nativeComponentRender();

/** Source `Tj`: the render cache in the context, or one this component holds. */
export function Tj(): ReturnType<typeof Re> {
  const o = readContext<ReturnType<typeof Re> | null>(Se);
  const r = R<ReturnType<typeof Re> | null>(null);
  if (o !== null && o !== undefined) return o as ReturnType<typeof Re>;
  r.current ??= Re();
  return r.current;
}

/** Source `nt`: whether the surface is read by a screen reader. */
export function nt(): boolean {
  return readContext<boolean>(y4n);
}

/** Source `hr`: the current theme and the setter, in one array. */
export function hr(): [string, (name: string) => void] {
  const s = w(3) as unknown as [unknown, unknown, [string, (name: string) => void] | undefined];
  const { currentTheme: o, setThemeSetting: r } = readContext<{ currentTheme: string; setThemeSetting: (name: string) => void }>(i);
  let n: [string, (name: string) => void];
  if (s[0] !== o || s[1] !== r) {
    n = [o, r];
    s[0] = o;
    s[1] = r;
    s[2] = n;
  } else {
    n = s[2]!;
  }
  return n;
}

/** Source `Qdn`: the theme overrides the active theme carries. */
export function Qdn(): Record<string, string> | undefined {
  return readContext<{ activeThemeOverrides?: Record<string, string> }>(i).activeThemeOverrides;
}

/** The Code render settings (`Kl`), read against this host's context. */
export function Kl(): { syntaxHighlightingDisabled?: boolean; maxProseWidth?: number } {
  return readContext<{ syntaxHighlightingDisabled?: boolean; maxProseWidth?: number }>(RenderSettingsContext);
}

/** Source `rDr`: the structured code highlighter, gated by `CLAUDE_CODE_SYNTAX_HIGHLIGHT`. This host
 *  does not expose the flag, so the answer is the source's own answer when it is unset. */
export const rDr = (): null => null;

/** Source `CNo`: the structured diff highlighter, gated by the same flag. */
export const CNo = (): null => null;
