// The three press-site descriptors (W45-78). The source's site table `zd` holds one descriptor per
// engine event; this module builds it with the entries the terminal dispatch reads, and re-exports
// the copied descriptors and their argument checkers from ./plugin-chain-press-sites-source.ts.
//
//   - `w3`, the element names each surface offers; `vFe`, whether a name is a surface;
//   - `C`, wrapper that refuses a non-object argument before the site's own check;
//   - `ot`, the shared press check (plugin, element, component, requestId, surface, link);
//   - `mn`, the input check (plus `kind` and a string `value`);
//   - `Cn`, the select check (plus a string `value`);
//   - `Lt`, builds an input/select descriptor;
//   - `ya`/`da`/`ha`, the ui.press, ui.input and ui.select sites.
import { ya, da, ha } from './plugin-chain-press-sites-source.js';

export {
  w3, vFe, C, ot, mn, Cn, Lt, ya, da, ha,
} from './plugin-chain-press-sites-source.js';

// The site table the dispatch indexes by event name. The compiled table also carries every other
// engine site; this host only dispatches the three whose wire the terminal draws.
export const zd = {
  'ui.press': ya,
  'ui.input': da,
  'ui.select': ha,
} as const;
