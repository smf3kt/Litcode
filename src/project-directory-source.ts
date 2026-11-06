// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W385-declaration-prefix-preflight.md.
// Modules:
//   chunk-nqc6v990.js  sha256 261b35d99a3bb5aed676678c983f7c903da023ab3ad0c4117a3474d6b51e0738
//   chunk-sahdsq7n.js  sha256 f8807529cfba1dc0bc35ef9b17d6d39ccf35bba8f66e3e0e6c6ed07c1d43eda0
//   chunk-nca5bd28.js  sha256 a6f69359e93ba0c15ee9da0020883965ad9b61175383f270f55b09fe7bffcd6a
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
//
// The project storage root the source derives for transcripts, subagent directories and the
// `tool-results` store: `pin()` is the validated `CLAUDE_CODE_PROJECT_DIR_NAME` override, and when
// it is absent the directory name is the sanitized cwd with a 200-unit cutoff and a base-36 djb2
// suffix. `be()` is the product's existing `.claude` copy in
// ./plugin-chain-settings-source-source.js; `o()` is its `CLAUDE_CONFIG_DIR` read; `po` is the
// memoizer both `be` and `pin` are built with (./plugin-chain-memoize-source.js); `S` is the source
// alias for `path.join`. No body below is edited.

import { join } from 'node:path';
import { po } from './plugin-chain-memoize-source.js';
import { be, o } from './plugin-chain-settings-source-source.js';

const S = join;

// chunk-nqc6v990.js declares `p`, the project-directory-name override, unmodified [2838,2899) 61 units sha256 92292bf5007592f694ebc99383d7788f1c95f258856a0c5ef93546c8bafd07f0
function p(){return process.env.CLAUDE_CODE_PROJECT_DIR_NAME}

// chunk-nqc6v990.js declares `D`, `A`, `$Oo` and `C`: the accepted-name and reserved-device regexes, the validated name and the memo cache key [2899,3081) 182 units sha256 2d561dfb4b32f38684ef45163e8e13229b3c65ca2127d3fc2da9eba002b478d1
var D=/^[A-Za-z0-9_-]{1,64}$/,A=/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])$/i;function $Oo(e){if(!e||!D.test(e)||A.test(e))return;return e}function C(){return`${o()??""}\x00${p()??""}`}

// chunk-nqc6v990.js declares `pin`, the validated override remembered per config-dir/name pair [3081,3119) 38 units sha256 1da7592bed9a2323d2f924baefd9d07391ebd94a4f2821490f0f67bee1ca46f3
var pin=po(()=>o()?$Oo(p()):void 0,C);

// chunk-sahdsq7n.js declares `Use`, the 32-bit rolling hash the long-name suffix is taken from [615,704) 89 units sha256 9a279f3bc07c2a9e4a5d884ed74edcb130f952882285b43fd38e2e4c444939e6
function Use(t){let e=0;for(let n=0;n<t.length;n++)e=(e<<5)-e+t.charCodeAt(n)|0;return e}

// chunk-nca5bd28.js declares `Ipe` and `Le`: the 200-unit cutoff and the base-36 magnitude of the hash [12524,12588) 64 units sha256 aef8f6be0f5cb17ec973b3c6307b2f229d4a8efd16fc6c2354030f29173c4ce5
var Ipe=200;function Le(e){return Math.abs(Use(e)).toString(36)}

// chunk-nca5bd28.js declares `k`, the cwd spelling with every non-alphanumeric unit replaced by `-` [12588,12640) 52 units sha256 8d95c88fe028622e526a272e94c57d2e5e759f84bbcc414110028dcd4de8a0a6
function k(e){return e.replace(/[^a-zA-Z0-9]/g,"-")}

// chunk-nca5bd28.js declares `DO`, the directory name for a cwd: the sanitized spelling, or its first 200 units plus the hash of the original spelling [12640,12727) 87 units sha256 a23f451004c71f17d6a26241fce359908a1c07874588b6279aaea3cce7091076
function DO(e){let n=k(e);if(n.length<=Ipe)return n;return`${n.slice(0,Ipe)}-${Le(e)}`}

// chunk-nca5bd28.js declares `Df`, the projects root under the `.claude` configuration directory [13408,13448) 40 units sha256 916fdacf7d2549fefe2843d317be201acf7e60df8a14d915abf5d841d8e12bc5
function Df(){return S(be(),"projects")}

// chunk-nca5bd28.js declares `VE`, the selected directory name: the pinned override, else the cwd spelling [13448,13483) 35 units sha256 7261cfc4042294118cc607c845291ec82061c56a0e9aefe7f102fdba86f9900a
function VE(e){return pin()??DO(e)}

// chunk-nca5bd28.js declares `Oh`, the project directory under a supplied projects root [13537,13577) 40 units sha256 320e7d8215e540ad280009d99d1d45792c28d11fb0a0be3895fbb1106df2ee45
function Oh(e,n=Df()){return S(n,VE(e))}

// chunk-nca5bd28.js declares `l8e`, the pinned project directory, or null when no valid override exists [13577,13637) 60 units sha256 c13f65278c0cdb6df858d3421210f1f34a03cf00e0d01a0c46a71e814c92d71c
function l8e(){let e=pin();return e===void 0?null:S(Df(),e)}

// chunk-bf3z2ftn.js `En` [43709,43758) 49 units sha256 9591f8c9f971ab4384067261e59f7b41fa67b1a7d49eca414c5a67eca8628216
// uses `l8e()??Oh(cwd)` as the store root before joining the session id and `tool-results`. This
// exposes only that root expression; the session join belongs to the permission port.

export {
  p as projectNameOverride,
  $Oo as validatedProjectDirectoryName,
  pin as pinnedProjectDirectoryName,
  Use as rollingHash32,
  Le as base36Magnitude,
  DO as projectDirectoryNameFromCwd,
  Df as projectsDirectory,
  VE as projectDirectoryKey,
  Oh as projectDirectory,
  l8e as pinnedProjectDirectory,
};

export function toolResultsProjectDirectory(cwd: string): string {
  return l8e() ?? Oh(cwd);
}
