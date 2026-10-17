// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-xmvfy87k.js sha256 fabe23b454accb5fcb9390965e13cd815400518e90b86cb9550d55aae113ade0
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.

// chunk-xmvfy87k.js diff data constants: 400-line truncation threshold, 150ms debounce, 2000ms prime TTL and the empty hunks value [1818,1883) 65 units sha256 f17d77398e4a93d20bbd236ddbd1471e18d8c1f863d0c8d73ab555d1d97a3ae5
var j=400,jKn=150,de=2000,I={hunks:new Map,skippedLarge:new Set};

// chunk-xmvfy87k.js prime store z: set/take with the TTL and base-mode guards [2290,2566) 276 units sha256 f782bdb8d05f2787ff399b42852f566fe18665170e2bcaa8f24299717212cb71
class z{#e=null;set(t,r,o,s){this.#e={baseMode:t,refreshKey:r,round:o,at:s}}take(t,r){let o=this.#e;if(o===null)return;if(r-o.at>de){this.#e=null;return}if(o.baseMode!==t)return;return this.#e=null,{round:o.round,refreshKey:o.refreshKey}}get isPrimed(){return this.#e!==null}}


export { j, jKn, de, I, z };
