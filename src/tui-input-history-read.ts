// @ts-nocheck
// Exact source body; provenance: research/ports/W44-history-copies.json.
export function initializeHistoryReader(Q) {
async function*T8e(e){let r=await Q(e,"r");try{let i=(await r.stat()).size,o=Buffer.alloc(0),a=Buffer.alloc(4096);while(i>0){let u=Math.min(4096,i);i-=u,await r.read(a,0,u,i);let l=Buffer.concat([a.subarray(0,u),o]),c=l.indexOf(10);if(c===-1){o=l;continue}o=Buffer.from(l.subarray(0,c));let d=l.toString("utf8",c+1).split(`
`);for(let p=d.length-1;p>=0;p--){let m=d[p];if(m)yield m}}if(o.length>0)yield o.toString("utf8")}finally{await r.close()}}
return T8e;
}
