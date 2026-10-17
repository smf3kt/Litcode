// W45-79 URL plan: the link normalizer `mxn` and the path-safety bodies it reads. `Rf` calls `mxn`
// to turn a local href into a file URL before comparing it with the drawing's declared links; the
// graph reaches the Windows UNC tests, the posix danger parser and the percent-decoding check.
// Environment bindings come from ./plugin-chain-press-url-host.ts.
import fs from 'node:fs';

const plan = {
  imports: [
    "import { et, tt, nt, a, Rn, se } from './plugin-chain-press-url-host.js';",
  ],
  exports: [
    'mxn', 'An', 'IF', 'Bn', 'zN', 'zt', 'Xt', 'lA', 'tl', 'fa', 'qP', 'aw', 'QPe', 'qa', 'GS',
    'qO', 'Mt', 'C', 'YR', 'Lt', '_m', 'Bt', 'Gt', 'I', 'k', 'vfr', 'Cot', 'Yoo', 'Xoo', 's',
    'Koo', 'l', 'c', 'f', 'i', 'u', 'uG',
  ],
  blocks: [
    { file: 'chunk-j8hqhz0c.js', range: [46149, 46315], note: '`IF` — absolute path to a file URL, refusing a UNC, dangerous or encoded-traversal path' },
    { file: 'chunk-j8hqhz0c.js', range: [46315, 46756], note: '`mxn` — normalize a local href to a file URL, keeping the query and fragment' },
    { file: 'chunk-j8hqhz0c.js', range: [46756, 46855], note: '`An` — strip a leading slash before a Windows drive letter' },
    { file: 'chunk-ae84tp6z.js', range: [7436, 7484], note: '`Bn` — whether a path is a UNC or extended-length path' },
    { file: 'chunk-ae84tp6z.js', range: [22769, 22836], note: '`zN` — whether a path is an extended-length path after normalization' },
    { file: 'chunk-ae84tp6z.js', range: [22836, 22861], note: '`zt` — the extended-length path prefix' },
    { file: 'chunk-ae84tp6z.js', range: [22861, 22916], note: '`Xt` — normalize a path with the Windows rules' },
    { file: 'chunk-ae84tp6z.js', range: [14875, 15025], note: '`lA` — strip the extended-length prefix' },
    { file: 'chunk-ae84tp6z.js', range: [11681, 11730], note: '`tl` — whether a posix path is dangerous' },
    { file: 'chunk-ae84tp6z.js', range: [11361, 11389], note: '`fa` — whether a path names a device' },
    { file: 'chunk-ae84tp6z.js', range: [12953, 12981], note: '`qP` — whether a path is a Windows device path' },
    { file: 'chunk-ae84tp6z.js', range: [8134, 8430], note: '`aw` — whether a path escapes through a dot-dot segment' },
    { file: 'chunk-ae84tp6z.js', range: [11855, 12015], note: '`QPe` — the cached posix path parse' },
    { file: 'chunk-ae84tp6z.js', range: [11779, 11815], note: '`qa` — whether the posix parser found anything' },
    { file: 'chunk-ae84tp6z.js', range: [12414, 12612], note: '`GS` — the posix path danger scan' },
    { file: 'chunk-ae84tp6z.js', range: [12612, 12768], note: '`qO` — the posix path segment scan' },
    { file: 'chunk-ae84tp6z.js', range: [12768, 12953], note: '`Mt` — the posix path parse' },
    { file: 'chunk-ae84tp6z.js', range: [8635, 8745], note: '`C` — one posix path segment check' },
    { file: 'chunk-ae84tp6z.js', range: [8993, 9108], note: '`YR` — whether a posix path is absolute' },
    { file: 'chunk-ae84tp6z.js', range: [12015, 12176], note: '`Lt` — the posix path parser' },
    { file: 'chunk-ae84tp6z.js', range: [12981, 13030], note: '`_m` — whether a posix path is dangerous' },
    { file: 'chunk-ae84tp6z.js', range: [11815, 11855], note: '`Bt`/`Gt`/`I`/`k` — the path parse cache bounds and tables' },
    { file: 'chunk-d1ctn2b7.js', range: [896, 994], note: '`vfr` — whether a file URL path is dangerous, after percent decoding' },
    { file: 'chunk-d1ctn2b7.js', range: [1010, 1091], note: '`Cot` — whether a path names a dot-dot traversal' },
    { file: 'chunk-d1ctn2b7.js', range: [1163, 1227], note: '`Yoo` — whether a file URL names a traversal' },
    { file: 'chunk-d1ctn2b7.js', range: [1284, 1560], note: '`Xoo` — percent-decode a path for the traversal checks' },
    { file: 'chunk-d1ctn2b7.js', range: [1560, 1640], note: '`s` — percent bytes of one escape' },
    { file: 'chunk-d1ctn2b7.js', range: [857, 896], note: '`Koo` — strip leading invisible characters' },
    { file: 'chunk-d1ctn2b7.js', range: [1091, 1163], note: '`l` — whether a normalized posix path leaves its root' },
    { file: 'chunk-d1ctn2b7.js', range: [741, 857], note: '`c` — the leading invisible-character pattern' },
    { file: 'chunk-d1ctn2b7.js', range: [1227, 1284], note: '`i`/`f` — the percent-escape pattern and the leading-escape test' },
    { file: 'chunk-d1ctn2b7.js', range: [994, 1010], note: '`u` — the leading dot-dot pattern' },
    { file: 'chunk-ax7r0qj7.js', range: [5178, 5245], note: '`uG` — the control-character pattern' },
  ],
};

fs.writeFileSync('research/ports/W45-press-url-blocks.plan.json', JSON.stringify(plan, null, 1) + '\n');
console.log(plan.blocks.length, 'blocks');
