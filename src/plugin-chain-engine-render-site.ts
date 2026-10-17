// The `ui.render` chain site and the dispatch-answer copier, both from chunk-nyce03br.js
// (module digest 6a5164eb…). The site descriptor `ga` validates a render argument against the
// component prop table and the render envelope (`surface`, `component`, `requestId`, `viewport`);
// `ilt` is its `restoreArgument`, the structural copier `gno` also applies to the dispatch answer.
//
// The source's `zd` table is a literal, so its `ui.render` entry exists before any module body
// reads it. This product's table is a live registry populated as sites land (./plugin-chain-host.ts,
// `zd`), and `gno` reads `zd["ui.render"]` once at module scope. Registering here, before
// ./plugin-chain-engine-pipeline.ts is evaluated, is the product's equivalent of that literal entry.
import { registerChainSite } from './plugin-chain-host.js';
import { ga } from './plugin-chain-engine-render-site-source.js';

registerChainSite('ui.render', ga as never);

/** The `ui.render` site descriptor the registry now holds (`ga`). */
export const RENDER_SITE = ga as unknown as Record<string, unknown>;

/** Source `ilt`: copy the dispatch answer, normalizing every string to well-formed text. */
export { ilt } from './plugin-chain-engine-render-site-source.js';
