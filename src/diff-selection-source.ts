// @ts-nocheck
// Exact source regions with local owner and message adapters. See ./diff-selection-source-blocks.json.
import { ne } from './plugin-chain-source.js';
export class SourceDiffSelection {
  #a = null;
  #c;
  #n = { ideSelection: undefined };
  constructor(changed) { this.changed = changed; }
  getSnapshot = () => this.#n;
  #i(value) { this.#n = value; this.changed(); }
// chunk-24k7d6mw.js [1486702,1487552) UTF-16.
setIdeSelection=(h)=>{if(this.#a=null,this.#c=void 0,Object.is(h,this.#n.ideSelection))return;this.#i({...this.#n,ideSelection:h})};offerIdeSelection=(h)=>{if(this.#n.ideSelection?.source==="diff"&&!h.text)return;if(Hlt(h)===this.#a)return;this.setIdeSelection(h)};dismissIdeSelection=()=>{let h=this.#n.ideSelection;if(!h)return;this.setIdeSelection(void 0),this.#a=Hlt(h)};consumeIdeSelection=(h)=>{let T=this.#n.ideSelection;if(this.setIdeSelection(void 0),T&&h)this.#c={selection:T,promptUuid:h}};restoreIdeSelectionConsumedBy=(h,T)=>{if(T!==void 0)this.returnIdeSelection(T);else if(this.#c?.promptUuid===h)this.returnIdeSelection(this.#c.selection)};recordIdeSelectionConsumedBy=(h,T)=>{this.#c={selection:T,promptUuid:h}};returnIdeSelection=(h)=>{let T=this.#n.ideSelection;if(h!==void 0&&!T?.text&&T?.source!=="diff")this.setIdeSelection(h)};
}
// chunk-24k7d6mw.js [1488693,1488828) UTF-16.
function Hlt(h){let T=`${h.source??"ide"}|${h.filePath??""}`;return h.text?`${T}|${h.lineStart??""}|${h.lineCount}|${h.text.length}`:T}
var hr=/[\x00-\x1f\x7f-\x9f\u2028\u2029]/g;
// chunk-gyf58rwf.js [8843,9022) UTF-16.
function Md(e){return e.replace(hr,(n)=>`&#${n.charCodeAt(0)};`)}function cj(e){return e.replaceAll("<","&lt;").replaceAll(">","&gt;")}function su(e){return Md(cj(String(e??"")))}
// chunk-sfn1dbxq.js [4454587,4454667) UTF-16.
var TDn=2000;function EDn(e){return e.length>TDn?ne(e,TDn)+`
... (truncated)`:e}
var NO='<system-reminder>',_1e='</system-reminder>';
// chunk-sfn1dbxq.js [4438375,4438416) UTF-16.
function Xl(e){return`${NO}
${e}
${_1e}`}
const xe = value => value;
const yl = values => values.map(value => Xl(value.content));
const messages = {
// chunk-sfn1dbxq.js [4460985,4461259) UTF-16.
selected_lines_in_diff:(e)=>yl([xe({content:`The user selected the following ${e.lineCount} ${e.lineCount===1?"line":"lines"} from the diff view${e.filePath?` (in ${su(e.filePath)})`:""}:
${EDn(e.content)}

This may or may not be related to the current task.`,isMeta:!0})]),
};
export function diffSelectionMessage(selection) {
  return messages.selected_lines_in_diff({lineCount: selection.lineCount, content: selection.text, filePath: selection.filePath})[0];
}
export { Hlt };
