// The one dependency of the store's carry layer this package does not carry (W45-51): the platform-id
// test the candidate list canonicalizes through. `wD` is a free name inside the copied `AUn`
// (src/plugin-chain-store-carry-source.ts), so it bounds here the way the location policy, the
// platform and the data directory bounded in the earlier seams: the source's own body is quoted with
// its chunk and range, the reach that is not ported is named, and the hook is bindable.
//
// Source: `wD` — whether an id is a platform the application's plugin table knows,
// chunk-3cynezh1.js [124407,124449) 42 units:
//
//   function wD(e){return Object.hasOwn(xo,e)}
//
// `xo` is that table, and the table is the application core: `wD` sits between the platform list
// (`wi`), the installer's refusal text (`fPs`) and the table's own spreads, whose closure this record
// measured at more than 75,000 units across 226 statements. It is not this package's subsystem, and
// the table is not approximated here.
//
// The hook's answer is a plain yes or no, so an unbound hook answers `false` — the test's own negative
// branch, which `AUn` turns into "the id is used as it was written". That is a real answer for an id
// the table does not hold, not a guessed value: binding a table (as the tests do) brings the other
// branch back, and every entry of the application's table is a lowercase platform id, so an id already
// in lowercase — which is what a plugin id carries — is unaffected either way.

let platformIdTable: ((id: string) => boolean) | undefined;

/** Source `wD`: whether the application's plugin table knows this platform id. Unbound, the hook
 *  answers its own negative branch; `bindStoreCarryPlatformIdTable` installs the real table. */
export function wD(id: string): boolean {
  return platformIdTable === undefined ? false : platformIdTable(id);
}

/** Bind the platform-id test `wD` answers with. Binding nothing restores the negative branch. */
export function bindStoreCarryPlatformIdTable(table: ((id: string) => boolean) | undefined): void {
  platformIdTable = table;
}
