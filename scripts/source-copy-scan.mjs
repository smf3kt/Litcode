// Regex-literal-aware scanners over minified JS. Used to copy source bodies verbatim.
const REGEX_PREV = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '~', '^', '<', '>', '']);

/** Skip a comment, string or regex literal starting at i; returns the index of its last character. */
function skipLiteral(t, i, prev) {
  const c = t[i];
  if (c === '/' && t[i + 1] === '/') { while (i < t.length && t[i] !== '\n') i++; return i; }
  if (c === '/' && t[i + 1] === '*') { i += 2; while (i < t.length && !(t[i] === '*' && t[i + 1] === '/')) i++; return i + 1; }
  if (c === '"' || c === "'" || c === '`') {
    const q = c;
    for (i++; i < t.length; i++) { if (t[i] === '\\') i++; else if (t[i] === q) break; }
    return i;
  }
  if (c === '/' && REGEX_PREV.has(prev)) {
    let cls = false;
    for (i++; i < t.length; i++) {
      if (t[i] === '\\') { i++; continue; }
      if (t[i] === '[') cls = true;
      else if (t[i] === ']') cls = false;
      else if (t[i] === '/' && !cls) break;
    }
    return i;
  }
  return -1;
}

/** Index of `needle` at brace/paren depth 0, or -1. */
export function topLevelIndex(t, needle) {
  let depth = 0, paren = 0, prev = '';
  for (let i = 0; i < t.length; i++) {
    const last = skipLiteral(t, i, prev);
    if (last >= 0) { prev = t[i]; i = last; continue; }
    if (depth === 0 && paren === 0 && t.startsWith(needle, i) && !/[\w$.]/.test(t[i - 1] ?? '')) return i;
    const c = t[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '(') paren++;
    else if (c === ')') paren--;
    if (!/\s/.test(c)) prev = c;
  }
  return -1;
}

/** A `function`/`class` declaration body: from `start` to the brace that closes it. */
export function extractFn(text, start) {
  let i = start, paren = 0, bodyStart = -1, depth = 0, prev = '';
  for (; i < text.length; i++) {
    const last = skipLiteral(text, i, prev);
    if (last >= 0) { prev = text[i]; i = last; continue; }
    const c = text[i];
    if (c === '(') paren++; else if (c === ')') paren--;
    else if (c === '{') { if (paren === 0 && bodyStart < 0) { bodyStart = i; depth = 1; } else if (bodyStart >= 0) depth++; }
    else if (c === '}') { if (bodyStart >= 0) { depth--; if (depth === 0) return [start, i + 1]; } }
    if (!/\s/.test(c)) prev = c;
  }
  return [start, text.length];
}

/** One top-level statement: from `start` to the first depth-0 semicolon. */
export function extent(text, start) {
  let depth = 0, prev = '';
  for (let i = start; i < text.length; i++) {
    const last = skipLiteral(text, i, prev);
    if (last >= 0) { prev = text[i]; i = last; continue; }
    const c = text[i];
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth--;
    else if (c === ';' && depth === 0) return [start, i + 1];
    else if (depth === 0 && i > start && /\S/.test(c) === false) continue;
    if (!/\s/.test(c)) prev = c;
  }
  return [start, text.length];
}
