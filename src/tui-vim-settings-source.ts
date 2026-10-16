// @ts-nocheck
// Source settings row and command redirect: research/ports/W44-vim-copies.json.
export function editorModeRow(s,W,v) {
const i=()=>{},d=value=>value,S=value=>value;
return {id:"editor",label:"Editor mode",value:s.editorMode==="emacs"?"normal":s.editorMode||"normal",options:["normal","vim"],type:"enum",onChange(e){let o=e;W("editorMode",o),v((u)=>({...u,editorMode:o})),i("tengu_editor_mode_changed",{mode:d(o),source:S("config_panel")})}};
}
var a={vim:"Editor mode","output-style":"Output style"};
function m(o){let t=o&&a[o]?o:"vim";return`/${t} moved \u2192 ${a[t]} in /config`}
export const vimRedirect=m;
