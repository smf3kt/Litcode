// The DiffDialog tab strip (W169). Copied bodies live in ./diff-dialog-tabs-source.ts:
//
//   - chunk-3dnyxzpb.js [1324,6447)  5,123 units — the tabs context `g`, the title-key and width
//     helpers, and `sS`, the header, banner and content area;
//   - chunk-3dnyxzpb.js [6447,7321)    874 units — `je`, one tab header;
//   - chunk-3dnyxzpb.js [7321,7586)    265 units — `Na`, the selected tab's content;
//   - chunk-3dnyxzpb.js [7909,8083)    174 units — `te`, the opt-in counter;
//   - chunk-6j27z6m4.js [717,1009)     292 units — `VS`/`nl`/`ns`/`Ffe`/`KXe`, the viewport context;
//   - chunk-06azbynj.js [135432,135508) 76 units — `IU`, the inside test;
//   - chunk-06azbynj.js [173441,173541) 100 units — `nLr`, the scroll commit stamp;
//   - chunk-06azbynj.js [174030,174177) 147 units — `vie`, the scroll clamp;
//   - chunk-06azbynj.js [224832,224857)  25 units — `S4n`, the cursor context;
//   - chunk-1r9zp6s1.js [19906,20151)  245 units — `Zw`, the cursor reporter;
//   - chunk-1r9zp6s1.js [23676,23694)   18 units — `Ze`, the empty subscription;
//   - chunk-1r9zp6s1.js [23694,24062)  368 units — `_Ee`, the focus reader;
//   - chunk-1r9zp6s1.js [24066,24084)   18 units — `Lo`, the empty subscription;
//   - chunk-1r9zp6s1.js [24084,24236)  152 units — `eX`, the focus containment test;
//   - chunk-1r9zp6s1.js [28445,28549)  104 units — `Ys`/`zo`, a node's computed size;
//   - chunk-3c5vzz43.js [753,1088)     335 units — `Xw`, the padded current-tab label;
//   - chunk-70nf72b4.js [903,957)       54 units — `l`, the stray-click test;
//   - chunk-70nf72b4.js [957,1312)     355 units — `aS`, the stray-click predicate;
//   - chunk-70nf72b4.js [1391,1422)     31 units — `c`, the mount-settle comparison;
//   - chunk-6x3scwgf.js [965,3956)   2,991 units — `Se`/`K`/`OT`, the scroll box.
//
// Total 20 blocks, 11,747 UTF-16 units. The React seam gained `useImperativeHandle` for the scroll
// box's ref; the presence and telemetry calls are host bindings in ./diff-dialog-tabs-host.ts.
import {
  Co, Fo, KXe, Na, OT, To, VS, Ffe, aS, g, je, ko, nl, ns, sS, te, xo,
} from './diff-dialog-tabs-source.js';
import type { SurfaceElement } from './plugin-chain-react-hooks.js';

export interface TabProps {
  title: string;
  id?: string;
  children?: unknown;
}

export interface TabsProps {
  title?: string;
  color?: string;
  defaultTab?: string;
  children: readonly unknown[];
  hidden?: boolean;
  useFullWidth?: boolean;
  selectedTab?: string;
  onTabChange?: (tab: string) => void;
  banner?: unknown;
  disableNavigation?: boolean;
  initialHeaderFocused?: boolean;
  contentHeight?: number;
  stableHeight?: boolean;
  navFromContent?: boolean;
}

export interface TabHeaderProps {
  title: string;
  isCurrent?: boolean;
  headerFocused?: boolean;
  color?: string;
  onClick?: () => void;
}

export interface TabState {
  selectedTab: unknown;
  width: unknown;
  headerFocused: boolean;
  focusHeader: () => void;
  blurHeader: () => void;
  registerOptIn: () => () => void;
  registerNavigationOwner: () => () => void;
}

/** Source `g`: the context the header and content read for the selected tab and width. */
export const TabStateContext = g;

/** Source `sS`: the tab strip — optional title, one header per child, an optional banner, and the
 *  selected child's content. */
export function Tabs(props: TabsProps): SurfaceElement {
  return sS(props as never) as SurfaceElement;
}

/** Source `Na`: one tab's content, null unless the tab is selected. */
export function TabContent(props: TabProps): SurfaceElement | null {
  return Na(props as never) as SurfaceElement | null;
}

/** Source `je`: one tab header. */
export function TabHeader(props: TabHeaderProps): SurfaceElement {
  return je(props as never) as SurfaceElement;
}

/** Source `OT`: the scroll box the content area uses when a scroll viewport is registered. */
export function ScrollBox(props: Record<string, unknown>): SurfaceElement {
  return OT(props as never) as SurfaceElement;
}

/** Source `ko`: a tab child's identity and label. */
export function tabKey(child: { props: { id?: string; title: string } }): [string, string] {
  return ko(child) as [string, string];
}

/** Source `xo`: the next index. */
export function nextTabIndex(index: number): number {
  return xo(index) as number;
}

/** Source `To`: the header width one tab adds — its label width plus the two-cell padding and the
 *  one-cell gap. */
export function tabLabelWidth(total: number, key: readonly [string, string]): number {
  return To(total, key) as number;
}

/** Source `Fo`: the next header index. */
export function nextHeaderIndex(index: number): number {
  return Fo(index) as number;
}

/** Source `Co`: the previous header index. */
export function previousHeaderIndex(index: number): number {
  return Co(index) as number;
}

/** Source `VS`: the viewport context the content area reads. */
export const ViewportContext = VS;

/** Source `nl`: whether a viewport is mounted. */
export function hasViewport(): boolean {
  return nl() as boolean;
}

/** Source `Ffe`: the scroll viewport the content area attaches to. */
export function scrollViewport(): unknown {
  return Ffe() as unknown;
}

/** Source `KXe`: the scroll box the content area claims. */
export function claimScrollBox(): unknown {
  return KXe() as unknown;
}

/** Source `te`: the opt-in counter pair. */
export function useOptInCounter(): [number, (next: number | ((previous: number) => number)) => void] {
  return te() as [number, (next: number | ((previous: number) => number)) => void];
}

/** Source `aS`: the predicate that drops a click arriving at window activation or within 300 ms of
 *  the mount. */
export function useStrayClickFilter(): (event: {
  isWindowActivation?: boolean;
  dropAsStray: () => void;
}) => boolean {
  return aS() as (event: { isWindowActivation?: boolean; dropAsStray: () => void }) => boolean;
}

/** The copied bodies under their source names. */
export const SOURCE_BODIES = {
  g, ko, xo, To, Fo, Co, sS, je, Na, te, aS, VS, nl, ns, Ffe, KXe, OT,
};
