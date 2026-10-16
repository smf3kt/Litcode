// The chain sites this product carries, registered as this module evaluates: the twelve hand-written
// descriptors whose cores are also carried, the two generated families (the value events and the
// classic hook events), and the seven value events the source's table overrides by hand.
//
// The order matters and is why this is its own module: `Mm` (./plugin-chain-entry.ts) reads
// `zd[name]` when it builds a chain, and the copied cores (./plugin-chain-cores-source.ts) build
// theirs at module scope. A module that imported the cores first would pair every core with an
// undefined site, so ./plugin-chain-registry.ts imports this file before the cores.
import { registerChainSite } from './plugin-chain-host.js';
import { ai, Bi, Di, ea, Ei, ja, La, Qi, Ra, Wa, xi, Yi } from './plugin-chain-sites-source.js';
import { Bbr, HFs, Q$n, co, se } from './plugin-chain-classic-source.js';
import { Ha, Hi, Ni, Oi, Pa, Si, oa } from './plugin-chain-override-sites-source.js';
import { Ba, Ka, Ua } from './plugin-chain-classic-sites-source.js';

/** The copied site descriptor for each chain name, as `event` names them. */
const sites: ReadonlyArray<readonly [string, unknown]> = [
  ['prompt.autocomplete', ai],
  ['command.describe', xi],
  ['config.describe', Ei],
  ['attribution.text', Di],
  ['prompt.attachment', Bi],
  ['prompt.context', Yi],
  ['prompt.section', Qi],
  ['skill.prompt', ea],
  ['session.receive', Ra],
  ['telemetry.mark', ja],
  ['agent.offer', La],
  ['tool.describe', Wa],
];

for (const [name, site] of sites) registerChainSite(name, site as never);

// The two generated families, built and spread in the source's own order (`zd` is
// `{...co(Q$n, se), ...co(HFs, Bbr), …}`): the 63 value events and the 32 classic hook events.
for (const [name, site] of Object.entries({ ...co(Q$n, se), ...co(HFs, Bbr) })) {
  registerChainSite(name, site as never);
}

// The seven value events the source's table overrides by hand, in the table's own column order. They
// come after the spreads because that is where the source puts them and a later key wins: each of
// these names carries a `checkArgument` (and `state.set` a `restoreArgument`) that the generated
// value site does not have, so the hand-written descriptor is the one a plugin is held to.
const handWrittenValueSites: ReadonlyArray<readonly [string, unknown]> = [
  ['ui.open', Ni],
  ['ui.close', Hi],
  ['ui.blit', oa],
  ['env.get', Si],
  ['env.set', Oi],
  ['state.get', Pa],
  ['state.set', Ha],
];

for (const [name, site] of handWrittenValueSites) registerChainSite(name, site as never);

// The three classic sites the source writes by hand, in the table's own column order. They are the
// only hand-written entries left of `zd`, and they are excluded from the generated classic family by
// construction (`HFs` is `ao.filter(e => e !== "classic.PreToolUse")`).
const handWrittenClassicSites: ReadonlyArray<readonly [string, unknown]> = [
  ['classic.PreToolUse', Ua],
  ['tool.call', Ba],
  ['tool.check', Ka],
];

for (const [name, site] of handWrittenClassicSites) registerChainSite(name, site as never);
