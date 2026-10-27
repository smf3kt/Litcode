// @ts-nocheck
// Exact recovered declarations. Regenerate or verify with scripts/copy-source-plan.mjs.
// chunk-zjewzgfh.js declarations [4728,5314), UTF-16; sha256 c26de7a81df26ba0f5220a854edd0cca07af2ac5986886d2cc25633513ea432e
var ce={">":">",">>":">>","<":"<",">&":">&","<&":"<&",">|":">|","&>":"&>","&>>":"&>>","<<<":"<<<"},K=/\{[^\s]*(,|\.\.)[^\s]*\}/,ue=/\{[^{]*\\}/,fe=/\{[^}]*\\\{/,yit=/[\x00-\x08\x0B-\x1F\x7F]/,lyr=/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/,fLn=/[\u00A0\u1680\u2000-\u200B\u2028\u2029\u202F\u205F\u3000\uFEFF]/,cyr=/\\[ \t]/,dyr=/(?:^|[^ \t\\])(?:\\\\)*\\\n|[ \t](?:\\\\)+\\\n/,Rt=new RegExp(`${cyr.source}|${dyr.source}`),GRt=/(?:^|[^\\])(?:\\\\)*[`$]/,zRt=/(?:^|[^\\])(?:\\\\)*['"]/,mLn=/~\[/,gLn=/(?:^|[\s;&|])=[a-zA-Z_]/,uyr=/<\d*-\d*>/,At=/\{[^}]*['"]/;
// chunk-zjewzgfh.js Fe [6336,7150), UTF-16; sha256 f0ffb512dd2cf2e8c5bd02b9572c6acfa171018d496a0251446eeb8b31cbb48e
function Fe(e){if(!e.includes("{"))return e;let t=[],r=!1,s=!1,o=!1,n=!0,l=0;while(l<e.length){let a=e[l];if(o)if(a==="\\"&&(e[l+1]==="`"||e[l+1]==="\\"||e[l+1]==="$"))t.push(a,e[l+1]),l+=2;else{if(a==="`")o=!1;t.push(a==="{"?" ":a),l++}else if(r){if(a==="'")r=!1;t.push(a==="{"?" ":a),l++}else if(s)if(a==="\\"&&(e[l+1]==='"'||e[l+1]==="\\"||e[l+1]==="`"))t.push(a,e[l+1]),l+=2;else if(a==="`")o=!0,t.push(a),l++;else{if(a==='"')s=!1;t.push(a==="{"?" ":a),l++}else if(a==="\\"&&l+1<e.length){if(t.push(a,e[l+1]),e[l+1]!==`
`)n=!1;l+=2}else if(a==="#"&&n){while(l<e.length&&e[l]!==`
`)t.push(e[l]),l++;n=!0}else if(a==="`")o=!0,n=!1,t.push(a),l++;else{if(a==="'")r=!0;else if(a==='"')s=!0;n=a===" "||a==="\t"||a===`
`||a===";"||a==="|"||a==="&"||a==="("||a===")"||a==="<"||a===">",t.push(a),l++}}return t.join("")}

export { yit, lyr, fLn, Rt, mLn, gLn, uyr, At, Fe };
