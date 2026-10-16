// @ts-nocheck
// Exact source bodies: research/ports/W44-progress-copies.json.
import {s,n} from "./tui-base-components.js";
import {jsx as e,jsxs as r} from "./tui-jsx.js";
import {Yc,rn} from "./tui-progress-source.js";
import {EXe} from "./tui-progress-time.js";
var PP="\u273B";
export function ProgressCompletion({message,addMargin=false,formatTime=EXe}) {
const f=Yc(message.uuid),W=rn(message.durationMs),U=formatTime(message.timestamp),g=addMargin,j=true,Ce=false,Me=null,de=null,Ee="",xe=false,O=null;
return r(s,{flexDirection:"row",marginTop:g?1:0,width:"100%",children:[e(s,{minWidth:2,children:e(n,{"aria-hidden":!0,dimColor:!0,children:PP})}),r(n,{children:[j&&(Ce?Me:e(n,{dimColor:!0,children:`${f} for ${W}${U?` \xB7 done ${U}`:""}`})),de&&e(n,{dimColor:!0,children:de}),Ee&&e(n,{dimColor:!0,children:Ee}),!xe&&O&&e(n,{dimColor:!0,children:` \xB7 ${O} still running`})]})]});
}
