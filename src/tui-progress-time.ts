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
// Source chunk-7d9mja9n.js `L` [3905,4031), `fKo` [4031,4139), `E` [4139,4278) and `mKo`
// [4278,4665): the clock the message stamp uses. `fKo` is the short time; `mKo` the full date,
// time and zone. `P` [1152,2439) with `s`/`_`/`y`/`A`/`d`/`Z` serves the pattern kind.
var L={"2-digit":{hour:"2-digit",minute:"2-digit",hourCycle:"h12"},numeric:{hour:"numeric",minute:"2-digit",hourCycle:"h12"}};
var E={year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23",timeZoneName:"short"};
function fKo(t,e,r,o="2-digit"){return t.kind==="pattern"?l(t.pattern,t.timeZone,e,r):FJn(t,L[o],"en-US",e)}
function mKo(t,e,r,o){let g=t.timeZone??o;if(t.kind==="pattern")return l(t.pattern,g,e,r);let i=D(E,t.preset,g),u=zB("en-US",i).formatToParts(e),n={};for(let p of u)n[p.type]=p.value;let c=n.dayPeriod?` ${n.dayPeriod}`:"",m="";if(t.preset==="24-hour-utc")m="Z";else if(n.timeZoneName)m=` ${n.timeZoneName}`;return`${n.year}-${n.month}-${n.day} ${n.hour}:${n.minute}:${n.second}${c}${m}`}
function l(t,e,r,o){return P(t,r,{locale:o,timeZone:e})}
function P(t,e,{locale:r,timeZone:o}){let g=zB("en-US",cPe(b,o)).formatToParts(e),i={};for(let T of g)i[T.type]=T.value;let u=Number(i.year),n=Number(i.month),c=Number(i.day),m=Number(i.hour),p=(m+11)%12+1,h=new Date(Date.UTC(u,n-1,c)).getUTCDay();return t.replace(/%(-?)([\s\S])/g,(T,f,O)=>{switch(O){case"Y":return String(u);case"y":return s(u%100,f);case"C":return s(Math.floor(u/100),f);case"m":return s(n,f);case"d":return s(c,f);case"e":return y(c,f);case"j":return _(A(u,n,c),f);case"u":return String(h===0?7:h);case"w":return String(h);case"H":return s(m,f);case"k":return y(m,f);case"I":return s(p,f);case"l":return y(p,f);case"M":return s(Number(i.minute),f);case"S":return s(Number(i.second),f);case"p":return m<12?"AM":"PM";case"P":return m<12?"am":"pm";case"s":return String(Math.floor(e.getTime()/1000));case"a":return dl(e,r,o,I);case"A":return dl(e,r,o,M);case"b":case"h":return dl(e,r,o,N);case"B":return dl(e,r,o,x);case"Z":return i.timeZoneName??"";case"z":return Z(e,u,n,c,m,i);case"F":return`${u}-${s(n,"")}-${s(c,"")}`;case"D":return`${s(n,"")}/${s(c,"")}/${s(u%100,"")}`;case"T":return`${s(m,"")}:${i.minute}:${i.second}`;case"R":return`${s(m,"")}:${i.minute}`;case"r":return`${s(p,"")}:${i.minute}:${i.second} ${m<12?"AM":"PM"}`;case"%":return"%";default:return T}})}
function s(t,e){return e?String(t):String(t).padStart(2,"0")}
function _(t,e){return e?String(t):String(t).padStart(3,"0")}
function y(t,e){return e?String(t):String(t).padStart(2," ")}
function A(t,e,r){return(Date.UTC(t,e-1,r)-Date.UTC(t,0,1))/86400000+1}
function dl(t,e,r,o){return zB(e,cPe(o,r)).format(t)}
function Z(t,e,r,o,g,i){let u=Date.UTC(e,r-1,o,g,Number(i.minute),Number(i.second)),n=Math.floor(t.getTime()/1000)*1000,c=Math.round((u-n)/60000),m=c<0?"-":"+",p=Math.abs(c);return`${m}${String(Math.floor(p/60)).padStart(2,"0")}${String(p%60).padStart(2,"0")}`}
var b={year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23",timeZoneName:"short"};
var I={weekday:"short",calendar:"gregory"};
var M={weekday:"long",calendar:"gregory"};
var N={month:"short",calendar:"gregory"};
var x={month:"long",calendar:"gregory"};
export {EXe,qIs,zB,cPe,FJn,AWe,fKo,mKo};

export function initializeProgressText(ae, ra) {
function ct(e,t){if(ae(e)<=t)return e;if(t<=1)return"\u2026";let r=0,n="";for(let{segment:s}of ra().segment(e)){let o=ae(s);if(r+o>t-1)break;n+=s,r+=o}return n+"\u2026"}
var ce={notation:"compact",maximumFractionDigits:1,minimumFractionDigits:1};
var le={notation:"compact",maximumFractionDigits:1,minimumFractionDigits:0};
function Bs(e){let t=e>=1000;return qIs("en-US",t?ce:le).format(e).toLowerCase()}
return {ct, Bs};
}
