# W367 permissions: a group or keyword body is checked as the command it runs

Status: implementation, main verification and independent review with repairs. One active package. Base commit 4388337.

## Task card

ID: W367, the Permissions family's second source difference in reading strictness, found while surveying the next Partial family.
User chain: a permission policy with a `command` rule meets a line whose command sits inside a group or a keyword body. Today the text walk sees one segment, so the rule never meets the inner command and the call is allowed.
Source: the statement-coverage check and the tree walk of `E6` in chunk-zjewzgfh.js, plus the already-copied `vS` parser.
Targets: an exact copy of the coverage block, one typed host walk over the parse tree, one new regression group, and two added cases in the existing compiled driver.
Mode: copy the coverage block verbatim. Adapt only the decision boundary: the recovered analyser answers `too-complex` or a command list, this runtime answers an extra set of readings plus a completeness verdict.
Predicate: a `deny` rule on `echo hi` denies `( echo hi )`, `{ echo hi; }`, `if true; then echo hi; fi` and `for f in *; do echo hi; done`; an allowed inner command keeps its own answer; a line the parser cannot read yields no complete reading set, so an `allow` rule asks; a top-level redirect is still one reading, so an exact `allow` rule keeps working.

## Provenance

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. All ranges are zero-based half-open UTF-16 code units, read from extracted bytes as inert data.

- Statement-coverage check `let l=(y)=>y===32||...` — chunk-zjewzgfh.js (SHA-256 83180bcc6260cb73ac46b7d44d98a5a621a1dc03153582b929e8d717649149b3, 93529 units) [9498,10028), body SHA-256 ee47f73f32d95eb6fdf52d8da4ae42a548b6d90fa736baf4f19b27d03075d86c. It walks the top-level statements, allows only whitespace, newline continuations, `;` and `&` between them, and refuses a line whose statements do not cover the bytes. Copied as `statementCoverage(n, t)` where `n` is the UTF-8 byte view of the command and `t` its parse tree, returning `null` where the source returns nothing.
- Node set `Mt` — same module offset 21417, listing `command`, `variable_assignment`, `variable_assignments`, `list`, `pipeline`, `redirected_statement`, `negated_command`, `declaration_command`, `unset_command`, `test_command`, `subshell`, `compound_statement`, `if_statement`, `while_statement`, `for_statement`, `case_statement`, `function_definition` and `ERROR`.
- Command extraction `Dt`/`E` — same module offsets 21059 and 22589. `Dt` runs `yLn` first, then walks children through `E`, which appends one entry to the command list for a `command` node and recurses into the statement containers. That is why the recovered analyser reports an inner command at all.
- Parse wrapper `w6` — same module offset 21009. It refuses a line longer than `$e = 1e4` and returns `Yx` for a parse abort or a `null` tree; `E6` answers `too-complex` with `PARSE_ABORT` for that sentinel.
- The parser itself is `vS`, already copied exactly in `src/bash-parser-source.ts` (chunk-y59c9wzk.js [633,657)). Its node indices are UTF-8 byte offsets, which is why the coverage check receives the byte view.

Classification: exact copy for the coverage block, with one host wrapper and one host tree walk. The walk uses the copied parser's own node set; it does not port `Dt`'s command construction (argv, env prefixes, redirects), which is the analyser's own semantic model and stays out of scope.

## Contract and boundaries

`treeReadings(command)` returns the inner command texts the copied parser reports and a refusal reason when the line cannot be modelled: over-length, parse abort, a parse `ERROR` node, or a coverage failure. `shellReadings` adds those texts as readings, and reports `exhaustive: false` whenever the tree was refused. `applyShellReadings` is unchanged: a `deny` reached from any reading still wins, and an incomplete set still turns a would-be `allow` into an `ask` unless the mode is `bypass`.

Only leaf commands (`command`, `variable_assignment`, `variable_assignments`, `negated_command`, `declaration_command`, `unset_command`, `test_command`) become readings; the containers around them (`list`, `pipeline`, `redirected_statement`, the keyword and group statements) are walked, not added. A redirect is handled as the recovered `Wt` handles it: when a `redirected_statement` wraps exactly one command, that command's reading is the whole statement text, because the command runs with its redirect; when it wraps a pipeline or a group, the redirect attaches to the last command inside, so each inner command keeps its own text and the statement text already covers the redirect. Getting this wrong the other way made an exact `allow` rule on `printf shell-content > content/shell.txt` ask, which the affected-suite run caught.

Separately, a line whose tree holds a compound node is not split on the text walk's separators: `;` inside `if …; then …; fi` separates a keyword from its body, and splitting it invented `then echo hi` and `fi` as commands. Those lines are read from the tree instead.

The change can only tighten. Every line whose inner command was previously invisible now reports that command, so a `deny` reaches it and a matching `allow` covers it. No line gains a permission.

Not ported, with reasons: `Dt`'s command model (argv splitting, env-prefix values, redirect analysis, heredoc handling), the declaration-prefix rule, the `Lcn` strictness ordering, `Be`/`Ue`/`We` parse-error verdicts beyond the plain `ERROR` node, and the backtick scan verdicts. Each of those needs the analyser's own semantics rather than its node set; the host keeps its conservative reading superset for them and the family stays Partial.

## Validation

`test/shell-permissions.test.ts` gains two groups. The first: a `deny` on `echo hi` denies all four wrapper forms; `echo ok` and `( echo ok )` keep their allow; and `echo hi )`, which the parser reads as an `ERROR`, reports `exhaustive: false` so an `echo *` allow rule asks. The group fails without the tree walk, because the text walk sees one segment for each wrapper form. The second pins the reading shape itself: a compound line reports only its real commands, a plain `;` list still splits, an exact allow on a redirected single command keeps working, and a redirect around a pipeline attaches to the last command only.

`scripts/smoke-shell-readings-cli.mjs` gains two cases against the real CLI, in both source and compiled modes, on an owned loopback SSE gateway. Under a `deny` on `echo denied`, `( echo denied ) > marker.txt` is refused with "alternate reading" and writes no marker, while `( echo fine ) > marker.txt` runs and writes it. Both modes pass; two model requests per case, asserted.

Check and build pass. Full suite 3439/3439 across 118 suites, 0 fail/cancel/skip/todo. Identity e767d6fb156a18c8a5f03191494d42ae4231e36f321d9bfb4747f250f481130d (938 input / 360 validation / 662 build records). Affected suites 93/93 across seven files.

An independent reader verified the copied block byte-for-byte, the `Mt` citation, the refusal path and the first regression group, and returned four product defects and two record gaps. All six are repaired here and pinned by the second group and the driver assertions: a quoted inner command is now de-quoted before a rule sees it, a redirect inside a group no longer hides the command, a tree refusal no longer discards the text readings, no form of a compound line is split on separators, the walk comment and its `E`/`Wt` citation are corrected, and both driver cases now assert two model requests. The reader did not run tests, build or the driver; main bound those to the repaired identity. Its remaining limits are the unported analyser command model, declaration-prefix rule, `Lcn` ordering and backtick verdicts, and that `bypass` still allows a line whose reading set is incomplete.

The first draft of this package also added the command under a top-level `redirected_statement`, which turned an exact allow rule on `printf shell-content > content/shell.txt` into an ask. The affected-suite run caught it, and the compound-only rule above is the repair.

## Reproduction

```sh
node --import tsx --test test/shell-permissions.test.ts
node scripts/smoke-shell-readings-cli.mjs
node scripts/smoke-shell-readings-cli.mjs --compiled
npm run check && npm run build && npm test
```

`node scripts/copy-source-plan.mjs research/ports/W367-shell-coverage-source-plan.json extracted-v2/modules src` regenerates `src/shell-coverage-source.ts` and its ledger.

## Boundaries and ownership

The coverage block is inert data until `treeReadings` reads it; no recovered entrypoint runs. The Permissions family stays Partial: the analyser's command model, the declaration-prefix rule, the `Lcn` ordering and the remote managed policy remain outside this package. No source-equivalence percentage is claimed.
