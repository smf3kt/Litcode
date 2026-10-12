# W09 path link chains: a bounded resolution with an identity

Status: verified. Date: 2026-10-12.
Task: a confined file path -> the link chain on the way to it is walked one hop at a time -> a chain longer than the bound is refused by name, a chain that loops is refused, an ancestor that cannot be read is refused as unreadable rather than reported as a dangling link, and a chain that lands on a network filesystem is refused -> the resolution carries the hops it followed and the identity of what it resolved to -> a read or an overwrite refuses when the path is no longer that file.
Entry: none. Path handling in `tools.ts` and `media.ts` is unchanged from the caller's view; the resolver replaces the resolution those already did.
Targets: path-identity.ts (new), tools.ts (`confineResolved`, `verifyUnchanged`, the identity check on the read handle and before both overwrites), test/path-identity.test.ts, scripts/smoke-path-chain-cli.mjs.

## Provenance and adaptation

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. All ranges are zero-based UTF-16, left-closed/end-exclusive, read from extracted bytes as inert data.

- The resolver is in chunk-gyf58rwf.js (SHA-256 7a6a01732760c89b5d434cc5ba98faf72b10917d85b771671f8201e9e3d8d2ad, 82836 bytes), in the same module as the credential-pattern table recorded as an unscheduled candidate in [unreviewed-corpus.md](unreviewed-corpus.md).
- The walk is a generator, `function*He(e,n)` [64745, ...), driven synchronously by `function ff(e,n,r)` [63574, ...) through the `Vn` loop [64077, ...) and asynchronously by `function NN(e,n,r,s,i)` [63768, ...) through the `bi` loop [64198, ...). The two entry points are `DV` [68898, ...) and `lj` [69060, ...).
- The hop bound is a local, `p, m=64` [64965, ...), applied in the loop guard `while(a.length>0&&u<m)` [65020, ...). The counter `u` is incremented on the branch that follows a link, not on every segment, so the bound is on links followed.
- The loop carries `o` as the resolved prefix and `a` as the remaining segments as text. Following a link re-splits its target into segments and prepends them to the remainder, which is how a chain is walked without a `realpath` call: after reading a link it assigns the target's segments back onto `a`.
- Loop detection is a visited set of `f+"\x00"+a.join("\x00")` — the link path plus the remaining segments — and a repeat returns without resolving.
- Two sentinels mark the outcomes that are not a path: `var Lh="\x00unverified-ancestry",C8e="\x00opaque-link-text"` [61223, ...), declared between `function Fe` [61052, ...) and `function kzn` [61366, ...).
- Text that cannot be trusted as written is rejected by `function kzn(e,n=!1)` [61366, ...): a replacement character anywhere, and — only when its second argument is set, which the Windows-shaped callers pass — a drive-relative `C:foo`, a root-relative `\foo`, a `\\?\` path that names neither a drive nor a UNC share, and any component ending in a dot or a space.
- A chain that is too long is refused through a factory, `function Azn(e)` [61668, ...), which builds `ELOOP: symbolic link chain too long to vet`; a chain that surfaces a network path is what `Spt="ERR_SYMLINK_TO_NETWORK_PATH"` [68860, ...) names, raised by the entry points [70143, ...) and [70417, ...).
- Whether an unreadable ancestor may be treated as verified is decided by `function Un(e,n,r=!1,s=!1,i=!1)` [61780, ...), which returns the unverified sentinel unless the error is `ENOENT`, `ENOTDIR`, or `ENAMETOOLONG` under the flags its callers pass.
- Resolution on a chain that will not resolve falls back to a direct realpath through `function FZ(e,n)` [68463, ...), which consults `function ywe(e)` [68107, ...) for the launch ancestry's common root when the ancestry is unreadable. The caller `function yo(e,n)` [67735, ...) turns the two sentinels into `{resolvedPath, isSymlink, isCanonical}`.
- `lj` returns, beyond the path, the hops it followed, the end state, a `dev`/`ino`/`ctimeNs` identity and `noFileSeen` when only a symbolic link was ever observed.

These are source declarations, not runtime observation.

Classification: rewrite of the chain walk onto this runtime's own path model, with its bounded refusal and its identity kept. This runtime already confined file tools by resolving each segment with a separate `realpathSync` call and checking the prefix, so the chain was resolved but never counted, never diagnosed, and never tied to the bytes that were then read. Owned decisions, marked as such:

- The bound is kept at 64 hops. It is a different number from the kernel's own limit, which is the point: a chain between the two is refused by this runtime with a name rather than by the kernel with a bare `ELOOP`.
- A loop is refused outright with the same `ELOOP` code instead of falling back to a direct realpath, because the fallback exists to serve an unreadable-ancestry policy this runtime does not have.
- The identity is the recovered triple — `dev`, `ino`, `ctimeMs` — with the byte length added, and it is checked against the open handle for a read and against a re-stat before an overwrite.
- The unreadable-ancestry verdict is a refusal rather than a marker, because this runtime's caller has no policy that would treat an unverified ancestor as usable.
- Network landings are refused by reading the filesystem type of the landing path. The recovered predicates live in an imported path-classification module and cover Windows device and UNC forms; here the check is a set of network filesystem magic numbers, which can only be wrong by omission.

Not ported, with the reason each is out of scope rather than unimplemented:

- The Windows path forms in `kzn` apply only on Windows, where the platform's own path syntax makes them ambiguous.
- The `launchAncestry`, `surfaceNetworkRaw`, `unreadableAncestry:"unverified"` and `literalLinkText:"opaque"` options are policy switches for a launch context this runtime does not have.
- The `openDirNoFollow` fallback that `He` tries when a `lstat` fails with an error other than `ENOENT`/`ENOTDIR`/`ENAMETOOLONG`, and the `/dev/fd` special case, both serve surfaces this runtime does not expose.
- The sentinel protocol itself: the two sentinels are internal to the recovered callers, so the port uses named errors instead.
- The credential-pattern table in the same module, which is recorded as a second candidate in [unreviewed-corpus.md](unreviewed-corpus.md) rather than ported here.

## Contract and boundaries

`resolveChain(root, userPath)` returns `{path, hops, identity}`. It refuses `non-canonical` text, `ELOOP` for a chain longer than 64 hops or a loop, `unreadable-ancestry` for an ancestor that exists but cannot be read, and `network-path` for a landing on a network filesystem; a path that does not exist resolves to where it would be, with no identity and no hops, so a caller can still decide whether to create it. `verifyIdentity(resolved)` refuses `changed` when the path is gone or is no longer that file.

`tools.ts` keeps its existing contract: `confineResolved` is the old `confine` with the resolver behind it, `confine` is a one-line wrapper, and every existing refusal keeps its message — an escaping link still reports that it escapes the workspace, the reserved `.agent` directory is still refused lexically and after resolution, and a chain ending on nothing still reports a dangling symlink. What is new is that the read opens the resolved path with `O_NOFOLLOW` and streams from that handle after checking it against the recorded identity, and that `write_file` and `edit_file` re-verify before their atomic rename.

## Validation

- Unit: test/path-identity.test.ts, 8 cases. Non-canonical text is refused only where the platform makes it ambiguous; the local filesystem's own type is asserted absent from the network magic-number set so a wrong entry fails loudly; a chain is followed hop by hop with each hop recorded; a chain of `MAX_LINK_HOPS + 8` is refused with `ELOOP` and "too long to vet"; a link loop is refused; a missing path resolves with no identity; a network landing is refused and a non-network one is not; identity verification catches a length-changing rewrite, a substitution and a disappearance.
- CLI smoke: `npm run smoke:path-chain-cli` (`scripts/smoke-path-chain-cli.mjs`), source and compiled, two model requests per case against an owned loopback gateway. A three-link chain reads its target's content; a chain of `MAX_LINK_HOPS + 8` fails with "too long to vet" and its target content never appears in the result; a link that leaves the workspace fails with "escapes the workspace" and the outside content never appears. The first case is the control that separates a working bound from a blanket refusal.
- Full suite 1070/1070, fail 0. `tsc --noEmit` and `tsc -p tsconfig.build.json` clean. Package smoke: 65 files, 0 upstream requests.
- Identity: 116 input / 85 validation / 58 build files, merged `117588b210f600273190598a52f65a4e7582bc7fa869971b179f7585fad02ac7`, reproduced exactly by an independent offline rebuild from the source bundle (205 files) under `npm ci --ignore-scripts --offline`, `npm run check`, `npm run build`. Tarball `litcode-0.1.0.tgz`, 65 files, 316919 bytes, SHA-256 `ad0624084ca6d5af228e1b1b7f127599a09063a70cce5fb0f8cf24ff3dd53dd8`.
- Limits: the network-landing refusal is exercised through an injected filesystem-type reader, so the refusal is verified but no claim is made that a real network mount was observed; and the identity timestamps are only as fine as the filesystem's, which on this host means APFS advancing `ctime` in whole seconds, so a same-size in-place rewrite inside one tick is not detected. Both are stated in the module comment as well.
