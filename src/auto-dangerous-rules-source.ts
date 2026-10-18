// @ts-nocheck
// Exact source bodies, copied verbatim; provenance: research/ports/W45-chain-runner-copies.json.
// Modules:
//   chunk-nkb63p1y.js sha256 cb746f58859c7e9d52383597ff3a5c08bea091d17746697e713d379408504e5c
// Each block carries its zero-based UTF-16 [start,end) range, unit count and body SHA-256.
const Be='Bash', Tt='PowerShell', yt='Agent', Pl='Monitor';
const Bl = value => value === 'Task' ? 'Agent' : value;

// chunk-nkb63p1y.js dangerous rule command constants [4598,5113) 515 units sha256 642da73742c2b08d76da9fc1150a97b5411767a652e9db21dfd374c55bf4596b
var z=[],IDn=[...z,"python","python3","python2","node","deno","tsx","ruby","perl","php","lua","npx","bunx","npm run","yarn run","pnpm run","bun run","bash","sh","ssh"],Oco=[...IDn,"zsh","fish","eval","exec","env","xargs","sudo"],Thr=["curl","wget","kubectl","aws","gcloud","gsutil"],Rhr=[],v=new Set([...Thr,...Rhr]),L={kubectl:new Set(["exec","apply","create","delete","run","cp","port-forward","proxy","patch","edit","replace","attach","debug","scale","rollout","drain","cordon","taint"]),...!1},D=[...Oco,...[]];

// chunk-nkb63p1y.js complete dangerous shell Agent Monitor predicates [5113,6996) 1883 units sha256 e4eb2e32fbc3d21de31bb24126c560a0472cea3959dd2b23003b805241fe96d6
function xhr(e,n){if(e!==Be)return!1;if(n===void 0||n==="")return!0;if(/^[\s*]+$/.test(n))return!0;return ODn(n,D)}function ODn(e,n){let o=e.trim().toLowerCase();if(o==="*")return!0;for(let t of n){let r=t.toLowerCase();if(o===r)return!0;if(o===`${r}:*`||o===`${r} *`)return!0;if(o===`${r}*`)return!0;if(o.startsWith(`${r} `)&&o.endsWith("*")){let s=o.slice(r.length+1);if(v.has(r)){if(/[$`]/.test(s))return!0;let l=L[r];if(l==="all")return!0;let i=s.replace(/[\s:*]+$/,"").split(/\s+/).filter(Boolean),u=0;for(;u<i.length;u++){let f=i[u];if(!f.startsWith("-"))break;if(!f.includes("=")&&u+1<i.length&&!i[u+1].startsWith("-"))u++}let m=i[u];if(m===void 0){if((r==="curl"||r==="wget")&&i.some((f)=>f.includes("://")))continue;return!0}if(l?.has(m))return!0;continue}if(s.startsWith("-")){let l=s.slice(0,-1);if(!(/^python[\d.]*$/.test(r)&&/^-m\s+\w+\.[\w.]+(\s*:|\s+)$/.test(l)))return!0}}}return!1}function Phr(e,n){if(e!==Tt)return!1;if(n===void 0||n==="")return!0;if(/^[\s*]+$/.test(n))return!0;let o=n.trim().toLowerCase();if(o==="*")return!0;let t=[...IDn,"pwsh","powershell","cmd","wsl","iex","invoke-expression","icm","invoke-command","start-process","saps","start","start-job","sajb","start-threadjob","invoke-wmimethod","iwmi","invoke-cimmethod","icim","wmic","register-objectevent","register-engineevent","register-wmievent","register-scheduledjob","new-pssession","nsn","enter-pssession","etsn","add-type","new-object"];for(let r of t){if(o===r)return!0;if(o===`${r}:*`)return!0;if(o===`${r}*`)return!0;if(o===`${r} *`)return!0;if(o.startsWith(`${r} -`)&&o.endsWith("*"))return!0;let s=r.indexOf(" "),l=s===-1?`${r}.exe`:`${r.slice(0,s)}.exe${r.slice(s)}`;if(o===l)return!0;if(o===`${l}:*`)return!0;if(o===`${l}*`)return!0;if(o===`${l} *`)return!0;if(o.startsWith(`${l} -`)&&o.endsWith("*"))return!0}return!1}function ZNs(e,n){return Bl(e)===yt}function X(e){return e===Pl}


export { xhr, Phr, ZNs, X };
