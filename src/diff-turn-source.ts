// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-twzxjzbk.js sha256 84e9dd9e0d193d0d9e64cfdf3534a0f0c2f2b42cee51236346b5eef34b7dd35b
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.

// chunk-twzxjzbk.js Rt: recognize a diff tool result carrying a file path plus a structured patch or created content [17903,18122) 219 units sha256 c05038de700be85b05a1bb0a768c0d1cecec1cddd7ca6a53921a8f6823190f43
function Rt(a){if(!a||typeof a!=="object")return!1;let o=a,i=typeof o.filePath==="string",t=Array.isArray(o.structuredPatch)&&o.structuredPatch.length>0,u=o.type==="create"&&typeof o.content==="string";return i&&(t||u)}

// chunk-twzxjzbk.js St: recognize the create/update tool result types [18122,18194) 72 units sha256 84c6edca5f36148376a37c09c7851cbdf8e18b1da1271140eb90d16bdd89784f
function St(a){return"type"in a&&(a.type==="create"||a.type==="update")}

// chunk-twzxjzbk.js Mt: count added and removed hunk lines [18194,18338) 144 units sha256 734cad18730adf37b10e48afe9a9be545c3e99b81e13c1ee9b9e098b8b53c6f6
function Mt(a){let o=0,i=0;for(let t of a)for(let u of t.lines)if(u.startsWith("+"))o++;else if(u.startsWith("-"))i++;return{added:o,removed:i}}

// chunk-twzxjzbk.js Ct: 30-character user prompt preview [18338,18487) 149 units sha256 d5e3d1b5ca99f6fb8b35ddf481d66b81dcbd5415182c030235f49d593118b83f
function Ct(a){if(a.type!=="user")return"";let o=a.message.content,i=typeof o==="string"?o:"";if(i.length<=30)return i;return i.slice(0,29)+"\u2026"}

// chunk-twzxjzbk.js we: settle turn stats from its file rows [18487,18642) 155 units sha256 4e55593ee62f8dc3ed3076a908925499154269352e4173a6e1021588938a9c0c
function we(a){let o=0,i=0;for(let t of a.files.values())o+=t.linesAdded,i+=t.linesRemoved;a.stats={filesChanged:a.files.size,linesAdded:o,linesRemoved:i}}

// chunk-twzxjzbk.js ri: wrap a completed turn as a turn source [22140,22184) 44 units sha256 0450a351d7fb3c351188e35ab8981bcd892c1395c40402e13ddb8224a19b26bd
function ri(pi){return{type:"turn",turn:pi}}

// chunk-twzxjzbk.js Ie: turn files and hunks to the dialog diff data shape [22184,22672) 488 units sha256 d76f518aa5bf036c60a32efc35495d41fbcf50e7ae3e42c63fcc34d897b58c34
function Ie(a){let o=Array.from(a.files.values()).map((t)=>({path:t.filePath,linesAdded:t.linesAdded,linesRemoved:t.linesRemoved,isBinary:!1,isLargeFile:!1,isTruncated:!1,isNewFile:t.isNewFile})).sort((t,u)=>t.path.localeCompare(u.path)),i=new Map;for(let t of a.files.values())i.set(t.filePath,t.hunks);return{stats:{filesCount:a.stats.filesChanged,linesAdded:a.stats.linesAdded,linesRemoved:a.stats.linesRemoved},files:o,hunks:i,loading:!1,source:{kind:"working-tree"},baseMode:"auto"}}


export { Rt, St, Mt, Ct, we, ri, Ie };
