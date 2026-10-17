// The React layer's seam, partition 1 (W45-72): the Raster site component, the paint scheduler and
// the surface hook that binds a mounted raster to the node it paints through.
//
// The source's site components are React functions. This build carries no React runtime (the
// product's TUI is its own renderer), so the layer is taken the way W45-38 took the bar: the source
// bodies stay verbatim in ./plugin-chain-react-surface-source.ts and the host layer they call lives
// in ./plugin-chain-react-hooks.ts. `runComponent` renders one component, commits its element tree
// (binding refs) and then runs the queued effects; `unmount` runs their cleanups.
//
// The rest of the React layer is partitioned in the package record: the Image component with its
// source/decode bodies (`No`, `Ao`, `lFo`), the leaf components (Text/Link/Markdown/Code), the
// input/select/button and hover components, the Client host, the site-tree walker `je`, and the
// remaining hooks and terminal glue.
export { Bo, Ce, Fo, Ko, Wo, eg, jo, nr, _o, ee } from './plugin-chain-react-surface-source.js';
export {
  Ae, R, Tc, Z, en, n, qt, s, tI, y, ZFt, runComponent,
} from './plugin-chain-react-hooks.js';
export type {
  ComponentRun, HookRuntime, SurfaceContext, SurfaceElement, SurfaceNode,
} from './plugin-chain-react-hooks.js';
