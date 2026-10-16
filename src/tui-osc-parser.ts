// @ts-nocheck
// Exact source bodies; provenance: research/ports/W44-visual-copies.json.

var Yp={SET_TITLE_AND_ICON:0,SET_ICON:1,SET_TITLE:2,SET_COLOR:4,SET_CWD:7,HYPERLINK:8,ITERM2:9,SET_FG_COLOR:10,SET_BG_COLOR:11,SET_CURSOR_COLOR:12,CLIPBOARD:52,KITTY:99,RESET_COLOR:104,RESET_FG_COLOR:110,RESET_BG_COLOR:111,RESET_CURSOR_COLOR:112,SEMANTIC_PROMPT:133,GHOSTTY:777,ITERM2_PROPRIETARY:1337,PROGRAM_STATUS:7501,TAB_STATUS:21337};
function $ns(e){let r=e.indexOf(";"),n=r>=0?e.slice(0,r):e,o=r>=0?e.slice(r+1):"",i=parseInt(n,10);if(i===Yp.SET_TITLE_AND_ICON)return{type:"title",action:{type:"both",title:o}};if(i===Yp.SET_ICON)return{type:"title",action:{type:"iconName",name:o}};if(i===Yp.SET_TITLE)return{type:"title",action:{type:"windowTitle",title:o}};if(i===Yp.HYPERLINK){let s=o.split(";"),u=s[0]??"",d=s.slice(1).join(";");if(d==="")return{type:"link",action:{type:"end"}};let f={};if(u)for(let m of u.split(":")){let T=m.indexOf("=");if(T>=0)f[m.slice(0,T)]=m.slice(T+1)}return{type:"link",action:{type:"start",url:d,params:Object.keys(f).length>0?f:void 0}}}if(i===Yp.TAB_STATUS)return{type:"tabStatus",action:Et(o)};return{type:"unknown",sequence:`\x1B]${e}`}}
function j(e){let r=e.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);if(r)return{type:"rgb",r:parseInt(r[1],16),g:parseInt(r[2],16),b:parseInt(r[3],16)};let n=e.match(/^rgb:([0-9a-f]{1,4})\/([0-9a-f]{1,4})\/([0-9a-f]{1,4})$/i);if(n){let o=(i)=>Math.round(parseInt(i,16)/(16**i.length-1)*255);return{type:"rgb",r:o(n[1]),g:o(n[2]),b:o(n[3])}}return null}
function Et(e){let r={};for(let[n,o]of yt(e))switch(n){case"indicator":r.indicator=o===""?null:j(o);break;case"status":r.status=o===""?null:o;break;case"status-color":r.statusColor=o===""?null:j(o);break}return r}
function*yt(e){let r="",n="",o=!1,i=!1;for(let s of e)if(i){if(o)n+=s;else r+=s;i=!1}else if(s==="\\")i=!0;else if(s===";")yield[r,n],r="",n="",o=!1;else if(s==="="&&!o)o=!0;else if(o)n+=s;else r+=s;if(r||o)yield[r,n]}

export { $ns, Yp };
