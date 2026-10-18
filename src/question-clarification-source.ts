// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: ./question-clarification-source-blocks.json.
// Modules:
//   chunk-24k7d6mw.js sha256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.

// chunk-24k7d6mw.js nmo question clarification feedback [1179811,1180104) 293 units sha256 4d3738033b47d7348d6d684aa1207d0301971104f00eab703eac5b531d3d0472
function nmo(h,T,M,L,ee){return h.map((he,we)=>{let Te=M[he.key],Me=!ee&&zet(he)?L[he.key]?.textInputValue?.trim():void 0,He=[`- "${(T[we]??he).displayQuestion.text}"`];if(He.push(Te?`  Answer: ${Te}`:"  (No answer provided)"),Me)He.push(`  User notes: ${Me}`);return He.join(`
`)}).join(`
`)}

// chunk-24k7d6mw.js zet preview single-select gate [1180104,1180182) 78 units sha256 1666681dad47d5d944d49736413ca84ffb20d3c1303825e9ffd05566c092d01c
function zet(h){return!h.multiSelect&&h.options.some((T)=>T.preview!==void 0)}


export { nmo, zet };
