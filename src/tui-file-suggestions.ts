import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { FileMatch } from './tui-file-index.js';

/**
 * The composer's `@path` completion, adapted from the recovered interactive application.
 *
 * `chunk-24k7d6mw.js` (SHA-256
 * 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31) holds the input
 * side: the separator class `S5` (chunk-sfn1dbxq.js 3565490), the token regexes `jDt`
 * 565774, `V0e` 565816, `WDt` 565857, `qDt` 565934, `$Dt` 565975 and `VDt` 565998, the
 * parser `ak` 568974, the partial accessor `lse` 567681, the display shaping `dse` 567832
 * and `ese` 565691, the explicit-path test `Ure` 502887 and the directory provider `jre`
 * 503694 over `I0e` 501861.
 *
 * `chunk-vr7yfckx.js` (SHA-256
 * 3f82078066ff8460dd7239a5535627a492ce1771a0b08dec654b5af955eeb7c6) holds the fuzzy
 * provider: `SDs` 9313, the `file-` row `C` 8050, the cwd listing `H` 9002, the limit `k`
 * 8140 with `qQe` 15, the longest common prefix `k6r` 7894, and the splice `pbn` 10590.
 *
 * `chunk-yn0pfn70.js` (SHA-256
 * 1d90c3c5bfa8d28f4dec90c70ae77bec0236285ddf3c034790236238a90b940f) holds the path
 * truncations `ct` 8443, `OO` 8612 and `hc` 8192 that the file row lays out with.
 *
 * Coordinates are zero-based UTF-16 offsets. The remote suggestion path and the
 * `fileSuggestion` command override are not ported: both are account or command gated.
 */

/** `S5`: whitespace plus the CJK punctuation that also ends a token. */
const SEPARATOR = /[\s。、？！]/;
/** `jDt`: the `@` head of a token. */
const AT_HEAD = /^@[\p{L}\p{N}\p{M}_\-./\\()[\]~:]*/u;
/** `V0e`: the path characters that may continue a token past the cursor. */
const AT_TAIL = /^[\p{L}\p{N}\p{M}_\-./\\()[\]~:]+/u;
/** `WDt`: a whole path run, with or without the `@` that starts it. */
const PATH_RUN = /(@[\p{L}\p{N}\p{M}_\-./\\()[\]~:]*|[\p{L}\p{N}\p{M}_\-./\\()[\]~:]+)$/u;
/** `VDt`: the `@` token at the end of the text before the cursor. */
const AT_TOKEN_END = new RegExp(String.raw`(^|${SEPARATOR.source})@([\p{L}\p{N}\p{M}_\-./\\()[\]~:]*|"[^"]*"?)$`, 'u');
/** The quoted form the parser recognises. */
const QUOTED_HEAD = /@"([^"]*)"?$/;
const QUOTED_TAIL = /^[^"]*"?/;

/** `qQe`: the composer offers at most fifteen file rows. */
export const FILE_SUGGESTION_LIMIT = 15;
/** `ee`/`jre`: the explicit-path listing returns at most ten rows. */
export const DIRECTORY_SUGGESTION_LIMIT = 10;
/** `M0e`: the directory listing is capped before it is filtered. */
const DIRECTORY_ENTRY_LIMIT = 5000;

export interface AtToken {
  /** The token including its `@` (or its quotes), as it was typed. */
  readonly token: string;
  /** Where the token begins in the draft. */
  readonly startPos: number;
  readonly isQuoted: boolean;
}

export interface AtQuery extends AtToken {
  /** The path the user has typed, without the `@` or the quotes. */
  readonly partial: string;
  /** `Ure`: an absolute, home, or explicit relative path lists a directory instead. */
  readonly explicit: boolean;
}

/** `ak` with its file flag: the token under the cursor, or undefined outside one. */
export function atToken(text: string, cursor: number): AtToken | undefined {
  const before = text.slice(0, cursor);
  const quoted = before.match(QUOTED_HEAD);
  if (quoted && quoted.index !== undefined) {
    const tail = text.slice(cursor).match(QUOTED_TAIL);
    return { token: quoted[0] + (tail ? tail[0] : ''), startPos: quoted.index, isQuoted: true };
  }
  const at = before.lastIndexOf('@');
  if (at >= 0 && (at === 0 || SEPARATOR.test(before[at - 1]!))) {
    const run = before.slice(at);
    const head = run.match(AT_HEAD);
    if (head && head[0].length === run.length) {
      const tail = text.slice(cursor).match(AT_TAIL);
      return { token: head[0] + (tail ? tail[0] : ''), startPos: at, isQuoted: false };
    }
  }
  const run = before.match(PATH_RUN);
  if (!run || run.index === undefined) return undefined;
  const tail = text.slice(cursor).match(AT_TAIL);
  return { token: run[0] + (tail ? tail[0] : ''), startPos: run.index, isQuoted: false };
}

/** `lse`: the path inside a token. */
export function atPartial(token: AtToken): string {
  if (token.isQuoted) return token.token.slice(2).replace(/"$/, '');
  return token.token.startsWith('@') ? token.token.slice(1) : token.token;
}

/** `Ure`: the prefixes that make the completion list a directory rather than a search. */
export function isExplicitPath(partial: string): boolean {
  return partial.startsWith('~/') || partial.startsWith('/') || partial.startsWith('./')
    || partial.startsWith('../') || partial === '~' || partial === '.' || partial === '..';
}

/** `VDt` plus `ak`: the `@` query under the cursor, if the draft has one. */
export function atQuery(text: string, cursor: number): AtQuery | undefined {
  if (!AT_TOKEN_END.test(text.slice(0, cursor))) return undefined;
  const token = atToken(text, cursor);
  if (!token || !token.token.startsWith('@')) return undefined;
  const partial = atPartial(token);
  return { ...token, partial, explicit: isExplicitPath(partial) };
}

export interface FileSuggestionRow {
  /** `C`: `file-<path>` for the fuzzy family, the bare path for a directory listing. */
  readonly id: string;
  readonly displayText: string;
  readonly description?: string;
  /** `C`: the index ratio, used only to order the rows. */
  readonly score?: number;
}

/** `C`: one `file-` row. */
function fileRow(match: FileMatch): FileSuggestionRow {
  return { id: `file-${match.path}`, displayText: match.path, score: match.score };
}

/** `~` expansion against the workspace, which is what the source's `et` does. */
function expandTilde(partial: string, cwd: string): string {
  if (partial === '~') return os.homedir();
  if (partial.startsWith('~/')) return path.join(os.homedir(), partial.slice(2));
  return partial;
}

/**
 * The `file-` rows for a non-explicit partial. `SDs`: an empty partial, `.` or `./` lists
 * the working directory's entries; anything else strips a `./` head, expands `~` and runs
 * the fuzzy index. Hidden entries are the index's business, not this function's.
 */
export function fileSuggestionRows(search: (query: string) => readonly FileMatch[],
  partial: string, cwd: string, listCwd: () => readonly string[]): FileSuggestionRow[] {
  if (partial === '' || partial === '.' || partial === './') {
    return listCwd().slice(0, FILE_SUGGESTION_LIMIT)
      .map((entry, index, all) => ({ id: `file-${entry}`, displayText: entry,
        score: index / Math.max(all.length, 1) }));
  }
  let query = partial;
  if (query.startsWith('.' + path.sep)) query = query.slice(2);
  query = expandTilde(query, cwd);
  return search(query).slice(0, FILE_SUGGESTION_LIMIT).map(fileRow);
}

/** `H`: the working directory's entries, with a trailing separator on a directory. */
export function listWorkingDirectory(cwd: string): string[] {
  try {
    return fs.readdirSync(cwd).map(name => {
      const full = path.join(cwd, name);
      const relative = path.relative(cwd, full);
      return fs.statSync(full).isDirectory() ? relative + path.sep : relative;
    });
  } catch { return []; }
}

/** `bDt`: split a partial into the directory to list and the prefix to filter by. */
export function splitDirectoryQuery(partial: string, base: string): { directory: string; prefix: string } {
  if (partial === '') return { directory: base || process.cwd(), prefix: '' };
  const expanded = path.resolve(base, expandTilde(partial, base));
  if (partial.endsWith('/') || partial.endsWith('\\')) return { directory: expanded, prefix: '' };
  return { directory: path.dirname(expanded), prefix: path.basename(partial) };
}

/**
 * `jre`: the explicit-path listing. Directories first, then by name; the prefix filter is
 * case-insensitive; the returned path keeps the textual directory head the user typed.
 */
export function directorySuggestionRows(partial: string, base: string,
  readdir: (directory: string) => readonly { name: string; isDirectory: boolean }[] = defaultReaddir):
FileSuggestionRow[] {
  const { directory, prefix } = splitDirectoryQuery(partial, base);
  const wanted = prefix.toLowerCase();
  const entries = readdir(directory)
    .filter(entry => !entry.name.startsWith('.'))
    .map(entry => ({ name: entry.name, isDirectory: entry.isDirectory }))
    .sort((left, right) => {
      if (left.isDirectory && !right.isDirectory) return -1;
      if (!left.isDirectory && right.isDirectory) return 1;
      return left.name.localeCompare(right.name);
    })
    .slice(0, DIRECTORY_ENTRY_LIMIT)
    .filter(entry => entry.name.toLowerCase().startsWith(wanted))
    .slice(0, DIRECTORY_SUGGESTION_LIMIT);
  const slash = Math.max(partial.lastIndexOf('/'), partial.lastIndexOf('\\'));
  let head = slash >= 0 ? partial.slice(0, slash + 1) : '';
  if (head.startsWith('./')) head = head.slice(2);
  return entries.map(entry => {
    const display = head + entry.name;
    return { id: display, displayText: entry.isDirectory ? display + '/' : display };
  });
}

function defaultReaddir(directory: string): readonly { name: string; isDirectory: boolean }[] {
  try {
    return fs.readdirSync(directory, { withFileTypes: true })
      .map(entry => ({ name: entry.name, isDirectory: entry.isDirectory() }));
  } catch { return []; }
}

/** `k6r`: the longest common prefix, which Tab fills before accepting one row. */
export function commonPrefix(values: readonly string[]): string {
  if (values.length === 0) return '';
  let prefix = values[0]!;
  for (let index = 1; index < values.length; index++) {
    const value = values[index]!;
    let at = 0;
    while (at < prefix.length && at < value.length && prefix[at] === value[at]) at += 1;
    prefix = prefix.slice(0, at);
    if (prefix === '') return '';
  }
  return prefix;
}

/**
 * `dse`: how an accepted path is written back. A quoted or space-bearing path becomes
 * `@"path"`, a plain one keeps the `@` it replaced, and a complete accept adds one space.
 */
export function shapeAtDisplayText(value: string, options: { hasAtPrefix: boolean; isQuoted: boolean;
  isComplete: boolean; needsQuotes?: boolean }): string {
  const trailing = options.isComplete ? ' ' : '';
  if (options.isQuoted || options.needsQuotes) return `@"${value}"${trailing}`;
  return options.hasAtPrefix ? `@${value}${trailing}` : value + trailing;
}

/** `pbn`: splice the accepted text over the token and report the cursor after it. */
export function applyFileSuggestion(text: string, token: AtToken, replacement: string):
{ text: string; cursor: number } {
  const next = text.slice(0, token.startPos) + replacement + text.slice(token.startPos + token.token.length);
  return { text: next, cursor: token.startPos + replacement.length };
}
