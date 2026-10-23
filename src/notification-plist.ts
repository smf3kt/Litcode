// Agt/ipn closure, 8e9fdjt4 [615,2871), UTF-16; parser used only for the local Terminal profile.
type Token = [string, string | undefined, string | undefined, string | undefined];
type Tokens = Generator<Token>;
type Plist = string | number | boolean | Plist[] | { [key: string]: Plist };
export function Agt(e: unknown): e is { [key: string]: Plist } { return typeof e === 'object' && e !== null && !Array.isArray(e); }
var c = /^\/?[\w:.-]+/;
function* a(e: string): Tokens {
  let t = e.length, n = 0;
  while (n < t) {
    if (e[n] !== '<') { let u = e.indexOf('<', n); if (u === -1) u = t; yield ['', undefined, undefined, e.slice(n, u)], n = u; continue; }
    if (e.startsWith('<?', n)) { let u = e.indexOf('?>', n + 2); if (u === -1) return; n = u + 2; continue; }
    if (e.startsWith('<!--', n)) { let u = e.indexOf('-->', n + 4); if (u === -1) return; n = u + 3; continue; }
    let i = e.indexOf('>', n + 1); if (i === -1) return;
    if (e.startsWith('<!', n)) { n = i + 1; continue; }
    let r = e.slice(n + 1, i), d = c.exec(r)?.[0]; if (d === undefined) return;
    yield [e.slice(n, i + 1), d, r.endsWith('/') ? '/' : '', undefined], n = i + 1;
  }
}
export function ipn(e: string): Plist | undefined {
  let t = a(e), n = s(t); if (!n || n[1] !== 'plist' || n[2] === '/') return;
  let i = s(t); if (!i) return; let r = o(t, i); return s(t)?.[1] === '/plist' ? r : undefined;
}
function s(e: Tokens): Token | undefined { for (let t = e.next(); !t.done; t = e.next()) if (t.value[1] !== undefined) return t.value; return; }
function f(e: Tokens, t: Token): string | undefined {
  if (t[2] === '/') return ''; let n = '';
  for (let i = e.next(); !i.done; i = e.next()) { let r = i.value; if (r[1] === `/${t[1]}`) return g(n); if (r[3] === undefined) return; n += r[3]; }
  return;
}
function o(e: Tokens, t: Token): Plist | undefined {
  let n = t[2] === '/';
  switch (t[1]) {
    case 'true': case 'false': if (!n && f(e, t) === undefined) return; return t[1] === 'true';
    case 'string': case 'data': case 'date': return f(e, t);
    case 'integer': { let i = f(e, t)?.trim(); if (!i) return; let r = Number(i); return Number.isNaN(r) ? undefined : r; }
    case 'real': { let i = f(e, t)?.trim(); if (!i) return; let r = /^([+-]?)(nan|inf|infinity)$/i.exec(i);
      if (r) { if (r[2]!.toLowerCase() === 'nan') return NaN; return r[1] === '-' ? -1 / 0 : 1 / 0; }
      let d = Number(i); return Number.isNaN(d) ? undefined : d; }
    case 'array': return n ? [] : l(e);
    case 'dict': return n ? {} : p(e);
    default: return;
  }
}
function l(e: Tokens): Plist[] | undefined { let t: Plist[] = []; for (;;) { let n = s(e); if (!n) return; if (n[1] === '/array') return t; let i = o(e, n); if (i === undefined) return; t.push(i); } }
function p(e: Tokens): { [key: string]: Plist } | undefined {
  let t: { [key: string]: Plist } = Object.create(null);
  for (;;) { let n = s(e); if (!n) return; if (n[1] === '/dict') return t; if (n[1] !== 'key') return;
    let i = f(e, n), r = s(e); if (i === undefined || !r) return; let d = o(e, r); if (d === undefined) return; t[i] = d; }
}
function g(e: string): string {
  if (!e.includes('&')) return e;
  return e.replace(/&(lt|gt|amp|quot|apos|#x[0-9a-fA-F]+|#\d+);/g, (t, n: string) => {
    switch (n) { case 'lt': return '<'; case 'gt': return '>'; case 'amp': return '&'; case 'quot': return '"'; case 'apos': return "'";
      default: { let i = n[1] === 'x' ? parseInt(n.slice(2), 16) : parseInt(n.slice(1), 10); return i <= 1114111 ? String.fromCodePoint(i) : t; } }
  });
}
