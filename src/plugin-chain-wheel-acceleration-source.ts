// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-z7whhrje.js sha256 3dca9fb572e08c43b779dd32b44d21858a177e021557bacb2a126e4ed268a3ac
//   chunk-24k7d6mw.js sha256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.

// chunk-z7whhrje.js jediTerm wheel state [9007,9133) 126 units sha256 a1acda18daeb2a5828b9b4a07a5c3ce0f54ba532ee58e2286cc1d18f4cd06593
function tgt(){return{lastWheelTime:0,lastWheelDownTime:0,bugConfirmed:!1,notified:!1,trackpadGesture:!1,pendingArrowBoost:0}}

// chunk-z7whhrje.js pending arrow boost [9266,9339) 73 units sha256 b3731d3deb42c61c7937e0a352007362c621d9bc71386fcb719e9ac95c1c417b
function VNo(r){let n=r.pendingArrowBoost;return r.pendingArrowBoost=0,n}

// chunk-z7whhrje.js jediTerm bypass window [9540,9565) 25 units sha256 62228de53d7959e20bd9eb73f177b2a5b3c933c8c800d378f1719aefd02fca5f
var de=75,pe=250,gLr=200;

// chunk-24k7d6mw.js wheel window constants [124024,124140) 116 units sha256 3742cd42c34dc0430db85f822807f955a42fb5d908e1847b4c00b4cb97483e24
var QAe=40,zSt=0.3,YSt=6,JSt=3,XSt=200,ZSt=15,ebt=15,tbt=3,obt=1500,zAe=150,nbt=7,YAe=5,rbt=80,sbt=3,ibt=36,abt=500;

// chunk-24k7d6mw.js wheel acceleration constants [124299,124336) 37 units sha256 2f55656841db06e36ac4078b9828465a5b30107899a4f2f3767b19473ef222ef
var dbt=0.35,cbt=0.008,ubt=0.4,mbt=4;

// chunk-24k7d6mw.js wheel step [124336,126011) 1675 units sha256 ee800913cbcdf4658b7bf798e04d061de035b2808acf547256939fef694f08be
function pbt(h,T,M){if(h.jediTerm.trackpadGesture){let Te=M-h.time;if(!h.jbBypass||Te>gLr)h.jbBypass=!0,h.frac=0,h.mult=1;else if(T!==h.dir)h.frac=0;h.dir=T,h.time=M;let Me=VNo(h.jediTerm);if(h.accelEnabled)h.mult=Math.min(mbt,h.mult+cbt+Me*ubt);h.frac+=dbt*h.mult;let Le=Math.floor(h.frac);return h.frac-=Le,Le}if(h.jbBypass)h.jbBypass=!1,h.pendingFlip=!1,h.wheelMode=!1,h.burstCount=0,h.frac=0,h.dir=0;if(!h.useDecayCurve){if(h.wheelFlood){let Me=M-h.time;return h.time=M,h.dir=T,h.mult=Me>QAe?h.base*JSt:h.base,Math.max(1,Math.floor(h.mult))}if(h.wheelMode&&M-h.time>obt)h.wheelMode=!1,h.burstCount=0,h.mult=h.base;if(h.pendingFlip){if(h.pendingFlip=!1,T!==h.dir||M-h.time>XSt)return h.dir=T,h.time=M,h.mult=h.base,Math.max(1,Math.floor(h.mult));h.wheelMode=!0}let Te=M-h.time;if(T!==h.dir&&h.dir!==0)return h.pendingFlip=!0,h.time=M,0;if(h.dir=T,h.time=M,h.wheelMode)if(Te<YAe)if(++h.burstCount>=5)h.wheelMode=!1,h.burstCount=0,h.mult=h.base;else return 1;else h.burstCount=0;if(h.wheelMode&&h.accelEnabled){let Me=Math.pow(0.5,Te/zAe),Le=Math.max(ebt*Math.min(h.base,1),h.base*2),He=1+(h.mult-1)*Me+ZSt*Me;return h.mult=Math.min(Le,He,h.mult+tbt),Math.max(1,Math.floor(h.mult))}if(Te>QAe||!h.accelEnabled)h.mult=h.base;else{let Me=Math.max(YSt*Math.min(h.base,1),h.base*2);h.mult=Math.min(Me,h.mult+zSt)}return Math.max(1,Math.floor(h.mult))}let L=M-h.time,ee=T===h.dir;if(h.time=M,h.dir=T,ee&&L<YAe)return 1;if(!h.accelEnabled)return Math.max(1,Math.floor(h.base));if(!ee||L>abt)h.mult=Math.max(2,h.base),h.frac=0;else{let Te=Math.pow(0.5,L/zAe),Me=L>=rbt?sbt:ibt;h.mult=Math.min(Me,1+(h.mult-1)*Te+nbt*Te)}let he=h.mult+h.frac,we=Math.floor(he);return h.frac=he-we,we}

// chunk-24k7d6mw.js wheel state factory [126011,126204) 193 units sha256 f5f62ba17eae25543944b403d75549db8a0875d16a0118641d0ad2bc5c413614
function fbt(h=!1,T=1,M=!1,L=!0,ee=tgt()){return{time:0,mult:T,dir:0,useDecayCurve:h,frac:0,base:T,pendingFlip:!1,wheelMode:!1,burstCount:0,jbBypass:!1,jediTerm:ee,wheelFlood:M,accelEnabled:L}}


export { pbt, fbt, VNo, tgt };
