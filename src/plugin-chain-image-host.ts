// The host seam the Image component reads (W45-76). The component bodies live in
// ./plugin-chain-image-component-source.ts; this module supplies the host state they ask for and
// nothing else. The source bodies are copied whole; the seam is the boundary between them and this
// build's terminal:
//
//   - `LT`, `Z8n`, `aWo` and `$1t` are the capability and file-probe store accessors of
//     chunk-mvsmkx6d.js. The stores themselves are copied (W45-75); these four wrappers are the host
//     object (`DT().capabilities` / `DT().imageFiles`) that the source reaches them through, so they
//     are served here over the copied stores instead of the source's terminal probe.
//   - `bC` is the client context the resolver reads `terminalImages` from, and `QO` the internal
//     querier the file probe sends through. Both are host objects; this build serves them from a
//     configurable fixture (`configureImageHost`) and defaults them to null, which the source already
//     treats as "no terminal images" and "no querier".
//   - `ge` is the terminal colour level the id width is chosen from (`ge.level`); this build starts it
//     at 0, the level at which the resolver draws alt text, and tests raise it.
//   - `lPe` is the temporary path builder the file probe writes its probe image to. It is the host's
//     filesystem policy, so it is written here against the host's temp directory.
//
// The client contract is read from the source's calls: `allocate(width, onRefusal)` answers an 8-bit
// image id or undefined, `free(id)` releases it, `transmit(id, build, { resend })` sends one source
// and answers whether the terminal took it, and `isBackedUp(id)` tells whether the surface still holds
// frames for it.
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  CapabilityReadings, DEFAULT_CAPABILITIES, CAPABILITY_NAMES, ImageFileProbe,
} from './plugin-chain-terminal-capabilities.js';
import type { CapabilityStore, ImageFileProbeStore } from './plugin-chain-terminal-capabilities.js';

export interface TerminalImages {
  allocate(width: number, onRefusal: (message: string) => void): number | undefined;
  free(id: number): void;
  transmit(id: number, build: (id: number) => string, options: { resend: boolean }): boolean;
  isBackedUp(id: number): boolean;
}

export interface TerminalQuerier {
  send(query: { request: string; match: (event: unknown) => boolean }): Promise<{ message: string } | undefined>;
  flush(): Promise<boolean>;
}

export interface ImageHostConfiguration {
  terminalImages?: TerminalImages | null;
  internalQuerier?: TerminalQuerier | null;
  capabilityLevel?: number;
  capabilities?: CapabilityStore;
  imageFiles?: ImageFileProbeStore;
}

let terminalImages: TerminalImages | null = null;
let internalQuerier: TerminalQuerier | null = null;
let capabilityStore: CapabilityStore = defaultReadings();
let fileProbe: ImageFileProbeStore = new ImageFileProbe();

/** The colour level object the source reads as `ge.level`: 0 for a terminal with no indexed colour,
 *  2 from indexed colour (the small id width) and 3 from truecolor (the wide id width). */
export const ge = { level: 0 };

function defaultReadings(): CapabilityStore {
  const readings: Record<string, { likely: boolean; source: string }> = {};
  for (const name of CAPABILITY_NAMES as string[]) {
    readings[name] = { likely: (DEFAULT_CAPABILITIES as Record<string, boolean>)[name], source: 'not asked yet' };
  }
  return new CapabilityReadings(readings);
}

/** Replace the host state; `resetImageHost` restores the defaults (no terminal images, no querier,
 *  level 0, fresh stores). */
export function configureImageHost(configuration: ImageHostConfiguration): void {
  if ('terminalImages' in configuration) terminalImages = configuration.terminalImages ?? null;
  if ('internalQuerier' in configuration) internalQuerier = configuration.internalQuerier ?? null;
  if ('capabilityLevel' in configuration) ge.level = configuration.capabilityLevel ?? 0;
  if ('capabilities' in configuration) capabilityStore = configuration.capabilities ?? defaultReadings();
  if ('imageFiles' in configuration) fileProbe = configuration.imageFiles ?? new ImageFileProbe();
}

export function resetImageHost(): void {
  terminalImages = null;
  internalQuerier = null;
  ge.level = 0;
  capabilityStore = defaultReadings();
  fileProbe = new ImageFileProbe();
}

export function bC(): { terminalImages: TerminalImages | null } {
  return { terminalImages };
}

export function QO(): { internal_querier: TerminalQuerier | null } {
  return { internal_querier: internalQuerier };
}

export function LT(): CapabilityStore {
  return capabilityStore;
}

export function Z8n(): boolean {
  return capabilityStore.now('kittyGraphics');
}

export function aWo(listener: (value: boolean) => void): () => void {
  return capabilityStore.onSettle('kittyGraphics', listener);
}

export function $1t(): ImageFileProbeStore {
  return fileProbe;
}

/** Source `lPe`'s contract: a temp path named after the caller, a content hash or a fresh id. */
export function lPe(prefix = 'plugin-prompt', extension = '.md', options?: { contentHash?: string }): string {
  const id = options?.contentHash === undefined ? randomUUID().replaceAll('-', '') : options.contentHash.slice(0, 16);
  return join(tmpdir(), `${prefix}-${id}${extension}`);
}
