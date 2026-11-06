// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-24k7d6mw.js sha256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.

// chunk-24k7d6mw.js digit hint and prompt input [442163,443631) 1468 units sha256 405d1af2952189ce4fa9363bcaf777f492162ba9e7a371f7e9c077149539938a
var mne=400,Pm=600,bFe=new Map([["&","1"],["\xE9","2"],['"',"3"],["'","4"],["(","5"],["-","6"],["\xA7","6"],["\xE8","7"],["_","8"],["\xE7","9"],["\xE0","0"]]);function h0(h){return bFe.get(h)??h.normalize("NFKC")}function Tp({inputValue:h,isValidDigit:T,onDigit:M,enabled:L=!0,once:ee=!1,enterConfirms:he=!0,debounceMs:we=mne,mountDelayMs:Te=Pm}){let Me=on(),Le=Xa(),He=R(h),$e=R(!1),je=R(null),Je=R(L?Date.now():null);P(()=>{if(L)Je.current=Date.now()},[L]);let at=()=>Te>0&&Je.current!==null&&rc(Le,Je.current,Te),_t=R({isValidDigit:T,onDigit:M});_t.current={isValidDigit:T,onDigit:M};let xt=Lc();Ey((Ct,Pt)=>{if(!he||!Pt.return||Pt.shift||Pt.ctrl||Pt.meta||Pt.super||!L||ee&&$e.current)return;if(xt){let Et=xt.resolve(Ct,Pt,[...xt.activeContexts,"Chat","Global"]);if(Et.type!=="match"||Et.action!=="chat:submit")return}if(at())return;if(h===He.current||h.length!==1)return;let Mt=h.normalize("NFKC"),Ft=_t.current.isValidDigit(Mt)?Mt:bFe.get(h)??Mt;if(!_t.current.isValidDigit(Ft))return;if(je.current!==null)je.current(),je.current=null;return $e.current=!0,_t.current.onDigit(Ft),!0},{isActive:L}),P(()=>{if(!L||ee&&$e.current)return;if(je.current!==null)je.current(),je.current=null;if(at())return;if(h!==He.current&&h.length===1){let Ct=h.normalize("NFKC");if(_t.current.isValidDigit(Ct))je.current=Me.setTimeout(()=>{je.current=null,$e.current=!0,_t.current.onDigit(Ct)},we)}return()=>{if(je.current!==null)je.current(),je.current=null}},[h,L,ee,we,Te,Me,Le])}


export { mne, Pm, bFe, h0, Tp };
