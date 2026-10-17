// The Image site component and its resolver (W45-76, partition 2b-ii). The copied bodies live in
// ./plugin-chain-image-component-source.ts; this module is the seam around them. A plugin's `Image`
// node gives a source in one of the four shapes of ./plugin-chain-image-model.ts; the resolver `Ao`
// keeps an image id, transmits the source through the wire layer, and registers the answer the site
// draws; the component `No` renders that answer as the raw-ansi element, or the alt text when there is
// none.
//
// The path through the bodies:
//
//   - `Eo` decides why the Image draws its alt instead of the source: no terminal root, placeholders
//     the terminal does not draw, no free 8-bit id, the file-read question not yet answered (asked
//     here, blit again), or a terminal that cannot read files.
//   - `Lo`/`tr`/`rr`/`dt` are the one-shot file-read probe: it writes a 4-byte probe image to a temp
//     path, asks the terminal through `uFo`, and settles the W45-75 file store with the answer; `gi`
//     is the set of transient filesystem errors that leave the probe inconclusive instead of false.
//   - `or` turns a source into the transmit the wire layer builds; `Ho` is the per-key refusal log,
//     rate-limited by `Po` so a repeated refusal is reported once per 5 s; `xt` is the resolver's
//     memory of what it last sent (source key, source, box).
//   - `Ke` is the id width by terminal level: 8 bits from indexed colour, 24 from truecolor; `vo`
//     reads the capability store and answers the width, or undefined below indexed colour.
//   - `Mo` registers the alt answer through the image mount writer (`ELs`/`vLs`), keyed like the
//     raster side.
//   - `Oo` subscribes to the file-read answer for the duration of one resolve.
//   - `Ao` is the resolver: allocate an id on mount, transmit on the first render and on a source or
//     size change, skip a resend of the same file/shm reference, and register the callback whose
//     answer is the alt element when the terminal cannot draw the source.
//   - `No` is the component: the alt text when the resolver answers undefined, otherwise a Box holding
//     one `ink-raw-ansi` element sized to the image.
//
// The host seam is ./plugin-chain-image-host.ts: the capability and file-probe accessors, the client
// and querier contexts, the colour level and the temp path builder. The source bodies call them by the
// same names they had in the bundle.
export {
  E, uFo, Eo, Lo, tr, rr, dt, or, Po, Ho, xt, Ke, vo, Mo, Oo, Ao, No,
  xi, hi, yi, gi,
} from './plugin-chain-image-component-source.js';
