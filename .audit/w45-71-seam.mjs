// Build the two W45-71 seams: the prose is written here, every quoted body is pulled straight out of its
// module slice so a quote cannot drift from the copy it documents.
import fs from 'node:fs';

const entriesPlan = JSON.parse(fs.readFileSync('research/ports/W45-scroll-focus-blocks.plan.json', 'utf8'));
const sitesPlan = JSON.parse(fs.readFileSync('research/ports/W45-scroll-focus-sites-blocks.plan.json', 'utf8'));
const bodyOf = (plan, index) => {
  const block = plan.blocks[index];
  return fs.readFileSync(`extracted-v2/modules/${block.file}`, 'utf8').slice(block.range[0], block.range[1]);
};
const speak = (module, range, units, text) => `//\n// [${range[0]},${range[1]}) ${units} units, ${module}. ${text}\n`;

/* --------------------------------------------------------------- the entries seam */

const entries = [];
entries.push(`// The \`ui.scroll\` and \`ui.focus\` call entries (W45-71) — the two site registries a plugin's call
// reaches, the key a site is filed under, the checks each call makes before anything moves, and the
// commit road with its refusal sentences. The copied bodies live in
// ./plugin-chain-scroll-focus-source.ts, and the two site descriptors they read come from
// ./plugin-chain-scroll-focus-sites.js, which this module imports first for its side effect: \`Mm\`
// reads the site out of the host seam's table while the copy is evaluated, so the descriptors have to be
// registered before that happens.
//
// A site is what the UI side registers when a plugin's element can be scrolled or can hold the keyboard:
// \`{owner?, commit, isHeldNow?, holderNow?}\`, filed under \`component:requestId\`.
//
// The two registries, the key they are filed under, and the two lookups:
//
//   ${bodyOf(entriesPlan, 4)}
${speak('chunk-sfn1dbxq.js', [476191, 476241], 50, `\`ahe\` — the scroll-site registry: \`it().scrollSites\`, read through the store wrapper \`Ge\`, whose second argument (the disposer) is dropped in this build.`)}
//
//   ${bodyOf(entriesPlan, 2)}
${speak('chunk-sfn1dbxq.js', [475653, 475702], 49, '`Uet` — the focus-site registry: `it().focusSites`, the same way.')}
//
//   ${bodyOf(entriesPlan, 5)}
${speak('chunk-sfn1dbxq.js', [476241, 476267], 26, '`_z` — the key a site is filed under: the component and the request id joined by a colon, with nothing escaped, so a component that contains a colon is a key that cannot be told from a longer one.')}
//
//   ${bodyOf(entriesPlan, 6)}
${speak('chunk-sfn1dbxq.js', [476681, 476733], 52, '`mse` — the scroll site a call names, out of the registry above.')}
//
//   ${bodyOf(entriesPlan, 9)}
${speak('chunk-sfn1dbxq.js', [479605, 479656], 51, '`iL` — the focus site a call names, the same way.')}
//
// The two ownership checks, which are not the same check:
//
//   ${bodyOf(entriesPlan, 3)}
${speak('chunk-sfn1dbxq.js', [476009, 476078], 69, '`pyt` — the scroll check: the call is refused only when the caller is a plugin and the site has an owner that is not that plugin. A site with no owner is every plugin\'s, and an editor call is never refused here.')}
//
//   ${bodyOf(entriesPlan, 1)}
${speak('chunk-sfn1dbxq.js', [475544, 475653], 109, '`uyt` — the focus check, which is about a forwarded call: it refuses when the caller is a plugin, the site has an owner other than the origin\'s plugin, and the caller is not that origin plugin itself. A plugin touching another plugin\'s site on its own behalf passes; the same plugin forwarding the call does not.')}
//
//   ${bodyOf(entriesPlan, 0)}
${speak('chunk-sfn1dbxq.js', [475447, 475544], 97, '`XH` — the keyboard holder check: whether a plugin other than the caller holds the keyboard at this site right now.')}
//
// The two bodies and the two entries:
//
//   ${bodyOf(entriesPlan, 7)}
${speak('chunk-sfn1dbxq.js', [476733, 476926], 193, '`PY` — `$.ui.scroll`: no such site, then not this plugin\'s site, then the site\'s own commit, answering `{}` when the window moved and the site\'s refusal when it did not.')}
//
//   ${bodyOf(entriesPlan, 8)}
${speak('chunk-sfn1dbxq.js', [479578, 479605], 27, '`bse` — the `ui.scroll` entry: the site out of the host seam\'s table and this body as its core handler.')}
//
//   ${bodyOf(entriesPlan, 10)}
${speak('chunk-sfn1dbxq.js', [479656, 479962], 306, '`IY` — `$.ui.focus`: no such site, then a forwarded call from another plugin, then whether the site holds the keyboard at all, then whether another plugin\'s element holds it, and last the site\'s own commit, whose sentence is passed through as the refusal.')}
//
//   ${bodyOf(entriesPlan, 11)}
${speak('chunk-sfn1dbxq.js', [479962, 479988], 26, '`vse` — the `ui.focus` entry, the same way.')}
//
// The entry builder is the entry seam's, so an entry is a hook site from the host seam's table plus a core
// handler; the store wrapper and the registry getter come from the runner copy and the host seam.
import type { PluginFocusSite, PluginScrollSite } from './plugin-chain-registry-state.js';
import './plugin-chain-scroll-focus-sites.js';
import { Mm } from './plugin-chain-entry.js';
import {
  _z, ahe, bse, iL, IY, mse, PY, pyt, Uet, uyt, vse, XH,
} from './plugin-chain-scroll-focus-source.js';

/** Source \`bse\`: the \`ui.scroll\` entry — the site and the core handler \`PY\`. */
export const SCROLL_ENTRY = bse;

/** Source \`vse\`: the \`ui.focus\` entry — the site and the core handler \`IY\`. */
export const FOCUS_ENTRY = vse;

/** Source \`ahe\`: the scroll-site registry, the same map the registry state holds. */
export function scrollSites(): Map<string, PluginScrollSite> {
  return ahe() as Map<string, PluginScrollSite>;
}

/** Source \`Uet\`: the focus-site registry, the same map the registry state holds. */
export function focusSites(): Map<string, PluginFocusSite> {
  return Uet() as Map<string, PluginFocusSite>;
}

/** Source \`_z\`: the key a site is filed under. */
export function siteKey(component: string, requestId: string): string {
  return _z(component, requestId);
}

/** Source \`mse\`: the scroll site a call names, or nothing when no site is filed under that key. */
export function scrollSiteFor(call: { component: string; requestId: string }): PluginScrollSite | undefined {
  return mse(call) as PluginScrollSite | undefined;
}

/** Source \`iL\`: the focus site a call names, or nothing when no site is filed under that key. */
export function focusSiteFor(call: { component: string; requestId: string }): PluginFocusSite | undefined {
  return iL(call) as PluginFocusSite | undefined;
}

/** Source \`PY\`: \`$.ui.scroll\` — the site's own commit, or the refusal that says why not. */
export function scrollCall(call: {
  component: string; requestId: string; offset: unknown; origin: { kind?: string; name?: string };
}): { deny?: string } {
  return PY(call) as { deny?: string };
}

/** Source \`IY\`: \`$.ui.focus\` — the site's own commit, or the refusal that says why not. */
export function focusCall(call: {
  component: string; requestId: string; plugin: string; origin: { kind?: string; name?: string };
}): { deny?: string } {
  return IY(call) as { deny?: string };
}

/** Source \`pyt\`: is this scroll call one the site refuses to let through. */
export function scrollCallIsForeign(site: PluginScrollSite, origin: { kind?: string; name?: string }): boolean {
  return pyt(site, origin);
}

/** Source \`uyt\`: is this focus call a forwarded one the site refuses to let through. */
export function focusCallIsForwarded(site: PluginFocusSite, call: { plugin: string; origin: { kind?: string; name?: string } }): boolean {
  return uyt(site, call);
}

/** Source \`XH\`: does another plugin's element hold the keyboard at this site. */
export function otherHolderHasKeyboard(site: PluginFocusSite, origin: { kind?: string; name?: string }): boolean {
  return XH(site, origin);
}

/** The copied bodies under their source names, for a record or a test that wants to compare the ported
 *  call with the source's own. */
export const SOURCE_BODIES = { XH, uyt, Uet, pyt, ahe, _z, mse, PY, bse, iL, IY, vse, Mm };

export { XH, uyt, Uet, pyt, ahe, _z, mse, PY, bse, iL, IY, vse };

export type { PluginFocusSite, PluginScrollSite };
`);
fs.writeFileSync('src/plugin-chain-scroll-focus.ts', entries.join(''));

/* --------------------------------------------------------------- the sites seam */

const sites = [];
sites.push(`// The \`ui.scroll\` and \`ui.focus\` site descriptors (W45-71) — what a call of either name must
// carry, what a rewrite of one may not change, and what its answer must look like — registered into the
// host seam's site table as this module is evaluated. The copied bodies live in
// ./plugin-chain-scroll-focus-sites-source.ts.
//
// The registration is why this is its own module: \`Mm\` pairs an entry with \`zd[name]\` while the
// entries' copy is evaluated, so the two descriptors have to be in the table first, and the entries'
// copy imports this file above its own bodies for exactly that reason.
//
// The check and the two builders every site of this family shares, which the copies above already carry:
// \`et(kind, answer, rest)\` describes a refusal, \`we(keys)\` builds a restore-argument step and
// \`C(check)\` wraps the check that reads an answer. The two descriptors are built with them:
//
//   ${bodyOf(sitesPlan, 0)}
${speak('chunk-nyce03br.js', [15588, 15723], 135, '`pr` — the check both sites share: the answer may carry no `deny`, or one that is a non-empty string. An empty one is refused with `a deny that is not a non-empty string`, which is what keeps a silent refusal from reading as success.')}
//
//   ${bodyOf(sitesPlan, 1)}
${speak('chunk-nyce03br.js', [16084, 16200], 116, '`ro` — the site builder: the event name, the restore-argument step over the names the site restores, the argument check, and the wrapped answer check.')}
//
//   ${bodyOf(sitesPlan, 2)}
${speak('chunk-nyce03br.js', [34850, 35160], 310, '`Vr` — the element check: an element where the move named none is one of the engine\'s stops, no element where it named one is a rewrite naming another, and anything that is not a non-empty string is refused outright.')}
//
//   ${bodyOf(sitesPlan, 3)}
${speak('chunk-nyce03br.js', [35160, 35211], 51, '`ko` — the four names a focus call\'s envelope is made of, which a rewrite may not change.')}
//
//   ${bodyOf(sitesPlan, 4)}
${speak('chunk-nyce03br.js', [35211, 35334], 123, '`Ci` — the `ui.focus` site: the envelope plus its element, the envelope-unchanged check followed by the element check, and the shared answer check.')}
//
//   ${bodyOf(sitesPlan, 5)}
${speak('chunk-nyce03br.js', [94084, 94166], 82, '`Po` — the seven names a scroll call\'s envelope is made of. The offset is not among them, which is measured: the site checks it and does not restore it.')}
//
//   ${bodyOf(sitesPlan, 6)}
${speak('chunk-nyce03br.js', [94166, 94345], 179, '`wa` — the `ui.scroll` site: the offset must be a whole row number (0 or more), then the envelope-unchanged check, then the shared answer check.')}
//
// Both are registered under the names the host seam's table files them by, in the order the table lists
// them.
import { registerChainSite } from './plugin-chain-host.js';
import { Ci, ko, Po, pr, ro, Vr, wa } from './plugin-chain-scroll-focus-sites-source.js';

/** Source \`Ci\`: the \`ui.focus\` site descriptor. */
export const FOCUS_SITE = Ci;
/** Source \`wa\`: the \`ui.scroll\` site descriptor. */
export const SCROLL_SITE = wa;
/** Source \`ko\`: the names a focus call's envelope is made of. */
export const FOCUS_CALL_ARGUMENTS = ko;
/** Source \`Po\`: the names a scroll call's envelope is made of. */
export const SCROLL_CALL_ARGUMENTS = Po;

registerChainSite('ui.focus', Ci as never);
registerChainSite('ui.scroll', wa as never);

/** Source \`pr\`: the answer check both sites share — the refusal it answers, or nothing. */
export function siteAnswerCheck(answer: unknown, args: unknown, fromBelow: unknown): string | undefined {
  return pr(answer, args, fromBelow);
}

/** Source \`Vr\`: the element check — the refusal it answers, or nothing. */
export function elementCheck(next: unknown, previous: unknown): string | undefined {
  return Vr(next, previous);
}

/** Source \`ro\`: the site builder, for a site of this family that is not one of the two above. */
export function buildSite(spec: {
  event: string;
  restored: string[];
  checkArgument: (args: unknown, previous: unknown) => string | undefined;
  check: (answer: unknown, args: unknown, fromBelow: unknown) => string | undefined;
}): unknown {
  return ro(spec);
}

/** The copied bodies under their source names, for a record or a test that wants to compare the ported
 *  descriptor with the source's own. */
export const SOURCE_BODIES = { pr, ro, Vr, ko, Ci, Po, wa };

export { Ci, ko, Po, pr, ro, Vr, wa };
`);
fs.writeFileSync('src/plugin-chain-scroll-focus-sites.ts', sites.join(''));
console.log('seams written', fs.readFileSync('src/plugin-chain-scroll-focus.ts', 'utf8').split('\n').length,
  'and', fs.readFileSync('src/plugin-chain-scroll-focus-sites.ts', 'utf8').split('\n').length, 'lines');
