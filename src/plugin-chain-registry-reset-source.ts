// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-3ph567jx.js sha256 281868632c24f04e8dca6677ab734f29299f78b6933693a9148d7dbaf698a11b
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The registry's invalidation surface (W45-40): the two reads and the five resets the plugin
// sources use when a source they were built from changes. Each body is the module's text; the only
// thing it reaches outside itself is the registry accessor `it`, which this product carries in
// ./plugin-chain-host.ts under the source's own name (the source's own `it` is
// `function it(){return a().registry}`, sitting on the per-host memo `q(() => new n)` — this product
// has one host for the process and builds the registry lazily in that function instead).
import { it } from './plugin-chain-host.js';

// chunk-3ph567jx.js declares wms, whether a name is a registered agent [3763,3815) 52 units sha256 c79ae7e48051f0b0e5648fb24e717bf97bccb6d0cdaf8f125859862a8d0bc02f
function wms(e){return it().registeredAgents.has(e)}

// chunk-3ph567jx.js declares $Dn, whether the plugin loader may read this host's cache only [3815,3862) 47 units sha256 313a6c43de66a7c68619ff97ddcc345ca4561374806ec950f59a06dafc23f80f
function $Dn(){return it().pluginLoadCacheOnly}

// chunk-3ph567jx.js declares Nhr, the commands slot cleared so the producers rebuild [3862,3898) 36 units sha256 5136267e50b35bd655bbd693b81bdd2208d918136714de7b9fabf8f020ded32c
function Nhr(){it().commands=void 0}

// chunk-3ph567jx.js declares Fhr, the two skill slots [3898,3958) 60 units sha256 e855ca616e80f21f418c29e3370d94065e484a5180d53b2bbd7f5a0ddb248cce
function Fhr(){let e=it();e.skills=void 0,e.skillsV5=void 0}

// chunk-3ph567jx.js declares $hr, the agents slot [3958,3992) 34 units sha256 104452a9257d2be0a5aa28fba756209a25cfd00da28e2f2752c27768a8e7dca4
function $hr(){it().agents=void 0}

// chunk-3ph567jx.js declares Uhr, the output styles slot [3992,4032) 40 units sha256 0cd132713e11f58973d8fccaa85931cb86ffa9dfbc7451cab27b5884a223f815
function Uhr(){it().outputStyles=void 0}

// chunk-3ph567jx.js declares UDn, the workflows slot [4032,4069) 37 units sha256 5f8e2aae5ffda4e469f2d6e7b2529eb3963fd0700ad22fb4641c3a4707a28138
function UDn(){it().workflows=void 0}


export { wms, $Dn, Nhr, Fhr, $hr, Uhr, UDn };
