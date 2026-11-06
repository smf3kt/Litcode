# W373 permissions: the declaration-prefix rule

Preflight only; no product edits until the W372 review returns and the source closure is read in full.

## Why this is next

W372's record and the Permissions matrix row both name the declaration-prefix rule as one of the two remaining local gaps (the analyser command model is the other; remote managed policy stays External). The host's `statementCoverage` copy is the slice [9498,10028) of the recovered `E6`; the entry signature and the declaration-prefix post-check around it are not ported.

## Source owners to read

chunk-zjewzgfh.js (analyser module):
- `E6` entry at 7890: `function E6(e,t,{plainUnquotedHeredocs:r=!1,declarationPrefix:s}={})`; the state save/restore at [10246,10280) (`L=0`, `M=void 0`, `B=!1`).
- The post-check at [10490,10560): when the caller passed no `declarationPrefix`, a collected prefix list `y = Zt()` adds `declarationPrefixes: y.length` and `declarationPrefixBashKeeps: y`; when the caller passed one and the walk's kept count `Gt()` differs from `s.length`, the result becomes `too-complex` with "The variables set in front of declarations in this command can't be checked before it runs".
- The branch/loop check at 10265: `B && x.kind === "simple"` becomes `too-complex` with "A variable set in front of a declaration inside a branch or loop can't be checked before it runs".
- `Zt` [47071,47094) and `Gt` [47094,47117) read the module-level `M` and `L`; find where the walk (`Dt`) sets them, and where `B` is set.
- `Ze` at 13062: the declaration-command refusal inside the walk.
- The caller side: who passes `declarationPrefix` (search chunk-sfn1dbxq.js for `declarationPrefix`).

## Host surface

- `src/shell-coverage-source.ts` `statementCoverage` (the copied E6 slice) and its callers.
- `src/shell-readings.ts` `shellReadings`/`treeReadings`: a refusal makes the set non-exhaustive; the synthetic ask text lives in `applyShellReadings`.
- `src/permissions.ts` `applyShellReadings`: the non-exhaustive ask is already ported (W372); the new part is what makes a prefix line non-exhaustive.

## Predicate (to confirm)

A line that sets a variable in front of a declaration (`VAR=x cmd`, the branch/loop variant, and the declaration-command case `Ze` refuses) is not exhaustive, so an allow rule asks; a plain `cmd` and a declaration bash keeps behave as the source does. Actual compiled CLI case plus at most three new groups; the family stays Partial for the command model and remote managed policy.

Local only. No account, OAuth, hosted subscription, paid upstream, push, coauthor or schedule.
