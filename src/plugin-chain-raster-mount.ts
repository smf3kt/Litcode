// The mount side of the `$` table's raster surface (W45-59). The copied bodies live in
// ./plugin-chain-raster-mount-source.ts; this module is the host seam around them.
//
// Source: `Yto`, the register helper, chunk-n3ykh62m.js [256712,256899) 187 units:
//
//   function Yto(e){let{sites:n,siteKey:r,mount:s,mountsOf:h,freshSite:y}=e,b=n.get(r)??y();return h(b).add(s),n.set(r,b),()=>{let w=h(b);if(w.delete(s),w.size===0&&n.get(r)===b)n.delete(r)}}
//
// and the two row writers it drives — `hNs` at [256899,257058) 159 units:
//
//   var hNs=(e)=>Yto({sites:hs(),siteKey:e5t(e.requestId,e.key,e.plugin),mount:e,mountsOf:(n)=>n.rasters,freshSite:()=>({rasters:new Set,windowStart:0,blits:0})});
//
// `ELs` at chunk-sfn1dbxq.js [1869519,1869676) 157 units and `vLs` at [1869676,1869714) 38 units:
//
//   var ELs=(e)=>Yto({sites:Yj(),siteKey:e5t(e.requestId,e.key,e.plugin),mount:e,mountsOf:(n)=>n.images,freshSite:()=>({images:new Set,windowStart:0,blits:0})});
//   var vLs=(e,n,r)=>({...e,...n,swap:r});
//
// This is the producer of the two registries W45-58's `ui.blit` reads. A plugin's Raster site calls
// `hNs` with its element when it mounts (and calls what it hands back when it unmounts); an Image site
// builds its element through `vLs` — its own fields, then its props, then the `swap` the blit will
// call — and mounts that through `ELs`. The key both write under is `e5t`'s: the plugin, the requestId
// and the element's key joined with `QJt`, the NUL — which is why a site and a blit agree on the row.
//
// Three things about the source body are load-bearing and are kept as they are:
//  · The row is built by `freshSite()` only when the key holds none, and the *same* row object is
//    written back on every later mount under that key, so a row's rate window survives a remount.
//  · The unregister deletes the element, and deletes the key only when the set has *emptied* and the
//    map still holds that same row object — a row replaced by someone else is left alone.
//  · Both writers read the registry through the memoized accessors the blit copy carries (`hs` for
//    rasters, `Yj` for images), so the map is the live `it().mountedRasters` / `it().mountedImages`.
//
// What a mount *is* stays the site's own: `hNs`/`ELs` take the element and never read it. The element
// shapes here are the ones the registry state names (W45-58), which is what the blit calls `paint` /
// `swap` on.
import type { MountedImageSite, MountedRasterSite } from './plugin-chain-registry-state.js';
import { ELs, Yto, hNs, vLs } from './plugin-chain-raster-mount-source.js';

/** One mounted Raster element: the fields the blit matches on and the `paint` it calls. */
export type MountedRasterElement = Parameters<MountedRasterSite['rasters']['add']>[0];
/** One mounted Image element: the same, with the `swap` the blit calls. */
export type MountedImageElement = Parameters<MountedImageSite['images']['add']>[0];

/** Source `Yto`: register one mount under a site key and answer the unregister. The row is built by
 *  `freshSite()` when the key holds none; the mount goes into `mountsOf(row)`; the unregister deletes
 *  the mount and drops the key once that set is empty and the map still holds the same row. */
export function registerSiteMount<Row, Element>(request: {
  sites: Map<string, Row>;
  siteKey: string;
  mount: Element;
  mountsOf: (row: Row) => Set<Element>;
  freshSite: () => Row;
}): () => void {
  return (Yto as (request: unknown) => () => void)(request);
}

/** Source `hNs`: mount one Raster element under its own `e5t` site key in `it().mountedRasters`, and
 *  answer the unregister. The blit's Raster path paints through what this leaves behind. */
export function mountRaster(element: MountedRasterElement): () => void {
  return (hNs as (element: MountedRasterElement) => () => void)(element);
}

/** Source `ELs`: the same for one Image element, in `it().mountedImages`. */
export function mountImage(element: MountedImageElement): () => void {
  return (ELs as (element: MountedImageElement) => () => void)(element);
}

/** Source `vLs`: the builder an Image site spreads its element and props through to gain its `swap` —
 *  `{...element, ...props, swap}` — so the `swap` it passes is the one the blit calls. */
export function withSwap(
  element: MountedImageElement,
  props: Partial<MountedImageElement>,
  swap: MountedImageElement['swap'],
): MountedImageElement {
  return (vLs as (element: MountedImageElement, props: Partial<MountedImageElement>, swap: MountedImageElement['swap']) => MountedImageElement)(element, props, swap);
}

/** The copied bodies under their source names, for a record or a test that wants to compare the ported
 *  surface with the text: `Yto` (the register helper), `hNs` (the Raster writer), `ELs` (the Image
 *  writer) and `vLs` (the Image element builder). The seam's own names above are the ones a site calls. */
export { Yto, hNs, ELs, vLs } from './plugin-chain-raster-mount-source.js';
