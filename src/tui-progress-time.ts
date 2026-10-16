// @ts-nocheck
// Exact source bodies: research/ports/W44-progress-copies.json.
const a = process.env, S = new Map, f = new WeakMap, c = new Map, d = new Map;
const Qe = (value,separator) => value.split(separator,1)[0];
const w_t = () => ({kind:"preset",preset:"auto",timeZone:undefined});
const gKo = () => "";
var ae={today:{hour:"numeric",minute:"2-digit"},week:{weekday:"long",hour:"numeric",minute:"2-digit"},older:{weekday:"long",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}};
var le={week:{weekday:"long"},older:{weekday:"long",month:"short",day:"numeric"}};
var ce={year:"numeric",month:"2-digit",day:"2-digit"};
function p(e){if(!e)return"";let t=f.get(e);if(t!==void 0)return t;let r=Object.entries(e).sort(([i],[o])=>i<o?-1:i>o?1:0),n="";for(let[i,o]of r)n+=`${i}=${String(o)};`;return f.set(e,n),n}
function cPe(e,t){return t?{...e,timeZone:t}:e}
function zB(e,t){let r=`${e??""}|${p(t)}`,n=c.get(r);if(!n)n=new Intl.DateTimeFormat(e,t),c.set(r,n);return n}
function qIs(e,t){let r=`${e??""}|${p(t)}`,n=d.get(r);if(!n)n=new Intl.NumberFormat(e,t),d.set(r,n);return n}
function D(t,e,r){switch(e){case"auto":return cPe(t,r);case"12-hour":return cPe({...t,hourCycle:"h12"},r);case"24-hour":case"24-hour-utc":return cPe({...t,hourCycle:"h23"},r)}}
function FJn(t,e,r,o){let g=zB(r,D(e,t.preset,t.timeZone));if(t.preset!=="24-hour-utc")return g.format(o);let i=g.formatToParts(o),u=i.findLastIndex((n)=>n.type==="minute"||n.type==="second");return i.map((n,c)=>c===u?`${n.value}Z`:n.value).join("")}
function AWe(){let t=a.LC_ALL||a.LC_TIME||a.LANG||"";if(S.has(t))return S.get(t);let e=R(t);return S.set(t,e),e}
function R(t){if(!t||t==="C"||t==="POSIX")return;let e=Qe(Qe(t,"."),"@");if(!e)return;let r=e.replaceAll("_","-");try{return new Intl.DateTimeFormat(r),r}catch{return}}
function G(d,t){if(!t)return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();let o=zB("en-US",cPe(ce,t)).formatToParts(d),a={};for(let i of o)a[i.type]=i.value;return Date.UTC(Number(a.year),Number(a.month)-1,Number(a.day))}
function EXe(d,t=new Date){let o=new Date(d);if(Number.isNaN(o.getTime()))return"";let a=AWe(),i=w_t(),{timeZone:m}=i,u=G(t,m)-G(o,m),g=Math.round(u/86400000),l="older";if(g===0)l="today";else if(g>0&&g<7)l="week";if(i.kind==="preset")return FJn(i,ae[l],a,o);let p=gKo(i.pattern,m,o);if(l==="today")return p;let c=zB(a,cPe(le[l],m)).format(o);return l==="week"?`${c} ${p}`:`${c}, ${p}`}
export {EXe,qIs,zB,cPe,FJn,AWe};

export function initializeProgressText(ae, ra) {
function ct(e,t){if(ae(e)<=t)return e;if(t<=1)return"\u2026";let r=0,n="";for(let{segment:s}of ra().segment(e)){let o=ae(s);if(r+o>t-1)break;n+=s,r+=o}return n+"\u2026"}
var ce={notation:"compact",maximumFractionDigits:1,minimumFractionDigits:1};
var le={notation:"compact",maximumFractionDigits:1,minimumFractionDigits:0};
function Bs(e){let t=e>=1000;return qIs("en-US",t?ce:le).format(e).toLowerCase()}
return {ct, Bs};
}
