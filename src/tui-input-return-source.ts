// @ts-nocheck
// Source return gesture: research/ports/W44-return-copies.json.
export function sourceReturn(b,key,n) {
const a=process.env,j=true,te=false,B="",Ze=undefined,we=value=>value,NNo=()=>{};let Ye=false;
function _t(e){return!1}
function UDr(){return a.terminal==="Apple_Terminal"&&_t("shift")}
function Gt({meta:u,shift:A}){if(j&&!te&&b.offset>0&&b.text[b.offset-1]==="\\")return NNo(Ze),b.backspace().insert(we(`
`));if(u||A)return b.insert(we(`
`));if(UDr())return b.insert(we(`
`));if(n)n(b.text.slice(B.length)),Ye=!0;return b}
return Gt(key);
}
