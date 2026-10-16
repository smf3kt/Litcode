// @ts-nocheck
// Source bodies: research/ports/W44-theme-copies.json.
const a=process.env;
var dAo=["dark","light","light-daltonized","dark-daltonized","light-ansi","dark-ansi"];
var qxe=["auto",...dAo];
function TOn(r){return typeof r==="string"&&dAo.includes(r)}
function mot(r){return typeof r==="string"&&(qxe.includes(r)||r.startsWith("custom:"))}
function s(){let e=a.COLORFGBG;if(!e)return;let n=e.split(";").at(-1);if(n===void 0||n==="")return;let r=Number(n);if(!Number.isInteger(r)||r<0||r>15)return;return r<=6||r===8?"dark":"light"}
const themeChoices=[{label:"Auto (match terminal)",value:"auto"},{label:"Dark mode",value:"dark"},{label:"Light mode",value:"light"},{label:"Dark mode (colorblind-friendly)",value:"dark-daltonized"},{label:"Light mode (colorblind-friendly)",value:"light-daltonized"},{label:"Dark mode (ANSI colors only)",value:"dark-ansi"},{label:"Light mode (ANSI colors only)",value:"light-ansi"}];
export function initializeThemeActions({rt,J,C,Zme,I}) {
  return {cancelPreview:()=>J(null),setThemeSetting:(X)=>{if(rt(X),J(null),X==="auto")C(Zme());I(X)},setPreviewTheme:(be)=>{if(J(be),be==="auto")C(Zme())}};
}
export function resolveThemeSource(m,ot,v) {
  const V=typeof m==="string"&&m.startsWith("custom:");
  let l=v?v.base:m==="auto"?ot:V?"dark":m;return l;
}
export {dAo,qxe,TOn,mot,s as environmentTheme,themeChoices};
