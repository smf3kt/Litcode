// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-kjfwbh4w.js sha256 67018559b1d682a322cc8191a5a7f7fe1137ea8bd16e7f56c7a294e8af2c9858
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
import { Xe as e, Ae, R, qt, w, b, s } from './plugin-chain-react-surface.js';
import { kc, Ys } from './plugin-chain-code-host.js';
import { vVe, J4t, Int, HN } from './plugin-chain-leaf-walkers.js';
import { ct } from './plugin-chain-text-clamp-source.js';
import { Ob } from './plugin-chain-code-block-source.js';
import { tq } from './plugin-chain-code-diff-source.js';

// chunk-kjfwbh4w.js `Oe` — truncate one line to a width through the text clamp [19762,19789) 27 units sha256 09cd8f058a4edc93553c1598ef9a5d79b3d8b242b5e5bd6c9211b50041bd5b7c
var Oe=(o,i)=>ct(J4t(o),i);

// chunk-kjfwbh4w.js `Te` — re-highlight every diff line after its marker [19789,19874) 85 units sha256 bd04607cf472c4afe035ff97edc7a9e7029041a53d1b2a6f6a334b70c9672a66
var Te=(o)=>o.map((i)=>({...i,lines:i.lines.map((p)=>p.slice(0,1)+HN(p.slice(1)))}));

// chunk-kjfwbh4w.js `et` — truncate the lines of every hunk to a width [19874,20000) 126 units sha256 9418099effdf13ff8fd6f7218cc92e3d22c67463a16e133df7db7f16f888d9b8
var et=(o,i)=>Te(o).map((p)=>{let a=Math.max(1,i-Int(p));return{...p,lines:p.lines.map((m)=>m.slice(0,1)+Oe(m.slice(1),a))}});

// chunk-kjfwbh4w.js `tt` — truncate a source to a width with the gutter allowance [20000,20154) 154 units sha256 965d7b6e3ab27b1b8d8e14ae1c6c46b62356bc5c356d5470a0e6139fddb9eb10
function tt(o,i,p){let a=o.replace(/\n$/,"").split(`
`),f=Math.max(1,i-(p!==void 0?String(p+a.length-1).length+2:0));return a.map((u)=>Oe(u,f)).join(`
`)}

// chunk-kjfwbh4w.js `adn` — the Code width override context [20162,20179) 17 units sha256 808c120e64889cff9349317508d4f900b3a82b7641318ef83d4801befe4ff1c1
var adn=qt(null);

// chunk-kjfwbh4w.js `rt` — the Code width default, 80 [20179,20189) 10 units sha256 08e1e573d2351e6144ffc80e20b543e1fe4f74ca820f152a6d6b97597a5a9624
var rt=80;

// chunk-kjfwbh4w.js `st` — the source label a Code block highlights under [20189,20250) 61 units sha256 f347badf2b1acf231b8bf1d618ec42137954a742feae6b7ffce39d7f76a9742e
var st=({language:o,path:i})=>o===void 0?i??"":`source.${o}`;

// chunk-kjfwbh4w.js `lt` — the Code site component [20250,21203) 953 units sha256 e4c927c970a3a79664ee198cdd57fc4a197941e2679cbcb6efbabc858e56c784
function lt(o){let u=w(21),{source:i,startLine:p,format:a,wrap:m}=o,f=R(null),d;if(u[0]===b)d=()=>f.current?Math.floor(Ys(f.current).width):0,u[0]=d;else d=u[0];let x=kc(d),g=Ae(adn)??0,h=g>0?g:rt,T=x>0?x:h,S;if(u[1]!==o)S=st(o),u[1]=o,u[2]=S;else S=u[2];let k=S,C=m==="truncate-end",v;if(u[3]!==a||u[4]!==i)v=vVe(i,a),u[3]=a,u[4]=i,u[5]=v;else v=u[5];let G=v,L=G?.kind==="hunks"?G.hunks:void 0,H;if(u[6]!==T||u[7]!==C||u[8]!==L)H=L&&(C?et(L,T):Te(L)),u[6]=T,u[7]=C,u[8]=L,u[9]=H;else H=u[9];let A=H,K;if(u[10]!==T||u[11]!==C||u[12]!==i||u[13]!==p)K=C?tt(i,T,p):i,u[10]=T,u[11]=C,u[12]=i,u[13]=p,u[14]=K;else K=u[14];let W=K,F;if(u[15]!==W||u[16]!==T||u[17]!==k||u[18]!==A||u[19]!==p)F=e(s,{ref:f,flexDirection:"column",flexGrow:1,flexShrink:1,children:A?e(tq,{hunks:A,dim:!1,width:T,filePath:k,firstLine:null}):e(Ob,{code:W,filePath:k,width:T,startLine:p,lineNumbers:p!==void 0})}),u[15]=W,u[16]=T,u[17]=k,u[18]=A,u[19]=p,u[20]=F;else F=u[20];return F}


export { Oe, Te, et, tt, adn, rt, st, lt };
