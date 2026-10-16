// The one dependency of `settings.read` this package does not carry (W45-53): the settings store the
// entry's body reads through. `ft` and `fe` are free names inside the copied `hGo`
// (src/plugin-chain-settings-read-source.ts), so they bound here the way the data directory, the
// platform-id test and the loader session bounded in the earlier seams: each source body is quoted
// with its chunk and range, the reach that is not ported is named, and the hook is bindable.
//
// Source, both in chunk-x0dc37w9.js:
//
//   function fe(e){if(CT()&&Tp.has(e))return null;return y9e(e,M())}      [88486,88550) 64 units
//   function ft(){return yg().settings||{}}                              [96865,96904) 39 units
//
// What they reach is the settings subsystem: `CT` and `Tp` (whether managed settings are in force and
// which sources they cover — an unavailable source answers `null`), `y9e` (one source's settings read
// through `M`, the file read behind it) and `yg` (the cache accessor whose `settings` is the merged
// result). That closure in the same module is 205 statements / 66,141 units over more than sixty
// cross-module imports — the settings files, their watchers, the merge rules and the managed-settings
// gate. It is not this package's subsystem and it is not approximated here.
//
// The hook has no source answer to fall back on: unlike the platform-id test there is no negative
// branch in the source (a machine always has a settings cache), so an unbound hook refuses with a text
// this seam owns and says so. Binding a store (as the tests do) brings the whole ported path back.

/** The store `ft` and `fe` read: the merged settings, and one source's settings. */
export interface SettingsStore {
  /** Source `ft`: the merged settings of every source that has a file. */
  all(): unknown;
  /** Source `fe`: one source's settings — the name is a value of `J9` (`userSettings` and the rest) —
   *  or `null` when the store answers that the source is unavailable. */
  one(source: string | undefined): unknown;
}

let settingsStore: SettingsStore | undefined;

/** Bind the settings store the copied bodies read through. Binding nothing restores the refusal. */
export function bindSettingsStore(store: SettingsStore | undefined): void {
  settingsStore = store;
}

const unbound = 'the settings store is not bound; bindSettingsStore() installs one';

/** Source `ft`: the merged settings. Unbound, this hook refuses (see the note above). */
export function ft(): unknown {
  if (settingsStore === undefined) throw new Error(unbound);
  return settingsStore.all();
}

/** Source `fe`: one source's settings. Unbound, this hook refuses (see the note above). */
export function fe(source: string | undefined): unknown {
  if (settingsStore === undefined) throw new Error(unbound);
  return settingsStore.one(source);
}
