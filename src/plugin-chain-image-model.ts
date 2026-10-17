// The plugin image source model (W45-74). The copied bodies live in
// ./plugin-chain-image-model-source.ts; this module is the seam around them. A plugin supplies an
// image source in one of four shapes:
//
//   { png }                             inline PNG bytes (base64)
//   { rgba, width, height }             inline raw RGBA bytes (base64)
//   { file, format, width, height }     a file path the terminal reads
//   { shm, format, width, height }      a POSIX shared-memory name the terminal reads
//
// The validators for those shapes, and the decoded byte-size reader, were carried by the ui.blit copy
// (W45-58: `Mss`, `G_`, `z_`, `Y_`, `q_`, `F_`, `fs`, `ds`). This module adds the part the site
// component itself reads:
//
//   - `ac`, whether the source is the inline PNG shape; `Z4t`, whether it is a file or shm reference;
//     `Uto`, whether it is specifically the shm reference;
//   - `B_`, the source's decoded size — 0 for a file or shm reference, whose bytes never pass through
//     this process, otherwise the base64 payload's decoded byte count;
//   - `Dss`, the conversion from a source to the shape the wire layer's `cFo` transmits: inline
//     sources carry their base64 (and the pixel size for rgba), while file and shm references carry
//     the medium name and, unless the format is png, the pixel size.
//
// The source's own text is the behaviour; this module adds none. The Image component looks up
// `Z4t`/`Uto`/`Dss` and the wire layer (`cFo`) reads the result.
export { ac, Z4t, B_, Uto, Dss } from './plugin-chain-image-model-source.js';
