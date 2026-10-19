/**
 * The fuzzy file-path index behind the composer's `@path` completion, ported from the
 * recovered interactive application `chunk-3cynezh1.js` (SHA-256
 * c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3): `mnn` [93619,97113)
 * indexes and searches a path list, and `tp` 97113, `Fr` 97285, `$r` 97370, `np` 97504,
 * `op` 97573, `sp` 97609, `rp` 97644 and `ip` 97840 are its scoring helpers. Coordinates
 * are zero-based UTF-16 offsets.
 *
 * The source keeps the index in a class with a background build and a cache generation;
 * the search itself is pure and synchronous, so this port keeps only the index and the
 * search. The caller owns when a build happens.
 */

/** Source constants: boundary weights, the index bit width and the top-level cache size. */
const QUERY_BITS = 16;
const BOUNDARY_BONUS = 8;
const CAMEL_BONUS = 6;
const CONTIGUOUS_BONUS = 4;
const FIRST_CHAR_BONUS = 8;
const GAP_PENALTY = 3;
const GAP_MULTIPLIER = 1;
const TOP_LEVEL_LIMIT = 100;
const POSITION_BUFFER = 64;

export interface FileMatch {
  readonly path: string;
  /** `index / resultCount`, lifted to 1 for a path containing `test`. */
  readonly score: number;
  /** Zero-based UTF-16 offsets of each query character in `path`. */
  readonly positions: readonly number[];
}

/** `np`: the characters that make the following character a word boundary. */
function isBoundary(code: number): boolean {
  return code === 47 || code === 92 || code === 45 || code === 95 || code === 46 || code === 32;
}

/** `op`/`sp`: an ASCII lowercase letter followed by an uppercase one scores as a camel hump. */
function isLower(code: number): boolean { return code >= 97 && code <= 122; }
function isUpper(code: number): boolean { return code >= 65 && code <= 90; }

/** `$r`: the bonus for the character before a match position. */
function positionBonus(path: string, index: number, first: boolean): number {
  if (index === 0) return first ? FIRST_CHAR_BONUS : 0;
  const before = path.charCodeAt(index - 1);
  if (isBoundary(before)) return BOUNDARY_BONUS;
  if (isLower(before) && isUpper(path.charCodeAt(index))) return CAMEL_BONUS;
  return 0;
}

/** `Fr`: the sum of the per-position bonuses. */
function positionsBonus(path: string, positions: ArrayLike<number>, length: number): number {
  let total = positionBonus(path, positions[0]!, true);
  for (let index = 1; index < length; index++) total += positionBonus(path, positions[index]!, false);
  return total;
}

/**
 * `tp`: the same greedy match, but confined to the basename so a filename match can
 * outrank a directory match. Returns `-Infinity` when the basename cannot match.
 */
function nameScore(lower: string, query: readonly string[], start: number,
  positions: Int32Array): number {
  let total = 0;
  let previous = start - 1;
  for (let index = 0; index < query.length; index++) {
    const at = lower.indexOf(query[index]!, previous + 1);
    if (at === -1) return -Infinity;
    positions[index] = at;
    const gap = at - previous - 1;
    if (index > 0) total += gap === 0 ? CONTIGUOUS_BONUS : -(GAP_PENALTY + gap * GAP_MULTIPLIER);
    previous = at;
  }
  return total;
}

/**
 * `rp`: the search runs over the lower-cased path, so a position found there may sit
 * inside a lower-cased astral character. Walk the original code points and snap each
 * position forward to the start of the code point that contains it.
 */
function remapPositions(path: string, positions: number[]): void {
  let source = 0, folded = 0, index = 0;
  while (index < positions.length && source < path.length) {
    const point = path.codePointAt(source)!;
    const width = point > 0xffff ? 2 : 1;
    const foldedWidth = String.fromCodePoint(point).toLowerCase().length;
    while (index < positions.length && positions[index]! < folded + foldedWidth) {
      positions[index] = source;
      index += 1;
    }
    source += width;
    folded += foldedWidth;
  }
}

/** `ip`: the shallowest distinct directories, shortest first, which an empty query lists. */
function topLevelEntries(paths: readonly string[], limit: number): FileMatch[] {
  const seen = new Set<string>();
  for (const path of paths) {
    let end = path.length;
    for (let index = 0; index < path.length; index++) {
      const code = path.charCodeAt(index);
      if (code === 47 || code === 92) { end = index; break; }
    }
    const head = path.slice(0, end);
    if (head.length === 0) continue;
    seen.add(head);
    if (seen.size >= limit) break;
  }
  return [...seen]
    .sort((left, right) => left.length - right.length || (left < right ? -1 : left > right ? 1 : 0))
    .slice(0, limit)
    .map(path => ({ path, score: 0, positions: [] }));
}

export class FileIndex {
  private paths: string[] = [];
  private lowerPaths: string[] = [];
  private charBits = new Int32Array(0);
  private pathLens = new Uint16Array(0);
  private nameStarts = new Uint16Array(0);
  private nameCharBits = new Int32Array(0);
  private topLevelCache: FileMatch[] | null = null;
  private readonly matchPositions = new Int32Array(POSITION_BUFFER);
  private readonly nameMatchPositions = new Int32Array(POSITION_BUFFER);
  private readyCount = 0;

  /** `loadFromFileList`: dedupe the list, drop empty entries, then index it. */
  loadFromFileList(paths: readonly string[]): void {
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const path of paths) {
      if (path.length === 0 || seen.has(path)) continue;
      seen.add(path);
      unique.push(path);
    }
    this.buildIndex(unique);
  }

  /** The number of paths currently searchable; a partially built index still answers. */
  get size(): number { return this.readyCount; }

  private buildIndex(paths: string[]): void {
    this.resetArrays(paths);
    for (let index = 0; index < paths.length; index++) this.indexPath(index);
    this.readyCount = paths.length;
  }

  private resetArrays(paths: string[]): void {
    const count = paths.length;
    this.paths = paths;
    this.lowerPaths = Array<string>(count);
    this.charBits = new Int32Array(count);
    this.pathLens = new Uint16Array(count);
    this.nameStarts = new Uint16Array(count);
    this.nameCharBits = new Int32Array(count);
    this.readyCount = 0;
    this.topLevelCache = topLevelEntries(paths, TOP_LEVEL_LIMIT);
  }

  /** `indexPath`: the a-z bitmask for the prefilter, and the basename offset and mask. */
  private indexPath(index: number): void {
    const original = this.paths[index]!;
    const lower = original.toLowerCase();
    this.lowerPaths[index] = lower;
    const length = lower.length;
    this.pathLens[index] = length;
    let bits = 0, start = 0, nameBits = 0;
    for (let at = 0; at < length; at++) {
      const code = lower.charCodeAt(at);
      if (code >= 97 && code <= 122) {
        bits |= 1 << (code - 97);
        nameBits |= 1 << (code - 97);
      } else if ((code === 47 || code === 92) && at < length - 1) {
        start = at + 1;
        nameBits = 0;
      }
    }
    this.charBits[index] = bits;
    // A lower-cased path with a different code-unit length cannot be indexed by offset.
    this.nameStarts[index] = length === original.length ? start : 0;
    this.nameCharBits[index] = nameBits;
  }

  /** `mnn.search`: the top `limit` paths for `query`, best first. */
  search(query: string, limit: number): FileMatch[] {
    if (limit <= 0) return [];
    if (query.length === 0) {
      return this.topLevelCache === null ? [] : this.topLevelCache.slice(0, limit)
        .map(entry => ({ path: entry.path, score: entry.score, positions: [] }));
    }
    const caseSensitive = query !== query.toLowerCase();
    const needle = caseSensitive ? query : query.toLowerCase();
    const length = Math.min(needle.length, POSITION_BUFFER);
    const chars: string[] = Array<string>(length);
    let queryBits = 0;
    for (let index = 0; index < length; index++) {
      const char = needle.charAt(index);
      chars[index] = char;
      const code = char.charCodeAt(0);
      if (code >= 97 && code <= 122) queryBits |= 1 << (code - 97);
    }
    // A candidate whose best possible score is at or below the worst kept one is skipped.
    const floorBudget = length * (QUERY_BITS + BOUNDARY_BONUS) + FIRST_CHAR_BONUS + 32;
    const best: { pathIndex: number; fuzzScore: number; scanFrom: number }[] = [];
    let worst = -Infinity;
    const { paths, lowerPaths, charBits, pathLens, readyCount, nameStarts, nameCharBits } = this;
    const positions = this.matchPositions;
    const namePositions = this.nameMatchPositions;
    outer: for (let index = 0; index < readyCount; index++) {
      if ((charBits[index]! & queryBits) !== queryBits) continue;
      const haystack = caseSensitive ? paths[index]! : lowerPaths[index]!;
      let at = haystack.indexOf(chars[0]!);
      if (at === -1) continue;
      positions[0] = at;
      let gaps = 0, contiguous = 0, previous = at;
      for (let cursor = 1; cursor < length; cursor++) {
        at = haystack.indexOf(chars[cursor]!, previous + 1);
        if (at === -1) continue outer;
        positions[cursor] = at;
        const gap = at - previous - 1;
        if (gap === 0) contiguous += CONTIGUOUS_BONUS;
        else gaps += GAP_PENALTY + gap * GAP_MULTIPLIER;
        previous = at;
      }
      const nameStart = nameStarts[index]!;
      const inName = gaps > 0 && positions[0]! < nameStart && (nameCharBits[index]! & queryBits) === queryBits
        ? nameScore(haystack, chars, nameStart, namePositions) : -Infinity;
      if (best.length === limit && floorBudget + Math.max(contiguous - gaps, inName) <= worst) continue;
      const original = paths[index]!;
      const pathLength = pathLens[index]!;
      let score = contiguous - gaps + positionsBonus(original, positions, length);
      let scanFrom = 0;
      if (inName !== -Infinity) {
        const named = inName + positionsBonus(original, namePositions, length);
        if (named >= score) { score = named; scanFrom = nameStart; }
      }
      score += length * QUERY_BITS + Math.max(0, 32 - (pathLength >> 2));
      if (best.length < limit) {
        best.push({ pathIndex: index, fuzzScore: score, scanFrom });
        if (best.length === limit) {
          best.sort((left, right) => left.fuzzScore - right.fuzzScore);
          worst = best[0]!.fuzzScore;
        }
      } else if (score > worst) {
        let low = 0, high = best.length;
        while (low < high) {
          const middle = (low + high) >> 1;
          if (best[middle]!.fuzzScore < score) low = middle + 1;
          else high = middle;
        }
        best.splice(low, 0, { pathIndex: index, fuzzScore: score, scanFrom });
        best.shift();
        worst = best[0]!.fuzzScore;
      }
    }
    best.sort((left, right) => right.fuzzScore - left.fuzzScore);
    const count = best.length;
    const divisor = Math.max(count, 1);
    const results: FileMatch[] = Array<FileMatch>(count);
    for (let index = 0; index < count; index++) {
      const entry = best[index]!;
      const path = paths[entry.pathIndex]!;
      const lower = lowerPaths[entry.pathIndex]!;
      const haystack = caseSensitive ? path : lower;
      const offsets = Array<number>(length);
      let scan = entry.scanFrom;
      for (let cursor = 0; cursor < length; cursor++) {
        const at = haystack.indexOf(chars[cursor]!, scan);
        offsets[cursor] = at;
        scan = at + 1;
      }
      if (!caseSensitive && lower.length !== path.length) remapPositions(path, offsets);
      const ratio = index / divisor;
      results[index] = { path, score: path.includes('test') ? Math.min(ratio * 1.05, 1) : ratio, positions: offsets };
    }
    return results;
  }
}
