# W124 — Closing the C-10 residual list

C-10 (`Skills；WebFetch/web tools`) carried three residual phrases after
W123: source precedence, referenced URL invalidation and the recovered shell
AST, plus reserved names and collision naming from W122. Every one now has a
disposition; no product code changes.

## Reserved names and collision naming — excluded with account sync

Recovered evidence. The reserved list holds one name:
`var uRe=["anthropic-skills"]` (chunk-mven2c2x.js offset 619). `b9t`
(chunk-xrjhyksm.js offset 2913) maps a candidate onto that namespace by exact
match, `<name>:` prefix, or a first-segment comparison; `I2` at 3550 tests
it, `vce` at 3817 exempts synced skills and account-wrapped plugin skills, and
`dqe` at 3950 flags any non-synced skill whose name or `userFacingName`
lands in the namespace. The user-settings filter `J9e`
(chunk-sfn1dbxq.js offset 3373292) drops those entries and reports each
through `Qfe` (3372867), whose collision naming `Nxr` (3373506) recomputes
the directory path a namespaced skill would need. The refusal text itself says
the name are "reserved for the skills synced from your claude.ai account"
(chunk-xrjhyksm.js offset 3588).

Decision: excluded, not ported. The namespace exists only for claude.ai
account sync, and this product is local-only by an explicit constraint (no
account, subscription or sync transport). There is no synced namespace to
protect, so every local name is unreserved and there is nothing for collision
naming to rename. A local skill called `anthropic-skills` or
`anthropic-skills:<x>` loads like any other skill. Recorded as item 7 of
`ports/remaining-dispositions.md`; the `syncOwnedPrefixes` gate that `dAr`
uses has the same basis and was already recorded as having no counterpart in
W123.

## Referenced URL invalidation — already shipped

The phrase "a reference whose URL changes is dropped" describes the citation
rule in `web_search`: a citation is dropped when its URL is rewritten by
either redaction pass (`src/web-search.ts` line 155:
`redact(rawUrl, secrets) !== rawUrl → continue`). That landing is recorded in
`ports/W19-credential-shapes.md` and stated in the FEATURES WebFetch/web tools
row; the C-10 row text was stale, not a gap.

## Shell AST — decided not-ported

Item 3 of `ports/remaining-dispositions.md`: the recovered parser (`SE`,
chunk-sfn1dbxq.js [4697,4822), 10,000 character cap) loses to the tested
quote-group contract, which the product keeps.

## Verification

Documentation-only package: no source or test change. The last measured gates
are W123's — focused 137/137, three-suite 164/164, tsc 0, build 0, full
2,194/2,194, chain 768/768 — and the content identity is unchanged at
`4149770c…`.
