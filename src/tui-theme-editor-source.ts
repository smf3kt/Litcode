// @ts-nocheck
// Exact bodies: research/ports/W44-theme-editor-copies.json.
import {HK} from './tui-theme-overrides-source.js';
function ozr(e){return e.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"theme"}
function gn(ue,a){let L=ozr(ue);if(!a.some((d)=>d.slug===L))return L;for(let d=2;;d++){let ie=`${L}-${d}`;if(!a.some((G)=>G.slug===ie))return ie}}
export function initializeThemeFileWriter({j,mr,_,Fe,t,gt,Jne,C,PQe,K}) {
async function rWt(e,r){let s={name:e.name,base:e.base,overrides:e.overrides},i=`${e.slug}.json`;if(j()&&r!==void 0&&mr(i)){let m=_(s,null,2)+`
`,h=await r.write(Fe.userConfigDir("themes",[i]),m,{publishDiscipline:"atomic",mode:438&~process.umask()});if(!h.ok)throw t(`[theme] v5 save ${e.slug} failed: ${gt(h.error)}`,{level:"warn"}),Error("theme save failed");return}await Jne(C(PQe(),`${e.slug}.json`),K,{defaultValue:()=>({name:e.slug,base:"dark",overrides:{}}),ensureDir:!0,indent:2,trailingNewline:!0}).write(s)}
  return rWt;
}
export function initializeThemeEditorActions({i,f,c,T,g,m,u,le,Mn,v,rWt,t,lt,ft,De,qs,Re,U,Ke,Je,at,Ue,Te,ie,DX,d}) {
function A(Ee){return i[Ee]??f[Ee]}
function q(Ct,F){Mn(F),v(F),rWt({slug:Ct,name:m.trim(),base:u,overrides:F,source:"user"},le).catch((yt)=>{t(`[theme] save ${Ct} failed: ${yt}`,{level:"warn"})})}
function xe(Tt){let _e=A(Tt);lt(_e),ft(_e.length),De(Tt)}
function Oe(){if(c===null||!HK(T)){return}q(g,T===f[c]?qs(i,c):{...i,[c]:T}),De(null)}
function H(){v(i),De(null)}
function J(ee){if(!(ee in i)){return}q(g,qs(i,ee))}
function de(Ae){if(lt(Ae),c&&HK(Ae))v({...i,[c]:Ae})}
  const create=()=>{if(!Re){return}Je(U),at(Ke),Ue("colors"),rWt({slug:U,name:Ke,base:u,overrides:i,source:"user"},le).then(()=>Te()).then(()=>{ie(DX(U))}).catch((So)=>{t(`[theme] save ${U} failed: ${So}`,{level:"warn"})})};
  const done=()=>{v(null),d({slug:g,name:m,base:u,overrides:i,source:"user"})};
  return {effective:A,commit:q,edit:xe,accept:Oe,cancel:H,reset:J,change:de,create,done};
}
export {ozr,gn};
