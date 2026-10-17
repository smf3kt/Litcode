// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-mvsmkx6d.js sha256 78b6816967ea34054d2cf68f13e3baa99249fa08da96cfe43e1d080b422b9c7a
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The two stores emit through the signal the registry copy already carries.
import { Oe } from './plugin-chain-registry-stores-source.js';

// chunk-mvsmkx6d.js `i` the image-file probe store, `s`/`Q8n` the capability defaults and names, `o` the capability readings store [947,2782) 1835 units sha256 016792f46659516aaf2a2fab96f2280890962bcc94a42f8e8e82bcaa9bbe6139
class i{reading;settled=Oe();constructor(e){this.reading=e===void 0?{state:"unasked"}:{state:"settled",value:e.value,source:e.source}}get(){return this.reading}now(){return this.reading.state==="settled"&&this.reading.value}begin(){if(this.reading.state!=="unasked")return!1;return this.reading={state:"asking"},!0}unask(){if(this.reading.state==="asking")this.reading={state:"unasked"}}answer(e){if(this.reading.state==="settled")return!1;this.reading={state:"settled",...e};try{this.settled.emit(e.value)}finally{this.settled.clear()}return!0}onSettle(e){if(this.reading.state==="settled")return e(this.reading.value),()=>{};return this.settled.subscribe(e)}}var s={extendedKeys:!1,synchronizedOutput:!1,kittyKeyboard:!0,kittyGraphics:!1,mousePixels:!1,programStatus:!1},Q8n=Object.keys(s);class o{readings=new Map;answeredYes=new Set;listeners=new Map;constructor(e){for(let t of Q8n){let r=e[t];this.readings.set(t,"settled"in r?{state:"settled",value:r.settled,source:r.source}:{state:"pending",likely:r.likely,source:r.source})}}get(e){return this.readings.get(e)}now(e){let t=this.get(e);return t.state==="settled"?t.value:s[e]}confirmed(e){return this.answeredYes.has(e)}pending(){return Q8n.filter((e)=>this.get(e).state==="pending")}answer(e,t,r){let n=this.get(e);if(n.state==="settled"){if(t&&n.value)this.answeredYes.add(e);return!1}if(t)this.answeredYes.add(e);return this.settle(e,t,r),!0}deadline(){for(let e of this.pending()){let t=this.get(e);this.settle(e,t.likely,`${t.source}, no answer`)}}onSettle(e,t){let r=this.get(e);if(r.state==="settled")return t(r.value),()=>{};let n=this.listeners.get(e)??new Set;return this.listeners.set(e,n),n.add(t),()=>{n.delete(t)}}settle(e,t,r){this.readings.set(e,{state:"settled",value:t,source:r});let n=this.listeners.get(e);this.listeners.delete(e);for(let p of n??[])p(t)}}


export { i, o, s, Q8n };
