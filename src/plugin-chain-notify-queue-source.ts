// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-6zdc3jq1.js sha256 8009c180a36973dc5853feebabd9653728bb5a902f3f27aa36cd883187ca3e9a
//   chunk-356hrhz3.js sha256 0c821efb255e53af566480e6263c87c8be068ed1a7dae3205b2964f0f0c9076a
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The notification queue's own bodies (W45-39), the ones the source's `vo` hook closes over: the
// gate that decides whether the queue is suppressed at all (`vps`/`QD`/`i4n`), the local holder for
// the clear timer and the mount count (`I`), the body that drops one notification from a state
// (`XXe`), the diff-panel exemption test (`hEe`), the queue's class of a key (`D`), and the three
// priority helpers the drain and the push share (`Xmt` the order, `C` the requeue test, `F` the
// highest-priority pick). The hook itself (`vo`, [1735,5205)) is transcribed in the seam, because a
// React hook's three closures capture values that only exist inside a render.
// chunk-6zdc3jq1.js contributes `vps`, the capability probe the gate is; it answers `!1` in this
// build, which is why `i4n()` is a constant false and the presentation input is inert.

// chunk-6zdc3jq1.js declares vps, the capability probe the suppression gate reads (false in this build) [2939,2963) 24 units sha256 aa74e3797c5b72352fe2a6a28e072d9e79a97e342a8c2da305ea218769a55e56
function vps(){return!1}

// chunk-356hrhz3.js declares QD, the gate's first wrapper [926,953) 27 units sha256 509f7f44b6fb0951fc75aee309f4be730f8e993badaedd5cd4f6847c8d478b74
function QD(){return vps()}

// chunk-356hrhz3.js declares i4n, the gate itself [953,980) 27 units sha256 a110dcf429b50c73e4e2eb0b4860eebad95ff3082842e71bcb0b8eb63c538cc9
function i4n(){return QD()}

// chunk-356hrhz3.js declares I, the local clear-timer and mount-count holder the hook falls back to [980,1050) 70 units sha256 4f8f6eac3522ad1dba2891e61b835f4f28c7e794709bd960c86a488f2c697a9a
function I(){return{clearTimer:{current:null},mountCount:{current:0}}}

// chunk-356hrhz3.js declares XXe, the state with one notification dropped, out of the current, the queue and the pinned list [1050,1299) 249 units sha256 5826469420a110ab892faf23235b25c7af39726f2bd76d57c3e773d6b1c8a8e4
function XXe(o,n){let s=o.current?.key===n,p=o.queue.some((i)=>i.key===n),d=o.pinned.some((i)=>i.key===n);if(!s&&!p&&!d)return o;return{current:s?null:o.current,queue:o.queue.filter((i)=>i.key!==n),pinned:d?o.pinned.filter((i)=>i.key!==n):o.pinned}}

// chunk-356hrhz3.js declares hEe, the exemption test a notification is held through a diff panel by [1359,1431) 72 units sha256 1b69c6c7da5d89299da0a68958bba3dc38e3325832a9926b083fd3ec7833aa51
function hEe(o,n){return o!==null&&(!n||o.exemptFromDiffPanelHold===!0)}

// chunk-356hrhz3.js declares D, the queue class of a key [1707,1735) 28 units sha256 e76fafe28bbf283b8c949a215d31b3663d87528444c1cd790f38e4fb87a6219f
function D(o){return"queue"}

// chunk-356hrhz3.js declares Xmt, the priority order the two helpers compare with [5205,5249) 44 units sha256 c95f296d65defebced0cdf5f5dc7cf85468dcec9c16d3fa49f5ad591eccfebd0
var Xmt={immediate:0,high:1,medium:2,low:3};

// chunk-356hrhz3.js declares C, whether a notification may requeue behind the one taking the slot [5249,5384) 135 units sha256 eef421e9c00798bb0804bc32dd10eeff5d35fed55eab7270626a8ef73b8bcafb
function C(o,n){return(o.priority!=="immediate"||o.requeueOnPreempt===!0||o.heldDuringDiffPanel===!0)&&!n.invalidates?.includes(o.key)}

// chunk-356hrhz3.js declares F, the highest-priority notification a list holds [5384,5481) 97 units sha256 d7d7f59464b6435cfd392d6157736d5950f9e667babf24e7679e325ae4560bfc
function F(o){if(o.length===0)return;return o.reduce((n,s)=>Xmt[s.priority]<Xmt[n.priority]?s:n)}


export { vps, QD, i4n, I, XXe, hEe, D, Xmt, C, F };
