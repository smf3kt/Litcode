import { stripVTControlCharacters } from 'node:util';

/**
 * `pn(text)`, the source's ANSI stripper: the visible text of a string with its escape sequences gone.
 *
 * The source body is a Bun builtin call, `function pn(e){return Bun.stripANSI(e)}` (chunk-gyf58rwf.js
 * sha256 7a6a01732760c89b..., [9076,9115) 39 units, body sha256 f154404efd625789...), which this host
 * cannot call. `node:util`'s `stripVTControlCharacters` is the Node equivalent the platform provides, so it
 * stands in for the builtin; `Bun.stripANSI` and this differ only in how far they follow a malformed
 * sequence, and the copied row mapping uses the result for one thing, the length of each logical line of
 * the visible text.
 *
 * The one caller among the copied bodies is `S9r` in ./plugin-chain-decorations-source.ts (source
 * chunk-sfn1dbxq.js [463623,464165)).
 */
export function pn(text: string): string {
  return stripVTControlCharacters(text);
}
