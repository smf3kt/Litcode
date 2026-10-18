// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W183-permission-destinations.md.
// Modules:
//   chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da
//   chunk-bk5ct2gw.js sha256 efbc2d987608904a4a3ad7221f39f6e6afe34c13076d2ce3e4be2d49f43e6dd1
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.


// chunk-sfn1dbxq.js CF [4387472,4387616) 144 units sha256 6f810b64ce4b9bc5198426b21767d14c07332a13df38dbe2adfc4e3c5244fb04
function CF(e){return e.type==="user"&&(Array.isArray(e.message.content)&&e.message.content[0]?.type==="tool_result"||Boolean(e.toolUseResult))}

// chunk-sfn1dbxq.js zg [4432935,4433018) 83 units sha256 66d3acb8b0b34f752e3b82a27dc2f8c997aaed57aae5130471ddd83e243e4ca1
function zg(e){if(e.type!=="user")return null;let n=e.message.content;return rb(n)}

// chunk-sfn1dbxq.js rb [4433793,4433902) 109 units sha256 a38c88ca637d7b9480b11c2f86021f56d2e738fe1e1a5d868f660ec977c1d817
function rb(e){if(typeof e==="string")return e;if(Array.isArray(e))return Co(e,`
`).trim()||null;return null}

// chunk-sfn1dbxq.js Co [4433710,4433793) 83 units sha256 ee11385b8b4cbe001ad3680cf5333540d3892509ea1cb20cd7c345c1747bbc5a
function Co(e,n=""){return e.filter((r)=>r.type==="text").map((r)=>r.text).join(n)}

// chunk-bk5ct2gw.js ty [126655,126736) 81 units sha256 6b270790107af69f406fa0b52f6654a0254f87e3732767ecdac0c5d80ca92783
function ty(e){return e===void 0||e.kind==="human"||e.kind==="auto-continuation"}


export { CF, zg, ty };
