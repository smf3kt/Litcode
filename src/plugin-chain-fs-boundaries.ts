// The two dependencies of the `$` filesystem floor this package does not carry (W45-46). Both are
// free names inside the copied `HE` (src/plugin-chain-fs-source.ts), so they bound here the way the
// process identity bounds in ./plugin-chain-host.ts: the source's own call site is quoted with its
// chunk and range, the reach that is not ported is named, and the hook is bindable so a record or a
// test can hold the boundary and prove the ported body calls through it.
//
// Source: `$ne` — the location check `HE` runs on both the path it was asked about and the path it
// resolved, chunk-n3ykh62m.js [241513,241740) 227 units:
//
//   function $ne(e){let n=_4(),r=n===null?[]:lYe(n);if(lYe(e).some((w)=>!r.includes(w)))return!0;if(!(gin(e)||BH(e)))return!1;if(ks(e))return n===null||oie(e,n);let y=qa(e)?ree(e):null,b=n===null?null:ree(n);return y===null||y!==b}
//
// It is the containment policy: the reachable root (`_4()`), that root's path segments (`lYe`), the
// network-location and volume classification (`gin`, `BH`, `ks`, `qa`, `ree`, `oie`), and the answer
// "this location is not reached from here" the floor throws on. Its closure is chunk-ae84tp6z.js
// (`lYe`, `gin`, `BH`, `ks`, `oie`, `qa`, `ree`) plus `_4` in chunk-4bw62nzm.js, and none of it is
// ported yet — so the boundary answers "reachable" until a host binds a policy. What is ported is the
// call itself: the refusal text and where it is thrown are the copied body's.
//
// Source: `O` — the platform the read uses to pick an open mode, chunk-xaes9ysz.js [3527,3565) 38 units:
//
//   function O(){return s().getPlatform()}
//
// over `s`, the memoized platform descriptor, chunk-xaes9ysz.js [3287,3493) 206 units:
//
//   function s(){return m??=new f({platform:"darwin",env:process.env,readProcVersionSync:oxr,readProcVersion:()=>l("/proc/version",{encoding:"utf8"}),osRelease:d,readOsRelease:()=>l("/etc/os-release","utf8")})}
//
// The descriptor (`f`, the WSL detector in the same module) is not ported. Its constructor takes the
// host's platform string and `getPlatform()` answers it after at most a WSL refinement, so the
// unported default is the host's own `process.platform` — the same value `s()` is constructed with
// here. The refinement (`f.prime()`, read once against `/proc/version`) is what a Windows host would
// see and is not reproduced.

let locationRefusal: ((file: string) => boolean) | undefined;
let hostPlatform: (() => string) | undefined;

/** Source `$ne`: whether a location is not reached from here. The policy layer is not ported, so the
 *  default answers "reached"; `bindNetworkLocationRefusal` installs one. */
export function $ne(file: string): boolean {
  return locationRefusal === undefined ? false : locationRefusal(file);
}

/** Source `O`: the platform string the file floor reads. The descriptor is not ported; the default is
 *  the host's own `process.platform`, which is the value the source's `s()` is constructed with. */
export function O(): string {
  return hostPlatform === undefined ? process.platform : hostPlatform();
}

/** Bind the location policy `$ne` answers with. Binding nothing restores the unported default. */
export function bindNetworkLocationRefusal(policy: ((file: string) => boolean) | undefined): void {
  locationRefusal = policy;
}

/** Bind the platform `O` answers with. Binding nothing restores `process.platform`. */
export function bindHostPlatform(platform: (() => string) | undefined): void {
  hostPlatform = platform;
}
