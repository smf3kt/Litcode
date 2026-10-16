// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-3ph567jx.js sha256 281868632c24f04e8dca6677ab734f29299f78b6933693a9148d7dbaf698a11b
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The plugin-state registry (W45-35): the state literal every ported module reaches through `it()`,
// built by the source's own factory rather than by a hand-written stand-in. `FDn` is the frozen empty
// panes value the literal installs as `panes:gs(FDn)`; it was already copied by the fold package.
import { FDn } from './plugin-chain-notify-fold-source.js';
import { Oe, gs } from './plugin-chain-registry-stores-source.js';

// chunk-3ph567jx.js declares Zco, the plugin-state store: values (a store over a Map), readers, readersOf, mounted, the steady/live fold queues, staleListeners, faultRuns, bumps and versionFloor [941,1236) 295 units sha256 63a4c788f6571d7d7091712c0da0051d030583f090bb68f3caa65190a6e54f0c
var Zco=()=>({values:gs(new Map),readers:new Map,readersOf:new Map,mounted:new Map,folds:{steady:{stale:new Set,lastAt:Number.NEGATIVE_INFINITY,pending:void 0},live:{stale:new Set,lastAt:Number.NEGATIVE_INFINITY,pending:void 0}},staleListeners:new Set,faultRuns:new Map,bumps:0,versionFloor:0});

// chunk-3ph567jx.js declares edo, the toast clock: a handle with pending and pausedAt, both undefined [1236,1283) 47 units sha256 afaa57b50d25b8ec634dcf0d2523e7a203c8d3fe32a22580a1bdd80475386c5a
var edo=()=>({pending:void 0,pausedAt:void 0});

// chunk-3ph567jx.js declares s, the registry state literal: every field the source's registry carries, among them renderVersions/panes/hoverGroups as stores, pluginState Zco(), toastClock edo(), notices, the two change signals and the ui log sink [1283,3650) 2367 units sha256 cbead4858616a9c253c2c8e46e3ed4696c2a446f235e7a7aef11a89629c12561
function s(){return{pluginLoad:void 0,pluginLoadArm:void 0,pluginLoadCacheOnly:void 0,pluginLoadCacheOnlyArm:void 0,pluginLoadMarks:new WeakMap,commands:void 0,skills:void 0,skillsV5:void 0,agents:void 0,handedIn:void 0,outputStyles:void 0,workflows:void 0,hookRegistration:void 0,hookModulesAwaitTrust:!1,hookRegistrationInFlight:void 0,hooksUnknownCause:void 0,pluginsWithHooks:new Set,folderReadAt:new Map,hookRegistrationEpoch:0,hookSwapEpoch:0,unlatchedAbsentManagedIds:new Set,hooksLeftOutByName:[],hooksLeftOutByNameChanged:Oe(),hookRegistrationArgs:void 0,hookHotReloadUnsubscribe:void 0,hookHotReloadSettingsSnapshot:void 0,hookHotReloadTierSnapshot:void 0,hooksRespawns:new Set,loadedModules:[],moduleSeats:new Map,notices:gs(new Map),openCalls:new Map,spawnProvenance:new Map,registeredAgents:new Map,renderVersions:gs(new Map),panes:gs(FDn),pluginState:Zco(),toastClock:edo(),hoverGroups:gs(new Map),scrollSites:new Map,focusSites:new Map,focusSiteDraws:Oe(),mountedRasters:new Map,mountedImages:new Map,rasterAdmission:void 0,uiLogSink:null,pendingUiLog:[],armedMonitorKeys:new Set,marketplaces:new Map,marketplaceRefreshesInFlight:new Map,marketplaceHelperMemo:new Map,addDirMarketplacesMemo:void 0,headlessInstallPass:void 0,installedPluginsMigrated:!1,installedPluginsFile:null,installedPluginsEpoch:0,recordSpellingsCounted:!1,recordSpellingFallbackReported:!1,installedPluginsSnapshot:null,optionValues:new Map,flaggedPlugins:null,orphanedVersionGlobExclusions:null,recentActivity:[],pluginActivityFeatures:new Map,autoUpdateListener:null,commandSourceReresolve:null,pendingAutoUpdateNotification:null,ownInUseMarkerPaths:new Set,ownInUseMarkerHandles:new Map,commandProducerDirsDenied:new Set,commandProducerDirsScannedAt:0,commandProducerDirsComparable:null,commandProducerDirsNeedCanonicalCandidate:!1,commandProducerDirsWslProviderUndeterminable:!1,commandProducerDirsChanged:Oe(),inUseMarkerCleanup:void 0,vouchedManagedPluginIds:new Set,hintedPluginIds:new Set,seenHintPluginIds:new Set,gitAvailable:void 0,operatorDeclaredMemo:void 0,marketplaceResolutionNoticesLogged:new Set,marketplaceAdmissionVerdicts:new Map,hiddenRegistryEntries:{raw:new Map,v5:new Map},releasedRegistryEntries:{raw:new Set,v5:new Set},cacheRootComparableMemo:void 0,provenLocalRoots:new Map,wslProviderOfPluginsRootMemo:void 0,inlinePluginRootsComparableMemo:void 0}}


export { Zco, edo, s };
