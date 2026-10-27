// @ts-nocheck
// Exact recovered declarations. Regenerate or verify with scripts/copy-source-plan.mjs.
// The recovered E6 statement-coverage check, wrapped so it returns null when it
// finds nothing. `n` is the UTF-8 byte view of the command, `t` its parse tree.
function statementCoverage(n,t){// chunk-zjewzgfh.js E6.statementCoverage [9498,10028), UTF-16; sha256 ee47f73f32d95eb6fdf52d8da4ae42a548b6d90fa736baf4f19b27d03075d86c
let l=(y)=>y===32||y===9||y===10||y===13||y===59||y===38,a=(y,k)=>{let w=y;while(w<k){let N=n[w];if(l(N))w++;else if(N===92&&(n[w+1]===10||n[w+1]===13&&n[w+2]===10))w+=n[w+1]===13?3:2;else break}return w},h=t.children.filter((y)=>y!==null).map((y)=>[y.startIndex,y.endIndex]).sort((y,k)=>y[0]-k[0]),p=0;for(let[y,k]of h){if(a(p,y)<y)return{kind:"too-complex",reason:"Parser skipped input between top-level statements"};if(k>p)p=k}if(a(p,n.length)<n.length)return{kind:"too-complex",reason:"Parser did not consume trailing input"};
return null;}
export { statementCoverage };
