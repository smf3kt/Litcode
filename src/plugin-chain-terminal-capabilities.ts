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
export {
  i as ImageFileProbe,
  o as CapabilityReadings,
  s as DEFAULT_CAPABILITIES,
  Q8n as CAPABILITY_NAMES,
} from './plugin-chain-terminal-capabilities-source.js';
