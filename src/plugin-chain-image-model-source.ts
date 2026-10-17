// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// `B_` measures a source's decoded size with the base64 decoder the ui.blit copy already carries.
import { ds } from './plugin-chain-ui-blit-source.js';

// chunk-n3ykh62m.js `ac`, `Z4t` and `B_` — the png and file/shm shape tests and the decoded byte size [242804,242947) 143 units sha256 b47bf3f48a76ae4d9541b905bf43f77a32ba6a7ec4b51d182c2d958471dfb4c3
var ac=(e)=>Object.hasOwn(e,"png");var Z4t=(e)=>Object.hasOwn(e,"file")||Object.hasOwn(e,"shm");var B_=(e)=>Z4t(e)?0:ds(ac(e)?e.png:e.rgba)??0;

// chunk-n3ykh62m.js `Uto` and `Dss` — the shm test and the encoder from a source to the transmit shape [245185,245596) 411 units sha256 d864eb7ae6c35c67d24cc68355f207504f35a302662f04314bd9921f289da035
var Uto=(e)=>Object.hasOwn(e,"shm");function Dss(e){if(ac(e))return{format:"png",base64:e.png};if(!Z4t(e)){let{rgba:w,width:R,height:T}=e;return{format:"rgba",base64:w,width:R,height:T}}let n=Object.hasOwn(e,"shm")?"shm":"file",r=n==="shm",s="shm"in e,h="file"in e,y=r?s?e.shm:"":h?e.file:"";return e.format==="png"?{medium:n,name:y,format:"png"}:{medium:n,name:y,format:e.format,width:e.width,height:e.height}}


export { ac, Z4t, B_, Uto, Dss };
