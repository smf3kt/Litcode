// The environment bindings the recovered URL normalizer reads (W45-79). The copied bodies in
// ./plugin-chain-press-url-source.ts use `et` (the path module, for `win32.normalize`), `tt`
// (isAbsolute), `nt` (resolve), `a` (posix), `Rn` (pathToFileURL) and `se` (the current directory).
// Node supplies the first five directly; `se` is the one host boundary. In the source `se()` reads
// the session store's cwd through `Aon()` and falls back to `VR()`/`Ee()` (chunk-qr9z1wer.js
// [2228,2405)); this product has no session store, so its one cwd is the process cwd — the same
// answer the source's fallback reaches when no session cwd is installed.
import * as et from 'node:path';
import { pathToFileURL } from 'node:url';

export { et };
export const tt = et.isAbsolute;
export const nt = et.resolve;
export const a = et.posix;
export const Rn = pathToFileURL;

export function se(): string {
  return process.cwd();
}
