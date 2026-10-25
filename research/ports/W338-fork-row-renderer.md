# W338 native fork rows

Status: verified locally with independent review. Main writes in place. Local commit only, no coauthor, no push.

Task card:
- Outcome: an open-fleet /fork draws its recovered gutter, bold name and dim state/id/chips in the fullscreen terminal. A resize fits the original fields again, so widening restores a clipped name.
- Data: existing ForkRowFields carried as a transcript display payload. The journal and worker task stay unchanged.
- Method: adapt Up and Ip's noninteractive JSX body; reuse the existing RMr adapter and native document renderer.
- Targets: interactive.ts, terminal.ts, tui-transcript.ts, tui.ts and a small fork renderer module. Keep plain/inline output as its existing fallback.
- Checks: up to three behavior groups, compiled baseline and resize/style/selection checks, affected tests, check/build, independent review and identity.

Artifact 2.1.296 SHA-256 is c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937. Source modules are verified against extracted-v2/manifest.json before Acorn body selection. All ranges are zero-based half-open UTF-16 code units.

| Module | SHA-256 | Acquired body |
| --- | --- | --- |
| chunk-phg89898.js | b52cc8f30379c267a8f9afb0f475b87c00d8fd96f8ddadcd0bdab1549234dfe3 | Sp [111375,111404), On [111837,112568), Up [112568,113022), Ip [113052,114313), Ap declarator [113026,113041), Yy declarator [113042,113051) |
| chunk-t721xmjm.js | c88d190d4b973f293465e812bffa970b235dcf6b7f2e12525af0551168a2cb26 | Bcn [47101,47446), RMr [47446,47819), UKn [47819,47911) |
| chunk-zsg1bb14.js | b92e586d18ae25da4ecd7cb55903d4ac94ab1ead4a6433ad17636f8a27886d26 | U [20040,21857) |

Up splits the first fork glyph into an aria-label of segment without changing its visible text. Ip reads current columns, subtracts ae(Ap), fits fields, paints state and separator dim, W = name ?? id bold, a second id dim only when both name/id exist, and all chips dim. Its gutter is `  ⎿  ` with aria-label `fork:`. On sends parsed fork rows to Ip before ordinary local-command text rendering. U's onDone marks the row display as system.

The host currently fits and serializes before output.write, which TuiTerminal stores as assistant text. The full name is lost and a resize can only wrap the truncated string. The port carries raw fields through TerminalSurface.writeForkRow and TranscriptEntry.fork. The fullscreen renderer calls the adapted Ip body at each width. Plain/inline output retains the previous string fallback.

Ip's live attach click/hover and the associated conditional id drop remain absent because this host has no live attach owner. The adapted renderer calls fitForkRow with attachAvailable false. This package does not create a background daemon or promise peer messaging. React compiler memo slots are removed in the small adapter; the JSX ordering and styles are retained, with the existing native renderer/cache owning recomputation.

Throughput checkpoint:
- Blocking first steps: verify source bodies and capture the compiled missing-renderer baseline before product edits.
- Independent workstreams: main owns the coupled implementation and driver. One independent read-only review follows validation.
- Shared mutable state: raw display fields live in the existing terminal transcript; renderer/cache/selection remain terminal-owned and release on close.
- Smallest decomposition: one native component plus a typed display payload, with the existing serializer used for plain output. No new process or event store.

## Implementation and source comparison

Model the Domain keeps the existing ForkRowFields as the display model instead of reconstructing fields from already clipped text. It travels through optional TerminalSurface.writeForkRow into TranscriptEntry.fork. TuiTerminal clones the fields and chip array, keeps the full serializer text for fallback and stores a system entry. Its existing row cache includes columns, theme and theme generation, so the native ForkRow reruns fitting when those inputs change. No extra cache, timer or pointer owner is added. TuiDocumentRenderer and the terminal's existing close path release the mounted tree and selection resources.

The fullscreen renderer adapts Up and Ip. The plain or inline interactive command keeps its original fitted-text branch. A TuiTerminal outside a mounted fullscreen session prints the full plain serializer output. Worker launch, task prompt, title and journal behavior remain with W337.

The manifest-bound comparison script is `$CLAUDE_JOB_DIR/tmp/w338-source.mjs`, with results in w338-source.txt. It selects ten exact bodies or declarators across three modules and compares eleven source expressions or JSX sections after mechanical identifier, void, boolean and jsx-key normalization. These cover primary selection, secondary-id presence, state/separator, primary bold text, id, chips, gutter, prefix/suffix slices and glyph accessibility. The primary underline property is removed explicitly because live attach is absent. Gutter width uses the same literal. The exact source-to-target character diffs are retained as w338-Up-character.diff and w338-Ip-character.diff and were read in full. They show only the listed parameter/name/JSX/type adaptations, removed compiler memo slots and absent attach wrapper. The normalized comparisons ignore positions and raw literal spellings, so they verify syntax after the listed mechanical adaptations rather than byte-for-byte copy identity. Compiler memo slots and pointer wrappers are omitted. The helper preserves original bodies as inert AST data and never imports them.

Sp in this module is `function Sp(){return Ae(TKn)}`, an attach-context reader. The W335 awsCredentialExport interpretation used a same-named binding from elsewhere and is corrected. RMr's 20-cell name floor is retained, so extremely narrow rows may still overflow.

## Verification

- The compiled pre-edit baseline on e75e23b fails at the recovered gutter assertion. The decoded row was already fitted plain text without the gutter.
- Three new behavior groups pass. They cover id-only and named rows with chips and literal glyphs, the un-timestamped transcript dispatch, raw chip-array ownership, system entry classification, 60-to-140-to-60-to-140 resizing, live light-ANSI-to-dark repaint, exact OSC52 selection and cleanup, full command-field forwarding and plain fallback.
- The affected set passes 182/182. It includes tui-fork-row, fork-row, fork-command, fork-relocation, background-session, tui, terminal, tui-bash-mode and status-mcp tests. Check and build exit 0.
- Compiled smoke-fork-row-cli.mjs passes 11 checks with one owned loopback model request. It completes a parent task, renames it, takes a waiting fork, checks native cells and two resize cycles, copies the exact full name, confirms no additional model request and exits with all session locks released.
- Existing compiled smoke-fork-gates-cli.mjs passes 24 checks with three owned loopback requests. smoke-fork-relocation-cli.mjs passes 10 checks with one. Their journals, launch and resume conditions remain intact.
- Commands are `npm run check`, `npm run build`, `node --import tsx --test --test-concurrency=2 test/tui-fork-row.test.ts test/fork-row.test.ts test/fork-command.test.ts test/fork-relocation.test.ts test/background-session.test.ts test/tui.test.ts test/terminal.test.ts test/tui-bash-mode.test.ts test/status-mcp.test.ts`, and `node scripts/smoke-fork-{row,gates,relocation}-cli.mjs` as three separate invocations. Each final invocation exits 0. The three new groups were rerun with the affected set after tightening chip-array and un-timestamped dispatch assertions.
- Candidate identity is `1956ab6e5e01b2b5a3e377ee4edc13770d5f635b910c70f35385b39339c102c0`, with 879 input, 340 validation and 623 build files. Logs and the full identity are under `$CLAUDE_JOB_DIR/tmp/w338-*`. Full-suite testing and live Magpie validation are not run for this bounded package.
- Independent read-only review found no confirmed scoped correctness defects. It verified all 1,842 candidate records before and after its checks, reread the exact source bodies and reran all eleven source comparisons. Its three behavior groups and actual compiled eleven-check CLI pass with one owned loopback request. Eleven supplemental compiled checks cover widths 24/40/60/80/120/200, mixed fork/plain/Markdown entries, repeated resize, transcript mode, dark-theme repaint and renderer close with zero live nodes. The compiled piped `--interactive --no-tui --resume` fallback uses an actual CLI-created parent and exits 0 with the fitted row and resume command. Its fixture locks, recorded PIDs and PTY process group are clear. Logs are w338-independent-focused.txt, w338-independent-cli.txt, w338-independent-cache.txt and w338-independent-fallback.txt under the job temporary directory.
- The comment audit retained six source anchors and found no changed suppressions or code refactor targets. Two redundant driver cleanup comments were deleted after review. The driver's parsed executable syntax remains identical. The final manifest differs only in scripts/smoke-fork-row-cli.mjs; product, tests and all compiled bytes remain equal to the reviewed candidate. Final identity is `d73cd6b20d8bf875603a28e8041e2ca5cff7bc5cfe03a484d019cea799b7ecbe`. Both protected user-file hashes remain unchanged. The first reader's upstream HTTP429 returned no result and is not counted. Supplemental fallback setup mistakes were corrected in the review fixtures without product edits.
- The local commit subject is `Render fork rows from their original fields`. Exact-path staging excludes research/question.md and all unrelated user changes. No coauthor or push.

## Rule comparison

S-1 and S-7 bind recovered On/Up/Ip/U and their field/width owners before edits. Eleven normalized source comparisons cover the handwritten adapter. Test Behavior, Not Implementation is applied through real renderer cells, terminal input and the compiled CLI; the tests assert literal text and clipboard payloads. S-2 preserves the fitting floor, noninteractive id and existing fallback. S-3 retains original fields separately from painted rows and verifies exact clipboard text. S-4 keeps existing renderer/cache/selection ownership and checks close listeners, modes and session locks. S-5 uses decoded cells, persisted rename, request counts and OSC52 payloads. S-6 connects the command producer, interface, transcript dispatch, renderer and actual driver together.

The clipboard fixture initially waited for guessed copied text. The source uses sent N chars via OSC52 feedback, so the repaired assertion checks the actual OSC52 payload. UTF-8 decoding now uses stream.setEncoding so chunk boundaries preserve characters. The bold check reads xterm's actual bit flag as a boolean. These are fixture corrections; product selection and style behavior are unchanged. Existing S-1, S-3 and S-5 cover the incidents. apply_patch remains absent, so dedicated Write/Edit remain the recorded fallback.
