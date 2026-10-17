// The terminal capability and image-file probe stores (W45-75). The copied bodies live in
// ./plugin-chain-terminal-capabilities-source.ts; this module is the seam around them. The Image
// component asks two questions of the terminal: whether it draws kitty graphics, and whether it reads
// files on this machine. Both answers are kept in the two state machines of chunk-mvsmkx6d.js, copied
// whole here, and both are asked of the terminal at most once.
//
// ImageFileProbe (source `i`) is the file-read probe: it starts `unasked`, `begin()` moves it to
// `asking` and answers false unless it was unasked; `unask()` returns an asking probe to unasked;
// `answer({value, source})` settles it once and emits the value, and `onSettle` either calls back at
// once when already settled or subscribes until the answer arrives.
//
// CapabilityReadings (source `o`) is the terminal capability table. `DEFAULT_CAPABILITIES` (source
// `s`) holds the assumed value of every capability and `CAPABILITY_NAMES` (source `Q8n`) lists them.
// The store is built from per-capability readings: a reading with `settled` is settled at that value,
// one with `likely` stays pending at that guess. `now` answers the settled value or the default,
// `answer` settles a pending capability (and records a yes), `deadline` settles every pending
// capability at its guess with `, no answer` appended to the source, and `onSettle` follows one
// capability the same way the probe store does.
import { i, o, s, Q8n } from './plugin-chain-terminal-capabilities-source.js';

export interface ImageFileReading {
  state: 'unasked' | 'asking' | 'settled';
  value?: boolean;
  source?: string;
}

export interface ImageFileProbeStore {
  get(): ImageFileReading;
  now(): boolean | undefined;
  begin(): boolean;
  unask(): void;
  answer(reading: { value: boolean; source: string }): boolean;
  onSettle(listener: (value: boolean) => void): () => void;
}

export interface CapabilityReading {
  state: 'pending' | 'settled';
  value?: boolean;
  likely?: boolean;
  source: string;
}

export interface CapabilityStore {
  get(name: string): CapabilityReading;
  now(name: string): boolean;
  confirmed(name: string): boolean;
  pending(): string[];
  answer(name: string, value: boolean, source: string): boolean;
  deadline(): void;
  onSettle(name: string, listener: (value: boolean) => void): () => void;
}

export const ImageFileProbe = i as unknown as new (initial?: { value: boolean; source: string }) => ImageFileProbeStore;
export const CapabilityReadings = o as unknown as new (
  readings: Record<string, { settled?: boolean; likely?: boolean; source: string }>,
) => CapabilityStore;
export const DEFAULT_CAPABILITIES = s as Record<string, boolean>;
export const CAPABILITY_NAMES = Q8n as string[];
