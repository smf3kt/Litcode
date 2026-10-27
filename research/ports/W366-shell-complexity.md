# W366 permissions: the analyser's own refusals make a reading set incomplete

Status: implementation, main verification and independent VERIFIED_SCOPED. One active package. Base commit 44bff7e.

## Task card

ID: W366, the Permissions family's remaining source difference in reading strictness.
User chain: a permission policy with a `command` rule meets a line the recovered analyser refuses to model. Today the reading set over that line is reported complete and an `allow` rule carries it. After this package the refusal makes the set incomplete, so the call asks instead of running.
Source: the refusal guards of `E6` in chunk-zjewzgfh.js, plus the `Fe` normaliser they run through.
Targets: an exact copy of the guard declarations and `Fe`, one typed host predicate, one new regression group, and two added cases in the existing compiled driver.
Mode: copy the guard set verbatim. Adapt only the decision boundary: the recovered analyser answers `too-complex`, this runtime answers "this reading set is not complete".
Predicate: with an `allow` rule that matches the literal text, a line carrying any recovered refusal asks and never runs; a line with none keeps its allow; a `deny` from any reading still denies.
Checks: one new behaviour group, affected tests, check/build, actual compiled CLI in both source and compiled modes, full suite, frozen identity.

## Provenance

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. All ranges are zero-based half-open UTF-16 code units, read from extracted bytes as inert data.

- Guard declarations `var ce={...},...,At=/\{[^}]*['"]/;` — chunk-zjewzgfh.js (SHA-256 83180bcc6260cb73ac46b7d44d98a5a621a1dc03153582b929e8d717649149b3, 93529 units) [4728,5314), body SHA-256 c26de7a81df26ba0f5220a854edd0cca07af2ac5986886d2cc25633513ea432e. Only the eight guards this package consumes are used; the redirect table and the brace classes are copied with the declaration and stay inert.
- Normaliser `function Fe(e)` — same module [6336,7150), body SHA-256 f0ffb512dd2cf2e8c5bd02b9572c6acfa171018d496a0251446eeb8b31cbb48e. It rewrites `{` inside quotes and comments to a space so the brace guard sees only expansion braces.
- The guard order and reasons are `E6`'s own, chunk-zjewzgfh.js [7897,8796): lone surrogate, control characters, Unicode whitespace, backslash-escaped whitespace, zsh `~[`, zsh `=cmd`, zsh `<N-M>`, and a brace holding a quote character. The range ends where `E6` stops refusing on text alone and starts reading the parse tree.
- The guard set is closed under the module: `Rt` is built from `cyr`/`dyr` in the same declaration, and `Fe` has no free names.

Classification: exact copy for both declarations, with one host wrapper. The wrapper calls the eight tests in the source's order and returns the source's own reason string. It does not port `E6`'s parse-tree body, which stays out of scope: the host has no bash parse tree, and this package only needs the verdict "the analyser refuses this line", which the guards decide before any tree is read.

## Contract and boundaries

`shellComplexityReason(command)` returns the recovered reason for a refused line and `undefined` otherwise. `shellReadings` reports `exhaustive: false` whenever that reason exists, in addition to its existing construct and bound checks. `applyShellReadings` is unchanged: an incomplete set still turns a would-be `allow` into an `ask` unless the mode is `bypass`, and a `deny` from any reading still wins. `checkBashCommandClamp` inherits the same rule through `exhaustive`.

The change can only tighten. Every line the guards match previously produced a reading set that could allow; now it asks. No line gains a permission, and no line that was already incomplete changes its answer.

Not ported, with reasons: the remaining `E6` body (parse-tree walking, declaration-prefix rules, heredoc and redirect analysis, `Be`/`Ue`/`We` parse-error verdicts) is the analyser itself, whose host replacement is the conservative reading superset recorded in W01. Porting its guards removes the part of that gap that decides *without* a tree; the part that needs a tree stays open and is recorded as such.

## Validation

`test/shell-permissions.test.ts` gains one group: each of the eight refusals returns its source reason and reports the set incomplete; an ordinary line and an astral character that is not a lone surrogate stay complete; and an `allow` rule that matches the literal text asks for `echo <1-3>` and for `echo a\ b`. Affected run 82/82.

`scripts/smoke-shell-readings-cli.mjs` gains two cases against the real CLI, in both source and compiled modes, on an owned loopback SSE gateway. Under an `echo *` allow rule, `echo <1-3> > marker.txt` is refused with "cannot all be checked" and writes no marker, while `echo fine > marker.txt` runs and writes it. Both modes pass; two model requests per case.

Check and build pass. Full suite 3437/3437 across 118 suites, 0 fail/cancel/skip/todo. Identity b40aa962b01c84fbea5dbd7118329c21544808621e26d4c975e347f46e0e2bc2 (936 input / 360 validation / 661 build records).

An independent reader verified the copied bytes against the ledger output ranges, the single binding of each guard, the guard order and reason strings, and that `exhaustive` can only move from true to false, so nothing widens. It found two citation/assertion gaps and no product defect. Both are repaired here: the `E6` guard range is narrowed to [7897,8796), where the parse-tree branch begins, and the driver now asserts the two model requests per new case. The reviewer did not re-run the identity, the full suite or the compiled driver; main bound those to b40aa962 after the repair. Its other recorded limits are the unported parse-tree refusals, the declaration-prefix rule, the `Lcn` ordering, and that `bypass` still allows a refused line, which this package does not change.

## Reproduction

```sh
node --import tsx --test test/shell-permissions.test.ts
node scripts/smoke-shell-readings-cli.mjs
node scripts/smoke-shell-readings-cli.mjs --compiled
npm run check && npm run build && npm test
```

`node scripts/copy-source-plan.mjs research/ports/W366-shell-complexity-source-plan.json extracted-v2/modules src` regenerates `src/shell-complexity-source.ts` and its ledger.

## Boundaries and ownership

The guard set is inert data until `shellComplexityReason` reads it; no recovered entrypoint runs. The Permissions family stays Partial: the parse-tree analyser, the `Lcn` strictness ordering, the declaration-prefix rule and the remote managed policy remain outside this package. No source-equivalence percentage is claimed.
