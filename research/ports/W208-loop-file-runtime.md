# W208 the loop.md runtime and the autonomous `/loop` defaults

Status: implemented locally on `work/w43-choice-preview`. No push, no upstream calls.

## Request

Queue item W208, split out of W207: `native storage V5 / transformed session-storage producers`. The
storage half reduces to the one thing this product needs it for — the `loop.md` task file the
built-in `/loop` command reads — so the package landed as the loop-file runtime behind `/loop` with
no prompt, which W210 had left deferred.

## What was there

`src/loop-command.ts` carried only the parse-and-schedule branch `R`. An empty `/loop` or a bare
`/loop 5m` fell through to the same text, so neither the loop-tasks file nor the autonomous default
existed, and a scheduled job whose prompt was a loop sentinel fired that sentinel verbatim.

## Recovered source

| Module | SHA-256 | Range | Contents |
| --- | --- | --- | --- |
| `chunk-ryyp81k6.js` | `99f4d0b9ac75f3a98980830e40e536f688612aab35613e762dc8e9dd33d59d82` | whole module, 11 524 bytes | the loop-file runtime |
| ↳ | | `p`/`y` [5318,5448), `c` [5448,5547), `L` [5547,5664), `s` [5735,6289) | the bundled preambles, the persistent gate, the getter, the push sentence |
| ↳ | | `P` [6289,6586), `d` [6586,7232), `N` [7232,7759) | the cron tick, the shared delay paragraph, the dynamic tick |
| ↳ | | `_` [7759,7797), `A` [7797,8890), `w`/`D`/`l` [7994,8066) | the autonomous test and resolver, the sentinel literals |
| ↳ | | `q` [8066,8364), `j` [8364,8890), `B` [8890,9463) | the loop-file ticks and the absent tick |
| ↳ | | `h`/`U` [9463,9647), `S`/`T`/`W` [9647,9774), `b`/`u`/`O`/`g` [9774,10087) | the 25 000 limit and truncation, the path builders, the readers |
| ↳ | | `Y` [10087,10370), `m` [10370,10404), `H`/`z`/`R` [10404,11124), exports [11124,11524) | the file reader, the sentinel test, the resolvers, the export list |
| `chunk-1eegq95r.js` | `b84d67a18c2873ac0f54b882718647305d0c037b20d1b873b5a2d49b9b3db65b` | `y` [17570,22959), `m`/`f`/`L` [7650,7797), `A` [7414,7422), `k`/`v`/`b`/`g`/`w` [7422,7642) | the no-prompt builder, the interval matchers and normaliser, the default interval, the shared helpers |
| `loopAutonomousPreamble-07qcyhv4.md` | `8baa2e53d41f65f6b776661c36a888c26a42ac475d7fb0e14d105eb6e27580f7` | whole file, 4972 bytes | the bundled non-persistent preamble |
| `chunk-3857kmpe.js` | (shared helpers) | `Eqe`/`xCe` line 666, `v0n` [746,…), `k0n` [1398,…) | the autonomous sentinels, the visible-update and stopped-outcome sentences |
| `chunk-appb2dtz.js` | (main frame) | `C` [18304,18490), fire [18100,…) | the job-list display transform and the `resolveLoopDefaultFire` call site |
| `chunk-bws04yaw.js` | (main frame) | `CronListTool.create` | the tool returns `prompt: e.prompt` untransformed |
| `chunk-pf51eqsx.js` | `1c01c90992f57a5e1ff3da2a0234ed6497940f05cb63387e2f7e9625670f36fc` | `Mbr` [1543,…) | the storage V5 backend factory, `{if(!j())return;return}` |
| `chunk-nv1qvpv3.js` | `cc76859560ae90503a2b351be2a492feace861d72429698f0c7bbab4ac5ec14b` | `Fe.state` [3109,…) | the `{namespace:"state", id:"loop-file"}` scope |

Coordinates are zero-based UTF-16 offsets, and every range above was read from the bundle.

## Port

- `src/loop-file.ts` (new) is the runtime: the four sentinel literals, `isLoopFileSentinel`,
  `isAutonomousLoopSentinel`, `isLoopDefaultSentinel`, `truncateLoopFile` (`U`), the project-then-user
  path pair (`S`/`T`), `readLoopFile` (`W`) with the recovered `ENOENT`/`EACCES`/`EPERM`/`ENOTDIR`/
  `ELOOP`/`ENAMETOOLONG`/`EROFS`/`EISDIR` tolerance and the empty-file rule (`O`/`g`), the four tick
  texts (`P`/`N`/`q`/`j`/`B`), the shared delay paragraph (`d`), `resolveLoopDefaultFire` (`A`/`R`/`we`)
  over a `LoopDeliveryState`, `getAutonomousLoopPreamble` (`L`), and `loopJobDisplayPrompt` (`C`)
  with `displayCronJobs` over the `cron_list` payload.
- `src/loop-autonomous-preamble.ts` (new) inlines `loopAutonomousPreamble-07qcyhv4.md`; the built
  asset is reproduced byte for byte (4972 bytes, sha256 `8baa2e53…`, verified against the extracted
  file in this session).
- `src/loop-command.ts` gains `loopAutonomousInterval` (the recovered `m`/`f`/`L` branch selector)
  and `loopAutonomousPrompt` (`y`) for both the dynamic and the fixed-interval form, and hoists the
  shared `rearmUpdate` sentence that `R` and `y` both use.
- `src/interactive.ts`: `/loop` splits on `loopAutonomousInterval` — null keeps `R`, otherwise the
  loop file is read and `loopAutonomousPrompt` builds the turn. The `/cron` output runs through
  `displayCronJobs`.
- `src/runtime.ts`: `drainEvents` resolves a scheduled loop sentinel into its tick before the event
  reaches the turn, holding the delivery state on the owner's resources. That is the recovered
  `Hc.resolveLoopDefaultFireAsync(e.autonomousLoopPreamble, Se, gt)` at `chunk-rx2nah4x.js` [562724).

## Adaptations and what stays out

- **Native storage V5 is unavailable, and the recovered code agrees.** `Y(e)` reads the project file,
  then asks the handle `e.read([Fe.state("loop-file")])`, then falls back to a direct read of the
  user file — `if(!e)return u(o)`. The bundled factory is the stub
  `function Mbr(){if(!j())return;return}` behind the `CLAUDE_CODE_HOVER_REST` gate, so the handle is
  undefined in this build and the fallback is the live path. The port keeps the two direct reads and
  drops the middle step; the reported `path` stays the user file, as the recovered `g(o, …)` does.
- **Roots.** The recovered project root is `<projectDir>/.claude/loop.md` and the user root is
  `<configHome>/loop.md`. This host's equivalents are `<workspace>/.harness/loop.md` and
  `<userDir>/loop.md` (`HARNESS_DIR`, `defaultUserDir`), matching `src/diff-panel.ts:47` and the
  rest of the harness layout. The product name is not carried into a path.
- **Sync, not async.** The recovered module exports both `we` (sync) and `ke` (async); the async one
  differs only in awaiting the backend read. With no backend to await, the port keeps the sync
  resolver and calls it from the synchronous `drainEvents`. The recovered catch that skips a fire on
  an expansion failure has no local counterpart because a local read cannot fail that way: a missing
  or unreadable file is already `null`.
- **Fixed local gates.** `PCe()` (push notification) and `zI()` (brief mode) are false, so the push
  sentence `s()` is empty in every tick and the update sentences take their plain-text form; `r$()`
  (per-model pre-arm) is false, so `d()` takes its post-arm branch; `c()` (persistent loop) is false,
  so `loopAutonomousPreamblePersistent-3zqtkrvg.md` stays out. `dre()` is false in the recovered
  build, but this host's monitor does take a deadline, so `v()`/`k()`/`C0n` keep the deadline
  reading W210 already used — `timeout_ms: 1800000` and `30 minutes`.
- **Telemetry and host effects dropped.** `I()`/`logAutonomousLoopActivation`, the `A1r()` call in
  the `/loop` dispatch, and the `aJe` cloud/PR-steward block are not ported.
- **The display transform is display-only.** The recovered `C` is applied at a job-store write; the
  recovered `CronListTool` returns `prompt: e.prompt` untouched. The port therefore maps the prompt
  only on the `/cron` print path, so the model still sees the literal sentinel the loop instructions
  tell it to re-arm with.
- **Not ported:** the durable `.harness/scheduled_tasks.json` persistence, the storage-V5 scopes for
  transcripts, memory, plugins, themes and the rest of the `Fe` vocabulary, and the cloud/remote
  session paths the scouting report marked remote-only.

## Verification

- `test/loop-file.test.ts` (new, 10 tests): the branch selector over the empty input, a bare
  interval, both `every` forms and four inputs that carry a prompt; the sentinel predicates and the
  `/loop` display labels; the cron-list transform and its pass-through; the truncation at the limit;
  the project-over-user resolution with an empty project file falling through; the autonomous
  preamble-once behaviour; the loop-file inline, repeat and re-inline after an edit; the absent tick
  and its own preamble; a non-sentinel prompt passed through; and the `y` text for the dynamic
  loop-file, fixed loop-file and fixed autonomous forms.
- `test/runtime-events.test.ts` (1 new test): with an injected clock, three cron jobs — the
  autonomous sentinel, a loop-file sentinel and a plain prompt — fire in creation order; the first
  autonomous delivery carries the preamble, the loop-file job inlines `<workspace>/.harness/loop.md`
  on its own first delivery, the shared delivery state makes the next autonomous tick the short
  form, and a third fire repeats both short ticks.
- Full suite 2770/2770 (118 suites), `npm run check` and `npm run build` clean.
- Compiled probe `.audit/w208-loop-file.mjs` passes 13 checks: `/loop` with no file produces the
  dynamic autonomous default with the inlined preamble and the `<<autonomous-loop-dynamic>>`
  sentinel; `/loop 5m` produces the fixed default with `<<autonomous-loop>>` and the typed interval;
  with a `.harness/loop.md` present the same form produces the tasks branch naming and inlining the
  file and pointing the wakeup at `<<loop.md-dynamic>>`; and `/cron` shows the scheduled loop job as
  `"/loop (loop.md)"` while the plain job keeps its prompt.
