// @ts-nocheck
import { stat as II, readFile as MI } from "node:fs/promises";
import { createReadStream as AI, fstat as OI } from "node:fs";
import { StringDecoder as CI } from "node:string_decoder";
import { createHash } from "node:crypto";
import { normalize as pathNormalize } from "node:path";
import { Readable as PI } from "node:stream";
import type { FileHandle } from "node:fs/promises";
import type { Stats } from "node:fs";
import { sourceBunHashString } from "./wyhash-source.js";
// Kc, chunk-2zhybd9r.js eeb86fde63b51e60ea159880a9585ebfe10431ed76828ba090090e488c71ed66
// UTF-16 [9688,11000), has 11597, get 15617: bounded, non-TTL cache operations.
export class SourceReadLRU<T extends { content: string }> {
  private readonly values = new Map<string, T>();
  private bytes = 0;
  constructor(readonly max: number, readonly maxSize = 26214400) {}
  get size() { return this.values.size; }
  get calculatedSize() { return this.bytes; }
  has(key: string) { return this.values.has(key); }
  get(key: string): T | undefined {
    const value = this.values.get(key);
    if (value !== undefined) { this.values.delete(key); this.values.set(key, value); }
    return value;
  }
  delete(key: string): boolean {
    const value = this.values.get(key);
    if (value === undefined) return false;
    this.bytes -= Math.max(1, Buffer.byteLength(value.content));
    return this.values.delete(key);
  }
  clear() { this.values.clear(); this.bytes = 0; }
  set(key: string, value: T) {
    this.delete(key);
    const size = Math.max(1, Buffer.byteLength(value.content));
    if (size > this.maxSize) return this;
    while (this.values.size >= this.max || this.bytes + size > this.maxSize) {
      const oldest = this.values.keys().next().value;
      if (oldest === undefined) break;
      this.delete(oldest);
    }
    this.values.set(key, value); this.bytes += size;
    return this;
  }
  *entries(): IterableIterator<[string, T]> { yield* [...this.values.entries()].reverse(); }
}
// w/zC, chunk-zm79vshj.js 671868b11eba6ba55d389827d959adb062c3e427d2a4f8ebe00d4f0755d6763c
// UTF-16 [1870,4397): Bun.hash is adapted locally; the remote baseline gate is injected.
export class SourceReadCache {
  private readonly cache: SourceReadLRU<any>;
  constructor(max: number, private readonly fingerprint: (content: string) => string = sourceBunHashString,
    maxSize = 26214400, private readonly keepsReadBaselines = false,
    private readonly remoteBaselines: () => boolean = () => false) {
    this.cache = new SourceReadLRU(max, maxSize);
  }
  get(key: string) { return this.cache.get(pathNormalize(key)); }
  has(key: string) { return this.cache.has(pathNormalize(key)); }
  delete(key: string) { return this.cache.delete(pathNormalize(key)); }
  clear() { this.cache.clear(); }
  get size() { return this.cache.size; }
  get calculatedSize() { return this.cache.calculatedSize; }
  entries() { return this.cache.entries(); }
  set(key: string, value: any) {
    key = pathNormalize(key);
    const previous = this.cache.get(key);
    const keepContent = value.keepContent ?? previous?.keepContent;
    const contentHash = value.contentHash ?? this.fingerprint(value.content);
    const contentLength = value.contentLength ?? value.content.length;
    const hasContent = value.content !== "" || value.contentHash === undefined;
    const complete = (value.offset ?? 1) <= 1 && !value.isPartialView &&
      (value.limit === undefined || (value.content !== "" && value.content.split("\n").length < value.limit));
    const readBaseline = !(this.keepsReadBaselines || this.remoteBaselines()) ? undefined :
      hasContent && !value.contentFromTranscript && complete ? sourceReadBaseline(value.content) :
      value.readBaseline ?? (contentHash === previous?.contentHash ? previous?.readBaseline : undefined);
    const content = keepContent && value.content === "" && contentHash === previous?.contentHash && previous.content
      ? previous.content : value.content;
    this.cache.set(key, { ...value, keepContent, contentHash, contentLength,
      content: keepContent || Buffer.byteLength(content) <= 4096 ? content : "", readBaseline });
    return this;
  }
}
// b/Dre, chunk-zm79vshj.js 671868b11eba6ba55d389827d959adb062c3e427d2a4f8ebe00d4f0755d6763c, UTF-16 [1185,1378).
export function sourceReadBaseline(content: string): { sha256: string; bytes: number } {
  return { sha256: createHash("sha256").update(content, "utf8").digest("hex"), bytes: Buffer.byteLength(content, "utf8") };
}
export function sourceReadBaselineMatches(baseline: { sha256: string; bytes: number }, content: string): boolean {
  return Buffer.byteLength(content, "utf8") === baseline.bytes && sourceReadBaseline(content).sha256 === baseline.sha256;
}
// Mt, 51w556q5 [1358,1405); P/ZXt, tcpnppq7 [2857,3180), UTF-16.
const sourcePreReadModels = new Set(["claude-opus-4-6", "claude-haiku-4-5", "claude-opus-4-5",
  "claude-opus-4-1", "claude-opus-4-0", "claude-sonnet-4-5", "claude-sonnet-4-0",
  "claude-3-7-sonnet", "claude-3-5-sonnet", "claude-3-5-haiku"]);
export function sourceLocalPreReadGuard(model: string): boolean {
  return sourcePreReadModels.has(model.replace(/\[1m\]$/i, ""));
}
// chunk-hwpb27as.js c5f6d5b8fb187a14de3db7aebcb5615a3632aa34a0e174c54d38607e7c5ead8e UTF-16 [4137,4342).
export function sourceReadTokenEstimate(text: string, extension: string): number {
  function Td(e: unknown,n=4){if(typeof e!=="string")return 0;return Math.round(e.length/n)}
  function bo(e: string){switch(e){case"json":case"jsonl":case"jsonc":return 2;default:return 4}}
  return Td(text,bo(extension));
}
// chunk-sfn1dbxq.js 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// QIr UTF-16 [3559220,3560910): first-page excerpt calculation; caller owns eligibility and message formatting.
export function sourceFirstReadExcerpt(content: string, tokenCount: number, maxTokens: number) {
  let lines = content.split("\n");
  let charsPerToken = Math.max(0.5, content.length / Math.max(1, tokenCount));
  let estimate = (text: string) => text.length / charsPerToken;
  let lineCount = Math.max(1, Math.min(lines.length, Math.floor(lines.length * maxTokens / Math.max(1, tokenCount) * 0.85)));
  let excerpt = lines.slice(0, lineCount).join("\n");
  for (let i = 0; i < 6; i++) {
    if (estimate(excerpt) <= maxTokens || lineCount <= 1) break;
    lineCount = Math.max(1, Math.floor(lineCount * 0.7));
    excerpt = lines.slice(0, lineCount).join("\n");
  }
  let byCharacters = false;
  if (estimate(excerpt) > maxTokens || excerpt.trim() === "") {
    let length = Math.max(1, Math.floor(maxTokens * charsPerToken * 0.85));
    for (let i = 0; i < 6; i++) {
      excerpt = content.slice(0, length);
      if (estimate(excerpt) <= maxTokens) break;
      length = Math.max(1, Math.floor(length * 0.7));
    }
    let last = excerpt.charCodeAt(excerpt.length - 1);
    if (last >= 55296 && last <= 56319) excerpt = excerpt.slice(0, -1);
    byCharacters = true;
  }
  return { content: excerpt, lineCount: byCharacters ? excerpt.split("\n").length : lineCount, byCharacters };
}
// chunk-sfn1dbxq.js 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
// XIr [3549492,3549979), vve [3550151,3550363), khn [3550363,3550941), Shn [3550941,3551202); UTF-16.
// Room ownership, precise counting, messages and telemetry are supplied by the caller.
export function createSourceReadLimits({ normalizeUsage, inputTokens, bytesPerToken, estimate, count, defaultLimits, suffixes, record, classify }) {
  function XIr(e,n,r){let s=e.contextRoom();if(s===void 0||e.remoteCall!==void 0||e.inputFromAnotherMachine===!0)return{roomTokens:void 0,raised:void 0};let h=n?.message.usage,y=h?normalizeUsage(h):void 0,b=y&&inputTokens(y)>0?inputTokens(y)+y.output_tokens:0,w=Math.max(b,s.held())+s.claimed(),M=Math.max(0,Math.floor((s.threshold-w)*0.7));if(M<=r.maxTokens)return{roomTokens:M,raised:void 0};let z=bytesPerToken(e.model());return{roomTokens:M,raised:{maxTokens:M,maxSizeBytes:Math.max(r.maxSizeBytes,M*z*3)}}}
  function vve(e,n,r){if(e.roomTokens===void 0)return n?suffixes.unavailable:"";if(n||e.raised===void 0)return suffixes.tooLarge;return(r.bytes===void 0||r.bytes<=e.raised.maxSizeBytes)&&(r.tokens===void 0||r.tokens<=e.raised.maxTokens)?suffixes.canRaise:suffixes.tooLarge}
  function khn(e,{room:n,optedIn:r,readMaxSizeBytes:s,ext:h}){let y,b,w;if(e instanceof SourceFileTooLargeError&&e.maxSizeBytes===s)w=n(),y=new SourceFileTooLargeError(e.sizeInBytes,e.maxSizeBytes,vve(w,r,{bytes:e.sizeInBytes})),b={totalBytes:e.sizeInBytes};else if(e instanceof SourceSelectedRangeTooLargeError)w=n(),y=new SourceSelectedRangeTooLargeError(e.selectedBytes,e.maxSelectedBytes,vve(w,r,{bytes:e.selectedBytes})),b={totalBytes:e.selectedBytes};else if(e instanceof SourceFileTokenLimitError)w=n(),y=new SourceFileTokenLimitError(e.tokenCount,e.maxTokens,vve(w,r,{tokens:e.tokenCount})),b={tokens:e.tokenCount};else return e;if(r){let M=w.roomTokens===void 0?"unavailable":"too_large";record(w,classify(M),b,h)}return y}
  async function Shn(e,n,r,s,h=!1,y=!1){let b=r??defaultLimits().maxTokens,w=estimate(e,n),M=y&&w?Math.max(w,Math.ceil(Buffer.byteLength(e)/2)):w;if(!M||M<=b/4)return M||void 0;if(!h&&e.length>b*128)throw new SourceFileTokenLimitError(M,b);let V=await count(e,s)??M;if(V>b)throw new SourceFileTokenLimitError(V,b);return V}
  return { XIr, khn, Shn };
}

// chunk-p3nvgjww.js 9fb7fb56e67040d0bfc7d0926a9ca16b2e88d60ac70ea958b65206ab749eb8a6 UTF-16 [1292,1653).
export class SourceFileTokenLimitError extends Error {
  constructor(readonly tokenCount: number, readonly maxTokens: number, suffix = "") {
    super(`File content (${tokenCount} tokens) exceeds maximum allowed tokens (${maxTokens}). Use offset and limit parameters to read specific portions of the file, or search for specific content instead of reading the whole file.${suffix}`);
    this.name = "MaxFileReadTokenExceededError";
  }
}
// chunk-5sxzysbh.js f011c32103b7ae04033cdff3555774f413ee90c5b1bc0d0ae7a725a33a1ff162 UTF-16 [615,844).
function sourceByteSize(r: number): string { let e = r / 1024; if (e < 1) return `${r} bytes`; if (e < 1024) return `${e.toFixed(1).replace(/\.0$/, "")}KB`; let t = e / 1024; if (t < 1024) return `${t.toFixed(1).replace(/\.0$/, "")}MB`; return `${(t / 1024).toFixed(1).replace(/\.0$/, "")}GB`; }

// chunk-n3ykh62m.js 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac UTF-16 [207890,208629).
export class SourceFileTooLargeError extends Error {
  constructor(readonly sizeInBytes: number, readonly maxSizeBytes: number, suffix = "") {
    super(`File content (${sourceByteSize(sizeInBytes)}) exceeds maximum allowed size (${sourceByteSize(maxSizeBytes)}). Use offset and limit parameters to read specific portions of the file, or search for specific content instead of reading the whole file.${suffix}`);
    this.name = "FileTooLargeError";
  }
}
export class SourceSelectedRangeTooLargeError extends Error {
  constructor(readonly selectedBytes: number, readonly maxSelectedBytes: number, suffix = "") {
    super(`The requested line range contains over ${sourceByteSize(maxSelectedBytes)} of text, more than a read can return. Use a smaller limit — or, if a single line is this large, no limit will fit it: search for specific content instead.${suffix}`);
    this.name = "SelectedRangeTooLargeError";
  }
}
// chunk-n3ykh62m.js SHA-256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac
// $I UTF-16 [209369,210397); source SelectedRangeTooLargeError is injected.
export function createControlledSourceProjection(tVe) {
function $I(e,n,r,s,h,y,b){let w=e.charCodeAt(0)===65279;if(w)n-=3;let R=w?e.slice(1):e;if(s===0&&h===void 0&&y===void 0&&b===void 0){let le=R.includes("\r")?R.replaceAll(`\r
`,`
`):R;if(le.endsWith("\r"))le=le.slice(0,-1);let re=1,te=le.indexOf(`
`);while(te!==-1)re++,te=le.indexOf(`
`,te+1);return{content:le,lineCount:re,totalLines:re,totalBytes:n,readBytes:Buffer.byteLength(le,"utf8"),mtimeMs:r,truncatedByBytes:!1}}let T=h!==void 0?s+h:1/0,P=[],M=0,z=0,N,V=0,X=!1;function Z(le){if(b!==void 0||y!==void 0){let re=P.length>0?1:0,te=V+re+Buffer.byteLength(le);if(y!==void 0&&te>y)return X=!0,!1;if(b!==void 0&&te>b)throw new tVe(te,b);V=te}return P.push(le),!0}while((N=R.indexOf(`
`,z))!==-1){if(M>=s&&M<T&&!X){let le=R.slice(z,N);if(le.endsWith("\r"))le=le.slice(0,-1);Z(le)}M++,z=N+1}if(M>=s&&M<T&&!X){let le=R.slice(z);if(le.endsWith("\r"))le=le.slice(0,-1);Z(le)}M++;let ee=P.join(`
`);return{content:ee,lineCount:P.length,totalLines:M,totalBytes:n,readBytes:Buffer.byteLength(ee,"utf8"),mtimeMs:r,truncatedByBytes:X}}
return $I;
}

// Eye UTF-16 [208629,209369), $I [209369,210397), stream [210397,214361).
// Error constructors and source G normalization are supplied by the caller.
export function createControlledSourceReader({ _De, tVe, G, Ye }: {
  _De: new (actual: number, maximum: number) => Error;
  tVe: new (actual: number, maximum: number) => Error;
  G: (error: unknown) => Error;
  Ye: new () => Error;
}): (path: string, offset?: number, limit?: number, maxBytes?: number, signal?: AbortSignal, options?: {
  truncateOnByteLimit?: boolean; maxSelectedBytes?: number; handle?: FileHandle; handleStats?: Stats;
}) => Promise<{ content: string; lineCount: number; totalLines: number; totalBytes: number; readBytes: number; mtimeMs: number; truncatedByBytes: boolean }> {
const FI=10485760,HI=134217728;
async function Eye(e,n=0,r,s,h,y){h?.throwIfAborted();let b=y?.truncateOnByteLimit??!1,w=y?.maxSelectedBytes,R=y?.handle,T=R?y?.handleStats??await R.stat():await II(e);if(w!==void 0&&T.isFile()&&T.size<=w)w=void 0;if(T.isDirectory())throw Object.assign(Error(`EISDIR: illegal operation on a directory, read '${e}'`),{code:"EISDIR",errno:-21,syscall:"read",path:e});if(T.isFile()&&T.size<FI){if(!b&&s!==void 0&&T.size>s)throw new _De(T.size,s);let P=R?await R.readFile({signal:h}):await MI(e,{signal:h});if(!b&&s!==void 0){if(P.length>s)throw new _De(P.length,s)}let M=P.toString("utf8");return $I(M,T.size,T.mtimeMs,n,r,b?s:void 0,w)}return GI(e,n,r,s,w,T.isFile()?void 0:HI,b,h,R?{handle:R,mtimeMs:T.mtimeMs,positional:T.isFile()}:void 0)}function $I(e,n,r,s,h,y,b){let w=e.charCodeAt(0)===65279;if(w)n-=3;let R=w?e.slice(1):e;if(s===0&&h===void 0&&y===void 0&&b===void 0){let le=R.includes("\r")?R.replaceAll(`\r
`,`
`):R;if(le.endsWith("\r"))le=le.slice(0,-1);let re=1,te=le.indexOf(`
`);while(te!==-1)re++,te=le.indexOf(`
`,te+1);return{content:le,lineCount:re,totalLines:re,totalBytes:n,readBytes:Buffer.byteLength(le,"utf8"),mtimeMs:r,truncatedByBytes:!1}}let T=h!==void 0?s+h:1/0,P=[],M=0,z=0,N,V=0,X=!1;function Z(le){if(b!==void 0||y!==void 0){let re=P.length>0?1:0,te=V+re+Buffer.byteLength(le);if(y!==void 0&&te>y)return X=!0,!1;if(b!==void 0&&te>b)throw new tVe(te,b);V=te}return P.push(le),!0}while((N=R.indexOf(`
`,z))!==-1){if(M>=s&&M<T&&!X){let le=R.slice(z,N);if(le.endsWith("\r"))le=le.slice(0,-1);Z(le)}M++,z=N+1}if(M>=s&&M<T&&!X){let le=R.slice(z);if(le.endsWith("\r"))le=le.slice(0,-1);Z(le)}M++;let ee=P.join(`
`);return{content:ee,lineCount:P.length,totalLines:M,totalBytes:n,readBytes:Buffer.byteLength(ee,"utf8"),mtimeMs:r,truncatedByBytes:X}}function BI(e){OI(e,(n,r)=>{this.resolveMtime(n?0:r.mtimeMs)})}function UI(e){let n=this.decoder.write(e);if(n.length>0)i_.call(this,n)}function i_(e){let n=e;if(this.isFirstChunk){if(this.isFirstChunk=!1,n.charCodeAt(0)===65279)n=n.slice(1)}let r=Buffer.byteLength(n);if(this.totalBytesRead+=r,this.hardCapBytes!==void 0&&this.totalBytesRead>this.hardCapBytes){this.stream.destroy(new _De(this.totalBytesRead,this.hardCapBytes));return}if(!this.truncateOnByteLimit&&this.maxBytes!==void 0&&this.totalBytesRead>this.maxBytes){this.stream.destroy(new _De(this.totalBytesRead,this.maxBytes));return}let s=this.partial.length>0?this.partial+n:n,h=this.partialBytes+r;this.partial="",this.partialBytes=0;let y=0,b;while((b=s.indexOf(`
`,y))!==-1){if(this.currentLineIndex>=this.offset&&this.currentLineIndex<this.endLine){let w=s.slice(y,b);if(w.endsWith("\r"))w=w.slice(0,-1);let R=this.truncateOnByteLimit&&this.maxBytes!==void 0;if(R||this.maxSelectedBytes!==void 0){let T=this.selectedLines.length>0?1:0,P=this.selectedBytes+T+Buffer.byteLength(w);if(R&&P>this.maxBytes)this.truncatedByBytes=!0,this.endLine=this.currentLineIndex;else if(this.maxSelectedBytes!==void 0&&P>this.maxSelectedBytes){this.stream.destroy(new tVe(P,this.maxSelectedBytes));return}else this.selectedBytes=P,this.selectedLines.push(w)}else this.selectedLines.push(w)}this.currentLineIndex++,y=b+1}if(y<s.length){if(this.currentLineIndex>=this.offset&&this.currentLineIndex<this.endLine){let w=s.slice(y),R=y===0?h:Buffer.byteLength(w),T=this.truncateOnByteLimit&&this.maxBytes!==void 0;if(T||this.maxSelectedBytes!==void 0){let P=this.selectedLines.length>0?1:0,M=this.selectedBytes+P+R;if(T&&M>this.maxBytes){this.truncatedByBytes=!0,this.endLine=this.currentLineIndex;return}if(this.maxSelectedBytes!==void 0&&M>this.maxSelectedBytes){this.stream.destroy(new tVe(M,this.maxSelectedBytes));return}}this.partial=w,this.partialBytes=R}}}function jI(){let e=this.decoder.end();if(e.length>0){if(i_.call(this,e),this.stream.destroyed)return}let n=this.partial;if(n.endsWith("\r"))n=n.slice(0,-1);if(this.currentLineIndex>=this.offset&&this.currentLineIndex<this.endLine)if(this.truncateOnByteLimit&&this.maxBytes!==void 0){let h=this.selectedLines.length>0?1:0;if(this.selectedBytes+h+Buffer.byteLength(n)>this.maxBytes)this.truncatedByBytes=!0;else this.selectedLines.push(n)}else this.selectedLines.push(n);this.currentLineIndex++;let r=this.selectedLines.join(`
`),s=this.truncatedByBytes;this.mtimeReady.then((h)=>{this.resolve({content:r,lineCount:this.selectedLines.length,totalLines:this.currentLineIndex,totalBytes:this.totalBytesRead,readBytes:Buffer.byteLength(r,"utf8"),mtimeMs:h,truncatedByBytes:s})})}function GI(e,n,r,s,h,y,b,w,R){return new Promise((T,P)=>{let M={stream:R?Keo(R.handle,R.positional,w):AI(e,{highWaterMark:524288,...w?{signal:w}:void 0}),decoder:new CI("utf8"),offset:n,endLine:r!==void 0?n+r:1/0,maxBytes:s,maxSelectedBytes:h,hardCapBytes:y,truncateOnByteLimit:b,resolve:T,totalBytesRead:0,selectedBytes:0,truncatedByBytes:!1,currentLineIndex:0,selectedLines:[],partial:"",partialBytes:0,isFirstChunk:!0,resolveMtime:()=>{},mtimeReady:null};if(M.mtimeReady=new Promise((z)=>{M.resolveMtime=z}),R)M.resolveMtime(R.mtimeMs);else M.stream.once("open",BI.bind(M));M.stream.on("data",zI.bind(M)),M.stream.once("end",WI.bind(M)),M.stream.once("error",P)})}function a_(e){return function(...n){try{e.apply(this,n)}catch(r){this.stream.destroy(G(r))}}}var zI=a_(UI),WI=a_(jI);function Keo(e,n,r){let h=Buffer.allocUnsafe(524288),y=n?0:null,b=!1,w=new PI({read(){if(b)return;b=!0,e.read(h,0,524288,y).then(({bytesRead:R})=>{if(b=!1,w.destroyed)return;if(R===0){w.push(null);return}if(y!==null)y+=R;w.push(Buffer.from(h.subarray(0,R)))}).catch((R)=>{b=!1,w.destroy(G(R))})}});if(r){let R=()=>{w.destroy(r.reason instanceof Error?r.reason:new Ye)};if(r.aborted)R();else r.addEventListener("abort",R,{once:!0}),w.once("close",()=>r.removeEventListener("abort",R))}return w}
return Eye;
}
