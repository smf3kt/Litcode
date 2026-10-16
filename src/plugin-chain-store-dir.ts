// The one dependency of the store's file layer this package does not carry (W45-48): the data
// directory the store lives under. `bl` is a free name inside the copied `S`
// (src/plugin-chain-store-path-source.ts), so it bounds here the way the location policy and the
// platform bound in ./plugin-chain-fs-boundaries.ts: the source's own body is quoted with its chunk
// and range, the reach that is not ported is named, and the hook is bindable so a host (and the
// record) can hold the boundary.
//
// Source: `bl` — the plugin data directory, chunk-s9zkj3fw.js [7352,7440) 88 units:
//
//   function bl(){let e=a.CLAUDE_CODE_PLUGIN_CACHE_DIR;if(e)return Ld(e);return R(be(),Y())}
//
// It reads an environment override (`CLAUDE_CODE_PLUGIN_CACHE_DIR`, expanded by `Ld` — chunk-ae84tp6z.js
// [14572,14628) 56 units: `function Ld(t){if(Vt(t))return it()+t.slice(1);return t}`, a leading `~`
// expanded against the home directory) and otherwise joins the configuration directory with a
// directory name:
//
//   function Y(){if(jsn())return V;if(a.CLAUDE_CODE_USE_COWORK_PLUGINS)return V;return ge}   chunk-s9zkj3fw.js [7172,7258) 86 units
//   var ge="plugins",V="cowork_plugins"                                                       the two directory names
//   var be=po(()=>(o()??u(R(),".claude")).normalize("NFC"),o);                                chunk-nqc6v990.js [2704,2762) 58 units
//
// `be` is the configuration directory itself — a memoized `~/.claude` unless the process names
// another — and `jsn` decides between `plugins` and `cowork_plugins`. Neither the configuration
// directory nor `jsn` is ported: they are the config/home layer W45-43 recorded as a subsystem in its
// own right, and this package does not approximate it.
//
// So the boundary has no default. A host that wants a store binds the directory it owns; until then
// `bl()` throws the boundary's own refusal, which is deliberately not one of the source's texts —
// the source always has a directory to answer.

let dataDirectory: (() => string) | undefined;

/** Source `bl`: the directory the store lives under. Unbound, the boundary refuses rather than
 *  guessing a path; `bindPluginDataDir` installs one. */
export function bl(): string {
  if (dataDirectory === undefined) {
    throw new Error('the plugin data directory is not bound; bindPluginDataDir() installs one');
  }
  return dataDirectory();
}

/** Bind the data directory `bl` answers with. Binding nothing restores the refusal. */
export function bindPluginDataDir(directory: (() => string) | undefined): void {
  dataDirectory = directory;
}
