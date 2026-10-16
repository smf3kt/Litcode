// @ts-nocheck
// Exact source bodies; provenance: research/ports/W44-statusline-copies.json.
function R1n(e,n){if(!e)return{used:null,remaining:null};let r=e.input_tokens+e.cache_creation_input_tokens+e.cache_read_input_tokens,s=Math.round(r/n*100),h=Math.min(100,Math.max(0,s));return{used:h,remaining:100-h}}
function j9(e){let n={input_tokens:e.input_tokens??0,output_tokens:e.output_tokens??0,cache_creation_input_tokens:e.cache_creation_input_tokens??0,cache_read_input_tokens:e.cache_read_input_tokens??0};if(oxt(n)===0||!Array.isArray(e.iterations))return n;let s=e.iterations.findLast((r)=>!Di(r));if(!Ni(s))return n;return{input_tokens:s.input_tokens,output_tokens:s.output_tokens,cache_creation_input_tokens:s.cache_creation_input_tokens,cache_read_input_tokens:s.cache_read_input_tokens}}
function oxt(e){return e.input_tokens+e.cache_creation_input_tokens+e.cache_read_input_tokens}
function Di(e){if(typeof e!=="object"||e===null)return!1;let{type:n}=e;return n==="advisor_message"||n==="compaction"}
function Ni(e){if(typeof e!=="object"||e===null)return!1;let n=e;return(n.type==="message"||n.type==="fallback_message")&&Ae(n.input_tokens)&&Ae(n.output_tokens)&&Ae(n.cache_creation_input_tokens)&&Ae(n.cache_read_input_tokens)&&n.input_tokens+n.cache_creation_input_tokens+n.cache_read_input_tokens>0}
function Ae(e){return typeof e==="number"&&Number.isFinite(e)&&e>=0}
function Q1e(e,n){let r=R1n(e,n);return{total_input_tokens:e?e.input_tokens+e.cache_creation_input_tokens+e.cache_read_input_tokens:0,total_output_tokens:e?.output_tokens??0,context_window_size:n,current_usage:e,used_percentage:r.used,remaining_percentage:r.remaining}}
export {j9,Q1e};
