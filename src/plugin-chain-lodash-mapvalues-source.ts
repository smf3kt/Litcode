// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-3cynezh1.js sha256 c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// One module of the lodash stack the classic sites read, copied whole from its own chunk: the
// bundle repeats these definitions in several chunks, and each copy is the text its own module's bodies call.
// Role: map-values.
import { Eo } from './plugin-chain-lodash-memoize-source.js';
import { uU } from './plugin-chain-lodash-internals-source.js';

// chunk-3cynezh1.js declares uc [3046,3075) 29 units sha256 b7f30aed21f940daf1a2fee293b262c5f66a9af2936c995c3f528bcb52199324
var uc="Expected a function";

// chunk-3cynezh1.js declares pc [3075,3347) 272 units sha256 9d189ee6ad00856dcae75ea7565f20a1c2082bec9e24b7f971639febe5e08fe7
function pc(e){if(typeof e!="function")throw TypeError(uc);return function(){var n=arguments;switch(n.length){case 0:return!e.call(this);case 1:return!e.call(this,n[0]);case 2:return!e.call(this,n[0],n[1]);case 3:return!e.call(this,n[0],n[1],n[2])}return!e.apply(this,n)}}

// chunk-3cynezh1.js declares bCr [3347,3358) 11 units sha256 a20410ac22550d88d6fbba1f8d8a57656812b8ed0ed69946a78b66a85c036194
var bCr=pc;

// chunk-3cynezh1.js mc: the memoized map-values `ua` is built from [3358,3399) 41 units sha256 113bbc76d2c58319737ee959f16bb78151c18e97c1137b901a77799fc1ac03d9
function mc(e,n){return Eo(e,bCr(uU(n)))}

// chunk-3cynezh1.js ua: the source's own alias the classic settle calls [3399,3409) 10 units sha256 7d46d194e7a282c62153e545f1ad24696889b2b358b290fef23c563c7a16ae5b
var ua=mc;


export { ua };
