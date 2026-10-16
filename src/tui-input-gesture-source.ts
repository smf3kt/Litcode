// @ts-nocheck
// Source confirmation gestures: research/ports/W44-gesture-copies.json.
export function initializeGestureSource({on,Xa,R,To,le,P}) {
var a=800;
function iq(e,o,r,t=a){let s=on(),n=Xa(),i=R(0),c=R(void 0),u=To(()=>e(!1)),l=le(()=>{if(c.current)c.current(),c.current=void 0},[]);return P(()=>()=>{if(c.current)l(),u()},[l]),le(()=>{let d=n();if(d-i.current<=t&&c.current!==void 0)l(),e(!1),o();else r?.(),e(!0),l(),c.current=s.setTimeout(()=>{e(!1),c.current=void 0},t);i.current=d},[e,o,r,l,s,n,t])}
return function({e,r,s,o,l,d=true,h,M,We,oe,ice,deleteCursor}) {
const z=false,K="",B="",Ze=undefined,X=undefined,Eo=contents=>contents,BEe=value=>value,Ie=h,Je=h, b={text:e,del:deleteCursor};
let Ne=R({key:"Ctrl-C",pending:!1});
let Rt=iq((u)=>{Ne.current.pending=u,o?.(u,Ne.current.key)},()=>s?.(),()=>{if(!z&&e)r(""),We(0),M?.()});
function lt(u){if(!Ne.current.pending)Ne.current.key=u;Rt()}
let Mt=iq((u)=>{if(!e)return;if(l){l(u);return}if(!u)return;Ie({key:"escape-again-to-clear",kind:"feedback",text:"Esc again to clear",priority:"immediate",timeoutMs:1000})},()=>{if(l?.(!1),Je("escape-again-to-clear"),e){if(d&&K===""&&e.trim()!==""){let u=oe?Eo(oe(),(ue)=>ue.type==="text"&&ue.unavailable===!0):void 0,A=X?.(),I=A!==void 0?BEe(e,A):e,ee=u?{display:I,pastedContents:u}:I;if(A!==void 0)ice(ee,Ze,{submitMode:A});else ice(ee,Ze)}r(""),We(0),M?.()}});
function Wt(){if(b.text===B&&e==="")return lt("Ctrl-D"),b;return b.del()}
return {interrupt:()=>lt("Ctrl-C"),eof:Wt,escape:Mt};
};
}
