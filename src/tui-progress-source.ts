// @ts-nocheck
// Exact source bodies: research/ports/W44-progress-copies.json.
const a = process.env;
var l=["\xB7","\u2722","\u2733","\u2736","\u273B","\u273B"];
var p=["\xB7","\u2722","\u2733","\u2736","\u273B","\u273D"];
var d=[...l,...l.toReversed()];
var f=[...p,...p.toReversed()];
var g=8;
function Vdn(){if(a.TERM==="xterm-ghostty")return l;return p}
function HIe(){if(a.TERM==="xterm-ghostty")return d;return f}
function SC(r){return Math.round(r*g)/g}
function MIe(r,t){return(1-Math.cos(2*Math.PI*r/t))/2}
function Uh(r,t,i){return{r:Math.round(r.r+(t.r-r.r)*i),g:Math.round(r.g+(t.g-r.g)*i),b:Math.round(r.b+(t.b-r.b)*i)}}
function Sm(r){return`rgb(${r.r},${r.g},${r.b})`}
function lS(r){let t=r.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);return t?{r:parseInt(t[1],10),g:parseInt(t[2],10),b:parseInt(t[3],10)}:null}
function rn(e,t){if(e<60000){if(e===0)return"0s";if(e<1)return`${(e/1000).toFixed(1)}s`;return`${Math.floor(e/1000).toString()}s`}let r=Math.floor(e/86400000),n=Math.floor(e%86400000/3600000),s=Math.floor(e%3600000/60000),o=Math.round(e%60000/1000);if(o===60)o=0,s++;if(s===60)s=0,n++;if(n===24)n=0,r++;let c=t?.hideTrailingZeros;if(t?.mostSignificantOnly){if(r>0)return`${r}d`;if(n>0)return`${n}h`;if(s>0)return`${s}m`;return`${o}s`}if(r>0){if(c&&n===0&&s===0)return`${r}d`;if(c&&s===0)return`${r}d ${n}h`;return`${r}d ${n}h ${s}m`}if(n>0){if(c&&s===0&&o===0)return`${n}h`;if(c&&o===0)return`${n}h ${s}m`;return`${n}h ${s}m ${o}s`}if(s>0){if(c&&o===0)return`${s}m`;return`${s}m ${o}s`}return`${o}s`}
export function createProgressClock(interval) {
function v(c){let r=new Map,t=null,n=c,l=performance.now(),i=0;function s(){i=performance.now()-l;for(let o of r.keys())o()}function a(){if([...r.values()].some(Boolean)){if(t!==null)clearInterval(t);else i=performance.now()-l;t=setInterval(s,n)}else if(t!==null)clearInterval(t),t=null}function f(o,m){return r.set(o,m),a(),()=>{r.delete(o),a()}}return{subscribeKeepAlive(o){return f(o,!0)},subscribeFollower(o){return f(o,!1)},now(){if(t!==null)return i;return performance.now()-l},setTickInterval(o){if(o===n)return;n=o,a()},setTimeout(o,m){let b=setTimeout(o,m);return()=>clearTimeout(b)}}}
return v(interval);
}
export function sourceSpinnerVerbs() {
var v=["Accomplishing","Actioning","Actualizing","Architecting","Baking","Beaming","Beboppin'","Befuddling","Billowing","Blanching","Bloviating","Boogieing","Boondoggling","Booping","Bootstrapping","Brewing","Bunning","Burrowing","Calculating","Canoodling","Caramelizing","Cascading","Catapulting","Cerebrating","Channeling","Choreographing","Churning","Clauding","Coalescing","Cogitating","Combobulating","Composing","Computing","Concocting","Considering","Contemplating","Cooking","Crafting","Creating","Crunching","Crystallizing","Cultivating","Deciphering","Deliberating","Determining","Dilly-dallying","Discombobulating","Doing","Doodling","Drizzling","Ebbing","Effecting","Elucidating","Embellishing","Enchanting","Envisioning","Fermenting","Fiddle-faddling","Finagling","Flamb\xE9ing","Flibbertigibbeting","Flowing","Flummoxing","Fluttering","Forging","Forming","Frolicking","Frosting","Gallivanting","Galloping","Garnishing","Generating","Gesticulating","Germinating","Gitifying","Grooving","Gusting","Harmonizing","Hashing","Hatching","Herding","Honking","Hullaballooing","Hyperspacing","Ideating","Imagining","Improvising","Incubating","Inferring","Infusing","Ionizing","Jitterbugging","Julienning","Kerfuffling","Kneading","Leavening","Levitating","Lollygagging","Manifesting","Marinating","Meandering","Metamorphosing","Misting","Moonwalking","Moseying","Mulling","Mustering","Musing","Nebulizing","Nesting","Newspapering","Noodling","Nucleating","Onioning","Orbiting","Orchestrating","Osmosing","Perambulating","Percolating","Perusing","Philosophizing","Photosynthesizing","Polishing","Pollinating","Pondering","Pontificating","Pouncing","Precipitating","Prestidigitating","Processing","Proofing","Propagating","Puttering","Puzzling","Quantumizing","Razzle-dazzling","Razzmatazzing","Recombobulating","Reticulating","Roosting","Ruminating","Saut\xE9ing","Scampering","Schlepping","Scurrying","Seasoning","Shenaniganing","Shimmying","Simmering","Skedaddling","Sketching","Slithering","Smooshing","Sock-hopping","Spelunking","Spinning","Sprouting","Stewing","Sublimating","Swirling","Swooping","Symbioting","Synthesizing","Tempering","Thinking","Thundering","Tinkering","Tomfoolering","Topsy-turvying","Transfiguring","Transmogrifying","Transmuting","Twisting","Undulating","Unfurling","Unraveling","Vibing","Waddling","Wandering","Warping","Whatchamacalliting","Whirlpooling","Whirring","Whisking","Wibbling","Working","Wrangling","Zesting","Zigzagging"];
return v;
}
var Vc=["Baked","Brewed","Churned","Cogitated","Cooked","Crunched","Saut\xE9ed","Worked"];
function Use(t){let e=0;for(let n=0;n<t.length;n++)e=(e<<5)-e+t.charCodeAt(n)|0;return e}
function Yc(m){let l=(Use(m)>>>0)%Vc.length;return Vc[l]??tD}
const tD = "Worked";
export {Vdn,HIe,SC,MIe,Uh,Sm,lS,rn,Yc};
