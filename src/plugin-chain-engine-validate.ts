// The engine's tree validation (`Eur`) and the closure it reads, the third slice of the `gno`
// pipeline measured by W140. The copied bodies live in ./plugin-chain-engine-validate-source.ts;
// this module is the typed seam around them.
//
// Source, chunk-n3ykh62m.js (module digest 2a0e605d…) plus ten element/limit tables from
// chunk-nyce03br.js (digest 6a5164eb…). `Eur` [262627,266967) walks one hook-returned tree and
// answers the first problem it finds, or nothing:
//
//   - node count (`AFe` 20000), depth (`ESe` 32), and the client component sentinel `B3e`;
//   - text children: control characters, and their row cost (`IAt`/`lQt`);
//   - element names (`Drt`), block-inside-inline, surface membership (`w3`);
//   - the element's own validator (`tno`), sibling key scope (`ano`), and `lur`'s hover/group/
//     client rules;
//   - Button children (strings and Text only), Markdown and Client around the dialog;
//   - Link hrefs through `sno`/`tIn`, and its drawn text row cost;
//   - props: allowed names (`Pgo`), scalar kinds, `sQt` value rules, `Igo` layout names,
//     `Ogo` spacing weights, border cost (`Ago`);
//   - Raster cell (`yur` 262144) and Image source byte (`hur` 2097152) limits;
//   - the dialog component's single engine node, row budget (`kFe`) and measured rows (`w`).
//
// The helpers this slice reads are imports from copies earlier packages landed; the plan in
// research/ports/W143-engine-tree-validation.plan.json carries the exact block provenance.
import { Eur, Drt, hur, yur, aur, B3e, w3 } from './plugin-chain-engine-validate-source.js';

/** What a validation call may read or receive. */
export interface ValidateOptions {
  surface?: string;
  note?: (problem: string) => void;
  within?: string;
  clientRows?: (client: { props?: Record<string, unknown> }) => number;
  measured?: (rows: number) => void;
}

/** Source `Eur`: the first problem in one hook-returned tree, or nothing when it validates. */
export function validateDrawnTree(tree: unknown, component: string, options: ValidateOptions = {}): string | undefined {
  return Eur(tree, component, options) as string | undefined;
}

/** The element names a surface accepts, by surface; a missing surface is not checked. */
export const SURFACE_ELEMENTS: Readonly<Record<string, readonly string[]>> = w3;

/** Every element the engine knows, in the source's own order. */
export const ELEMENT_TYPES: readonly string[] = Object.keys(Drt);

/** The component whose tree the dialog rules apply to. */
export const DIALOG_COMPONENT: string = B3e;

/** The limits the walk enforces: node count, depth, dialog rows, Raster cells, Image bytes, hover
 *  scope name length. */
export const NODE_LIMIT: number = 20000;
export const DEPTH_LIMIT: number = 32;
export const DIALOG_ROW_LIMIT: number = 12;
export const RASTER_CELL_LIMIT: number = yur;
export const IMAGE_BYTE_LIMIT: number = hur;
export const HOVER_SCOPE_LIMIT: number = aur;
