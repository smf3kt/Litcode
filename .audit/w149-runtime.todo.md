# W149 runtime trail

## W149-01 acceptance (2026-10-18)

- [x] **Source read.** `A5t`, `C5t`, `T5t`, `qAt`, `KAt`, `Xrt`, `mro` (419 units) and `nDr` (72);
  8 blocks, 491 units. Public names taken from the `chunk-24k7d6mw.js` and `chunk-kjfwbh4w.js`
  export tables, not inferred.
- [x] **Port.** Generated `src/plugin-chain-above-prompt-select-source.ts`; typed seam exposes the
  three stores, the site key, the generation read, the copy-without-keys helper, the forget helper
  and the terminal input dispatch.
- [x] **Scan.** unresolved 0 with imports from `Ge`/`bs`, `Ohe` and `UPn` only.
- [x] **Tests.** 7 cases cover the NUL key, empty and round-tripped stores, the generation default
  and stored read, `withoutKeys` copy semantics, single-site forget with a 2→3 bump and an intact
  sibling, the fresh-site 0→1 bump, and the quiet terminal dispatch.
- [x] **Gates.** Focused 9/9, full 2318/2318, tsc 0, build 0, notices 0, identity
  `61334785e54c04ba44f6d925934077f53e277b6d97ed2d78a87362faa0d3a430`.
- [ ] Next: `C0`/`nK`/`uK`/`lK` (select keyboard and site-field hooks), then `NFe`.
