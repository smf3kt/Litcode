// ax7r0qj7 8e782f9b, UTF-16 [1128,1272)/[1544,1645)/[4917,5021); Node Buffer branch.
function WMt(t: string){return Buffer.from(t,'utf16le').toString('utf16le')}
function ne(t: string,n: number){if(n<=0)return'';if(t.length<=n)return t;let e=t.slice(0,n),r=e.charCodeAt(n-1);return WMt(r>=55296&&r<=56319?e.slice(0,-1):e)}
export function truncateMcpDetail(t: string,n: number){if(t.length<=n)return t;let e=ne(t,n);return`${e}… [+${t.length-e.length} chars]`}
