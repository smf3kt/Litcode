// ecfjn15r N/Q/ee/L/re/b/C/ZEe/xmn/w and gwwwxdvd l, UTF-16; exact ranges and adaptations in W293.
import { constants as y } from 'node:fs';
import { open as M, realpath as U } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { z } from 'zod';
import { pn } from './tui-ansi-strip.js';
import { spinnerTipEntriesSchema, type SpinnerTipEntry, type SpinnerTipsLayer, type SpinnerTipsOverride } from './spinner-tips-settings.js';

export interface SpinnerTip {
  id: string;
  label: string;
  content(): Promise<string>;
  cooldownSessions: number;
  priority: number;
  isRelevant(): Promise<boolean>;
  providerAgnostic: true;
}
type FileResult = { entries: SpinnerTipEntry[]; transient: boolean };
const G1r='org-tip:',tYn='custom-tip-',x=500,k=200,v=262144,R='Tip',B=/^[A-Za-z0-9._-]{1,64}$/,H=40;
const P = ['policySettings','flagSettings','userSettings'] as const;
const X = ['projectSettings','localSettings'] as const;
const K='org-tip:file:',J=new Set(['EAGAIN','EBUSY','EINTR','EIO','EMFILE','ENFILE']);
const Z=/[\p{Cc}\p{Cf}\u{2028}\u{2029}\u{180e}\u{fe00}-\u{fe0f}\u{e0100}-\u{e01ef}]/gu;
const a=/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const wellFormed = Reflect.get(String.prototype, 'isWellFormed');
const l=typeof wellFormed==='function'?(value: string)=>Reflect.apply(wellFormed,value,[]):undefined;
function Gw(t: string){if(l&&l(t))return t;return t.replace(a,'')}
function WMt(t: string){return Buffer.from(t,'utf16le').toString('utf16le')}
function ne(t: string,n: number){if(n<=0)return'';if(t.length<=n)return t;let e=t.slice(0,n),r=e.charCodeAt(n-1);return WMt(r>=55296&&r<=56319?e.slice(0,-1):e)}
function Ept(e: string){return Gw(pn(Gw(String(e))))}
function N(e: string){return Ept(e).replace(/[\t\n\r\u{2028}\u{2029}]+/gu,' ').replace(Z,'').replace(/ {2,}/g,' ').trim()}
function Q(e?: string){if(e===undefined)return R;let i=ne(N(e),H);return i===''?R:i}
function Io(e: string){return e.startsWith('﻿')?e.slice(1):e}
const V=z.union([z.array(z.unknown()),z.object({tips:z.array(z.unknown())}).transform(e=>e.tips)]);
function errno(e: unknown): string | undefined {
  return e instanceof Error && 'code' in e && typeof e.code === 'string' ? e.code : undefined;
}
export class SpinnerTipFileCache {
  private readonly entries = new Map<string, Promise<FileResult>>();
  get size(): number { return this.entries.size; }
  read(file: string, warn: (message: string) => void): Promise<FileResult> {
    const prior = this.entries.get(file);
    if (prior) return prior;
    const pending = this.load(file, warn).then(result => {
      if (result.transient) this.entries.delete(file);
      return result;
    });
    this.entries.set(file, pending);
    return pending;
  }
  private async load(e: string,t: (message: string) => void): Promise<FileResult> {
    try {
      let i=process.platform==='win32'?0:y.O_NOFOLLOW|y.O_NONBLOCK,r=await M(await U(e),y.O_RDONLY|i),n;
      try {
        let f=await r.stat();
        if(!f.isFile()){t(`spinnerTipsOverride.tipsFile ${e} is not a regular file; ignoring it`);return {entries:[],transient:false}}
        if(f.size>v){t(`spinnerTipsOverride.tipsFile ${e} is larger than ${v} bytes; ignoring it`);return {entries:[],transient:false}}
        let c=Buffer.alloc(v+1),{bytesRead:_}=await r.read(c,0,c.length,0);
        if(_>v)return {entries:[],transient:false};
        n=Io(c.toString('utf8',0,_));
      } finally { await r.close(); }
      let l=V.safeParse(JSON.parse(n)),d=l.success?spinnerTipEntriesSchema.parse(l.data):undefined;
      if(d===undefined){t(`spinnerTipsOverride.tipsFile ${e} must be a JSON array of tips (or {"tips": [...]}); ignoring it`);return {entries:[],transient:false}}
      return {entries:d,transient:false};
    } catch(i) {
      let r=errno(i);
      t(r==='ENOENT'?`spinnerTipsOverride.tipsFile ${e} does not exist; no file tips loaded`
        :`spinnerTipsOverride.tipsFile ${e} could not be read: ${i instanceof Error?i.message:String(i)}`);
      return {entries:[],transient:r!==undefined&&J.has(r)};
    }
  }
}
const fileCache = new SpinnerTipFileCache();

export function initializeSpinnerTips(layers: readonly SpinnerTipsLayer[],t: (message: string) => void,
  cache = fileCache) {
  function re(e?: string){
    if(!e)return;
    if(!path.isAbsolute(e)&&e!=='~'&&!e.startsWith('~/')){t(`spinnerTipsOverride.tipsFile must be an absolute or ~/ path (got "${e}"); ignoring it`);return}
    if(hj(e)){t('spinnerTipsOverride.tipsFile must be a local path, not a network (UNC) path; ignoring it');return}
    try {
      if(e.includes('\x00'))throw new TypeError('Path contains a null byte');
      let i=(e.trim()==='~'?os.homedir():e.trim().startsWith('~/')?path.join(os.homedir(),e.trim().slice(2)):path.resolve(e.trim())).normalize('NFC');
      return hj(i)?undefined:i;
    } catch(i){t(`spinnerTipsOverride.tipsFile "${e}" is not a usable path: ${i instanceof Error?i.message:String(i)}`);return}
  }
  function hj(t: string){return /^[\\/]{2}/.test(t)||/^[\\/]\?\?[\\/]/.test(t)||t.includes('??')&&/^[\\/]\?\?[\\/]/.test(path.win32.normalize(t))}
  function b(e: readonly SpinnerTipsLayer['source'][]){
    let i: SpinnerTipsLayer[]=[];
    for(let r of e){let n=layers.find(item=>item.source===r)?.override;if(n)i.push({source:r,override:n})}
    return i;
  }
  function C<Key extends keyof SpinnerTipsOverride>(e: SpinnerTipsLayer[],i: Key){return e.find(r=>r.override[i]!==undefined)?.override[i]}
  function ZEe(){let e=b(P);if(C(e,'excludeDefault')!==true)return false;return e.some(i=>!!i.override.tipsFile)||e.some(i=>(i.override.tips?.length??0)>0)}
  async function xmn(){
    let i=b(P),r=b(X);
    if(i.length===0&&r.length===0)return {tips:[],trustedCount:0};
    let n=Q(C(i,'label')),l=i.find(s=>!!s.override.tipsFile),d=l?.source,f=re(l?.override.tipsFile);
    for(let {source:s,override:o} of r)if(o.tipsFile||o.label!==undefined)t(`spinnerTipsOverride.tipsFile/label in ${s} are ignored; set them in user or managed settings`);
    let c=f?(await cache.read(f,t)).entries:[],_=new Set<string>(),S: SpinnerTip[]=[],
      h=(s: string,o: string,a: number,T: number,D: string)=>{
        if(S.length>=k)return;
        let F=N(o);
        if(F===''){t(`spinnerTipsOverride: tip "${s}" is empty after sanitizing; dropped`);return}
        if(F.length>x){t(`spinnerTipsOverride: tip "${s}" is longer than ${x} characters; dropped`);return}
        if(_.has(s)){t(`spinnerTipsOverride: duplicate tip id "${s}"; keeping the first`);return}
        _.add(s);S.push({id:s,label:D,content:async()=>F,cooldownSessions:a,priority:T,isRelevant:async()=>true,providerAgnostic:true});
      },I=0;
    for(let {source:s,override:o} of i){for(let a of o.tips??[])w(a,`${tYn}${I++}`,n,h);if(s===d)c.forEach((a,T)=>w(a,`${K}${T}`,n,h))}
    let z=S.length;
    for(let {source:s,override:o} of r)for(let a of o.tips??[]){let T=`${tYn}${I++}`;if(typeof a==='string')w(a,T,R,h);else t(`spinnerTipsOverride: object tip entries in ${s} are ignored; only plain strings are read from project settings`)}
    return {tips:S,trustedCount:z};
  }
  function w(e: SpinnerTipEntry,i: string,r: string,n: (id: string,text: string,cooldown: number,priority: number,label: string)=>void){
    if(typeof e==='string'){n(i,e,0,0,r);return}
    if(typeof e.text!=='string'){t('spinnerTipsOverride: tip object without a "text" string; dropped');return}
    if(typeof e.id!=='string'||!B.test(e.id)){t('spinnerTipsOverride: tip object needs an "id" of 1-64 letters, digits, ".", "_" or "-"; dropped');return}
    let l=typeof e.cooldownSessions==='number'&&Number.isInteger(e.cooldownSessions)&&e.cooldownSessions>=0?Math.min(e.cooldownSessions,1000):0,
      d=typeof e.priority==='number'&&Number.isFinite(e.priority)?Math.max(-10,Math.min(10,Math.trunc(e.priority))):0;
    n(`${G1r}${e.id}`,e.text,l,d,r);
  }
  return { xmn, ZEe };
}

// l, gwwwxdvd [1852,2099), UTF-16; jj is the local startup-history reader.
export function selectSpinnerTip(e: SpinnerTip[],jj: (id: string)=>number): SpinnerTip | undefined {
  if(e.length===0)return;if(e.length===1)return e[0];
  let n=e.map(t=>({tip:t,sessions:jj(t.id)}));
  return n.sort((t,o)=>{if(t.sessions!==o.sessions)return o.sessions-t.sessions;return(o.tip.priority??0)-(t.tip.priority??0)}),n[0]?.tip;
}
