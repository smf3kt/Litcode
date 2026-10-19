// @ts-nocheck
// Exact source bodies: research/ports/W44-progress-settings-copies.json.
import {zB,cPe,FJn,AWe,fKo,mKo} from "./tui-progress-time.js";
function initializeFormatCleanup() {
function ne(t,n){if(n<=0)return"";if(t.length<=n)return t;let e=t.slice(0,n),r=e.charCodeAt(n-1);return WMt(r>=55296&&r<=56319?e.slice(0,-1):e)}
function WMt(t){if(typeof Buffer<"u")return Buffer.from(t,"utf16le").toString("utf16le");return x(t)}
function x(t){let e=[];for(let r=0;r<t.length;r+=8192){let i=Math.min(r+8192,t.length),o=new Uint16Array(i-r);for(let u=r;u<i;u++)o[u-r]=t.charCodeAt(u);e.push(String.fromCharCode(...o))}return e.join("")}
var a=/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
var l=typeof String.prototype.isWellFormed==="function"?Function.prototype.call.bind(String.prototype.isWellFormed):void 0;
function Gw(t){if(l&&l(t))return t;return t.replace(a,"")}
function jP(t){return t.replace(/[\p{Cc}\p{Cf}\p{Cs}\p{Default_Ignorable_Code_Point}\u2028\u2029]/gu,"")}
var d=/[\u001B\u009B][[\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*|[a-zA-Z\d]+(?:;[-a-zA-Z\d/#&.:=?%@~_]*)*)?(?:\u0007|\u001B\u005C|\u009C))|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;
function uy(t){return Gw(t).replace(d,"").replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu,"")}
return {ne,jP,uy};
}
export function initializeProgressTime(hs) {
const {ne,jP,uy}=initializeFormatCleanup();
var w9e=["auto","12-hour","24-hour","24-hour-utc"];
var b={year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23",timeZoneName:"short"};
var I={weekday:"short",calendar:"gregory"};
var M={weekday:"long",calendar:"gregory"};
var N={month:"short",calendar:"gregory"};
var x={month:"long",calendar:"gregory"};
function P(t,e,{locale:r,timeZone:o}){let g=zB("en-US",cPe(b,o)).formatToParts(e),i={};for(let T of g)i[T.type]=T.value;let u=Number(i.year),n=Number(i.month),c=Number(i.day),m=Number(i.hour),p=(m+11)%12+1,h=new Date(Date.UTC(u,n-1,c)).getUTCDay();return t.replace(/%(-?)([\s\S])/g,(T,f,O)=>{switch(O){case"Y":return String(u);case"y":return s(u%100,f);case"C":return s(Math.floor(u/100),f);case"m":return s(n,f);case"d":return s(c,f);case"e":return y(c,f);case"j":return _(A(u,n,c),f);case"u":return String(h===0?7:h);case"w":return String(h);case"H":return s(m,f);case"k":return y(m,f);case"I":return s(p,f);case"l":return y(p,f);case"M":return s(Number(i.minute),f);case"S":return s(Number(i.second),f);case"p":return m<12?"AM":"PM";case"P":return m<12?"am":"pm";case"s":return String(Math.floor(e.getTime()/1000));case"a":return d(e,r,o,I);case"A":return d(e,r,o,M);case"b":case"h":return d(e,r,o,N);case"B":return d(e,r,o,x);case"Z":return i.timeZoneName??"";case"z":return Z(e,u,n,c,m,i);case"F":return`${u}-${s(n,"")}-${s(c,"")}`;case"D":return`${s(n,"")}/${s(c,"")}/${s(u%100,"")}`;case"T":return`${s(m,"")}:${i.minute}:${i.second}`;case"R":return`${s(m,"")}:${i.minute}`;case"r":return`${s(p,"")}:${i.minute}:${i.second} ${m<12?"AM":"PM"}`;case"%":return"%";default:return T}})}
function s(t,e){return e?String(t):String(t).padStart(2,"0")}
function _(t,e){return e?String(t):String(t).padStart(3,"0")}
function y(t,e){return e?String(t):String(t).padStart(2," ")}
function A(t,e,r){return(Date.UTC(t,e-1,r)-Date.UTC(t,0,1))/86400000+1}
function d(t,e,r,o){return zB(e,cPe(o,r)).format(t)}
function Z(t,e,r,o,g,i){let u=Date.UTC(e,r-1,o,g,Number(i.minute),Number(i.second)),n=Math.floor(t.getTime()/1000)*1000,c=Math.round((u-n)/60000),m=c<0?"-":"+",p=Math.abs(c);return`${m}${String(Math.floor(p/60)).padStart(2,"0")}${String(p%60).padStart(2,"0")}`}
var F=100;
function NJn(t){return ne(jP(uy(t)),F)}
function C(t,e){let r=w9e.find((i)=>i===t);if(r==="24-hour-utc")return{kind:"preset",preset:r,timeZone:"UTC"};let o=k(e);if(r)return{kind:"preset",preset:r,timeZone:o};let g=NJn(t);return g.includes("%")?{kind:"pattern",pattern:g,timeZone:o}:{kind:"preset",preset:"auto",timeZone:o}}
function k(t){if(!t)return;try{return zB("en-US",{timeZone:t}),t}catch{return}}
function l(t,e,r,o){return ne(P(t,r,{locale:o,timeZone:e}),F)}
function w_t(){return C(hs("timeFormat","auto").value,hs("timeZone","").value)}
function gKo(t,e,r){return l(t,e,r,AWe())}
var ae={today:{hour:"numeric",minute:"2-digit"},week:{weekday:"long",hour:"numeric",minute:"2-digit"},older:{weekday:"long",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}};
var le={week:{weekday:"long"},older:{weekday:"long",month:"short",day:"numeric"}};
var ce={year:"numeric",month:"2-digit",day:"2-digit"};
function G(d,t){if(!t)return new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();let o=zB("en-US",cPe(ce,t)).formatToParts(d),a={};for(let i of o)a[i.type]=i.value;return Date.UTC(Number(a.year),Number(a.month)-1,Number(a.day))}
function EXe(d,t=new Date){let o=new Date(d);if(Number.isNaN(o.getTime()))return"";let a=AWe(),i=w_t(),{timeZone:m}=i,u=G(t,m)-G(o,m),g=Math.round(u/86400000),l="older";if(g===0)l="today";else if(g>0&&g<7)l="week";if(i.kind==="preset")return FJn(i,ae[l],a,o);let p=gKo(i.pattern,m,o);if(l==="today")return p;let c=zB(a,cPe(le[l],m)).format(o);return l==="week"?`${c} ${p}`:`${c}, ${p}`}
function short(d){return fKo(w_t(),d,AWe())}
function stamp(d){return mKo(w_t(),d,AWe())}
return {format:EXe,resolve:w_t,short,stamp};
}
export function initializeSpinnerWords(ft, base) {
const v=base;
function jFt(){let n=ft().spinnerVerbs;if(!n)return v;if(n.mode==="replace")return n.verbs.length>0?n.verbs:v;return[...v,...n.verbs]}
return jFt;
}
