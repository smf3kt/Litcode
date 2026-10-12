# W16 - a memory that disagrees with an instruction file reaches one of three verdicts

## Recovered surface

`chunk-kxgzv2t8.js`, sha256
`b2055cc237853b1b23905a53b3996dcc372bc9a5bc74fc2a5061f79efe620d78`, 14608 bytes, read as
inert data. Coordinates are zero-based UTF-16, left-closed/end-exclusive over the decoded
module text.

| Symbol | Range | What it is |
| --- | --- | --- |
| `de=\`### Reconcile memories against CLAUDE.md…\`` | [3137, 4291) | the reconcile procedure, as prompt text |
| `function Q(e,r,o,y=!1,p=!1,s=!1)` | [4291, 7650) | the dream prompt, which quotes the procedure above |
| `function ee(e,r)` | [7325, 7650) | registers the dream as a task |
| `ce=600000` | [8354, 8364) | the scan throttle |
| `function fe()` | [8435, 8719) | the gates: 24 hours and 5 sessions, from a config flag with those defaults |
| `function xFo(e)` | [8845, 13741) | the runner: read the last-consolidated stamp, list touched sessions, check the write permission rule, take a lock, run a forked subagent, settle |
| `items_unreadable` | [10531, 10547) | the memory-item state that skips a run |
| `record_newer` | [10777, 10789) | the memory-item state that skips a run |
| `Tool constraints for this run:` | [11275, 11304) | read-only shell plus deleting `.md` files inside the memory directory |

## Ported invariant

A memory that captures feedback or a project convention can describe a different procedure
than the project's instruction files for the same task, and the disagreement is decided
rather than left implicit: the memory is stale and is deleted or rewritten, the instruction
file may be stale and the memory is annotated `contradicts CLAUDE.md - verify which is
current` and surfaced to the user, or there is no conflict and the memory stays.

Classification: copy of the reconcile procedure onto the memory-maintenance instructions this runtime already ships, with every rewrite listed above. Both the judgment (which side is stale, annotate rather than silently resolve) and the annotation literal are carried; the unattended run the procedure was written for is not, so the text lands in the conversation where maintenance already happens. The recovered module's remaining three exports and its gates, lock, forked subagent and settle are runner machinery for a surface this runtime does not have.

## What the local runtime had

`AUTO_MEMORY_INSTRUCTIONS` (`src/auto-memory.ts:15`, appended to the system prompt by
`src/agent.ts:88` when auto-memory is on and both read tools exist) already asked for
in-conversation memory maintenance, merge-on-write, an `expected_sha256` conflict path, a
delete-only-when-superseded rule, an untrusted-data rule and the precedence sentence
"Current user instructions take precedence over remembered preferences". What it did not
have was any procedure for *what to do* when a memory and an instruction file disagree:
the precedence sentence names a winner for directives, not a reconciliation for a stale
procedure.

## What landed

| File | Change |
| --- | --- |
| `src/auto-memory.ts` | `MEMORY_CONTRADICTION_ANNOTATION` and the reconcile paragraph |
| `test/auto-memory.test.ts` | one case asserting the three verdicts, the literal, the no-edit rule and the surviving pre-existing rules |

## Owned decisions

- **The rule lands on the maintenance instructions rather than a background pass.** The
  recovered procedure is the prompt for an unattended consolidation run; this runtime has
  none, so the text lands where maintenance already happens - the current conversation -
  and the instruction-file set is named as the two files this runtime loads.
- **The annotation is a constant quoted into the text.** It is exported as
  `MEMORY_CONTRADICTION_ANNOTATION` and interpolated, so the literal a person will grep for
  and the text the model reads cannot drift apart.
- **ASCII only.** The recovered annotation uses an em dash; every file in this project is
  ASCII, so the annotation is written with a hyphen. The wording is otherwise unchanged.
- **"Do not edit CLAUDE.md during a dream" becomes conditional on the user.** The recovered
  rule is absolute because the pass is unattended. Here maintenance happens in a
  conversation where editing an instruction file can be exactly what the user asked for, so
  the rule is scoped to maintenance the user did not request, and the may-be-stale case tells
  the user instead.
- **"List it in your summary" becomes "tell the user in your reply".** There is no summary
  artifact here; the in-conversation equivalent is saying it.
- **"Where tagged" is kept.** The local store has no type field - types live in the memory
  body's metadata - so the qualifier makes the rule apply only where a type is present, as
  the recovered text does.

## Not ported

- The whole dream runner: the hour and session gates, the 600-second scan throttle, the
  consolidation lock, the forked subagent with its read-only tool list, the write-permission
  pre-check, the settle and capped-write reconciliation, the task registration and the
  completion notice. This runtime has no scheduled or background agent run and no task
  registry entry to hang one on, so porting the runner would mean building that surface
  first rather than landing a rule on one that exists.
- The two memory-item skip states, `items_unreadable` and `record_newer`, as *runner* states:
  both are already covered here in a different spelling on the write path - an unreadable
  entry raises `memory: entry contains invalid UTF-8` and a record that moved raises
  `memory: SHA-256 conflict; read the current document before updating` (`src/memory.ts:103`,
  `:321`) - so no rule was missing.
- The read-only shell constraint list, which exists to bound the forked run.

## Verification

- `npm test` - 1110 pass, 0 fail. `test/auto-memory.test.ts` holds 3 cases; the new one
  asserts the three verdict phrases, the annotation literal inside the instructions, the
  conditional no-edit rule, the recency note, the two instruction files, and that the
  pre-existing rules (`expected_sha256`, untrusted-data, precedence, no separate extraction
  call) all still hold after the addition.
- `npx tsc --noEmit` clean; `npm run build` exit 0; `npm run smoke:package` passed, 69 files,
  0 upstream requests.
- No CLI driver was added: the deliverable is the instruction text that reaches the model,
  and the case asserts the text itself plus the constant it quotes.

Regressions: none. The paragraph is appended; no existing line of the instructions changed.
