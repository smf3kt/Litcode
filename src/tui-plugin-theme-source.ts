// @ts-nocheck
// Source bodies: research/ports/W44-plugin-theme-copies.json.
import {isDeepStrictEqual as Uvt} from 'node:util';
export function initializePluginThemes({VJn,BU,br,g}) {
async function jvt(h){let T=[];for(let M of h){let L={plugin:M.name},ee=`${M.name}:`;if(M.themesPath)T.push(...await VJn(M.themesPath,L,ee));for(let he of M.themesPaths??[])T.push(...await VJn(he,L,ee))}return BU().addCustomThemeBases(T),g("plugin_load_themes"),T.sort((M,L)=>M.name.localeCompare(L.name))}
async function QEe(h){if(br("themes"))return BU().pluginThemes.setState(()=>[]),[];let T=await jvt(h);return BU().pluginThemes.setState((M)=>Uvt(M,T)?M:T),T}
function rzr(e){let r=BU();return r.cachedUserThemes().find((s)=>s.slug===e)??r.pluginThemes.getState().find((s)=>s.slug===e)}
  return {load:QEe,lookup:rzr};
}
