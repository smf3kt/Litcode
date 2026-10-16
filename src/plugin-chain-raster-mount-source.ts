// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The mount side of the `$` table's raster surface (W45-59): what fills the two registries the
// ui.blit entry reads. A plugin's site calls `hNs` when it mounts a Raster element and `ELs` when it
// mounts an Image one; both go through `Yto`, which keys the site (`e5t`: plugin, requestId, key
// joined with the NUL `QJt`), builds the row on the first mount and hands back the unregister that
// drops the key once its set empties. `vLs` is the builder an Image site spreads its element and
// props through to gain the `swap` the blit calls.
//
// Two blocks, 541 units: the two pairs are adjacent statements in their modules. The row shape is the
// one W45-58 measured (`{rasters:new Set,windowStart:0,blits:0}` / `{images:new Set,…}`), and both
// registries plus the site key `e5t` are bodies the blit copy already carries, so they are imports
// rather than copies.
import { e5t, hs, Yj } from './plugin-chain-ui-blit-source.js';

// chunk-n3ykh62m.js declares the Raster side of the mount: `Yto`, the register helper (one site key, one row built on demand, the mount added to the row's own set, and the unregister that drops the key once its set empties and the map still holds that same row), and `hNs`, which calls it against `hs()` — the mounted-raster registry — with the row `{rasters:new Set,windowStart:0,blits:0}` [256712,257058) 346 units sha256 c0fbd87e38e43ef3aaf3a527874bd4ffeb4fec625b01cd0f13cc6e7b1f1cfa68
function Yto(e){let{sites:n,siteKey:r,mount:s,mountsOf:h,freshSite:y}=e,b=n.get(r)??y();return h(b).add(s),n.set(r,b),()=>{let w=h(b);if(w.delete(s),w.size===0&&n.get(r)===b)n.delete(r)}}var hNs=(e)=>Yto({sites:hs(),siteKey:e5t(e.requestId,e.key,e.plugin),mount:e,mountsOf:(n)=>n.rasters,freshSite:()=>({rasters:new Set,windowStart:0,blits:0})});

// chunk-sfn1dbxq.js declares the Image side: `ELs`, the same register against `Yj()` with the row `{images:new Set,windowStart:0,blits:0}`, and `vLs`, the builder an Image site passes its element and props through to gain its `swap` [1869519,1869714) 195 units sha256 e214f1fca725b30627f2ab21c909f811e31d926747c63cf81fb4a1d0deea0717
var ELs=(e)=>Yto({sites:Yj(),siteKey:e5t(e.requestId,e.key,e.plugin),mount:e,mountsOf:(n)=>n.images,freshSite:()=>({images:new Set,windowStart:0,blits:0})});var vLs=(e,n,r)=>({...e,...n,swap:r});


export { Yto, hNs, ELs, vLs };
