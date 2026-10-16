// The settings source → file layer (W45-54): what every settings read resolves its file with. The
// copied bodies live in ./plugin-chain-settings-source-source.ts; this module is the host seam around
// them — the names, the context shape they read, and the two caches' handles.
//
// Source: the resolver cluster in chunk-3cynezh1.js, the fs facade and its helpers in
// chunk-gyf58rwf.js, the no-project-directory error in chunk-4bw62nzm.js, the `.claude` directory in
// chunk-nqc6v990.js, and the realpath/NFC helpers in chunk-ae84tp6z.js. 36 statements, 7,881 units,
// every range quoted in the port record.
//
// What the ported bodies say, all measured from the source:
//  · `GW(source, ctx)` is the resolver: `userSettings` is the `.claude` directory joined with the
//    settings file name, `projectSettings`/`localSettings` are the resolved source directory joined
//    with their own names and answer `undefined` for a context with neither a cwd nor a project
//    directory, `policySettings` is the managed settings file, `flagSettings` is the context's flag
//    path. Anything else answers `undefined`.
//  · `Ynn(source, ctx)` is the directory behind that: user settings are the `.claude` directory,
//    project is the configured project directory or the cwd, local is the same through the
//    canonical-root decision, flag is the flag path's directory or the cwd — and policy answers the
//    *cwd*, because the managed directory is reached through `m_` in the file resolver, not here.
//  · `RN` and `pTr` are that decision: when the cwd and its canonical root disagree and the root is
//    not the real home directory, the root is used only if `Z$s` says the user owns it — the root,
//    its `.git` entry and its `.claude` entry, each compared against the process's own uid.
//  · `Z$s` is the gate, and its three warn texts are the source's: a platform with no uid semantics,
//    a uid that is not the current user's, and an ownership that could not be verified. Each one
//    leaves the store at the session cwd.
//  · `My`/`Oko`/`eC`/`m_` are the managed settings file and its directory, cached in `Ad`; the
//    directory falls back to a per-platform default, and the override `Oko` answers nothing in this
//    build, so the switch is always reached.
//  · `UE`/`k_` are the user settings file name — `settings.json`, or the cowork name when the
//    context or the environment says so — and `TO` is the two per-source names.
//
// The context. The source's `M()` builds a ~30-field config context and passes it to all of these;
// the copied bodies read five fields of it (`cwd`, `projectConfigDir`, `flagPath`, `coworkPlugins`,
// `canonicalGitRoot`), so the seam names exactly those and takes them from its caller rather than
// approximating the rest. That is the same boundary the config/home layer `be` sits behind, recorded
// in W45-43 and still unported.
import { Ad, FWn, GP, GW, Hp, On, RN, TO, UE, Ynn, Z$s, be, fTr, ie, k_, m_, vse, w_ } from './plugin-chain-settings-source-source.js';

export { bindLocalStore, bindLocalStoreHost, localStore, type LocalStoreHandle } from './plugin-chain-local-store.js';

/** The five fields of the source's config context (`M()`, chunk-x0dc37w9.js [86914,87558)) that the
 *  bodies copied in this package read. The source's context carries about thirty; the rest belong to
 *  the config layer, which is not ported, so the seam names only what it uses. */
export interface SettingsSourceContext {
  /** The session's working directory, or `null` when the session has none. */
  cwd: string | null | undefined;
  /** An explicit project configuration directory, when the session was started with one. */
  projectConfigDir?: string | undefined;
  /** The settings file a `--settings` flag named, when one was given. */
  flagPath?: string | undefined;
  /** Whether this session uses the cowork settings file name. */
  coworkPlugins?: boolean | undefined;
  /** The source's `TP` — the canonical git root of a path, or null when there is none. It is a
   *  function in the source's context (`canonicalGitRoot: TP`), not a path: the local-settings
   *  decision asks it about the cwd. */
  canonicalGitRoot?: ((path: string) => string | null | undefined) | undefined;
}

/** Source `UE`: the user settings file names, default and cowork. */
export const SETTINGS_FILE_NAMES: Readonly<Record<string, string>> = UE as Readonly<Record<string, string>>;

/** Source `k_`: the user settings file name — the cowork one when the context asks for it or the
 *  environment flag is set, the default otherwise. */
export function settingsFileName(context: SettingsSourceContext): string {
  return k_(context) as string;
}

/** Source `be`: the `.claude` configuration directory, normalized to NFC and remembered after the
 *  first read. */
export function claudeDirectory(): string {
  return be() as string;
}

/** Source `m_`: the managed settings file, `managed-settings.json` inside the managed directory. */
export function managedSettingsPath(): string {
  return m_() as string;
}

/** Source `eC` through `Ad`: the managed settings directory, cached until `Ad.reset()`. */
export function managedSettingsDir(): string {
  return Ad.getManagedFilePath() as unknown as string;
}

/** Source `Ad.getDropInDir()`: the managed-settings drop-in directory beside the file. */
export function managedSettingsDropInDir(): string {
  return Ad.getDropInDir() as unknown as string;
}

/** Source `Ad.reset()`: forget both cached managed-settings paths. */
export function resetManagedSettingsCache(): void {
  Ad.reset();
}

/** Source `TO`: the relative path a project or local source's file is joined under — measured, this
 *  is `.claude/settings.json` and `.claude/settings.local.json`, not a bare file name; anything else
 *  answers `undefined`. */
export function settingsSourceRelativePath(source: string): string | undefined {
  return TO(source) as string | undefined;
}

/** Source `Ynn`: the directory a settings source lives in. Throws the source's own
 *  no-project-directory error for a project or local source whose context has no cwd. */
export function settingsSourceDirectory(source: string, context: SettingsSourceContext): string | undefined {
  return Ynn(source, context) as string | undefined;
}

/** Source `GW`: the file a settings source reads. `undefined` for a project or local source whose
 *  context has neither a cwd nor a project directory, and for a name that is not a source. */
export function settingsFilePath(source: string, context: SettingsSourceContext): string | undefined {
  return GW(source, context) as string | undefined;
}

/** Source `FWn`: the cwd a project or local source needs, or the source's own refusal. */
export function sourceCwd(context: SettingsSourceContext): string {
  return FWn(context) as string;
}

/** Source `RN`: the root a local source resolves against — the canonical root when the cwd and the
 *  root differ and the user owns the root, the cwd otherwise. */
export function localSettingsRoot(
  path: string,
  canonicalGitRoot?: (path: string) => string | null | undefined,
): string {
  return RN(path, canonicalGitRoot) as unknown as string;
}

/** Source `Z$s`: whether the process may canonicalize a local settings root to this path — true only
 *  when the path, its `.git` entry and its `.claude` entry are all owned by the current user. A
 *  false answer has already written the source's warn line. */
export function canonicalRootOwnedByUser(root: string): boolean {
  return Z$s(root) as boolean;
}

/** Source `fTr`: the normalized real home directory, read through the store's probe cache. */
export function normalizedRealHomeDir(): string {
  return fTr() as unknown as string;
}

/** Source `w_`: the realpath of the home directory, normalized to NFC. Throws when the realpath is
 *  unavailable. */
export function realHomeDir(): string {
  return w_() as unknown as string;
}

/** Source `Hp`: the realpath of a path, or null when it cannot be taken. */
export function realpathOrNull(path: string): string | null {
  return Hp(path) as string | null;
}

/** Source `On`: the NFC normalization every path comparison in this layer goes through. */
export function normalizePath(path: string): string {
  return On(path) as string;
}

/** Source `GP` and its name `an`: the error a project or local source raises when the context has no
 *  cwd. */
export const NoProjectDirectoryError: new () => Error = GP as unknown as new () => Error;

/** Source `ie()`: the fs facade the ownership probes read through. */
export function sourceFs(): unknown {
  return ie();
}

/**
 * Source `vse`: the legacy local settings file for a session — `join(resolve(cwd),
 * '.claude/settings.local.json')`, or `undefined` when there is nothing to answer: no cwd, a cwd
 * that *is* the canonical git root (the root's own local file is not a session setting), or a set
 * project config directory. This is exactly the path the settings reader takes its legacy local
 * branch through (`Qnn`, chunk-3cynezh1.js [427468,…): `let d=vse(n); if(d){let {settings:c}=FB(d,
 * n.store); …}`).
 */
export function localSettingsPath(context: SettingsSourceContext & {
  canonicalGitRoot?: ((path: string) => string | null | undefined) | undefined;
}): string | undefined {
  return vse(context) as string | undefined;
}
