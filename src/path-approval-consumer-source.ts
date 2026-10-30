// @ts-nocheck
// Exact recovered declarations. See research/ports/W385-declaration-prefix-preflight.md.
import { j8e } from './path-approval-stash-source.js';
// chunk-f606a53w.js _g [3685,3770), UTF-16; sha256 e7ef5a02da09ee9c02fa4eb5d2ce92b07783d097b2b5e1cf52ce0d147be54bac
class _g extends Error{constructor(e){super(e);this.name="SymlinkWriteRefusedError"}}
// chunk-f606a53w.js fY [3937,4021), UTF-16; sha256 83cc04468db805031f9fe3859e007aefce9a15050de760be9fc136455a6f5af9
class fY extends Error{constructor(e){super(e);this.name="SymlinkReadRefusedError"}}
function createPathApprovalConsumer(_o, t) {
// chunk-f606a53w.js mY [4672,5095), UTF-16; sha256 386d67a9a20b8a254c72fcf7d0335042bfca32ccda41aff37f9c1d23c45244ef
function mY(e,n,r="write"){let s=e.session.writePermissionStash.consume(e.toolUseId,n,r);if(s===j8e)throw new(r==="read"?fY:_g)(`Refusing to ${r==="read"?"read":"write"} ${n}: its permission check expired before it ran (too many concurrent file operations). Retry.`);if(s!==void 0)return s;if(e.toolUseId)t(`takeApprovedPathsForWrite: no check-time stash for toolUseId=${e.toolUseId}; using fresh resolution`);return _o(n)}
return mY;
}
export { createPathApprovalConsumer, _g, fY };
