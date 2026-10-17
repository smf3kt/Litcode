// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-tvdq3hrk.js sha256 d425ee99ec3ed8d974bc6559b8483cf045cb98a23309866d96ed43e41cf433c5
//   chunk-kjfwbh4w.js sha256 67018559b1d682a322cc8191a5a7f7fe1137ea8bd16e7f56c7a294e8af2c9858
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { Ge, bs } from "./plugin-chain-source.js";
import { Ohe } from "./plugin-chain-press-dispatch-source.js";
import { UPn } from "./plugin-chain-press-source.js";

// chunk-tvdq3hrk.js select open store [2954,2990) 36 units sha256 c6d1ce98de6ab8069070f8a0fbdb79ee20affd4b8dd41bda8ab32cf14cbd8776
var A5t=Ge(bs(),(e)=>e.set(void 0));

// chunk-tvdq3hrk.js select second store [2990,3026) 36 units sha256 404c586a16c9288d43ed6b5f9cad835da9819ffe5540cbf054fe86acdd7ece4b
var C5t=Ge(bs(),(e)=>e.set(void 0));

// chunk-tvdq3hrk.js select highlight store [3026,3062) 36 units sha256 3e21d94983d677181b78c9004ec850c4fb355819b833c4d124e048d53c3a0eac
var T5t=Ge(bs(),(e)=>e.set(void 0));

// chunk-tvdq3hrk.js seat store key [3062,3092) 30 units sha256 9a245126dd02f499d633c1e91d58cb122571bb6868cfdc0c0d7aaaf973092250
var qAt=(e,r)=>`${e}\x00${r}`;

// chunk-tvdq3hrk.js highlight read [3092,3145) 53 units sha256 465559e19353491f0c78f421c56f87500314fdb8d04af168952a667aecf32411
function KAt(e,r){return T5t.get()?.get(qAt(e,r))??0}

// chunk-tvdq3hrk.js map without keys [3145,3216) 71 units sha256 404ba177f36534acf28562e5c66e59232372a84ce6f7190d932cbde3149e840f
function Xrt(e,r){let n=new Map(e);for(let i of r)n.delete(i);return n}

// chunk-tvdq3hrk.js advance highlight [3216,3373) 157 units sha256 403928f4482d1ab5a132296f57753c7f63e7dd14e6a780e7c02e60fe9b8f5e5f
function mro(e,r){let n=qAt(e,r),i=KAt(e,r)+1;A5t.set(Xrt(A5t.get()??new Map,[n])),C5t.set(Xrt(C5t.get()??new Map,[n])),T5t.set(new Map(T5t.get()).set(n,i))}

// chunk-kjfwbh4w.js inputFromTerminal [45567,45639) 72 units sha256 73cdfcb5f27e3ab77b2e911adf1afdf0e46c3896e84ca3c09276d887b8647035
var nDr=(o)=>Ohe(`ui.input ${o.plugin}`,UPn({...o,surface:"terminal"}));


export { A5t, C5t, T5t, qAt, KAt, Xrt, mro, nDr };
