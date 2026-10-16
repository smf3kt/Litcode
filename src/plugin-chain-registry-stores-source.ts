// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-fdxhcr6b.js sha256 3c625e31827ca4ef7cc3a4691103fbbb3abbdd338778cbf70c0054f37359507b
//   chunk-tavdbgyw.js sha256 3ce548e44986d7954bff4d9ce784041040c20028b4176413cd5d459072106d80
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The two change helpers the registry state is built from, and the async-resource binder both use.
// `gs` and `Ein` also appear verbatim in src/tui-stream-preview.ts (the W44 preview copies, marked
// @ts-nocheck and not exported); this copy carries its own byte-identical blocks rather than editing
// that closed artifact, which is the reason recorded in the package's evidence.

// chunk-fdxhcr6b.js declares Ein beside its module-local async_hooks binding: bind a listener to an AsyncResource when the builtin is available, otherwise hand it straight back [1094,1196) 102 units sha256 8c4b88d7338f1af7c89e5e917241f29229a81e4cb4b0eee1a21d68d4308250a7
var s=globalThis.process?.getBuiltinModule?.("async_hooks"),Ein=s?(e)=>s.AsyncResource.bind(e):(e)=>e;

// chunk-fdxhcr6b.js declares Oe, the change signal: subscribe/emit/clear, where emit keeps every listener throw and re-throws a lone one directly and several as an AggregateError [1196,1457) 261 units sha256 6703493291decd431abb119359c5ea3b30a454972a308176f08d739380f9a04c
function Oe(){let e=new Set;return{subscribe(n){let r=Ein(n);return e.add(r),()=>{e.delete(r)}},emit(...n){let r;for(let o of e)try{o(...n)}catch(i){(r??=[]).push(i)}if(r)throw r.length===1?r[0]:AggregateError(r,"Signal listener(s) threw")},clear(){e.clear()}}}

// chunk-tavdbgyw.js declares gs, the store: getSnapshot/getState, setState (Object.is no-op, then the change callback, then every subscriber) and subscribe [1141,1399) 258 units sha256 eb651828dd1a4cfbc847e21510f01061d96dfd4f554a58f3f2167fb5115b81b5
function gs(t,e){let r=t,S=new Set,a=e&&Ein(e),s=()=>r;return{getSnapshot:s,getState:s,setState:(n)=>{let o=r,i=n(o);if(Object.is(i,o))return;r=i,a?.({newState:i,oldState:o});for(let u of S)u()},subscribe:(n)=>{let o=Ein(n);return S.add(o),()=>S.delete(o)}}}


export { Ein, Oe, gs };
