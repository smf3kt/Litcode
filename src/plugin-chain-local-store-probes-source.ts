// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-4bw62nzm.js sha256 1a8788672a623975dc4a807604528e46b128f16b5ec159495c0ec2370f805713
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The local store's probe cache (W45-54): the source's `Ht`, the small class the local store holds
// as `localStoreProbes`. Two of its methods are what the settings-source layer reaches — the
// ownership-uids probe, remembered per root, and the normalized real home directory, remembered for
// the process — and the rest of the class is the source's own so the copy is the whole statement
// rather than a hand-picked half of it. Its only free names are `Map`, so the copy imports nothing.
//
// `Ht` is declared in the local store's own module (chunk-4bw62nzm.js), where the store class holds
// `localStoreProbes=new Ht`; the store itself is not ported, so ./plugin-chain-local-store.ts owns
// the handle and this copy owns the cache.

// chunk-4bw62nzm.js declares `Ht`, the local store's probe cache: the ownership uids remembered per root with a has/prime/clear set around them, and the normalized real home directory remembered for the process [16313,16862) 549 units sha256 1d35b53e384549e345ffcf2ec801466460043a6fbde33f3535a4fe426d8f0db6
class Ht{ownerUidsByRoot=new Map;realHomeDir=void 0;canonicalRootOwnerUids(e,t){let o=this.ownerUidsByRoot.get(e);if(o!==void 0)return o;let r=t(e);return this.ownerUidsByRoot.set(e,r),r}hasCanonicalRootOwnerUids(e){return this.ownerUidsByRoot.has(e)}primeCanonicalRootOwnerUids(e,t){if(this.ownerUidsByRoot.has(e))return!1;return this.ownerUidsByRoot.set(e,t),!0}clearCanonicalRootOwnerUids(){this.ownerUidsByRoot.clear()}normalizedRealHomeDir(e){return this.realHomeDir??=e(),this.realHomeDir}clearNormalizedRealHomeDir(){this.realHomeDir=void 0}}


export { Ht };
