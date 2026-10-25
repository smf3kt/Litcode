# W333 open-fleet `/fork` gates

Status: task card and source verification. Work in place on `work/w43-choice-preview`; local commit only, no coauthor, no push.

Task card.
- Outcome: the open-fleet `/fork` refuses exactly what the recovered body refuses, in the recovered order, and the command table hides both agent rows in a coordinator session.
- Source: `Ue` (chunk-zsg1bb14.js [19311,20040)) and the `njt`/`ojt` registrations (chunk-sfn1dbxq.js ~1638551/~1638723).
- Domain: a coordinator session refuses before anything is seeded; a bare `/fork` with no seedable conversation refuses; `/fork <prompt>` seeds from the prompt and is allowed on an empty conversation.
- Adapter: the host has no persistence-off and no safe/bare launch flags, and its fork copies the pinned config, so those two rows have no host input (recorded, not invented).
- Validation: three regression groups, actual compiled CLI, check/build, independent review, exact-path local commit.

Artifact 2.1.296 SHA-256 `c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937`. Coordinates zero-based half-open UTF-16 code units; recovered bytes remain inert.

| Module | SHA-256 | Acquired body |
| --- | --- | --- |
| chunk-zsg1bb14.js | b92e586d18ae25da4ecd7cb55903d4ac94ab1ead4a6433ad17636f8a27886d26 | `Ue` [19311,20040): `xa()` → `hVn`; `Fa()` → persistence row; `Tr()\|\|pr()\|\|HD()` → launch-flag row with `${m4t}`; `fBe(r.messages,p,"(forked)")===null` → nothing row; then `U`. |
| ↳ | | `U` [20040,21857): `gft` with `keepParent:!0`, state chip by `t.length>0`, `UKn` row. |
| chunk-24k7d6mw.js | 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31 | `fBe` [51242,51842): default fallback `"(backgrounded)"`; returns null only when no user text was seen and no prompt was given. `hVn` [38689,38765). |
| chunk-vvj0cwgx.js | 557a86a5e4f608e938b7d477d0daf16f8cf8bba85d6ddb4cb695dea263fc4f46 | `xa` [758,886): coordinator mode, except interactive non-remote without `CLAUDE_CODE_REMOTE`. |
| chunk-sfn1dbxq.js | 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da | `njt` (~1638551) and `ojt` (~1638723): both carry `isEnabled:()=>!xa()`. |
| chunk-nqc6v990.js | 261b35d99a3bb5aed676678c983f7c903da023ab3ad0c4117a3474d6b51e0738 | `pr` [3830,3899) and `Tr` [3899,3976): bare/safe mode. |
| chunk-4bw62nzm.js | 1a8788672a623975dc4a807604528e46b128f16b5ec159495c0ec2370f805713 | `HD` [81984,82057): the restricted launch config. |
| chunk-7rs61wcn.js | 6af3cc3b30cf567fdedb29e819d31a446411cf19d7757146154afa7512160edc | `JZr` + `m4t` [1770,1840): which launch options count as restricted, and the row's noun phrase. |

## Findings

1. Coordinator refusal missing in the open branch. `Ue`'s first statement is `if(xa())return f(hVn,{display:"system"}),null;`. The host's open branch has no such gate, so a coordinator session reaches the copy. The closed branch already ports the same predicate as `subtaskCoordinator`.
2. Seed check is wrong. `Ue` refuses only when `fBe(...)` returns null, and `fBe` returns null only when no user text was seen and no prompt was given. The host tests `session.messages.length === 0`, so `/fork <prompt>` on an empty conversation is refused even though the source seeds it from the prompt.
3. Seed fallback is wrong for this path. `Ue` passes `"(forked)"`; the host's `backgroundSeed` hardcodes `"(backgrounded)"`, which is `/background`'s default. A bare `/fork` after only command or meta rows therefore names the copy `(backgrounded)`.
4. Command table does not honour `isEnabled:()=>!xa()`. Both `njt` and `ojt` hide themselves in a coordinator session; the host's table lists them.
5. Not applicable on this host: `Fa()` (`tRn()` reports test-env, explicit `--no-session-persistence`, `CLAUDE_CODE_SKIP_PROMPT_HISTORY` or a nested marker) and `Tr()||pr()||HD()`. The host always persists a journal, has no `--safe-mode`/`--bare` flags, and its fork copies the pinned `SessionConfig` instead of relaunching a process that re-reads settings, so a copy cannot run with fewer restrictions than its parent. Recorded rather than invented; no placeholder row is printed for inputs that cannot exist.

## Implementation

`src/background-session.ts`: `backgroundSeed` takes `fBe`'s third parameter (default `(backgrounded)`), and `BackgroundStartOptions` carries `seedFallback`. `/background` keeps the default; `/fork` passes `(forked)`.

`src/interactive.ts`: the open-fleet branch runs `Ue`'s gates in source order. A coordinator session prints `FORK_COORDINATOR` through the existing `subtaskCoordinator`; the seed check is `backgroundSeed(session.messages, argument, '(forked)') === null` rather than `messages.length === 0`; the spawn receives `seedFallback: '(forked)'`. A loop-local `coordinator()` closure feeds the same predicate to the command table so the row and the arm cannot disagree.

`src/tui-autocomplete.ts`: `tuiCommandsWithSkills` takes `coordinator`; when true it drops `fork` and `subtask` from whichever branch was selected, leaving `branch` and the rest.

## Verification

- `npm run check` and `npm run build` exit 0.
- Focused set `test/fork-command.test.ts test/background-session.test.ts test/subtask-command.test.ts test/interactive.test.ts test/tui-autocomplete.test.ts test/btw-fork.test.ts`: 87/87. New cases cover the coordinator refusal in the open branch, the typed-prompt seed on an empty conversation with the `(forked)` fallback, the `fBe` fallback parameter directly, and both hidden rows in both branches.
- Compiled `scripts/smoke-fork-gates-cli.mjs`, 14 checks, 1 model request, locks released: a coordinator session prints the refusal and writes no copy, the suggestion list omits the fork and subtask rows and keeps branch, a bare `/fork` on an empty conversation prints the nothing row, `/fork FORK_TASK` on that same empty conversation reports `session running · <8 hex>`, the copy runs its prompt, writes its own journal, and the session exits 0.
- Baseline: the same driver against the stashed pre-edit sources fails at the coordinator row with `Nothing to fork yet. Send a message first.`, so the compiled run measures this change rather than restating it.

## Commit

The package commit subject is `Port the open-fleet /fork refusal gates` on `work/w43-choice-preview`; local only, no coauthor, no push. Its literal hash is deliberately not written here, because amending this line to add it would change the hash again. Content identity `4ae3530c2dadf2c4334a514ea09513f8df0beac3d7135b6d7d33e95cddace62a` (inputs 874, validation 337, build 620). The reviewer's accepted W332 finding was committed separately as `c5d311b Judge presence on the serialized settings document`, because it repairs a different package; the W332 record lines corrected alongside it travel in that commit.
