# W10 instruction imports: link vetting before an import is read

Status: verified. Date: 2026-10-12.
Task: an instruction file reached through a link -> the link chain is walked before the file is read as instructions -> a body that is not valid UTF-8, a body that climbs back out of a directory it entered, a loop, or a chain past the bound is refused by name -> the refusal surfaces on the tool call whose path-scoped instructions were being loaded.
Entry: none new. Instruction loading keeps its entry points; `loadPathInstructions` and the rule readers vet each file's link chain before reading it.
Targets: link-vetting.ts (new), config.ts (`vetInstructionPath` and its three call sites), test/link-vetting.test.ts, scripts/smoke-link-vetting-cli.mjs.

## Provenance and adaptation

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. All ranges are zero-based UTF-16, left-closed/end-exclusive, read from extracted bytes as inert data.

- The vetting function is in chunk-pn44qc66.js (SHA-256 f6c745a0cf4f3370d0e13487c15727a69bdbf2256a30c59080c571274064a77f, 45078 bytes), the module that carries the include-and-settings handoff.
- The bound is a local declared beside an unrelated matcher, `var Cn=/~\d/,Un=32` [11281, ...), and `async function On(e)` [11287, ...) walks with `for(let o=0;o<Un;o+=1)`.
- `On` tracks visited states in a `Set` keyed by the path it is about to inspect and returns `false` when a state repeats, so a loop ends the walk rather than extending it.
- The three ruled refusals throw plain errors with the text this port reuses verbatim: `link body is not valid UTF-8` [11462, ...), `link body climbs out of a directory it entered` [11603, ...), and `link chain too long to vet` [11808, ...), the last reached by falling out of the bound.
- The climbs-out rule is `function $n(e)` [12206, ...): split the body, set a flag on the first component that is neither empty nor `.`, and report once a `..` is seen after that flag is set. A leading `..` is therefore a relative link, not a climb.
- The separator set it splits on is `Tn` [9802, ...), declared as `j===ge.sep?/[\\/]+/:/\/+/` — both separators only on the platform whose separator is a backslash.
- Not ported, because they are verdicts about a cloud handoff rather than about the link text: the `true`/`false` result of `On` and the counters its caller fills from it (`symlinksNotSent: Y(n,"symlink_not_sent")` [14739, ...), `too_many_links` [13174, ...)), and the `home_unvettable` [36833, ...) and `outside_root` [3795, ...) states of the same module.

These are source declarations, not runtime observation.

Classification: rewrite of the three text-level rules onto this runtime's instruction loader. This runtime already refused an import that escapes the workspace, but it did so by realpathing the resolved import and comparing the prefix, so a link body that enters a directory and climbs back out was normalized away before anything looked at it, and the chain it was part of was followed without a bound. Owned decisions, marked as such:

- The bound is kept at 32 hops, the recovered local, rather than reusing the file-tool resolver's 64: the two surfaces read different things and their refusals are allowed to differ.
- The recovered check for a body that cannot be a path is a replacement-character test on the decoded text; the port decodes the raw link bytes with a fatal UTF-8 decoder, which is the same verdict decided on the bytes rather than on a lossy decode.
- The recovered walk returns `false` on a repeated state so that its caller can count a chain it will not send; this runtime has no such caller, so a repeat is refused by name as a cycle.
- The separator set is both separators on every platform, so `docs\..\other.md` is refused here even on a POSIX host. The recovered set makes that refusal platform-dependent, and a body that is only a path on another platform is not a path on this one.
- The refusal is a `LinkVetError` carrying its `reason`, wrapped by `config.ts` into a `ConfigError` naming the file, so it arrives as an error on the tool call that triggered instruction loading rather than as a startup failure.
- Vetting happens in the loader's inner reader, before the file is read, so a refused import is refused for every reader that would have taken it: the ancestor walk, the root instruction file and its imports, and the rule files.

## Contract and boundaries

`vetLinkChain(file)` refuses `not-utf8`, `climbs-out`, `cycle` and `too-long`; a plain file, a link whose body is an ordinary relative path, and a path that does not exist all pass, so the caller keeps deciding what a missing file means. `linkBodyClimbsOut(body)` is exported on its own because it is the one rule that is a property of the text rather than of the filesystem.

`config.ts` calls `vetInstructionPath(file)` as the first statement of the three readers that turn a path into instructions: the nested-import reader, the root-file reader with its imports, and `loadPathInstructions`'s `visit`. Nothing else changes: the reserved-tree refusals, the workspace-escape refusal, the depth and byte budgets, and the path-scoped context text are untouched.

## Validation

- Unit: test/link-vetting.test.ts, 5 cases. The climbs-out truth table including a backslash body; a plain file, a simple link and a missing path passing; a chain of `LINK_VET_HOP_LIMIT + 5`, a two-link loop and a climbing body each refused by reason; a link body that is not valid UTF-8 refused; and an integration case in which an instruction file importing through a climbing link fails with "climbs out of a directory it entered" while the same import through a link that does not climb is read and appears as an instruction file.
- CLI smoke: `npm run smoke:link-vetting-cli` (`scripts/smoke-link-vetting-cli.mjs`), source and compiled, against an owned loopback gateway. The control run reads an instruction file whose import is reached through a link inside the same directory, and the imported text reaches the second request; the refused run fails the read it was loading instructions for with "climbs out of a directory it entered" and the imported text never reaches a request. The control is what separates a working rule from a loader that never read the import.
- Full suite 1075/1075, fail 0 (the five new cases). `tsc --noEmit` and `tsc -p tsconfig.build.json` clean. Package smoke: 66 files, 0 upstream requests.
- Identity: 118 input / 86 validation / 59 build files, merged `e4b6b8eb551c606233da55bf5a4f42485ce628286e21728404e06acb298a7733`, reproduced exactly by an independent offline rebuild from the source bundle (208 files) under `npm ci --ignore-scripts --offline`, `npm run check`, `npm run build`. Tarball `litcode-0.1.0.tgz`, 66 files, 318811 bytes, SHA-256 `db2eddc92e8c211816d9380df0e7e4b666554636ca5f0bdd0a48a8f9612ef7af`.
- Limits: the vetting covers links on the instruction-import path only. A link on the path of a file a tool reads is resolved by the W09 resolver, whose rules are its own, so the two surfaces are deliberately not the same check. Nothing here claims a real network mount, a Windows host, or a chain longer than either bound was observed.

## Regression note

No previously passing case changed. The first version of the integration case was written with `path.join` to build the climbing link body, which normalizes the `..` segments away and produced a link that did not climb; the body is now written verbatim, and the case records why.
