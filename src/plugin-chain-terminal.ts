// The terminal glue seam (W45-88): one site becomes a surface node through the render-version and
// row-accounting path. `renderSiteNode` is the one entry a terminal surface calls; the rest are the
// steps it composes and the source names they were copied under.
export {
  yt, pr, ir, ar, lr, mr, fr, ur, cr, dr, xr, $e, hdn, TU, VH,
  uo, Oto, bVe, CAt, Vss, fno, Lur, pIn,
  cIn, dIn, mno, uIn, cce, HM, s5t, sIn, CK, Iye,
} from './plugin-chain-terminal-glue-source.js';

export {
  yt as renderTree,
  pr as renderTreeGuarded,
  ir as boundaryComponents,
  ar as firstRunRef,
  lr as steadyRows,
  mr as offRows,
  fr as heldRows,
  ur as onScreenInput,
  cr as renderKeyFor,
  dr as failedRenderMessage,
  xr as settledRender,
  $e as renderVersionOf,
  hdn as renderTerminalSite,
  TU as renderSiteNode,
  VH as terminalInput,
  uo as siteInput,
  pIn as failureModules,
  uIn as noteRenderFailure,
  Iye as noteRenderWarning,
  CAt as descriptorInput,
  bVe as renderDescriptors,
} from './plugin-chain-terminal-glue-source.js';
