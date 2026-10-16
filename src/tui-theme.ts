// @ts-nocheck
// Exact source bodies; provenance: research/ports/W44-visual-copies.json.
import { w } from './tui-react-memo.js'; import { S1 } from './tui-theme-colors.js'; import { qt, Ae, N } from './tui-react-runtime.js'; N();
var z="dark";
var i=qt({themeSetting:z,setThemeSetting:()=>{},setPreviewTheme:()=>{},cancelPreview:()=>{},currentTheme:z,resolvedTheme:S1(z),activeThemeOverrides:void 0,customThemes:[],activeCustomTheme:void 0,reloadCustomThemes:()=>Promise.resolve(),setPreviewOverrides:()=>{}});
function hr(){let s=w(3),{currentTheme:o,setThemeSetting:r}=Ae(i),n;if(s[0]!==o||s[1]!==r)n=[o,r],s[0]=o,s[1]=r,s[2]=n;else n=s[2];return n}
function qS(){return Ae(i).resolvedTheme}

export { i as ThemeContext, hr, qS };
