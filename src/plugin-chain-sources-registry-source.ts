// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-qm4226vk.js sha256 03facde94be2af5141839b3f90cc3821dc8344709a1160c01101c49b95c13051
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
// The skill, command and agent source registry (W45-41): the per-host store whose tables the
// plugin-source re-read invalidates. Four declarations of chunk-qm4226vk.js are copied verbatim;
// the module's own accessor `xr()` is not one of them, because the source reaches it through the
// per-host memo `var a=new q(()=>new s)` keyed by `B().host`, and this product has one host for the
// process: ./plugin-chain-sources-registry.ts builds the singleton lazily instead and records
// [3438,3497) as the boundary.
import { Oe } from './plugin-chain-registry-stores-source.js';

// chunk-qm4226vk.js declares o, the source kind the dynamic-skill state key is built from (module-internal; the source does not export it) [710,722) 12 units sha256 4aa687ed73f8f456e3aa33c67f3b3448050fbe8cd3589fea1ae75f23fdd36fa0
var o="cli";

// chunk-qm4226vk.js declares s, the per-host source registry: 45 field initialisers and eight methods (reservedSpellingsFor, refusedReservedSkillNames, markLoadedResultMissingTrustedNames, loadedResultIsMissingTrustedNames, clearLoadCaches, invalidateCommands, invalidateSkillDirs, evictDynamicSkillState) [722,3319) 2597 units sha256 8dac813b9ca623abc9d3d06d26e35bf626b705ca43cbb24803445257892bb50c
class s{bundledSkills=[];bundledSkillKillSwitchSurvivors=new Set;bundledSkillSessionResetHooks=[];bundledSkillsInitialized=!1;shippedTablesFillFailed=!1;bundledSkillFilesElsewhere=void 0;commandsOffHere=void 0;attachedFolderSkills=void 0;builtinToolsServedByMcp=void 0;builtinCommandTable=void 0;builtinCommandNames=void 0;shippedCommandNames=void 0;loadedCommands=new Map;skillToolCommands=new Map;slashCommandToolSkills=new Map;skillIndex=new Map;reservedSpellingsByLoadedResult=new WeakMap;loadedResultsMissingTrustedNames=new WeakSet;skillDirCommands=new Map;dynamicSkillStates=new Map;lastCollisionExtrasSpellings=new Map;dynamicSkillStateKey=()=>o;dynamicSkillsLoaded=Oe();skillsChanged=Oe();replacedSkillNames=new Map;replacedSkillNamesSeq=0;shadowedBundledSkills=void 0;fallbackShadowTelemetryLogged=new Set;skillContentIntern=new Map;skillFiles=new WeakMap;builtinPlugins=new Map;builtinPluginsInitialized=!1;builtinPluginFailures=new Map;builtinPluginWiredSkills=new WeakMap;bundledWorkflows=[];markdownFiles=new Map;markdownScansGivenUp=0;agentDefinitions=new Map;projectAgentsElsewhere=[];outputStyleDirStyles=new Map;allOutputStyles=new Map;routines=new Map;routineCronTasks=new Map;allWorkflows=new Map;reservedSpellingsFor(e,n){let i=this.reservedSpellingsByLoadedResult.get(e);if(i)return i;let l=n();return this.reservedSpellingsByLoadedResult.set(e,l),l}refusedReservedSkillNames(){return Array.from(this.dynamicSkillStates.get(this.dynamicSkillStateKey())?.refusedReservedNames.values()??[])}markLoadedResultMissingTrustedNames(e){this.loadedResultsMissingTrustedNames.add(e)}loadedResultIsMissingTrustedNames(e){return this.loadedResultsMissingTrustedNames.has(e)}clearLoadCaches(){this.invalidateCommands(),this.skillDirCommands.clear(),this.markdownFiles.clear(),this.agentDefinitions.clear(),this.outputStyleDirStyles.clear(),this.allOutputStyles.clear(),this.routines.clear(),this.routineCronTasks.clear(),this.allWorkflows.clear()}invalidateCommands(){this.builtinCommandTable=void 0,this.builtinCommandNames=void 0,this.shippedCommandNames=void 0,this.loadedCommands.clear(),this.skillToolCommands.clear(),this.slashCommandToolSkills.clear(),this.skillIndex.clear()}invalidateSkillDirs(){this.skillDirCommands.clear();let e=this.dynamicSkillStates.get(this.dynamicSkillStateKey());if(e)e.conditionalSkills.clear(),e.activatedConditionalSkillNames.clear()}evictDynamicSkillState(e){this.dynamicSkillStates.delete(e),this.lastCollisionExtrasSpellings.delete(e);let n=`${e}:`;for(let i of[...this.skillDirCommands.keys()])if(i.startsWith(n))this.skillDirCommands.delete(i)}}

// chunk-qm4226vk.js declares pQ, memoise-or-build for a keyed table [3319,3406) 87 units sha256 8b381b071862771095540341054ee82a793ad92715c11a91f372885432975f98
function pQ(e,n,i){let l=e.get(n);if(l!==void 0)return l;let t=i();return e.set(n,t),t}

// chunk-qm4226vk.js declares fQ, the nullable-key normaliser [3406,3438) 32 units sha256 48ae3afe27a2b756efb6a66978844bc76350d5ab48d95734b5b790c88f366a17
function fQ(e){return e??"\x00"}


export { s, pQ, fQ };
