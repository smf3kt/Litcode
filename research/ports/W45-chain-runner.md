# W45 plugin chain runner and composer edit relay

Updated: 2026-10-15. Status: **locally verified, feature Partial**. Slices 1 through 4 and the
memoize dependency are implemented and locally verified. The hooks-module runtime and installer
remain the next package. Initial observations are retained in `W45-chain-runner-copies.json`;
the latest validation and content identity are in [memoize evidence](W45-chain-memoize-evidence.json).

## Scope

The recovered CLI runs every extension point through one chain runner: `ga(name, ctx)(input)`
resolves the chain's core plus the handlers installed for that event, composes them newest-first,
and runs the result under a budget, an abort signal and a floors/run trail. `prompt.edit` is one
chain name among many (`prompt.autocomplete`, `prompt.compose`, `prompt.submit`, `prompt.mention`,
`prompt.fill`, `prompt.section`, `prompt.context`, `prompt.attachment`, `command.run`,
`command.describe`, `config.set`, `config.describe`, `agent.spawn`, `agent.offer`, `tool.check`,
`session.append`, `attribution.text`, `telemetry.log`), and the composer edit relay
(`YHo` inside `cue`) is its live consumer: the composer records cursor/text changes, raises
`prompt.edit` through the chain, rebases whatever comes back onto the draft, commits the box, and
repaints only when the draft still matches.

The queue recorded this as `editRelay` ("实际 YHo/cue→prompt.edit 模块链已定位，当前缺具体
loadedModule handler 注册/执行预算/取消后端"). This package opens the runner first because the relay
is a thin consumer of it, and the product has none of the runner surface today (no `isCore` /
`budgetMs` / tier / floors anywhere in `src/`).

## What was read (source semantics, before any edit)

- **`ga` chain entry** — `chunk-sfn1dbxq.js` [3071816,3072765) 949 units. Resolves the respawn hop
  (`iOn`) first and re-enters itself once pending hooks-respawns settle; builds the chain payload
  through `tht[e](input)`; collects handlers with `P0` (or `Kdn` under managed mode) around the core
  from `yyt()[e]` or the call site's `core[e]`; merges managed handlers (`Zoe`); rejects with
  `$.<name>: no core at the bottom of the chain …` when neither the site nor the call installed one;
  filters pinned handlers with `jDe`; runs `aP` and, for the names in `_yt`, post-processes the
  answer through `TDe`.
- **`aP` chain executor** — `chunk-nyce03br.js` [121149,121896) 747 units. Normalises handlers
  (`fx`), builds the trail root (`mg`), the run/floors pair (`Gt`), linked abort controllers
  (`fp(signal, internal)`) so either side can cancel; folds the handler list with `reduceRight` into
  nested stages (`dx`) whose last stage carries `nothingBelow` and, when the engine answers, the
  `answersForEngine` flag; default budget is `site.budgetMs ?? pp.get()?.ms ?? kSe` (10 000 ms);
  on failure it logs `hooks chain failed: …` unless the rejection is an abort (`eRe`), and it always
  detaches the linked controllers in `finally`.
- **composer edit relay** — `chunk-6ejn7q9s.js` [121977,122681) 704 units. Microtask-batched
  (`later ?? queueMicrotask`) with one in-flight raise at a time; a batch collapses to
  `{before: first.before, after: last.after}` (`er`); the raise result is rebased onto the current
  draft (`or` → `yBe`/`nr`, or a `reason` when the rewrite no longer fits); the host then either
  commits the box (`e.commit`) or reports that the person's typing stands; `paint` runs only when
  the draft still equals the raised text; `dispose` clears the queue and aborts.
- **`cue` gate** — `chunk-24k7d6mw.js` [797251,797511) 260 units. Hooks the relay only while the
  `prompt.edit` module is loaded (`Jl("prompt.edit")`), logging "hooked; the composer relays its
  edits to the chain" or "unhooked; the composer relays nothing", and disposes on unmount.
- **Consumers of `prompt.edit`** — `XOr` (default raise, `chunk-6ejn7q9s.js` [120776,120880) 104
  units) calls `ga("prompt.edit", {signal, core: {"prompt.edit": Qo(r, e.after)}})(r)`; `Qo`
  ([120250,120591) 341 units) is the core entry (`{name:"core", isCore:!0, budgetMs:0, run}`) that
  returns the raised payload when the draft still matches, otherwise the current composer state.

## Source map

Full record list with ranges and body digests: `W45-chain-runner-copies.json` → `observations`
(31 entries, 7 modules). Modules and digests:

| module | sha256 (module bytes) | carries |
| --- | --- | --- |
| chunk-sfn1dbxq.js | `4c74137e…` | `ga`, chain table (`Syt`/`tht`/`yyt`/`_yt`), site registry (`$be`), merge (`Kdn`), managed gate (`Zoe`) |
| chunk-nyce03br.js | `6a5164eb…` | executor (`aP`), stage (`dx`), normalisation (`fx`), trail (`mg`/`jo`), run+floors (`Gt`), abort link (`fp`), budget (`kSe`/`pp`), origin (`CFe`) |
| chunk-2kdsvp3x.js | — | respawn hop (`iOn`), handler collection (`P0`/`jDe`), origin descriptor (`aJ`) |
| chunk-6ejn7q9s.js | — | composer relay (`YHo`), `prompt.edit` core (`Qo`) and default raise (`XOr`) |
| chunk-24k7d6mw.js | `1d064454…` | relay gate (`cue`) |
| chunk-n3ykh62m.js | `2a0e605d…` | engine-answer post-processing (`TDe`) |
| chunk-kd3dbbtb.js | — | `HooksError` |

Correction to the earlier W44 note: `ga[3071816,3072765)` was attributed to `chunk-nyce03br.js`;
the body is in `chunk-sfn1dbxq.js`. The executor in `chunk-nyce03br.js` is `aP`, not `ga`.

## Slices

1. **W45-1 chain entry and executor** — *landed*: `ga`, the chain table, the site registry,
   `Kdn`/`Zoe`, and `aP` with its helper bodies; `prompt.edit` wired as the only chain name, with an
   owned core handler. Fixture: core runs once, handler order and tiers, `budgetMs` cut, `cutAt`,
   abort-signal propagation and detach, floors/run readback, and the missing-core rejection text.
2. **W45-2 hops and handler collection** — *landed*: `iOn`, `P0`/`jDe`, `aJ`; pending/respawn
   behaviour and origin/tier descriptors verified, and every host port whose source body was
   obtainable replaced by the real body.
3. **W45-3 composer edit relay** — *landed*: `YHo` + `cue` + `Qo`/`XOr` on top of slice 1 — record,
   batch, raise, rebase, commit, dispose — wired to the product composer; verified that a raising
   handler lands in the draft, that a no-longer-fitting rewrite reports the recorded reason and keeps
   the person's typing, and that an unloaded `prompt.edit` relays nothing.
4. **W45-4 the event catalog and the declared-pattern hook surface** — *landed*: the source's own
   roster and the predicates over it, the real `mlt`/`kyt`, `wGt`/`bGt`/`w3`, and `iWt`'s checkable
   half as the install check. The seeded supported-name set is gone, so the copied `Syt` is the
   source's own.
5. **W45-5 the hooks-module installer** — reconned while slice 4 landed: `tGe` is not a slice but a
   package of its own, because the same-thread environment host it loads through is the hooks
   runtime (`vJt`/`Ygo`/`aZo`/`Ed`/`TJt`/`fas`) with the worker host (`l6o`/`dIo`/`IN`) beside it.
   Recorded as the successor package; not started, and not blocking anything slice 4 landed.

Each slice re-reads its bodies end to end before copying (S-7); this record maps them but does not
claim a line-by-line reading of `dx` (3 143 units) or `tht` (919 units) yet.

## Not claimed

The runner is wired for one chain name. Product hooks keep their existing native implementation; the
hooks-module loader that would install a plugin's hook definitions as chain modules is its own
package, so in a real session nothing is hooked yet. Native/mux/live hooks-respawn behaviour, the
managed-mode provider (`Zoe`)'s remote catalogs and the daemon-side producers remain outside this
preflight.

## Slice 1 landed — chain entry, executor and the prompt.edit wiring (2026-10-15)

Status: **landed and verified**. 76 source blocks (28 668 units, 12 modules) are copied verbatim into
the product with a per-block provenance header; the runner is wired for one chain name and its
fixture passes.

### Files

| file | role |
| --- | --- |
| `src/plugin-chain-source.ts` | the copied bodies: hooks error layer, event pattern layer, tier model, decoration and style tables, the executor region `chunk-nyce03br.js [111504,128400)`, `ga` with its tables (`tht`/`_yt`/`Syt`), `Kdn`/`Zoe`, `iOn`/`P0`/`jDe`/`aJ`/`M5t`, and the `prompt.edit` site `qi` with `Mm`/`cze` |
| `src/plugin-chain-host.ts` | the 25 bindings the copied bodies name but do not declare: verbatim copies (pattern layer, `MFs`, `glt`, tier tables) and owned ports, each with its reason |
| `src/plugin-chain-types.ts` | the shapes the host and the product wiring use (handler, site, module, call handle, trail entry, call context) |
| `src/plugin-chain-registry.ts` | the product's chain catalog: installs `He` as the shared hooks error and wires `prompt.edit` = `Mm('prompt.edit', cze)` with site `qi` |
| `test/plugin-chain.test.ts` | the fixture: 7 cases |
| `scripts/copy-module-regions.mjs`, `scripts/source-copy-scan.mjs` | the copier: regex-literal-aware, depth-0 needle location, per-block digest; plan in `research/ports/W45-chain-runner-blocks.plan.json`, ledger in `research/ports/W45-chain-runner-blocks.json` |

Regenerating: `node scripts/copy-module-regions.mjs research/ports/W45-chain-runner-blocks.plan.json extracted-v2/modules/ src/plugin-chain-source.ts`

### Adaptations (each with its reason)

- **No renames.** Every copied body keeps the source's own identifiers, so a reader can diff a block
  against its module range directly. The only structural change is the import line at the top.
- **The event pattern layer lives in the host**, not the source file: `chunk-nyce03br.js` declares both
  `function co/uo/Wde` (pattern) and `var uo=32000` (log text ceiling), and one file cannot declare
  `uo` twice. The host carries `fo`/`zt`/`co`/`uo`/`Wde` verbatim.
- **`glt(tier)`** is `ry.indexOf(tier)` and `ry` was not located. The host's order
  (`prepend, user, append, builtin, core`) is the one the source's own continuations imply:
  `aIt('prepend')` continues at append/builtin/core and `aIt('append')` at core only, so a
  `next.to('core')` from a prepend hook skips exactly user, append and builtin — which the fixture asserts.
- **`au`** extends the vendor API error class in the source; the host's port is an `Error` named
  `AbortError`, which is what `Ke` tests for anyway.
- **`kn(name)`** is `r(name)`, a redaction from an unported chunk; the host keeps the caller's shape
  gate (`lh`) and returns the name unchanged.
- **`rQt = new Set(PFs)`** is copied through the product's own border module: `src/tui-border.ts`
  carries the same table and now exports `PFs`.
- **`` was left out** of the copied region: it is a call-site convenience over
  `zd[classic.PreToolUse]`, not part of the runner, and the product has no such site yet.
- **Registries are ports.** `zd`/`` (sites), `yyt` (cores), `mlt`/`kyt` (the supported-name
  predicate and exclusions), `it()` (loaded modules and pending respawns), `rt`/`Z`/`nt`/`kro`/`Ee`
  (handler collection), `Aro`/`st`/`t`/`Ka`/`pwr` (hooks respawn), `UVn`/`nre`/`TDe` are owned by
  the product and documented in the host. Their source bodies belong to slice 2 (`iOn`/`P0`/`jDe`) and
  are shape-faithful until then; the fixture and every call in this slice pass `withoutModuleHandlers`,
  which is the source's own way to run a chain with no module handlers at all.
- **`SUPPORTED` is seeded in the host** because the copied `Syt` is computed while the source module is
  evaluated: names cannot be added after that point.

### Fixture

`test/plugin-chain.test.ts`, 7 cases, all passing:

1. handlers run in install order above the core, each keeps its own tag, the trail reads back
   `[0 first user returned, 1 second user returned, 2 engine core returned]` and frozen;
2. `next.to('core')` from a prepend handler skips the user tier — the skipped handler never runs, its
   trail entry records `skipped` / `bypassed by skipper` / `ms: 0`, and the bypass is logged;
3. a handler with `budgetMs: 10` that sleeps 60 ms is skipped, the answer comes from below, and the hook
   failure records `{kind: 'budget', why: 'ran past its 10ms budget'}` with effect
   `skipped; what is below it ran in its place`;
4. aborting the call rejects and no `hooks chain failed` line is logged (the copied `eRe` classifier);
5. a name with no core rejects with the source's own text
   `$.session.end: no core at the bottom of the chain (the site did not install one and the call supplied none)`;
6. the copied pieces keep their contracts: `Wde` accepts `<name>`, `<prefix>.*`, `*` and `!` negation and
   rejects `!*`; `ze` describes an error by kind and character count (`CustomFailure`, `unknown`);
   `jo` returns the frozen empty trail for a run with no entries;
7. `prompt.edit` is wired to the copied site and core (`event`, `budgetMs: 50`, `name: 'core'`,
   `isCore: true`, `budgetMs: 0`).

### Checks

- `npm run check` (tsc `--noEmit`) passed; `npm run build` passed; `npm run notices:check` unchanged
  (the four pre-existing missing notice texts).
- Full suite `1243` tests, `1242` passed, `1` failed — the pre-existing `source plugin theme catalog`
  failure in `src/plugins.ts` (`Missing, symlink, or invalid plugin directory: /var`), untouched here.
- Regenerating the source file from the plan reproduces it byte for byte (blocks/digests in
  `research/ports/W45-chain-runner-blocks.json`).

### Not claimed / next

- Nothing dispatches through the runner yet: no product hook calls `ga`, and the composer relay
  (`YHo`/`cue`/`Qo`/`XOr`) is not ported. Slice 3 wires it on top of this.
- Module handler collection (`rt`/`Z`/`nt`/`kro`/`Ee`, handler records, pinned seats), the hooks
  respawn hop (`Aro`/`st`/`t`/`Ka`/`pwr`) and the engine-answer post-processing (`TDe`/`tIt`) are
  host ports in this slice; slice 2 ports their bodies.
- `glt`'s exact order, `kn`'s redaction, the managed-mode provider (`pp`/`owr`'s holder is never set
  in this product, so `sIt()` is false and managed handlers are not consulted) remain as recorded.

## Slice 2 map — module handler collection, the respawn hop and the answer tail (reconnaissance, 2026-10-15)

Located while closing slice 1; every range is a zero-based UTF-16 `[start,end)` extent produced by
`scripts/source-copy-scan.mjs` (`extractFn` from the declaration keyword, so the leading `;`/`}` of the
preceding statement is not included).

### chunk-2kdsvp3x.js (sha256 2005e8ff7e9534510b3d7f687d6a190f21c5930f1d8e5397070e2fa018bf52d2)

| symbol | range | units | what the body is |
| --- | --- | --- | --- |
| `Z` | [27789,29001) | 1212 | builds a module's handler record for one event: matcher, seats, `hopKey`, `link`, `name`, `matcherFor` |
| `xe` | [29645,29727) | 82 | picks the record for a name out of a record list (`findIndex` on `Apr`) |
| `rt` | [36977,37034) | 57 | loaded record → handler: a linked record goes through `$o`, otherwise `tt` |
| `Ee` | [37034,37144) | 110 | plugin name of a record, resolved against `it().moduleSeats` |
| `kro` | [37182,37411) | 229 | the `from`/`e` seat filter over a record (used by `jDe`'s `slice`) |
| `nt` | [37411,37704) | 293 | the pinned/keys filter (used by `jDe`'s `pinned` argument) |
| `st` | [37996,38339) | 343 | the respawn message: names of handlers that must be re-collected (`xe(jDe(...))` + `hopKey.isDeclared` + `le`) |
| `Aro` | 38516 | arrow | `()=>L5t.getStore()?.isOver===!1` — the respawn guard is an arrow `var`, not a declaration |

### Imported by that module

| symbol | from | note |
| --- | --- | --- |
| `Ka` | chunk-yjc18bey.js, declaration at 2053 | `async function Ka(t,r,e)` — races the promise against the abort signal and throws `e()`'s value; the host port in slice 1 already has this shape (owner `o` added first, listener removed) but not this body |
| `pwr` | chunk-nyce03br.js, 158105 | reads `reason` off the signal/abort value |
| `CFe` | chunk-nyce03br.js, 111519 | **already inside the copied chain region** [111504,128400) — the frozen empty origin descriptor `{plugin:a8,tier:'core'}`; both occurrences in `src/plugin-chain-source.ts` |
| `t` | chunk-gyf58rwf.js | the respawn log call; the declaration there is not a top-level `function t(`, so its extent still has to be resolved inside that module's scope |
| `L5t` | — | the async-context store `Aro` reads; not yet located |

### Still open for slice 2

- `tt`/`$o` (the two branches of `rt`), `le` and `Apr` (used by `st`/`xe`), the record's `matcherFor` and
  `hopKey` (built by `Z`), `it().moduleSeats` and the seat table it reads.
- The engine-answer tail: `TDe(answer)`, whose source is the `tIt` post-processor over the four names in
  `_yt` (chunk-n3ykh62m.js), and `nre` for the `telemetry.log` payload.
- Whether `Ka` should be carried as a copy (its module `chunk-yjc18bey.js` has no other copied body yet)
  or adapted on top of the host's existing abort-aware promise helper.

### Slice 2 closure (resolved, 2026-10-15)

Every range below is zero-based UTF-16 `[start,end)` from `scripts/source-copy-scan.mjs`. `src:Y` means the
body (or a same-named one) is already declared in `src/plugin-chain-source.ts` from slice 1.

`chunk-2kdsvp3x.js` (sha256 2005e8ff7e9534510b3d7f687d6a190f21c5930f1d8e5397070e2fa018bf52d2):

| symbol | kind | range | units | src | notes |
| --- | --- | --- | --- | --- | --- |
| `se` | function | [27458,27621) | 163 | - | origin chain → `'every'` or the sorted registrations |
| `Gt` | function | [27621,27720) | 99 | Y | run/floor pair |
| `oOn` | var | [27720,27748) | 28 | - | `po(()=>new WeakMap)` seat store |
| `Cpr` | var | [27748,27789) | 41 | - | tier chain of an origin list |
| `Z` | function | [27789,29001) | 1212 | - | re-entry wrapper: lent/held seats, `leftOut`/`told`/`causes`, `hooks`/`catches`/`matcherFor` |
| `q` | function | [29248,29490) | 242 | Y | seat bookkeeping |
| `Apr` | function | [29490,29645) | 155 | - | seat gate; worker hops use `aUn` |
| `xe` | function | [29645,29727) | 82 | - | record for a name, from the first seat on |
| `le` | function | [29727,29904) | 177 | - | `.catch` question for pinned keys |
| `Rpr` | function | [33824,34569) | 745 | - | the non-native record runner `tt` builds |
| `we` | function | [34569,34712) | 143 | Y | leave/measure |
| `be` | function | [34712,34872) | 160 | Y | ``'s re-entry question |
| `$o` | function | [34872,35397) | 525 | Y* | linked (native) record → handler; **name collides** with the slice-1 failure-record `` |
| `tt` | var | [36530,36977) | 447 | - | plain loaded record → handler |
| `rt` | function | [36977,37034) | 57 | - | `link`ed ? `` : `tt` |
| `Ee` | function | [37034,37144) | 110 | - | plugin name, seat table fallback `'user'` |
| `kro` | function | [37182,37411) | 229 | - | `from`/`e` seat filter |
| `nt` | function | [37411,37704) | 293 | - | pinned-keys filter |
| `st` | function | [37996,38339) | 343 | - | the `refused: the hooks worker is being replaced…` message |
| `L5t` | var | [38388,38403) | 15 | - | `new Zo` async-context store |
| `Aro` | var | [38517,38557) | 40 | - | `()=>L5t.getStore()?.isOver===!1` |

`chunk-ed7zyzrn.js` (the module slice 1 already takes one block from):

| symbol | kind | range | units | notes |
| --- | --- | --- | --- | --- |
| `iRe` | function | [2334,2418) | 84 | the matcher context `kro`/`Apr`/`nt`/`le` pass |
| `$A` | function | [2456,2577) | 121 | plain-object gate (already copied in slice 1) |
| `aUn` | var | [8279,8325) | 46 | worker-hop matcher |
| `lUn` | var | [8440,8524) | 84 | pinned-keys matcher |
| `Slt` | var | [8712,8754) | 42 | ordinary matcher |

Imported by `chunk-2kdsvp3x.js` and still to place: `Xgo` and `Ooe` from `chunk-nyce03br.js`,
`po` from `chunk-ae84tp6z.js`, `Zo` (the `L5t` store class) unresolved, and the logger
`t` from `chunk-gyf58rwf.js` `function t(e,n={level:debug})` at 59393 — **its default level is
`debug`, not the `info` the slice-1 host port used**, so slice 2 must carry the real body and drop that port.

Two placement constraints for slice 2: (1) the second `$o` collides with the slice-1 name and must be
renamed with the reason recorded, exactly as `uo` was; (2) `it()` must grow `moduleSeats` (a `Map` the
product fills as modules are installed) before `Ee` and `Z` can run a real seat.

## Slice 2 landed — module handler collection, the entry module and the answer tail (2026-10-15)

The whole closure above is carried. 157 copied blocks / 42252 units across four generated files, plus
eight bodies carried in the host. Every block records its module digest, its zero-based UTF-16
`[start,end)` range and the sha256 of that range's own bytes; the per-block records are in
`research/ports/W45-chain-records-evidence.json` and the four ledgers beside it.

### Files

| file | source module | blocks | units | ledger |
| --- | --- | --- | --- | --- |
| `src/plugin-chain-source.ts` | chunk-nyce03br chain region + 10 more | 72 | 26028 | `W45-chain-source-blocks.json` |
| `src/plugin-chain-matchers.ts` | chunk-ed7zyzrn (+ `Dy` from chunk-bk5ct2gw) | 23 | 3115 | `W45-chain-matchers-blocks.json` |
| `src/plugin-chain-records.ts` | chunk-2kdsvp3x | 52 | 10472 | `W45-chain-records-blocks.json` |
| `src/plugin-chain-entry.ts` | chunk-sfn1dbxq | 10 | 2637 | `W45-chain-entry-blocks.json` |
| `src/plugin-chain-host.ts` | eight bodies + the owned ports | — | 504 | in-file range comments |
| `src/plugin-chain-module-record.ts` | the hooks-worker seam | — | — | hand-written, documented |

One generated file per source module scope, because these chunks reuse minified names: `uo` is both
the 32000-unit log ceiling and the pattern parser, `$o` is both the failure-record maker and a linked
record, and `Gt`, `se`, `Ye`, `We`, `Se` are each declared in two of the scopes. `plugin-chain-source.ts`
therefore declares only its own scope and no two files collide. `scripts/source-undeclared-scan.mjs`
reports 0 unresolved identifiers in all four.

Regeneration is byte-identical for all four files and their ledgers:

```
node scripts/copy-module-regions.mjs research/ports/W45-chain-runner-blocks.plan.json  extracted-v2/modules/ src/plugin-chain-source.ts
node scripts/copy-module-regions.mjs research/ports/W45-chain-matchers-blocks.plan.json extracted-v2/modules/ src/plugin-chain-matchers.ts
node scripts/copy-module-regions.mjs research/ports/W45-chain-records-blocks.plan.json  extracted-v2/modules/ src/plugin-chain-records.ts
node scripts/copy-module-regions.mjs research/ports/W45-chain-entry-blocks.plan.json    extracted-v2/modules/ src/plugin-chain-entry.ts
```

### Adaptations (each with its reason)

1. **Host-carried bodies** keep the source text with the host's TypeScript annotations and the
   product's quote style, because that file is type-checked; identifiers, literals, operator order and
   calls are unchanged and the recorded digest is the module range's own bytes. This is the six
   pattern-layer bodies, the log line `t` and the border table `rQt` (through the product's `PFs`).
2. **Ports replaced by real bodies.** `Ka` (chunk-yjc18bey `[2047,2313)`) and `pwr`
   (chunk-nyce03br `[158106,158196)`) were host ports; the copy of `pwr` returns the signal's own
   reason when it is an Error and otherwise throws `new He(wlt(e, "wait aborted"))` — the earlier port
   returned a string, which is not what the source does. `nre` (chunk-sfn1dbxq `[448283,448345)`) was a
   pass-through port and is now `(e) => e.to === "collector" ? e : {...e, to: e.to ?? "anthropic"}`.
   `UVn` was a wrapper over `randomUUID` and is now the source's own import binding
   (`[448245,448270)`). `t` was a hand-written equivalent and is now the source body
   (chunk-gyf58rwf `[59393,59438)`, whole-object default `{level: "debug"}` — the slice-1 port had
   defaulted to `info`, which the reconnaissance note above flagged).
3. **`it()` grew `moduleSeats`.** The source's tier resolver reads a loaded module record's own seat,
   which the source's loader writes while installing a plugin; this product installs modules through
   `installChainModule`, so the same information travels on the same accessor.
4. **The hooks-worker seam.** The copied collection dispatches a module through its hop key, which in
   the source is a `worker` hop answered by the hooks worker. This product has no worker, so
   `src/plugin-chain-module-record.ts` builds the record shape and answers the dispatch in process,
   reusing the copied `us` (tier restriction), `Xt` (budget) and `np`/`ip` (failure reporting) so the
   behaviour comes from source text rather than invention. The handle it hands a handler is callable
   and carries `call`/`to`/`signal`/`event`/`origin`, the way the executor's handle does.
5. **Generator changes** (three, each because a copy needed it): an `async` keyword sitting just before
   a range is now included, so `async function` bodies copy as async; declared-name detection escapes
   the name, so `$o` counts as declared; and it recognises an import binding, so
   `import{randomUUID as UVn}from"crypto"` exports like any other block.
6. **Ports that remain**, each with its reason in the host: `Nl()`/`G()` (the logger singleton's
   instance store is not carried, so both route to this product's record list), `TDe`
   (chunk-n3ykh62m 266967, but its `tIt` is a whole structural copier in an uncarried module, and it is
   reachable only for the four `_yt` names, none of which run here), `a`, `ve`, `sA`/`mU`, `po`, the
   registers `zd`/`$be`/`yyt`/`mlt`/`kyt`, `it()`, `au`/`kn` and `glt`.

### Fixture

`test/plugin-chain.test.ts`, nine tests, all passing:

1. handlers run in install order above the core and the trail reads back frozen;
2. `next.to('core')` from a prepend handler skips the tiers below it (the copied `ps`/`MFs` report the
   bypass and the skipped handler's trailing `next.call(e)` never runs);
3. a handler that overruns its budget is skipped and the answer comes from below;
4. aborting the call rejects without reporting a hook failure;
5. a name with no core rejects with the source's own message;
6. the copied pieces keep their own contracts — `Wde`'s pattern forms, `ze`'s error description, `jo`'s
   frozen empty trail, and now `pwr`'s reason/thrown-hooks-error and `Ka`'s race rejection;
7. `prompt.edit` is wired to the copied site and core;
8. the copied `only` filter decides which modules answer (one module by name, then all of them in
   install order);
9. a module with no tier answers at the user seat.

The fixture drives the real collection path: `ga('prompt.edit', {core})` with modules installed through
`installChainModule`, so `P0`/`jDe` collect records the way they collect a plugin's.

### Checks

- `npm run check`, `npm run build`, `npm run notices:check` all passed.
- Focused fixture 9/9 (197 ms). Related files (`plugin-components`, `plugins`, `runtime`, `agent`,
  `interaction-tools`) 78 tests: 77 passed, 1 failed — the same pre-existing `src/plugins.ts` failure.
- Full suite 1245 tests: 1244 passed, 1 failed — that same pre-existing failure, which is unrelated
  (the test builds its fixture under `os.tmpdir()`, which is `/var/...` on macOS, and the plugin
  directory containment check rejects an ancestor symlink). One earlier full attempt also tripped
  `test/mcp-progress.test.ts:113`, a 90 ms MCP stdio initialize deadline missed under the parallel
  suite; it passes alone (8/8) and in the recorded run, so it is load-sensitive rather than a
  regression.
- Identity after this slice: `83040545bb47…` (inputs `2e3e86e112d9…` 254 files, validation
  `f4978722ef84…` 105, build `c35e4faf5c20…` 183). Two stale generated files left by an early
  generator invocation (`src/plugin-chain-matchers-source.ts` and its ledger, plus
  `src/plugin-chain-records-source.ts`) were deleted; nothing imported them.

### Not claimed / next

- Nothing outside the fixture dispatches through the chain yet, and the composer relay
  (`YHo`/`cue`/`Qo`/`XOr`) with its default raise is slice 3.
- The worker seam is a stand-in: worker-side `next.to` re-dispatch, the worker's own budget reporting
  and the re-entry skip that reads `registrations`/`leftOut` are the product's in-process answers.
- `po`'s memoizer body (`V` with its MapCache class), the logger singleton store, `a`/`ve`, `sA`/`mU`
  and `TDe`/`tIt` stay ports.
- `supportedChains()` is seeded with `prompt.edit` alone: the copied `Syt` list is computed while the
  module is evaluated, so a name must be seeded before the copies load.

## Slice 3 landed — the composer edit relay (2026-10-15)

Status: **landed and verified**. 16 source blocks (3 050 units, two modules) are copied into
`src/plugin-chain-relay-source.ts`, the one body that cannot be copied (`cue`, a React hook) is
carried with its four hook names supplied by a hook host, and the product composer now relays its
edits through `prompt.edit`. Ledger `research/ports/W45-chain-relay-blocks.json`, evidence
`research/ports/W45-chain-relay-evidence.json`.

### Files

| file | role |
| --- | --- |
| `src/plugin-chain-relay-source.ts` | the copied relay: `YHo` (record/batch/raise/commit/paint/dispose), `XOr` with the `Qo` core, `er` (batch merge), `Xo`/`Jo` (key descriptor), `Zo` (record → chain event), `or`/`tr`/`nr`/`yBe`/`Dan` (rebase and span difference), `Wt`, `Yo`, `vLt`, `Jl` (is-any-module-hooked) |
| `src/plugin-chain-relay.ts` | `cue` carried with the host's annotations, the hook host (`y`/`Re`/`P`/`OL`), `composerEditRelay(host)`, `chainHooked(name, args?)`; imports the catalog so the composer surface carries the `prompt.edit` site and core |
| `src/tui.ts` | the composer: the relay built once per terminal, `dispatch(action, sequence?)` records each key-driven edit, `editKey` maps the key, `commit` writes the box back and renders, `report` goes to `setStatus`, `dispose` in `close()` |
| `src/plugin-chain-types.ts` | `ChainRelayEdit` (the source's own shape: `before`, `after`, `key`) and `ChainRelayKey` |
| `test/plugin-chain-relay.test.ts` | the fixture: 10 cases, the last three driving the real `TuiTerminal` |

### Adaptations (each with its reason)

- **`cue` is carried, not copied.** It is a React hook (`y`, `Re`, `P`, `OL`) and this product has no
  React, so its body keeps the host's TypeScript annotations and the four hook names come from the
  host below — the idiom `src/tui-input-undo.ts` already uses for the undo hook. Identifiers,
  literals and calls are the source's, including both dependency arrays and both log lines.
- **The hook host is an owned port.** `y` memoizes (`useMemo`), `Re(store, select)` reads the
  loaded-module inventory (`useSyncExternalStore`), and `P(effect, deps)` is `useEffect` with a commit
  pass: the component body runs, then the effects it declared commit in order, re-running only the
  slots whose dependencies changed. Re-rendering is what keeps the source's decision authoritative —
  installing or removing a module re-runs `cue`'s own effect with `Jl('prompt.edit')` as the selector,
  so the product never decides for itself whether the relay is hooked. The first attempt only re-ran
  the effect body without a re-render; the closure kept the stale selector value, which is exactly the
  bug re-rendering removes.
- **The key descriptor.** `Xo` reads `{key, name, ctrl?, shift?, meta?}` and takes a single printable
  character as `key`. `TuiTerminal.editKey` supplies that: a single printable character is relayed as
  itself, a multi-character insert as `paste` (`tab` for a tab), and any other key by the editor action
  it resolved to — this product's own name for that key. Typing, which is what the chain's argument
  matching sees, is exact.
- **What counts as an edit.** `record` runs only for a key-driven edit that changed the draft, only in
  the chat composer, and only while `isRecording()` is true. A submit clearing the draft, a recalled
  history entry, a restored or stashed draft are not keys the chain has an event for; the source's own
  `er` decides how several records become one hop, and it drops the key when a batch merges them.
- **No `paint`.** `YHo` calls `e.paint?.(M.decorations, M.text)` only when the answer's text equals the
  draft; the copied core `cze` returns `{text, cursor}` and no decorations, and this product's editor
  has no decoration model, so the host supplies no paint host. Nothing reachable here can produce a
  decoration.
- **One import for the catalog.** `src/plugin-chain-relay.ts` imports `./plugin-chain-registry.js` for
  its registration, so the composer surface carries the `prompt.edit` site `qi` and core `cze` it
  raises through instead of depending on the caller to have loaded them.

### Fixture

`test/plugin-chain-relay.test.ts`, 10 cases: a raising handler lands in the draft; a rewrite that no
longer fits reports the recorded reason and keeps the typing; an unloaded `prompt.edit` relays nothing
and logs the source's line; a hook installed later hooks the relay and removing it unhooks again; edits
recorded in one batch raise once; dispose in the same tick drops the batch before it raises; dispose
drops an answer still in flight. The last three drive the real `TuiTerminal` with keystrokes: one key
is relayed under its character and the rewrite lands in `tui.state.text`; a run of typing is one batch
that carries no single key; with nothing hooked the typing stands.

### Checks

- `npm run check`, `npm run build`, `npm run notices:check` all passed.
- All five generated files and their ledgers regenerate byte-identical from their plans; the
  undeclared-identifier scan reports 0 unresolved in each.
- Focused fixture 10/10. Related files (`plugin-chain`, `plugin-components`, `plugins`, `runtime`,
  `tui`) 95 tests: 94 passed, 1 failed — the same pre-existing `src/plugins.ts` failure.
- Full suite 1255 tests: 1254 passed, 1 failed — that same pre-existing failure.
- Identity after this slice: `ded205da07cf…` (inputs `02da83ed9d12…` 257 files, validation
  `f17073b552d7…` 106, build `a0a2a0d46cfa…` 185).

### Not claimed / next

- Nothing in the product installs a chain module yet — the hooks-module loader that reads a plugin's
  hook definitions is its own package — so in a real session `prompt.edit` is unhooked and the relay
  records nothing. Everything above is proven by fixtures that install a module through the host.
- Decorations and the paint host are not delivered (no producer and no renderer).
- The hook host re-renders `cue` only when the one store it reads changes; there is no general React
  runtime here.
- The other slices' ports are unchanged: the worker seam, the logger singleton store, `po`'s
  memoizer, `a`/`ve`, `sA`/`mU` and `TDe`/`tIt`.

## Slice 4 map — hooks-module installation (reconnaissance, 2026-10-15)

Why this is next: the relay landed, but nothing installs a chain module, so `prompt.edit` is never
hooked in a real session. This map bounds the source's installer so the next iteration can copy it;
nothing here is carried yet. All ranges are zero-based UTF-16 `[start,end)`.

`chunk-sfn1dbxq.js`:

| symbol | kind | range | units | notes |
| --- | --- | --- | --- | --- |
| `KWe` | function | [1683229,1683297) | 68 | the noun rule a registered pattern must satisfy |
| `tWt` | function | [1683297,1683468) | 171 | warns for each registered pattern that can never be a noun |
| `rWt` | function | [1683468,1683739) | 271 | `ui.render` matcher advice (warn channel only) |
| `iWt` | function | [1684913,1685296) | 383 | **the host check**: every registered event must be one the module's own scan declared, else `He` |
| `IN` | function | [1826839,1826971) | 132 | reads the plugin's `hooksModule.module`; non-void means the plugin ships a hooks *module* |
| `bGt` | var | [1829037,1829052) | 15 | the record name |
| `wGt` | var | [1829052,1829624) | 572 | the record members built from the registered patterns |
| `w3` | function | [1829624,1829702) | 78 | status-gated call wrapper (unloaded module answers its own message) |
| `tGe` | async function | [1829702,1831394) | 1692 | **the installer**: load the environment, register patterns, set the module seat, store the args, build the record |
| `_Ko` | function | [2362276,2362447) | 171 | same-thread environment host |
| `l6o` | function | [2421384,2423309) | 1925 | native (worker/VM) environment host |
| `lIo` | function | [2423309,2423504) | 195 | picks the environment host by `environmentHost.kind` |
| `dIo` | function | [2424118,2424242) | 124 | native host reuse; only on the `IN` path |

`chunk-2kdsvp3x.js`: `D5t` [27198,27288) 90 (module label, `storageId@plugin`).

Already carried, so the installer has its callees: `Rpr` [33824,34569), `tt` [36530,36977),
`rt` [36977,37034), `Ee` [37034,37144), `Z` (the re-entry wrapper), `P0`/`jDe`, and `mlt`/`hlt`
(`src/plugin-chain-host.ts` and the entry module).

Still to carry for the registration checks, from `chunk-m4qpskd4.js` (the pattern layer the host
already takes six bodies from): `Q3e` [49628,49686) 58, `eEs` [50381,50457) 76, `Awr` [50457,50521) 64,
`lIt` [50708,50764) 56, `Z$n` [47910,47970) 60. They are named by `iWt`/`tWt` only, so they travel
with this slice.

The seam: `tGe` calls `h.load(y, n)` and wraps the result in `bGt({ … hopKey: h, … })` — `h` is an
environment host (`_Ko` in-process or `l6o` in a worker). This product has no VM, so
`src/plugin-chain-module-record.ts` stays the host stand-in and `tGe` is copied with its `h.load`
boundary owned, the same way the W45-2 slice copied the collection with the worker hop owned.

Open questions to settle before copying (S-7: read the bodies end to end first):

1. What exactly is `n` (the plugin descriptor `tGe(e, n)` reads `pluginName`, `pluginStorageId`,
   `tier`, `scan`, `hooks`), and which product value becomes `scan`?
2. `wGt(registered, …)` reads `{pattern, matcher, …}` entries — the product's declared hooks are JSON
   from a plugin manifest (read by `src/hooks.ts` today), so the `registered` shape has to be built
   from those declarations and the mapping recorded.
3. `Te()` (`chunk-2kdsvp3x.js` [6762,6830) 68) rejects the install in some state — which state.
4. Whether the `iWt` host check applies at all on the declared path (it checks a hooks *module*'s own
   scan), or whether it stays a no-op for declared hooks like the product's.

## Slice 4 landed — the event catalog and the declared-pattern hook surface (2026-10-15)

Status: **landed and verified**. 16 bodies (≈3 200 units) into `src/plugin-chain-host.ts` and one new
generated file `src/plugin-chain-install-source.ts` (3 blocks, 665 units). Ledger
`research/ports/W45-chain-install-blocks.json`, evidence `research/ports/W45-chain-install-evidence.json`.

Answers to the map's four questions: `n` is the scanned plugin descriptor and its `scan` has no
product counterpart (see limitations); the `registered` shape is the product's `ChainModule.patterns`
declaration, added by this slice; `Te()` is a global-state gate over a store this product does not
have; and `iWt` **does** apply on the declared path — its second half is checkable without a scan, and
it is now the install check.

### What landed

| piece | where | what it does |
| --- | --- | --- |
| `xp`/`Ewr`/`ao`/`Q$n`/`J3e` (33 + 63 + 47 names) | host | the source's own event roster, 142 names |
| `Bt`/`Gt`/`Z$n`/`Q3e`/`lo` | host | the predicates over it: dotted prefixes, a two-segment name, a wildcard or negated pattern, the telemetry prefix |
| `eEs`/`Awr`/`lIt`/`D` | host | the name a pattern selects, the problem a pattern has, whether a pattern selects an event, dedupe |
| `mlt`/`kyt` | host | the source bodies, replacing the seeded `SUPPORTED`/`EXCLUDED` scaffolding |
| `bGt`/`wGt`/`w3` | `src/plugin-chain-install-source.ts` | the record an installed environment becomes, its hook surface, the unloaded gate |
| `checkDeclaredPatterns` | host | `iWt`'s checkable half, with the source's two messages |

### Adaptations (each with its reason)

- **The seeded `SUPPORTED` set is gone.** `Syt` is computed while `src/plugin-chain-entry.ts` is
  evaluated, so it needed a catalog at that moment; with the real roster it computes the source's own
  twelve names (`agent.offer`, `agent.spawn`, `command.run`, `config.set`, `prompt.mention`,
  `prompt.submit`, `session.append`, `session.compact`, `session.receive`, `session.send`,
  `tool.call`, `tool.check`). `prompt.edit` is correctly **not** among them — `Syt` only marks the
  names that may wait on a hooks respawn, and the relay raises `prompt.edit` straight through.
  `supportChain`/`supportedChains` were scaffolding over the seed and are deleted.
- **A declared module answers through `wGt`.** `chainModuleRecord` hand-built `hooks`/`catches` from
  the predicate and returned constants for `matcherFor`/`registrationsFor`/`hasCatch`. A module that
  declares `patterns` now gets the copied surface, so the collection's "does this module answer",
  "does it catch", "which matcher" and "which registrations" questions are answered by source text.
  A module with only a predicate keeps the predicate form — that shape stays for the product's older
  installers, and the difference is visible in the record.
- **`registrationsFor` returns indices.** `wGt`'s `s` maps a selected event to the indices of the
  declarations that select it, so the fixture asserts indices, not declarations.
- **The install check is `iWt`'s second half.** `Awr` first (a string that is not a pattern), then
  `eEs` against `mlt`/`Z$n` (a pattern naming an event the catalog does not know), throwing the
  source's own messages with the plugin name in front. The scan half has no counterpart here.
- **Name placement.** The catalog shares `fo`/`co`/`uo`/`Wde` with the pattern layer already in the
  host, so it lands there rather than in a generated file; the record surface has no such ties and
  gets its own generated file from the same source module as the entry file.

### Fixture

Six new cases in `test/plugin-chain.test.ts` (25 in the two chain files): a module answers exactly
the events its patterns select (`prompt.*`); a negated pattern (`!prompt.edit`) keeps it out; the
catalog decides whether a registered event exists (both of `iWt`'s messages, verbatim); a classic hook
name is an event and the declaration list comes back deduped; a matcher on a declaration comes back
through the record's `matcherFor` and its index through `registrationsFor`; and the copied classic
roster is compared, event for event, against the product's own hook inventory.

### Checks

- `npm run check`, `npm run build`, `npm run notices:check` all passed.
- All six generated files and their ledgers regenerate byte-identical; 0 unresolved identifiers each.
- Focused 25/25. Related (`plugin-chain`, `plugin-chain-relay`, `plugin-components`, `plugins`,
  `hooks`, `runtime`, `tui`) 158 tests: 157 passed, 1 failed — the same pre-existing `src/plugins.ts`
  failure.
- Full suite 1261 tests: 1260 passed, 1 failed — that same pre-existing failure.
- Identity after this slice: `70961c433aca…`.

### The roster guard

The catalog's classic half (`xp`, chunk-3cynezh1.js) and the product's `HOOK_EVENTS` (src/hooks.ts)
are two independent records of one lifecycle list. They agree exactly — 33 names, none missing on
either side — and the catalog's `classic.` entries are exactly that roster. The fixture asserts both
directions, so a stale copy or a product-only event fails instead of drifting quietly.

### Not claimed / next

- `tGe` (the installer itself) was **not** carried by this slice; it was carried by W45-5 (see "W45-5: the
  hooks module loader" below), which bounds the hosts this slice left open. `vJt`/`Ygo`/`aZo`/`Ed`/`TJt`/`fas`
  (the VM and worker environment runtime) remain unported, and this product's own plugin declarations are
  classic-hook JSON (`HooksConfig`) rather than chain patterns, so a bridge from a *classic manifest* to
  `patterns` would be product design rather than a port. W45-5 carries the module-file path instead: a plugin
  module file declares its own handlers and patterns.
- A module with only a `hooks` predicate keeps the hand-written record surface.
- The catalog is a copy: a new event name in a later sample needs a new copy.

## Memoize dependency completion (2026-10-15)

Status: **locally verified; independent findings resolved**. The inherited memoize copy covered `[2367,5355)` and imported two approximations from the host. The complete native-detection closure is now copied from the same module and both approximations are deleted. [Evidence](W45-chain-memoize-evidence.json), [source ledger](W45-chain-memoize-blocks.json), [final identity](W45-chain-memoize-identity.json).

- Source `chunk-ae84tp6z.js` SHA-256 `901937cc8e68c765b7dddc4875578a6b1759f5e9a2535bee85829bea8ace200f` matches `extracted-v2/manifest.json`.
- Acorn confirms complete top-level statements at `[707,2367)` and `[2367,5355)`, totaling 4,648 zero-based UTF-16 code units. The first range owns root discovery, object tags, the core-js mask-key check, function stringification and native detection. The second owns Hash, ListCache, MapCache, memoize and its aliases. Neither range imports an application module.
- Data shape remains the source's callable memo with mutable `.cache` and replaceable `V.Cache` constructor. The chain's `oOn()` owns one memoized WeakMap keyed by the absent first argument. Falsey results remain cached because the source checks `.has()` before `.get()`.
- `src/plugin-chain-memoize-source.ts` is generated from its plan. Host `po`, `Ne` and `_U` are removed; records import the copy and the runner has no unused memoize import. The typed `ry/glt` adaptation is separately bound to `chunk-m4qpskd4.js`, SHA-256 `730cbd0e42d685bf16a3b53c020b479670597d6bef6db2ab594049eea3e782ae`, with exact ranges `[48162,48214)` and `[48245,48272)`. The intervening `Qws` declaration is excluded.
- Throughput checkpoint completed with the existing copier and one bounded independent reviewer. The earlier omitted output argument had overwritten the default runner; after restoration, the generator now requires an explicit output. Verification regenerates in a fresh temporary directory and compares all seven source/ledger pairs. Required memoize ranges and exports are checked against the plan, ledger and generated module; missing blocks or exports fail before writes.

Three new cache regressions cover nullish values, key kinds, receiver/resolver, invalidation, replaceable cache constructors, shared chain ownership, ordinary constructors and masked native constructors. All 29 chain/cache/relay tests pass within the final affected run. The affected run is **161/162**, with the existing `Missing, symlink, or invalid plugin directory: /var` at `src/plugins.ts:119:70` retained. Type checking, build and notice-inventory checks pass. The notice checker still reports four installed packages with no root license text; this slice leaves that inventory unchanged. The historical full-suite result is 1260/1261; no full-suite rerun is claimed here.

The compiled CLI editing smoke installed an owned pass-through `prompt.edit` fixture. Five exact submissions used the loopback SSE provider; all twelve chain calls retained the shared memoized WeakMap. Terminal modes and session locks were released, and PID 35731 exited. The production module loader is still absent. No global install or packaging run belongs to this slice.

Independent review found two validation gaps: a missing memoize block could still pass generation/verification, and the original mask fixture passed when the mask check was removed. Both were fixed and independently reprobed. Incomplete plans now preserve sentinel output and create no ledger. Throwing native proxies make deletion of `||pt(t)` fail with `masked create was used`; the unchanged product passes. Q-068 through Q-071 retain the source-closure, overwrite, type and verifier incidents.

Final identity is `3f27d43a273c3f99410a66d94460d4585744e0f39eb8c3809f2f5316e2dbd9da` (262 input, 107 validation, 187 build files). The CLI ran at `ba2545e7...`; the final rebuild changes only the memoize provenance comment. All other 186 build files retain their digests, and the changed module's Acorn AST is equal. The evidence records both identities and this comparison instead of claiming a new CLI run. All fourteen generated source/ledger outputs regenerate exactly; their 178 blocks total 50,615 UTF-16 units.

S-1 through S-7 were reviewed. Exact coordinates and discriminating probes support S-1/S-5; existing contracts stay intact under S-2; the unchanged rendering boundary makes S-3 inapplicable to this cache change; the WeakMap owner and fixture/CLI cleanup satisfy S-4; consumers, plans and output guards satisfy S-6; the complete copied dependency closure satisfies S-7. Recovered application entrypoints were not executed and paid upstream calls were zero. Hooks runtime/installer, production module loading, other chain consumers and decoration painting remain successor work.

## W45-5: the hooks module loader (2026-10-15)

Status: **locally verified; the bounded independent review returned and its findings are applied** (see
"Post-review corrections" below). The package the W45-4 reconnaissance
called "not a slice" is carried: the loader `tGe`, the hooksModule read `IN`, the registration checks
`iWt`/`tWt`/`rWt`, the label `D5t`, the module inventory behind them, and the product's environment host with
its module-file path. [Evidence](W45-loader-evidence.json), [plan](W45-loader-blocks.plan.json),
[source ledger](W45-loader-source-blocks.json).

**What is copied.** 31 blocks, 4,999 zero-based UTF-16 units, five modules, one generated file
(`src/plugin-chain-loader-source.ts`, 37 exports). The five modules and their digests are in the file head and
the ledger; `scripts/verify-chain-copies.mjs` regenerates the plan in a fresh directory and compares, and the
loader is the eighth plan in that set, so all 16 source/ledger pairs now regenerate byte-identically.
`node scripts/source-undeclared-scan.mjs src/plugin-chain-loader-source.ts` reports 0 unresolved identifiers,
with 17 names imported from `./plugin-chain-host.js`, 3 from `./plugin-chain-install-source.js`, 2 from
`./plugin-chain-records.js`, 1 from `./plugin-chain-matchers.js` and 3 from `./plugin-chain-source.js`.

The closure avoided the trap this package was expected to fall into. The loader *names* the environment hosts
(`_Ko`, `l6o`, `lIo`, `dIo`, `vJt`, `Ygo`, `aZo`), and taking those as port targets exploded the closure past
1.4M units — the VM and worker runtime. They are bounded instead, one observed edge at a time, each with its
reason in `research/ports/W45-runtime-closure-request.json` (220 boundaries: 24 hand-written, the rest
derived from the existing copies' ledgers matched by *source module and range*, never by bare name — minified
modules reuse short names, and a name-only pass had bound a lodash body to a chain symbol).

**What the product supplies.** `src/plugin-chain-module-host.ts` is the environment host the copied loader
drives. Its contract is read off the source, not guessed: `tGe` reads `load`/`unload`/`died`/`resolveTables`/
`build`/`callInterface`/`press`/`releasePresses` off the host, and `Rpr` reaches the host through the record's
hop key for `dispatch`, `kind`, `nextDispatchId()` and (optionally) `isDeclared`/`replaced`. The same-thread
host `vJt` is the analogue the product follows: it has no `isDeclared`, so neither does this one. A dispatch
names its environment through the payload (`Rpr` puts the members' environment ids on `caughtBy`), which is how
one host serves every environment.

`src/plugin-chain-loader.ts` is the entry: `createChainRun()` (the counter and the argument table `tGe` reads
and writes), `loadChainModule(run, descriptor)` (the source's own step after `tGe` returns — the record joins
`it().loadedModules`), and `loadChainModuleFileInto(run, request)` for a plugin module file. The unload it
returns is the cleanup owner: it takes the record back off the inventory, drops the plugin's held presses and
terminates the record, which unloads the environment through the copied teardown path.

The scan `iWt` checks a registration against is real here, not a stand-in: the module file's own handler table
is the scan, so a plugin that registers a pattern it has no handler for is refused at load with the copied
message. The label is the copied `D5t` over the product's plugin identity, which is its own install directory.

**Product-owned ports, each with its reason at the port.** `Te` (the managed launch-options gate → false),
`Fv`/`pce` plus the storage-id parse (no marketplace registry; the parse is reimplemented over the id shape the
copied `D5t`/`th` compose and split), `Tpe` (the product clears its own agent registrations), `c` (the record
list is the product's error sink), `h3` and `rWt` (the product owns its command surface and its component
inventory), `AK` (the press table, keyed by plugin name) and `environmentHostKind` (one kind, in process).
`lIo`/`dIo` carry the source's own selection bodies and create the product host. `it()` gains `registeredAgents`
because the copied `e1e`/`hx` reach it.

**Verification.** Types, build and the notice inventory pass. `test/plugin-chain-loader.test.ts` — 8 tests —
loads real module files from disk and drives them: the label and inventory, the handler answering a chain
dispatch, the scan refusing an unregistered pattern and the catalog refusing a non-event, the noun warning
through the copied `tWt`, an interface call and a press reaching the module, a second load getting a fresh
environment, two loaded modules answering one dispatch in load order, the composer relay becoming hooked by a
loaded module and unhooked by its unload, and the file reader's naming. Chain suites 36/36, related 107/107
(plugins+hooks), full suite 1273 with two load-sensitive failures that do not involve this package (below).
`node scripts/verify-chain-copies.mjs` compares 16 files across 8 plans, byte-identical; the undeclared scan
reports 0 unresolved names in every copied file. `.audit/w45-loader-compiled.mjs` drives the same paths
through `dist/`. Identity `aef8b529…` (inputs 265, validation 108, build 190).

**Limitations.** `vJt`/`Ygo`/`aZo` and the worker host `l6o` remain unported; `resolveTables` returns its
argument and `build` resolves immediately because an in-process module has no table space and no build step;
`IN` finds no builtin plugin, so a plugin reaches the loader by module path; no product command installs a
chain module yet, so the loader's entry is real but not yet called by plugin discovery; `rWt`'s advice is not
carried. The worker's own dispatch bookkeeping (`caughtAnswered`, `endedReached`, the `ended.kept` answer) and
the environment's `leftOut`/`told` re-entry seats are not ported: they belong to the worker's environment
store, and the product has no worker.

### Post-review corrections (2026-10-15, later in the same package)

**The host has to fold every environment a dispatch names.** `Rpr` sends *one* dispatch for every member that
answers over a host (`Q` builds `environments` from all of them; `caughtBy` is only the subsets that catch),
and the worker's own dispatcher — `async function v` inside `bgo`, `chunk-p16hdq43.js` [18214,18714) — folds
them as an inner chain:

```js
aP({e: s.payload, handlers: s.environments.map((d) => W(n, {environmentId: d, event: s.event, ...})),
    site: Ooe(s.event, s.raise), signal: y, isHopFold: !0, bottom: (d, w, O = hlt) => f(d, w, O), ...})
```

The first draft of the product host dispatched to `payload.caughtBy[0]` alone, so with two modules loaded the
second one's code never ran. The compiled driver caught it: the rewriting module's `inputText` never reached
the core and the composer draft stayed at the person's own after-state, while the settle line still named both
modules. `dispatch` now calls the copied `aP` (already in `./plugin-chain-source.ts`) with `isHopFold: true`,
`bottom: next`, `site: Ooe(payload.event, payload.raise)`, one handler per environment and
`floors`/`cutAt`/`origin` off the payload. The regression test is
*"two loaded modules answer one dispatch, folded in load order"*: the answer carries the first module's tag
*and* the second module's spliced text, and exactly one settle line names both labels in load order.

**The plugin-facing continuation is the call itself.** `sO`/`vSe` (`chunk-nyce03br.js` [111700,112338))
null-prototype the call function and hang `to`/`signal`/`is`/`event`/`origin`/`trace`/`budget` off it, and the
worker's `nextFor` wrapper (`chunk-p16hdq43.js` [13525,13807)) hands the plugin exactly that object. So a
module's continuation is `next(e)` / `next.to(e, tiers)`, and `next.call` is deliberately a TypeError rather
than `Function.prototype.call` — the string `next.call(` does not occur anywhere in the extracted bundle. The
draft had *added* `call` to the handle and documented it as the source's shape, and 16 test call sites used
it. `ChainCallHandle` is now a callable interface (no `call` member), the host-path record builds the same
null-prototyped handle, and the call sites use `next(input)`.

**Review findings applied.** The reviewer's items were checked against the source before acting on them; the
ones that held were fixed in this package: `Tpe` no longer clears the whole `registeredAgents` table (it would
have dropped other plugins' agents; it is a documented no-op), `chainStorageId` cites `iB` [11835,11948) and
names the dropped `Gc` guard, `c` names the source's early return, the host is per chain (a `WeakMap` keyed by
the run, not one shared instance), the host's `unload` no longer touches the press table (the loader's
`terminate`/`retire` paths do), `releasePresses` takes the handles, the loader's inventory comment now
discloses that the source replaces `it().loadedModules` wholesale where this product pushes, `terminate?.()`
became `retire?.()` on unload, a dead field and a duplicated structural type were removed, and the
composer-relay test asserts a draft that only the loaded module's rewrite can produce instead of comparing a
literal it had just assigned.

## W45-6 reconnaissance: the manifest's hooksModule (2026-10-15)

Read before any product change, since the product behaviour this package adds is what `IN` and `hb` already
decode. Everything below is `chunk-m4qpskd4.js`, sha256
`730cbd0e42d685bf16a3b53c020b479670597d6bef6db2ab594049eea3e782ae` — the same module the install copy already
uses.

| Source | Range (zero-based UTF-16) | Body |
| --- | --- | --- |
| `Sr` + `Fe = Sr()` | [7484,7720) | the hooks-module registry: `register(key, module)`, `source(key)`, `registerScan(key, scan)`, `scan(key)` |
| `nr` | [2333,2375) | the registry key, `` `builtin:${name}/${he}` `` |
| `Tn` | [1776,1923) | the files table: a frozen object of the `{files}` entries whose values are strings |
| `An` | [1923,2100) | validates a `{scan}`'s shape (`hooks` and `calls` arrays, `nextTo` optional) and throws the build-carried-no-hooks-module error otherwise |
| `jn`, `aho`, `oW` | [74702,74855) | `oW(dir, registration, loader)` = `up() ? {module, scan: An(loader(), dir), files: Tn(loader())} : {module, folder: dir}` |
| `Jk` | [74855,74990) | the listing contribution: `{path: folder, modulePath: join(folder, he)}`, or `{path: Pi, modulePath: nr(name)}` |
| `hb` | [75963,76157) | builtin registration: stores the plugin, then `Fe.registerScan(key, scan)` for a `{scan}` shape or `Fe.register(key, shipped)` for a `{shipped}` one |
| `th` / `Fv` / `E3` | [76157,76249) / [76200,76249) / [76249,…) | the `@builtin` suffix test (already copied), the registry lookup `IN` reads, and the listing builder that spreads `Jk(name, hooksModule)` |
| `X3e` | [5839,6300) | plugin-relative resolution, whose refusal names the rule this package needs: `resolves outside the plugin's folder` |

So the source's `hooksModule` is a union — `{module}` (plus `scan`/`files` when the flag is on), `{scan}`,
`{shipped}`, `{folder}` — and `IN` (already copied) returns `n.module` only for the first. The presence of that
module is what makes `tGe` choose the in-process host (`dIo`) over the worker host, which is exactly the
product's situation. The product's `Fv` currently answers `undefined` (no marketplace registry), so the chain
never sees a plugin's module.

**Next actions for W45-6.** (1) Find `up()`'s flag and decide, with its reason recorded, which side of `oW`
the product is on; the product has no build-carried scan object, so the `{module, folder}` side is the one its
manifest can honestly produce. (2) Read `src/plugins.ts` for the plugin record, its manifest validation and
its install snapshot, then attach `hooksModule` (relative path inside the plugin folder, validated the way
`X3e` validates) and feed the product's `Fv`. (3) Expose the module path where the product lists plugin
components, mirroring `Jk`'s `{path, modulePath}`. (4) Call `loadChainModuleFileInto` on plugin discovery and
the returned unload on disable/uninstall, with the cleanup owner recorded. Nothing in this section has been
landed yet; it is the source map the implementation starts from.

**Step (2) was wrong, and the landing section below records why.** `hb`/`oW`/`Jk`/`Fv` are the *builtin* half:
`Fv` is `xr().builtinPlugins.get(name)`, `hb` is called by builtin plugin modules that hand over a module
*object*, and `nr` keys the registry `builtin:<name>/hooks/register.ts`. No manifest field declares a hooks
module anywhere in the recovered source. An installed plugin reaches the chain through its own hooks file's
`modules` array, which `aUr` resolves; the first draft of W45-6 invented a `plugin.json` field instead, and the
correction is described below.

## W45-6 landed: the plugin hooks module (2026-10-15)

The package's goal stays the recorded one — an installed plugin's chain module reaches the chain, with a
recorded cleanup owner — but the surface it attaches to is the source's, not the manifest.

**Where a plugin's module comes from.** The plugin's hooks component (`plugin.json`'s `hooks` path, the
product's hooks file) may carry a `modules` array of specifier strings. `PGn`
(`chunk-sfn1dbxq.js` [269575,269666)) is the list of keys that file may have at all — `$schema`,
`description`, `hooks`, `modules`, `surface` — and `aEn` ([4054979,4056182)) returns
`{hooks: parsed.hooks ?? {}, modules: parsed.modules ?? []}` from it. Each entry becomes
`{hooksFilePath, spec}` ([4067172,4067196)). `aUr` ([4056182,4056874)) then decides:

- no entry → no module;
- two or more → `{type:"hook-load-failed", plugin, hookPath, reason: "Plugin <name> names one hooks module per
  plugin, but <a> and <b> each name one in `modules`; neither is loaded"}` — the plugin still loads;
- one → resolve `Dz(s0, anchor, plugin.path, Fd(PS(plugin.path, Sm(hooksFilePath)), spec))`: the specifier is
  joined onto the folder the hooks file sits in, then confined to the **plugin** folder. An escape is
  `{type:"path-traversal", path: spec}`, a missing file `{type:"path-not-found", path: <resolved>}`; either way
  the plugin loads and `modulePath` stays unset. Only a resolved, present file sets `n.modulePath = M`.

`$9o` ([2453027,2453260)) shows the confinement more exactly: the module may leave the `hooks` folder — the
plugin's `hooks`, `types` and `tests` folders, plus the module's own folder, are all inside the boundary.

**What the chain does with it.** The environment descriptor carries `{modulePath, pluginName, pluginRoot,
pluginStorageId, tier, scan, source, linked, links}` and `cIo` ([1831564,1831962)) rebuilds an environment from
`n?.modulePath ?? e.modulePath` with `n?.path ?? e.pluginRoot` and `n?.name ?? e.pluginName`; the loader reads the module through `oho(n, e.path, e.name)`. `Fv` is not on this path: it is the builtin lookup,
and `IN` ([1826839,1826971)) consults the *builtin* registry `Fe`, which only `hb` fills. So the product keeps
`Fv` answering `undefined` (its faithful value with no builtin plugin modules) and feeds the chain through the
descriptor instead.

**What landed.**

| Product file | What it now does | Source |
| --- | --- | --- |
| `src/plugins.ts` | the hooks file schema accepts `modules`; `hookModuleFor` returns the single resolved path or the source's diagnostic, and `componentConfigs` exposes `hooksModulePath` / `hooksModuleProblem` on every discovered component | `PGn` [269575,269666), `aEn` [4054979,4056182), `aUr` [4056182,4056874) |
| `src/plugin-chain-host.ts` | `Fv` answers `undefined` as the source's empty builtin table does, with that reading documented | `Fv` [76200,76249), `hb` [75963,76157) |
| `src/plugin-chain-registry.ts` | `adoptPluginHooksModules` reconciles the descriptor list `{name, modulePath, path}` against what is loaded: loads new and changed modules, unloads what left | `cIo` [1831564,1831962), the plugin-state rebuild around the `knownPlugins` state `Fqt` [2396281,2396500) feeds |
| `src/plugin-chain-loader.ts` | before the read, a module outside the plugin folder or not a regular file is refused with the source's two sentences | `X3e` [5839,6300) |
| `src/config.ts` | a config read hands discovery's declarations to the chain, and once a process has adopted anything it re-adopts on every later read — the empty list is how a removed plugin is unloaded; the chain is imported lazily until then | product wiring; no source body |

`adoptPluginHooksModules` returns the loads it started, and `pluginHooksModulesSettled` waits until the pending
promise stops moving, so an adoption recorded while a caller is already waiting is still covered. The composer
relay's default `raise` awaits that settle before dispatching, so a declared module answers the person's first
keystroke rather than whichever one lands after its import finished.

**Corrections to the earlier draft of this package.** The draft added `hooksModule` to `plugin.json` with a
snapshot existence check, exposed `hooksModulePath` from the manifest, and fed an invented `Fv` registry over
installed plugins. Reading `hb`…`E3` and then the *installed*-plugin side (`aEn`/`aUr`) showed all three to be
invented: the source has no manifest field, `Fv` is the builtin lookup, and the module arrives through the
hooks file. All three were replaced rather than kept alongside the faithful path. The same reading also fixed a
test-fixture defect: the plugin-theme runtime test built its workspace from an un-realpathed `os.tmpdir()`,
which macOS symlinks through `/var`, so the store's symlink refusal failed it (recorded in W45-5 as the
pre-existing `src/plugins.ts` `/var` failure). It now realpaths the fixture root.

**Residual unknowns.** (1) The product's hooks file is the one `plugin.json` names; the source also probes the
conventional `<plugin>/hooks/hooks.json` when no manifest declares hooks (`Fd(e,"hooks","hooks.json")`), so a
plugin that ships the file without declaring it loads no module here. (2) `hb`'s builtin half and its `scan`
and `shipped` shapes stay unported: nothing in this product compiles a plugin into the binary, and `up()` is
false off Bun, so the `{module, folder}` side is the only one reachable. (3) The config read starts adoption
behind a dynamic import; a raise that runs before that import resolves would dispatch without the module. No
product path reaches that window today (the relay module imports the registry statically, so it is evaluated
before any relay exists), but the source closes it by loading during install instead.

**Verification.** `npm run check`, `npm run build`, `node scripts/dependency-notices.mjs --check`,
`node scripts/verify-chain-copies.mjs` (16 files byte-identical, 8 plans), the per-file undeclared scan on
`src/plugin-chain-loader-source.ts` (0 unresolved, 79 declared), the focused suites `test/plugin-hooks-module.test.ts` 6/6 and
`test/plugin-chain-loader.test.ts` 8/8, the related set 101/101, the full suite 1279/1279, and
`.audit/w45-loader-compiled.mjs` against `dist/` — which installs a plugin whose hooks file names a module,
reads the config, waits for the adoption and answers a `prompt.edit` dispatch with the plugin's own tag
(`pluginHooksModule.adopted: ["compiled-plugin"]`). Identity `24098070…` (inputs 265 / validation 109 /
build 190); the pre-existing failure recorded in W45-5 is gone, so the full suite has no retained failure.

## W45-7 landed: the module loads at install (2026-10-15)

W45-6 left the load to a background adoption started by a config read, which left one window: a raise that
ran before that read's dynamic import resolved would dispatch without the module. The source has no such
window because its installer *awaits* the load. That is what this package ports.

**The source's install.** `vVe(name, run)` (chunk-sfn1dbxq.js [2391122,…)) is the reload/install entry: it
takes the live record and the known plugin entry, or `await GJt(n, h)` — and `GJt` ([2373349,2373462)) is
`if (n?.modulePath === undefined) return; let r = await mWt(n, n.modulePath); return Q2e(e.state, r), r`,
with `mWt` ([1687812,1688382)) the loader that throws `new bN(name)` on a diskless run and
`` `${name}: hooks module not…` `` for a name on its list. `vVe` then builds the descriptor with
`await cIo(y, h)` and admits it: `Re = await tGe(n, z), Re.shown = GE(z, h), [Ae] = await BW(n, [Re], Pe)`
inside a `try`, whose `catch` runs `Ve()` — the rollback that restores `knownArgs`/`withholdings` and
releases the build slot — and rethrows ([2392440,2392470)). So a module's load is part of the install, and a
failed load rolls back the chain's own admission, not the plugin's files.

**The source's removal.** `CVo(pluginState, liveKeys)` ([2394700,2395092)) runs on that state's queue: keys
known to the chain but absent from the live plugin listing are deleted from `knownPlugins` and handed to
`iF(run, names, "plugin disabled or uninstalled")`. `iF` ([2390389,2390919)) splits `loadedModules` into the
leaving and staying sets, drops the seat per name (`EW`), retires each leaving record, and logs
`` t(`hooks modules unloaded: ${labels} (${reason})`) `` before its own settle and drain.

**What landed.**

| Product file | What it now does | Source |
| --- | --- | --- |
| `src/plugins.ts` | `plugin_install` / `plugin_update` / `plugin_remove` reconcile the chain after their transaction and **await** it: `reconcileChainHooksModules` recomputes the store's declarations and calls `adoptPluginHooksModules`, so an install returns with the module loaded and a removal returns with it unloaded. The chain is still imported dynamically, so a store that never sees a hooks module never pulls it in. | the awaited `tGe` admission [2392440,2392470); the removal reconciler `CVo` [2394700,2395092) |
| `src/plugin-chain-registry.ts` | an adoption that leaves names out unloads them and logs the source's own sentence with each record's label: `hooks modules unloaded: <labels> (plugin disabled or uninstalled)` | `iF`'s log line [2390389,2390919) |

**Divergences recorded, not hidden.** (1) A *changed* module path unloads and reloads here; the source
reloads in place, displacing the record through the rank/seat path (`wVe`/`bVe` in `vVe`), so a reload keeps
the module's seat in its trail. (2) The source keys its reconciler by the registry key (`rm(entry)`,
`fW(state, name)`); this product keys by plugin name, which is the same value for every plugin it can
install. (3) The source's failed install *throws* out of the admission after rolling back its own state; the
product's tool reports the failure to its caller, and the store's committed plugin stays installed without a
loaded module — the same end state for the files, a different surface for the error.

**Residual.** A plugin installed by *another* process after this one read its config is adopted by the next
config read, as W45-6 recorded; nothing observes the store between reads.

**Verification.** `npm run check`, `npm run build`, notices, `verify-chain-copies` (16 files, 8 plans),
the loader copy's undeclared scan (0 unresolved / 79 declared), `test/plugin-hooks-module.test.ts` 7/7 (the
new one installs and asserts the module is loaded *before* any config read, removes and asserts the unload
line), the related set, and the full suite 1,280/1,280. `.audit/w45-loader-compiled.mjs` runs the same
through `dist/`: `loadedByInstall: true`, `unloadLogged: true`, `adopted: []` after the removal. Identity
`d145bf0b…` (inputs 265 / validation 109 / build 190).

## W45-8 landed: the painted decorations (2026-10-15)

**The gap this closes.** W45-3 built the composer edit relay, and its answer carries `text` and `cursor`
only. `Cr` in ./plugin-chain-source.ts has always declared a third field, `decorations`, and nothing read
it; the product editor had no decoration model at all. So a module that paints its draft (the shape the
source's own highlighter uses) had nowhere to paint, which is the residual W45-3 recorded.

**The source's paint.** The composer's state class in chunk-24k7d6mw.js (sha256 1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31) keeps two
slots, `#y` (the paint being shown) and `#h` (the paint the last draft change carried), and three bodies
move runs between them:

```
paint=(h)=>{if(this.#h=null,h.length===0&&this.#y===null)return;this.#y=h.length===0?null:{value:this.#i.value,runs:h},this.#p({})};
                                                                                              [486016,486148)
carryPaint=(h,T)=>{let M=this.#h;if(this.#h=null,M===null||M.value!==h.text||this.#i.value!==T.text)return;
  let L=Rke(a7o(M.runs,yBe(h,T)),T.text);this.#y=L.length===0?null:{value:T.text,runs:L},this.#p({})}
                                                                                              [486148,486354)
```

and the publish clause `#p(h)` carries the two sentences that decide what the draft paints right now:
`if(M.value!==T.value)this.#h=this.#y?.value===T.value?this.#y:null,this.#y=null;` and
`if(M.decorations=this.#y?.value===M.value?this.#y.runs:ihe,` ([482300,482690), the cursor clamp, `cameBack`
and the emit around them belong to the store this product does not share). The relay binds both operations
at the host: `$v=(eM)=>M.carryPaint(eM.before,eM.after),fS=(fp,qN)=>M.paint(Rke(fp,qN))` ([831323,831404)) —
note the host normalizes with `Rke` *before* `paint` stores, and the composer starts with
`decorations:ihe` ([481873,481918)).

Read together: an answer's runs are normalized against the text they answered and bet on the draft; a draft
change without them moves them to the carry slot and the next relayed edit rebases them (`yBe` is the edit,
`a7o` rebases every run across it, `Rke` renormalizes and merges); anything that no longer matches the draft
is dropped rather than drawn over text it was not computed for. An answer that returns **no** `decorations`
paints an empty list, and an empty list clears the paint.

**The geometry.** Four blocks, 4,331 UTF-16 units, into the generated `src/plugin-chain-decorations-source.ts`
(21 exports, 0 undeclared identifiers): the run geometry `Ire`/`ihe`/`i7o`/`AOe`/`Mht`/`wY`/`Iht`/`drr`/
`Ckn`/`POe`/`Oht`/`MOe`/`Dht`/`Lht`/`Nht`/`IOe`/`a7o`/`Fht` [460997,463623), the overlap resolution `OOe`
[464165,464391), the span overlay `w9r` [465607,466097) and the grapheme offset lookup with the
normalization `DOe`/`Rke` [466097,467086). The cross-module closure settled on homes that already exist:
`D`/`nQt` in `plugin-chain-source.ts`, `ra` in `tui-graphemes.ts`, `SCt` in `tui-theme-colors.ts`, `HK` in
`tui-theme-overrides-source.ts`, so the copy duplicates nothing.

**What landed.**

| Product file | What it now does | Source |
| --- | --- | --- |
| `src/plugin-chain-decorations-source.ts` | the generated copy of the geometry and the overlay | the four blocks above; the runner plan gained the two exports `D`/`nQt` the copy imports |
| `src/tui-input-decorations.ts` | `PaintedDecorations` holds the composer's paint/carry/publish rules (`this.#i.value` is the text the caller says the draft holds, `this.#p({})` is the caller's repaint); `normalizedRuns` is the host binding's `Rke`; `paintPromptLine` splits one rendered row into its runs over the copied `w9r` | `paint` [486016,486148), `carryPaint` [486148,486354), the publish clause's two decoration sentences [482300,482690), the host bindings [831323,831404) |
| `src/tui-input-navigation.ts` | `inputLineRanges` measures the draft range each rendered prompt row draws: `displayStartOffset`, the renderer's trailing-blank rule, and, in vim's non-insert modes, the caret row's stop at the caret | `Si.render`'s own row discipline; `w9r`'s caret-range argument |
| `src/tui-renderer.ts` | a prompt row is a string or a list of styled segments; `renderChat` draws the segments as nested styled text | the product's renderer; the style keys are `Dht`'s |
| `src/tui.ts` | the relay's `carry`/`paint` bindings call the store, `publishDraft` runs on every draft transition (relay commit and key dispatch), and `inputLayout` paints the rows the runs cover | the host bindings, read at the relay |

**Divergences recorded, not hidden.** (1) The composer here is the TUI's editor, not the source's React
store: the draft text is read from the caller, the repaint is the caller's render, and the private fields are
plain. (2) The source overlays runs onto its own draft renderer's base spans with `w9r`; this product's
prompt renderer draws plain text, so the base span handed to the overlay is the row's whole range and base
styling the app renderer would have contributed is not reproduced. (3) One row's range is not the tiling
`w9r` expects, and `AOe` matches a span by its start, so the overlay can reach one boundary past the row;
`paintPromptLine` drops every span outside the row's own range rather than let that tail paint text it was
not computed for (the compiled driver asserts the tail the raw overlay produces). (4) The source's spans come
from a markdown-aware renderer, so markdown inside a painted run is not re-rendered here.

**Residual.** The app draft renderer's base spans (a 35k-unit React component) and its markdown-aware row
mapper stay uncopied. `S9r`/`$ht`/`b9r`/`Hht`/`Bht`/`i7o` and the `ui_prompt_fill` path have no call sites in
the composer module and stay uncopied. The published text is read, not stored, so a draft changed without a
publish is noticed at the next publish; and a paint survives until the next answer or publish, because
nothing re-normalizes runs against a draft no module has seen.

**Verification.** `npm run check`, `npm run build` and the notices check pass; `verify-chain-copies` reports
passed true over 9 plans and 18 byte-identical files; both regenerated copies scan 0 unresolved. Five focused
tests in `test/input-decorations.test.ts` cover the normalized paint and its clearing, the carry across an
edit against a replaced and a stale draft, the row split (including a run spanning two wrapped rows and the
trailing-blank rule), the vim caret row, and an end-to-end terminal test in which an installed module paints
`world` on the composer row, the run survives edits typed while the module answers late, and the paint clears
when the answer stops recognizing the word. Related input/TUI suites 49/49, full suite 1,285/1,285 (adding
`ranges` to the layout result updated the one whole-object layout assertion). `.audit/w45-decorations-compiled.mjs`
runs the same against `dist/` (`W45DecorationsCompiled.v1`): `Rke` resolves the named color, `a7o` rebases
across the edit, the store paints/publishes/carries, the row comes back
`[['hi hello ', null], ['world', '#e5484d']]`, and the raw overlay drops an unnormalized color name.
Identity `aa74a158…` (inputs 268 / validation 110 / build 192).

## W45-9 landed: the highlight row mapping (2026-10-15)

**What was wrong before.** W45-8 painted a module's runs over the prompt rows with an invented rule:
the product measured each row's own draft range and clipped the runs to it. The source does not clip runs
per row. It maps them.

**The source's mapping.** The input state's `getRenderedRowStartOffsets(rows)` (chunk-f37m98yh.js sha256
207b107a452d54c8..., [24224,24395) 171 units, body sha256 b3a5e35fc0949882...) is
`let {startLine, endLine} = this.getViewportLineRange(rows); return
this.measuredText.getWrappedLines().slice(startLine, endLine).map(line => line.displayStartOffset)`, and the
rendered value it is paired with is the same `render(...)` string this product already draws. The input
component `UFt` (chunk-s7977spq.js sha256 3b692848c071d5fd..., [4899,…)) hands the renderer
`S9r(highlights, renderedValue, renderedRowStartOffsets)` after filtering them, and the text component `Q`
([3176,…)) turns that list into rows:

```
ie = o.showCursor && o.highlights ? o.highlights.filter(_ => _.dimColor || o.cursorOffset < _.start || o.cursorOffset >= _.end) : o.highlights
H  = V && V.length > 0 ? S9r(V, f, h.renderedRowStartOffsets) : V
Q: g = b9r(h, i); split each g[k].text on "\n" into rows carrying g[k].highlight; one styled Text per segment
```

`S9r` ([463623,464165) 542 units sha256 262a05511c7665c6...) splits the stripped rendered value's lines,
walks the row starts into `{textStart, renderedStart, length}` and puts each run's ends through `$ht`'s
binary search; `b9r` ([463623,464072)) segments the rendered value with `OOe`'s overlap resolution through
the `Hht` class ([464391,465607) 1216 units sha256 4f7d01430faf94e8...), which walks the text token by
token and re-opens, in every segment, the escape codes that are open where that segment starts (`Bht`
drops the codes whose close is themselves). So a run stated in draft offsets comes out stated in rendered
offsets, splits across the newline rows on its own, and keeps coloured text coloured.

**How much of it landed.** The row mapping and the segmenter joined the decoration copy (now 6 blocks /
6089 units), and its tokenizer came with them: `_ns` and the width tables it reports per character are a
new generated copy, `src/tui-sgr-tokens-source.ts` (9 blocks / 3620 units, chunk-q4ya5hp8.js sha256
af9981afeb41bc20...), which closes over five bindings `src/tui-style-diff.ts` already carried and now
exports (`rxn` with them). `pn`, the stripper `S9r` measures rows with, is a Bun builtin in the source
(`function pn(e){return Bun.stripANSI(e)}`, chunk-gyf58rwf.js [9076,9115) 39 units sha256 f154404efd625789...),
so `src/tui-ansi-strip.ts` stands in with Node's `stripVTControlCharacters`.

**What landed.**

| Product file | What it now does | Source |
| --- | --- | --- |
| `src/plugin-chain-decorations-source.ts` | the copy grew from 4 to 6 blocks: `S9r`/`$ht`/`b9r` and `Hht`/`Bht` joined the run geometry | [463623,464165), [464391,465607) of chunk-sfn1dbxq.js |
| `src/tui-sgr-tokens-source.ts` | the ANSI tokenizer and the width tables it reports | 9 blocks of chunk-q4ya5hp8.js |
| `src/tui-ansi-strip.ts` | `pn`, the visible text the row mapping measures its rows with | the Bun builtin's host stand-in |
| `src/tui-input-navigation.ts` | `renderedRowStartOffsets` is the source method, so the layout reports the draft offset each rendered row starts at | `getRenderedRowStartOffsets` [24224,24395) |
| `src/tui-input-decorations.ts` | `caretVisibleRuns` is the input's caret filter and `highlightRows` is the S9r/b9r/split path | `UFt`'s filter, `Q`'s segmentation |
| `src/tui.ts` | `inputLayout` hands the runs, the rendered value and the row starts to `highlightRows` with the editor's caret | `UFt`'s call site |

**Divergences recorded, not hidden.** (1) `UFt` and `Q` are React components and are not ported as
components: the product takes their two rules and renders them through its own row renderer. (2) `pn` is a
Bun builtin; the product uses `node:util`'s equivalent. (3) The source's leading pill shifts every run by
the pill's length and adds a priority-30 `ide` span for it; this composer has no pill. (4) A highlight
carrying `shimmerColor` renders per character through the glimmer component with the row's cycle offset in
the source; the product's rows carry the style only. (5) The base-span overlay `w9r` stays copied but is no
longer on this path, because the base spans it merges are the app renderer's own.

**Residual.** The composer's highlight *producers* are not ported: the ultrathink/ultraplan/ultrareview/
workflow-keyword keyword spans, the warning/suggestion/dim spans, the spellcheck marks with `pue`'s
non-overlapping merge, and `YIt`'s rainbow-by-index expansion. The caret filter also runs only when the
source's input shows its cursor; the product applies it whenever a run is painted.

**Verification.** `npm run check`, `npm run build` and the notices check pass; `verify-chain-copies` reports
passed true over 10 plans and 20 byte-identical files; both regenerated copies scan 0 unresolved (56 and 30
declared). `test/input-decorations.test.ts` 6/6, the two related suites 71/71, full suite 1,286/1,286 (the
two cases that asserted the replaced inventions were rewritten against the source's rules: a row is split by
the mapping rather than clipped, and the caret withholds a run rather than clamping a row).
`.audit/w45-highlights-compiled.mjs` runs the same against `dist/` (`W45HighlightsCompiled.v1`) and
`.audit/w45-decorations-compiled.mjs` still passes with the row built through the new path. Identity
`95706ab6…` (inputs 271 / validation 110 / build 194).

## W45-10 landed: the composer's own highlight producers (2026-10-15)

**The gap W45-9 left.** W45-9 put the input's side of the highlight path in place and recorded the other
half as residual: the spans a chain answer's runs are painted *over* come from the composer itself, and
`pue`'s merge, `ewe`'s caret width and the rainbow palettes were still unported. This package ports them
and puts `w9r` back on the prompt path with the base spans it was written for.

**What the composer builds, in its own order.** The assembly at [824770,825761) (991 units sha256
939a02777167c07e...) pushes, in order: the history-search query notice (`{start:vn,end:vn+Pt.length,
color:"warning",priority:20}`, gated `Ct&&Mt&&!Ft`); the `/btw` notice as `warning` 15; the slash-command
runs as `suggestion` 5; the MCP mentions as `suggestion` 5; the teammate mentions with each teammate's
`themeColor`, 5; the ghost text as `{color:void 0,dimColor:!0,priority:1}`; the ultrathink rainbow, one
span per cell, `fB(index)` for the color and `fB(index,!0)` for the shimmer, 10, gated `Goe()`; the spread
runs `bl`; the ultraplan rainbow, same shape, gated `vz()`; the workflow keyword's per-cell `autoAccept`,
10, gated `dg()&&!Zi`. It closes with `wc=pue(Zd,ai)`, which keeps every base span and appends only the
marks that overlap nothing already kept.

The overlay call at [826091,826184) (93 units sha256 39816ec5c84dd3ad...):

    lg = Bn.length===0 || Ct || fi!==Io ? ag : w9r(ag, Bn, ec ? {start:vn,end:vn+ewe(Io.slice(vn)).length} : undefined)

So the base spans go over untouched when nothing is painted, during a history search, or when the match
value is not the store value; otherwise `w9r` overlays the runs and cuts one grapheme out of the span
holding the caret, `ec` being `!po && !Ct` (no modal overlay, not searching).

**The locals, read rather than guessed.** The composer is `DQe` (chunk-24k7d6mw.js at 818061) and its
letters resolve through its props and the store: `isSearchingHistory:Ct,historyQuery:Pt,historyMatch:Mt,
historyFailedMatch:Ft` [818309,818385) 76 units sha256 c22b2c0937d4142b..., and `Io=Re(M,sk)` (the store
value), `vn=Re(M,F0)` (the caret), `kn=Re(M,UC)` (the mode), `Nn=Re(M,_re)` (the ghost text),
`Bn=Re(M,xre)` (the chain runs the relay paints) at 818823. The producers then read off that value:
`na=YIt(fi)` → `Zr`, `Rs=Ct&&Mt?sI(Mt.display):Io` → `fi`, `Ji=vz()&&!pl&&!wl?Ndr(fi,yn):[]` → `Sl`,
`Bl=MM()?uto(fi):[]` → `Vr`, `Qs=dg()&&C7t()?Art(fi):[]` → `Pi`, `ed=d3n(fi)` → `Al`,
`Dd=vMe(fi).filter(...)` → `Bd`, `Kc=j0(...)?Zre(ir,fi):[]` → `pu`, `Ms=j5r(fi)` → `bl`, the teammate loop
→ `Iu`, and `ai=fue({host,text,cursorOffset,active,placeholders})` for the marks.

**What landed.**

| Product file | What it now does | Source |
| --- | --- | --- |
| `src/tui-input-highlights-source.ts` | the producers: `aZt`/`YIt`/`LF`/`UF`/`fB`, `IE`/`Qp`/`Zp`/`uto`/`Art`, `mW`, `A`/`d3n`, `ewe`, `pue`, `vMe`, `j5r` | 8 blocks / 2815 units of 6 modules |
| `src/tui-input-highlights.ts` | the assembly in the source's order, the `pue` merge, and the overlay call with its three pass-through states | [824770,825761), [826091,826184) |
| `src/tui.ts` | `inputLayout` builds the base spans against the editor's text and caret, overlays the chain runs, and hands the result to `highlightRows` | the composer's `highlights` prop |

**Gates and the three surfaces this product does not have.** The gates are inputs whose defaults are the
source's own: `Goe()` reads `k("tengu_turtle_carbon",!0)` and so is on, `vz()` needs the ultraplan flag and
so is off. The workflow keyword's pair (`dg()`, `C7t()` and the `Zi` dismissal state) belongs to a UI this
product does not carry (the alt+w toggle, its notice, its footer chip), so the call site passes it off
while the matcher and its spans are copied. `Ndr` (chunk-n3ykh62m.js at 462762) is not copied: it reads the
host's ultraplan command list through `VAe` and `pto`, and the pure matcher it wraps (`Zp`) is. `kye`/`Ls`
are not copied either: `knownCommand` is the caller's registry, and the TUI's call site passes nothing,
which marks nothing, exactly as the source does for a name it does not know. `j5r` is copied although it
is `null?.setupGuideChipHighlights(e) ?? []`: the spread producer being empty is the source's own state.

**Divergences recorded, not hidden.** (1) The composer is a React component; the adapter takes its locals
as a plain input. (2) The history search is a screen of its own in this product, so the input's
`isSearchingHistory` path is carried but not reached from the chat composer. (3) The TUI has no command
registry in scope (skills resolve at the runtime layer through `findSkill`), so slash-command runs are
unmarked until it is handed one. (4) `shimmerColor` is carried and cleared on repainted cells exactly as
the source writes it, but the rows render the static color only.

**Residual.** `/btw` itself is unported, so its notice marks a token nothing consumes; the workflow-keyword
UI, the ultraplan command list, the MCP-mention and teammate-mention registries, the ghost text and the
marks have no product surface yet; `uto` (ultrareview) is copied with no reachable call site; the
per-character shimmer stays unrendered. Each is recorded in `W45-highlights-producers-evidence.json`.

**Verification.** `npm run check`, `npm run build` and the notices check pass; `verify-chain-copies` reports
passed true over 11 plans and 22 byte-identical files; the new copy scans 0 unresolved / 41 declared.
`test/input-decorations.test.ts` 13/13 (seven new cases), full suite 1,293/1,293.
`.audit/w45-highlights-producers-compiled.mjs` runs every producer, the assembly, the overlay and the rows
against `dist/` (`W45HighlightsProducersCompiled.v1`), including a rainbow crossing a soft wrap; the W45-9
and W45-8 drivers still pass. `.audit/w45-10-measure.mts` is the probe every expectation in the test file
and the driver was read off before it was written. Two expectations written before measuring were corrected to the source's own
results (`ultrathinking` does not match the word boundary, and the wrapped rows are seven cells wide), and
two object shapes were corrected to the source's explicit `undefined` keys (`shimmerColor: void 0` on a
repainted cell, `color: void 0` on the ghost span). Identity `e46e47bf…` (inputs 274 / validation 110 /
build 196).

## W45-11 landed: the twelve chains whose cores this product can answer (2026-10-15)

**The gap W45-10 left.** The runner, the module collection, the relay and the composer's edit chain were in
place, and the registry carried exactly one chain name: `prompt.edit`. The source's `yyt()` core table lists
twenty-seven names whose default answer is the engine's own, so twenty-six of them refused with `$.<name>: no
core at the bottom of the chain` and thirty-four sites were missing. This package closes the part that needs
no surface the product lacks.

**Which twelve, and why not the rest.** A core is only worth registering when its answer does not come from a
registry the product has not carried. `agent.offer`, `command.describe`, `config.describe`, `tool.describe`,
`prompt.autocomplete`, `telemetry.mark`, `prompt.context`, `prompt.section`, `prompt.attachment`,
`skill.prompt`, `attribution.text` and `session.receive` answer from their own argument: `() =>
({isOffered: true})`, `(e) => ({description: e.description, argumentHint: e.argumentHint, isHidden:
e.isHidden})`, the two lists handed back, `{suggestions: []}`, `{value: void 0}`, `HT(name)` for the five
that return `{text: e.text}`. The other fifteen read the engine's slash-command table, tool list, config
schema, teammate registry or session store, and a core answering from an absent registry would be a
fabricated answer; they stay open, recorded in `question.md`.

**Sites come with the cores, because the source pairs them.** `Mm(e, n)` is `{site: zd[e], core: {name:
"core", isCore: !0, budgetMs: 0, run: async (r) => n(r)}}` (chunk-sfn1dbxq.js [459384,459472)), so a core
registered without its site is a chain with no argument rules and no result check. Each of the twelve sites
is the source's own descriptor, copied range for range: the checks (`Or` for suggestions, `go` for
command.describe, `xo` for config.describe, `gr` for prompt.context), the restores (`vr`, `we`, `Gi`/`zi`,
`m$`), the settles (`Ki`) and the measures (`wr`, `mt`).

**Registration order is load-bearing.** `Mm` reads `zd[name]` when it is called and the copied cores call it
at module scope, so the sites must be in the host's map before ./plugin-chain-cores-source.ts evaluates. That
is why the sites have a module of their own (`src/plugin-chain-sites-registration.ts`, whose body registers
all twelve) and why `./plugin-chain-registry.ts` imports it on the line above the cores: a single module
registering both would build the cores first and pair every one with an undefined site.

**What landed.**

| Product file | What it now does | Source |
| --- | --- | --- |
| `src/plugin-chain-sites-source.ts` | the twelve site descriptors and the bodies their closure needs | 57 blocks / 12,327 units of 3 modules |
| `src/plugin-chain-cores-source.ts` | the twelve cores, the two projections, `Cht` and `HT` | 16 blocks / 1,282 units of chunk-sfn1dbxq.js |
| `src/plugin-chain-sites-registration.ts` | registers the twelve sites as it evaluates | `registerChainSite` per `event` name |
| `src/plugin-chain-registry.ts` | registers each chain's core through the copied `Mm`/`HT` objects | the source's own pairings |
| `src/plugin-chain-host.ts` | one new port, `rse` | chunk-m7864yc0.js [2196,2237) |

**One copy, not two.** Ten bodies the sites close over (`B`, `C`, `L`, `Me`, `er`, `fe`, `m$`, `ne`, `tT`,
`we`) are already verbatim in `./plugin-chain-source.ts` from the same chunk, so the sites import them and
the plan carries no second copy; seven were added to that plan's export list and the file regenerated
otherwise unchanged. The generator's export check needed a real fix for `m$`: `(?:var|let|const|function|class)\s+m\$\b`
never matches `function m$(…)` because `$` is not a word character and the boundary after it does not exist.

**The port, and the reason with it.** `Loe` (chunk-btcaa7nx.js [1595,1628)) is `rse(s(content))`; `s` and the
code-point set `klt` reads are copied with it, and `rse` is the host port: its source body is `z().neutralize(e)`
and `z` (chunk-m7864yc0.js [2068,2196)) is the auto-memory provider accessor this product does not carry.
`Nbr` calls `Loe` for instruction files of kind `"AutoMem"` and no such record exists here, so the port hands
the normalized text through, marked as a port with that reason.

**Corrections made while building, recorded rather than hidden.** (1) Three blocks an earlier pass had added
were *import statements*, not helper bodies (`[663,719)` the `/{$bunfs}` `gl`/`ne`/`Yc`/`hf` line,
`[1226,1402)` the thirty-name chunk-m4qpskd4 list, `[1642,1688)` `L` from chunk-6q0v3ahc), and the notes
written beside them described helpers those ranges do not contain. The closure probe had reported a
declaration offset that happened to be an import; a copied `import … from "/$bunfs/root/…"` could never
resolve in the product. Removing them cost nothing: the names are unused by these bodies, and the closure is
zero undeclared with no bunfs import. (2) `Sho` and the invisible-character pattern `i` (chunk-btcaa7nx.js
[1757,1838)) were missing because the undeclared scan treats every identifier in a declaration position as
declared; the four names it was hiding were found by reading `klt` rather than trusting the count.

**Divergences recorded, not hidden.** (1) Nothing in the product raises these twelve events yet, so the cores
answer when a caller dispatches by name and the surfaces they describe (offering an agent, describing a
command, marking telemetry) do not appear. (2) `rse` is the identity where the source neutralizes through an
auto-memory provider. (3) The four post-processed names pass through `TDe`, which is the identity because
`tIt` is not carried. (4) A core's answer is not re-checked by its site: the runner reads `Je = ae(e) ? void 0
: r.check?.(…)` and `ae` is true for a core, so the site's rules run on a hook's answer, which the driver
asserts rather than works around.

**Verification.** `npm run check`, `npm run build` and the notices check pass; `verify-chain-copies` reports
passed true over 13 plans and 26 byte-identical files; the two new copies scan 0 unresolved (sites 79
declared, cores 21). `test/plugin-chain-cores.test.ts` 3/3 (new), full suite 1,296/1,296.
`.audit/w45-chain-cores-compiled.mjs` drives all twelve chains, the pairing and the refusal against `dist/`
(`W45ChainCoresCompiled.v1`); the W45-10, W45-9 and W45-8 drivers still pass. Identity `7462bec6…` (inputs 279
/ validation 111 / build 199).

## W45-12 landed: the two generated site families (2026-10-15)

**The gap W45-11 left.** Twelve sites were in the table, but the source's `zd` is mostly *generated*:
`zd = {...co(Q$n, se), ...co(HFs, Bbr), …}`, where `co(names, build)` folds a name list into a site table and
the two lists are `Q$n` (63 value events) and `HFs` (32 classic hook events). None of those 88 names had a
site, so a plugin module answering any of them found nothing beneath its chain.

**The package is the source's own partition.** `HFs` is `ao.filter(e => e !== "classic.PreToolUse")` and `ao`
is `Ewr.map(e => "classic." + e)`, so the generated classic family excludes by construction the one event the
source writes by hand; copying both families leaves no half-covered family behind. The three hand-written
sites (`classic.PreToolUse`, `tool.call`, `tool.check`) and the seven value events the table overrides by hand
(`ui.open`, `ui.close`, `ui.blit`, `env.get`, `env.set`, `state.get`, `state.set`) are therefore *not* in this
package, and the registration skips the seven rather than giving them the generated descriptor: the source's
table holds a different one for those names, so the generated site would be a contract the source does not
hold. The tool sites and `classic.PreToolUse` drag the lodash `pickBy`/`baseIteratee` subtree (four closure
passes, still expanding at ~1.6k units), so they wait for a package that takes that subtree as its subject.

**The two rules, as the source builds them.** `se` gives a value site `{event, check: C(t => Me(t, "{ value }",
o => Object.hasOwn(o, "value")))}`: an answer must carry `value`, or `deny`. `Bbr` gives a classic site
`{event, check: C(Ur), checkArgument: jr}`: `jr` pins the envelope (`Mr`, twelve keys) and `Ur` checks the
result, which is where `Dr`'s wrong-type sweep and `$r`'s `permissionDecision` rule run. Both are copied byte
for byte, together with `Lr`/`Fr` (the updated-permission checks the decision rule reads), `Ie`/`g$`/`rlt` (the
text-list rules the value checks share) and `CH`/`y`/`BE`/`zW` (the permission modes the classic rules compare
against).

**Registration.** The two families are spread after the twelve hand-written sites, in the source's order, in
`src/plugin-chain-sites-registration.ts`: `for (const [name, site] of Object.entries({...co(Q$n, se), ...co(HFs,
Bbr)}))` with the seven overridden names skipped. The module evaluates before the cores, so the proxy's map is
filled before `Mm` reads it.

**These names never reach `ga`.** `ga(name, ctx)(event)` reads `tht[e](r)`, and `tht` carries the engine's own
thirty-eight chain names only: no `classic.*` key, no value event. The source's hooks subsystem hands
`zd[name]` to `aP` directly (`$go = (e, t, o = {}) => aP({e, handlers: t, site: zd["classic.PreToolUse"], …o})`),
which is why these sites are reachable by name and by site table rather than by the engine entry. Measured,
and asserted in both the regression and the driver, rather than assumed.

**One copy, not two.** `B`, `C`, `L`, `Me`, `er`, `m$` are imported from `./plugin-chain-source.ts` and `at`,
`re` from `./plugin-chain-sites-source.ts`, all already verbatim from the same chunks.

**A tool fix, so the trap cannot recur.** The closure probe had three times reported a declaration offset that
was in fact an `import … from "/$bunfs/root/…"` statement; copying one emits an unresolvable specifier (and once
produced `SyntaxError: Identifier 'Vn' has already been declared`). `.audit/w45-11-missing.mjs` now classifies
any candidate whose declaration site is an import and prints `IMPORT <name> from <spec>` instead of a range.

**Verification.** `npm run check`, `npm run build` and the notices check pass; `verify-chain-copies` reports
passed true over 14 plans across 26 modules; the new copy scans 0 unresolved / 38 declared.
`test/plugin-chain-classic.test.ts` 3/3 (new), full suite 1,299/1,299.
`.audit/w45-chain-classic-compiled.mjs` (`W45ChainClassicCompiled.v1`) confirms 101 registered sites (12
hand-written, `prompt.edit`, 56 value, 32 classic), the per-family key shape, the rules' own sentences, and
`tht`'s lack of any classic key, against `dist/`. Identity `daa6f0e1…` (inputs 281 / validation 112 / build
200). Evidence: `research/ports/W45-chain-classic-evidence.json`.

## W45-13 landed: the seven value sites the table overrides by hand (2026-10-15)

**The gap W45-12 left.** Its registration skipped seven value events because the source's table holds a
different descriptor for them. That descriptor is the hand-written entry in the table's own column list:
`zd` is `{...co(Q$n, se), ...co(HFs, Bbr), "ui.open": Ni, "ui.close": Hi, "ui.blit": oa, "env.get": Si,
"env.set": Oi, "state.get": Pa, "state.set": Ha, …}`, and object-literal order means the later key is the
one a plugin meets.

**What each of the seven adds.** `check: se(name).check` for five of them and `check: Er` for the two
setters, plus the argument rule the generated site does not have: `ui.open` pins the pane id; `ui.close`
chains four refusals (the id shape through `ZPt` with the 64-character limit `jbr`, a changed id, a missing
origin, and an origin that is not the engine's `Rt`); `ui.blit` pins requestId, key and whether a source
was given at all; `env.get`/`env.set` pin the variable name (`Nt`); `state.get` pins the plugin/key/id
reference (`Bt`); `state.set` pins ifVersion and previous (`Fn`) and restores the two keys a rewrite drops
(`restoreArgument: we(["previous", "ifVersion"])`).

**`Er`, and why the setters are not the generated check.** `Er` is `Me(e, "{ value }", …) ?? et("deny", e,
o)`: it refuses a `deny` that arrives after the `next()` beneath the hook was already answered (`a deny
after its next() was answered (deny in place of next)`). That clause is only reachable through the two
setters, so it is copied with them.

**The registration expresses the override instead of skipping it.** The two generated families are spread
first and the seven are registered after them, in the table's column order; a later `registerChainSite`
wins, which is exactly the source's spread. The observable difference is the `checkArgument` (and, for
`state.set`, `restoreArgument`) the generated value site lacks, and that is what the regression and the
driver assert.

**A measurement worth recording.** `we(keys)` is `(t, o) => m$(keys, t, o)` and `m$` restores a key only
when the passed object does not own it: the first probe passed `{previous, ifVersion}` itself and got the
object back unchanged, which reads as a no-op until `m$`'s body is read. The regression asserts both
halves, a dropped key filled back and a key the rewrite owns left alone.

**Verification.** `npm run check`, `npm run build` and the notices check pass; `verify-chain-copies` reports
passed true over 15 plans across 26 modules; the new copy scans 0 unresolved / 25 declared.
`test/plugin-chain-override-sites.test.ts` 3/3 (new) beside the classic and cores files at 3/3 each, full
suite 1,302/1,302. `.audit/w45-chain-override-sites-compiled.mjs` (`W45ChainOverrideSitesCompiled.v1`)
confirms 108 registered sites, each of the seven being the hand-written site object itself, the rules'
sentences, `Er`'s deny clause and the restore semantics, against `dist/`. The two files that asserted the
old state (`test/plugin-chain-classic.test.ts`, `.audit/w45-chain-classic-compiled.mjs`) were updated with
it. Identity `790c9e63…` (inputs 283 / validation 113 / build 201). Evidence:
`research/ports/W45-chain-override-sites-evidence.json`.

## W45-14 landed: the three hand-written classic sites and the lodash stack beneath them (2026-10-15)

**The gap W45-12 and W45-13 left.** With the two generated families and the seven overridden value
events landed, three names of `zd` remained: `classic.PreToolUse`, `tool.call` and `tool.check`. The
first is excluded from the generated classic family on purpose (`HFs` is `ao.filter(e => e !==
"classic.PreToolUse")`); all three are written out by hand in the table's column list, and all three
close over a slice of lodash through `ua`, the memoized map-values the classic settle calls.

**The three sites.** `Ua` [104152,104568) 416 units is the `classic.PreToolUse` site: `check` reads the
three classic decision keys, `checkArgument: Vt` pins the tool call's own envelope (`Gn` is `["tool",
"tool_use_id", "agentId", "consent", $shadowed]`, not `tool_name`), `restoreArgument` fills the
`$shadowed` key a rewrite dropped and `settle` folds the answer through `zn`. `Ba` [105113,105501) 388
units is `tool.call`: `check` refuses an answer that is `neither { result } nor { deny }`,
`pinnedKeys: ["tool", "tool_use_id", "agentId"]`, `stripResult` keeps the shadowed result only when a
read-only hook beneath answered the same one, and it is the one site with `measure`. `Ka`
[105602,106133) 531 units is `tool.check`: `check` refuses anything but the three decisions,
`checkArgument` refuses a hook that asks about another call instead of answering `{ decision }`, and
`restoreResult` puts back the ceiling the call was made with.

**The lodash stack, measured this time.** Q-087 recorded four expansion rounds with no convergence seen.
The recon walker (`.audit/w45-13-closure.mjs`, pass limit raised to 40) converged: the closure is
exactly memoize over map-values, and it is four modules, all copied:

| copy | module | blocks | units |
| --- | --- | --- | --- |
| `src/plugin-chain-lodash-memoize-source.ts` | chunk-t2x9eyac.js | 20 | 1,231 |
| `src/plugin-chain-lodash-internals-source.ts` | chunk-4bw62nzm.js | 146 | 10,343 |
| `src/plugin-chain-lodash-mapvalues-source.ts` | chunk-3cynezh1.js | 5 | 363 |
| `src/plugin-chain-classic-sites-source.ts` | chunk-nyce03br.js + chunk-m4qpskd4.js | 32 | 4,236 |

The chain's own memoize copy (`src/plugin-chain-memoize-source.ts`, chunk-ae84tp6z.js, 2 blocks 4,648
units) was already in the product from W45-10; its export list grew from `V`/`po` to fourteen names
because the lodash copies read the rest of its bodies rather than copying them a second time. The
subtree is therefore 173 new blocks / 11,937 units plus five already-carried blocks, not the estimated
"~1.6k units and still expanding" Q-087 recorded.

**Two ports, both in the internals copy.** The bundle wraps chunk-4bw62nzm.js in a CommonJS preamble, so
its free `module` object appears twice in the copied bodies. An ESM copy has no such object: `typeof _ ===
"object"` is false, which selects the free-variable arm the module uses when it is not loaded by
CommonJS, and `H` feeds an `isBuffer` check that resolves to its always-false arm (`wo || gt`). Both are
declared once as `var _ = undefined;` / `var H = undefined;` with the reason beside them; no body text was
rewritten. The second is the one worth naming: without it the copy would look for a `Buffer`-shaped
object that cannot exist here.

**One wiring mistake worth recording.** The first run of the lodash-memoize copy imported all fifteen of
its cross-chunk names from the internals copy. `scripts/source-undeclared-scan.mjs` cannot see this (an
import counts as declared), so the copy scanned clean and failed at runtime with `does not provide an
export named '$8e'`. Every name was then resolved to its owning module with acorn and the line split in
two: `{$8e, Cxr, KMt, L8e, Pxr, Rxr, T1e, YMt, qMt, uU, wwe, xxr, zZ, zpe, zse}` from the internals copy
and `{Hwe, aA}` from the chain's memoize copy. The undeclared-name scan proves a copy's closure, not its
provenance; only the plan's export pins and a measured run do that.

**Minified-bundle hazard, fourth occurrence in a new form.** Merging the four lodash chunks into one
generated file threw `Identifier 'P' has already been declared`: the same helper name is declared in
several chunks, and a copy may only contain one declaration of each. The fix is structural and already
the rule here: one generated file per source chunk, exporting only what crosses.

**Registration.** The registry goes from 108 to 111 sites: the twelve hand-written descriptors,
`prompt.edit`, the 56 generated value events, the 32 generated classic events, the seven overridden value
events and these three.

**Verification.** `npm run check`, `npm run build` and the notices check pass. `verify-chain-copies`
reports passed true over 19 plans across 28 modules, and all five copies in this package scan 0
unresolved. `test/plugin-chain-classic-sites.test.ts` 3/3 (new), focused chain files 12/12, full suite
1,305/1,305. `.audit/w45-classic-sites-compiled.mjs` (`W45ClassicSitesCompiled.v1`) confirms against
`dist/` that each of the three names carries the hand-written site object itself, the pinned keys, the
rules' sentences measured with a changed `tool` key, `stripResult`'s read-only condition, `restoreResult`'s
ceiling and both settles. Three files that asserted the old state were updated with it:
`test/plugin-chain-classic.test.ts`, `test/plugin-chain-override-sites.test.ts` and
`.audit/w45-chain-classic-compiled.mjs` (108 to 111), and `test/plugin-chain-memoize.test.ts` now pins the
memoize copy's fourteen-name export boundary where it pinned two. Evidence:
`research/ports/W45-classic-sites-evidence.json`.

**Left open.** No host in this product raises a classic hook event or a value event, so a plugin that
answers these names still has no dispatcher; that is Q-088, separate from the copies landed here.

## W45-15 landed: the classic PreToolUse raise point (2026-10-15)

**What Q-088 asked for.** Every site the source's table names is now registered, but nothing in the
product raised a classic hook event, so a plugin answering `classic.PreToolUse` had no dispatcher. The
source has one, and it is its own bridge rather than something to invent: `tool.call`'s core *is* the
classic PreToolUse raise.

**The source's chain.** `Mo = (e, r = RFe()) => Jl("classic.PreToolUse") ? { "tool.call": ke(e, r) } : {}`
(chunk-kwp08k6x.js [17723,17793)) is the gate: the tool call is wrapped only while a classic PreToolUse
hook exists. `ke`'s `run` builds the envelope with `rIt` and dispatches `$go(i,
P0("classic.PreToolUse", e), {signal, origin: aJ(e), bottom})`, folding a denial through `xe` and a
rewrite through `ye`; `$go` (chunk-nyce03br.js [121822,121896)) is one line,
`(e, t, o = {}) => aP({e, handlers: t, site: zd["classic.PreToolUse"], ...o})`, which is the product's own
executor `aP` with the product's own registered site table. The answer's meaning for a caller is
`mDe` (chunk-sfn1dbxq.js [504309,504681)).

**Copied.** Thirteen blocks / 1,700 units over three modules into
src/plugin-chain-tool-raise-source.ts: the envelope (`Da`, `No`, `rIt`), the record an answer is kept in
(`RFe`, `CFe`, `a8`), the dispatcher (`$go`), the three bodies the tool-call core is built from (`xe`,
`ye`, `ke`), the gate (`Mo`) and the answer mapping (`p_t`, `mDe`). The plan is
research/ports/W45-tool-raise-blocks.plan.json; `zd` is imported from the host, where it is already the
registered table, so `$go`'s body is copied unchanged; the shared rules come from the copies already in
the product (`P0`/`aJ`, `Jl`, `aP`/`m$`, `Gn`/`Ude`/`je`/`j$n`).

**One port, and one host seam.** `xe`'s sentence is `Hook PreToolUse:${e.tool} ${Pet("deny")} this tool`;
`Pet` is the source's text lookup in the unported catalog, so the word is the host's — the product's own
wording for a denied decision. The seam is `src/plugin-chain-tool-raise.ts`: `m_t`'s own call is
`$go(b, [M, ...P0("classic.PreToolUse", h), X], {signal, origin: aJ(h)})` with `M` the managed pass and
`X` the settings core, and this product dispatches its settings hooks in ./hooks.ts, so those two slots
arrive as inputs and the module handlers are the part of `m_t`'s list the product has. The answer joins
the product's single permission path in src/agent.ts, which is what makes a deny, an ask and a rewrite
behave exactly as the native hook's do.

**Three measured facts, each of which changed an assertion.** The envelope keeps the key with no call
id (`tool_use_id: undefined`) rather than dropping it. Raising with no module hooking the event throws
the source's own `no implementation for classic.PreToolUse`, because `$go` passes no core and the chain's
bottom has none — which is why the product gates on `Jl`, the source's own gate. And `mDe`'s deny arm
returns early: a denial carries the reason and the context but **drops** `updatedInput`, so a hook that
both denies and rewrites loses the rewrite. All three are asserted as measured.

**Verification.** check / build / notices pass; `verify-chain-copies` reports passed true over 20 plans
and 40 byte-identical files; the new copy scans 0 undeclared. `test/plugin-chain-tool-raise.test.ts` 3/3
(new: the envelope's three shapes, the gate with its cores and answer mapping, and the agent's tool path
under a denial and under a rewrite), full suite 1,308/1,308.
`.audit/w45-15-compiled.mjs` (`W45ToolRaiseCompiled.v1`) drives the same three against `dist/`, including
one tool call through `Agent` whose denial stops the tool and one whose rewrite reaches it; all nine W45
compiled drivers exit 0. Identity `9e2093c2…` (inputs c6912906 / 294, validation 3ae1b796 / 115, build
d6c1871f / 207). Evidence: `research/ports/W45-tool-raise-evidence.json`.

**What Q-088 still holds.** One classic event now has a raise point. `classic.PostToolUse`,
`classic.PostToolUseFailure`, `classic.PostToolBatch`, `classic.PermissionRequest`, `classic.PermissionDenied`
and the value events (`ui.*`, `env.*`, `state.*`) are still raised by nothing, so a plugin answering them
is still waiting for a dispatcher.

## W45-16 landed: the generic classic raise (2026-10-15)

**What the source has.** Every classic event other than `PreToolUse` shares one raise: the product's hook
runner asks `Q_t(name)` (`Gnr(name) && Jl("classic." + name)`) and, when the gate is open, calls `Ikt`
(chunk-sfn1dbxq.js [562773,563154)). `Ikt` names the site with `FDe`, waits out a module whose hooks are
still loading through `Cro`/`N5t`, dispatches with `aP` over the two `xkt` arms the engine's configured
hooks and the plugin modules, and folds the answer with `h7n` into the record list its caller reads
(`p7r` is just `list.some(r => r.blocked)`). `le` and `fe` are the same pair on the chain's own test
surface, and `Bde` is what the pre-gate rejects with after an abort. All of that is now copied: 18 blocks
/ 2,095 units over four modules, 16 exports.

**One body adapted, and why.** `Ikt` builds its outer arms with `xkt(e, …)` over `e.runClassicHooks` — the
engine's configured-hook runner. In this product those hooks are ./hooks.ts's, they answer with one
aggregate `HookResult` rather than the per-hook `{command, succeeded, output, blocked}` records `xkt`
accumulates, and on the tool path they have already run before the chain event is raised. So
`src/plugin-chain-classic-raise.ts` is `Ikt`'s body with those two arms arriving as `managed`/`core`
inputs, raising through the copied `znr` and folding with the copied `h7n`; `xkt`, `mkt`, `QY` and `ckt`
are not copied, which also keeps lodash's `omit` (`qs = dy`) out of the closure. The one measured
difference that follows is recorded in the seam's header: `znr` passes one origin to both the pre-gate and
the dispatch where `Ikt` passes `void 0` to the gate, and that origin reaches only the pre-gate's
diagnostic text.

**Two ports, both small.** `pn` is `Bun.stripANSI`, which this product does not have; its single call site
here reads the last non-empty line of a hook's output, so the host supplies the strip. `K()` and `se()`
are the session id and the working directory; `fe` spreads the payload over both, so ./agent.ts hands in
`this.session.id` and `c.workspace`.

**Measured, then asserted.** The gates: `classicEventRaised('PostToolUse')` is false with nothing hooking
it and true with one module whose pattern names it, while `classicEventRaised('PreToolUse')` stays false
even then — `Gnr` excludes the event the tool call owns (W45-15). The fold: a `{block, additionalContexts}`
answer becomes `[{command: 'classic.PostToolUse hook', succeeded: false, output: <block>, blocked: true}]`
and `gkt(answer)` returns the same text, while a `{updatedToolOutput}` answer folds to `[]` with `block`
undefined. The agent path: a module hooking `classic.PostToolUse` replaces the tool's own result and adds
its context to the same message, and a module hooking `classic.PostToolUseFailure` leaves the tool's error
text alone and adds its block as the feedback — the same `post` result object both times, so a block or a
rewrite is handled once.

**Verification.** check / build / notices pass; `verify-chain-copies` reports passed true over 21 plans
with the new copy at 18 blocks / 2,095 units / sha256 `b459423a…`, and it scans 0 undeclared.
`test/plugin-chain-classic-raise.test.ts` 3/3 (new: the hook input and the gates, the fold and `gkt`,
and the agent's tool path for both post events), full suite 1,311/1,311.
`.audit/w45-16-compiled.mjs` (`W45ClassicRaiseCompiled.v1`) drives the same against `dist/`; all ten W45
compiled drivers exit 0. Identity `44af8e35…` (inputs 25389244 / 297, validation 8a740f93 / 116, build
60d741f6 / 209). Evidence: `research/ports/W45-classic-raise-evidence.json`.

**What Q-088 still holds.** Classic events now have a raise and two of them have a call site.
`classic.PostToolBatch`, `classic.PermissionRequest` and `classic.PermissionDenied` are legal names with
the same raise available and no product call site yet; the value events (`ui.*`, `env.*`, `state.*`) are
not classic events and still have no raise point at all.

## W45-17 landed: classic.PostToolBatch on the batch boundary (2026-10-15)

**No new copy, and that is the finding.** W45-16 already holds the whole raise, so this package is a call
site and a rule. The source's own site is `Hkn` (chunk-sfn1dbxq.js [3062957,3063491)): it gates on the
configured-hooks registry, builds `{...$d(session, cwd, …), hook_event_name: "PostToolBatch", tool_calls}`
and then runs `KT` — of which this product has the raise and ./hooks.ts has the configured hooks. The
batch's entries are the source's caller's own construction (chunk-5b2hxy2e.js [123669,124114)):
`{tool_name, tool_input, tool_use_id, tool_response}`. Unlike the single events, `Hkn` spreads no `_X`
tool aliases, so the batch input carries `tool_calls` and nothing else, and that is what the product sends.

**The rule, and the source's sentence.** The same caller discards a batch block: `if (N.blockingError ||
N.preventContinuation) t(...)` — the turn already ended by a tool result and no model re-invoke follows, so
the block is logged, not applied. `src/agent.ts` raises the event next to the native `PostToolBatch` hook,
pushes the answer's `additionalContexts` through that hook's own context message, and logs the discard with
the source's sentence. Measured: a blocking answer leaves `run` returning `end_turn` and the trailing reason
reads `preventContinuation`, because the source's fallback chain finds neither `blockingError.blockingError`
nor `stopReason` on a `{block}` answer — the fallback is the source's, not an invented default.

**Measured, then asserted.** The hook input's exact key set; the gate open only while a module's pattern
names the event (a batch turn with nothing hooked logs nothing); one batch of two calls reaching the hook as
two entries in call order with their own results; the context message; and the discard line. The event names
now live as `CLASSIC_POST_TOOL_USE`/`CLASSIC_POST_TOOL_USE_FAILURE`/`CLASSIC_POST_TOOL_BATCH` in
`src/plugin-chain-classic-raise.ts`, so the tool path names them in one place.

**Verification.** check / build / notices pass; `verify-chain-copies` still reports passed true over the same
21 plans (nothing was added); `test/plugin-chain-classic-batch.test.ts` 3/3; full suite 1,314/1,314; all
eleven W45 compiled drivers exit 0, the new one `.audit/w45-17-compiled.mjs` printing
`W45PostToolBatchCompiled.v1`. Identity `96183297…` (inputs 193c4f39 / 297, validation 73286c90 / 117, build
060d2531 / 209). Evidence: `research/ports/W45-classic-batch-evidence.json`.

**What Q-088 still holds.** `classic.PermissionRequest` and `classic.PermissionDenied` are raised by the
source's permission layer (`dze`/`I9r`) and consumed as `permissionRequestResult` and `retry`; the value
events (`ui.*`, `env.*`, `state.*`) still have no raise point at all.

## W45-18 landed: the two permission-side events, one raised and one measured shut (2026-10-15)

**The source first.** Both sites live in the same module and are read in full before anything is wired.
`dze` (chunk-sfn1dbxq.js [3063858,3064190), input schema `aK` chunk-r2vtj1kh.js [192753,192908)) builds
`{hook_event_name:"PermissionRequest", tool_name, tool_input, permission_suggestions}` over the shared
`fe` base — no `tool_use_id` — and its consumer `sxr` [3317869,3319984) reads the answer as
`z.permissionRequestResult`: an item without that field is skipped, `allow` returns
`{behavior:"allow", updatedInput:V.updatedInput ?? r, decisionReason:{type:"hook",hookName:"PermissionRequest"}}`,
and `deny` returns `{behavior:"deny", message:V.message || "Permission denied by hook"}`. `I9r`
([3063491,3063858)) builds the same shape for `PermissionDenied` with `tool_use_id` and `reason`, and its
**one** caller ([2288685,2289127)) wraps it in
`if (tn.decisionReason?.type === "classifier" && tn.decisionReason.classifier === "auto-mode")`, reading
only `Cr.retry` and pushing the meta line `Hen` when a hook sets it.

**What that forbids.** W45-18 was drafted to raise `classic.PermissionDenied` on every deny. The caller
measurement says otherwise: the source's own denial-kind mapping (`mze` [1006956,1007251)) classes a rule
denial and a rejected prompt as `permission-rule` and `user-rejected`, neither of which raises anything,
and only the auto-mode classifier's denial enters `I9r`. This product has no classifier and no
decision-reason surface at all, so its denials are the non-raising kind: the call was **removed**, the
event name and its exact input shape are recorded in `src/agent.ts` beside the deny path, and a regression
test locks it — with the event hooked and its gate open, a `permissions.deny` denial calls the handler zero
times and the rule's own text still reaches the model.

**What landed.** `classic.PermissionRequest` on the approval path: raised after the native
`PermissionRequest` hook with the source's own fields, its answer read where `sxr` reads it, `deny` blocking
with `message || "Permission denied by hook"`, and `allow` carrying `updatedInput` through the same
permission re-check a rewritten native answer goes through. Two answer fields stay unmapped for lack of a
consumer (`updatedPermissions`, `interrupt`), as do the two optional input fields (`permission_suggestions`,
`mcp_server`) — this product has no always-allow rule store, does not own the run's abort controller inside
`authorize`, has no suggestion surface, and carries no `mcpInfo` on a tool.

**The correction the same reading produced.** Re-reading `Okn`/`P9r` ([3062119,3062552) and
[3062552,3062957)) beside the schema showed both post events declare `duration_ms` — "Tool execution time in
milliseconds. Excludes permission-prompt and hook time." (chunk-r2vtj1kh.js [193030,193147)) — which W45-16's
site never sent. The classic post input now measures the tool's own call and carries it.

**Measured, then asserted.** `.audit/w45-18-probe.mts` first, assertions after: the input key set of the
approval event; allow/rewrite/deny-with-message/deny-without-message through `Agent` with the prompt count
as the observable (0 against a 1 baseline); the unmapped denial with the handler's own recorded inputs as
the observable (0); and `duration_ms` on a tool that sleeps 12 ms reading 13.

**Verification.** check / build / notices pass; `verify-chain-copies` still reports passed true over the same
21 plans (nothing added); `test/plugin-chain-permission.test.ts` 3/3; focused set 24/24; full suite
1,317/1,317; all twelve W45 compiled drivers exit 0, the new one `.audit/w45-18-compiled.mjs` printing
`W45PermissionCompiled.v1`. Identity `82806551…` (inputs e3bd2e99 / 297, validation 53f9298f / 118, build
60a50e5e / 209). Evidence: `research/ports/W45-permission-evidence.json`.

**What Q-088 still holds.** Every classic event with a product raise point is now wired; `classic.PermissionDenied`
is measured shut rather than approximated, and the value events (`ui.*`, `env.*`, `state.*`) still have no
raise point at all.

## W45-19 recon: the value events are raised by the plugin-call path, not the classic raise (2026-10-15)

**What Q-088's last item actually is.** The value events (`ui.*`, `env.*`, `state.*`) have sites and a
gate but no dispatcher. Reading the source shows why they cannot share the classic raise: they are raised
by the module-to-host **call** path. A plugin's `$` object funnels every method into one raiser
(chunk-nyce03br.js: `s=(a,f={})=>{r("ui.toast",{text:String(a),...typeof f.timeoutMs==="number"&&{timeoutMs:f.timeoutMs}})}`,
`i=(a)=>{r("ui.status",{text:a===void 0||a===null?void 0:String(a)})}`), and the host side of that raiser is
`Hze` (chunk-sfn1dbxq.js [1842591,1843388) 797 units): the same shape as the classic raise — `P0` handler
collection, `N5t` hooks-still-loading wait, `aP` dispatch, `aJ` origin — with two additions, a `bottom`
default action and an answer read as `{value, deny}` instead of `{block}`. Its `bottom` comes from the call
table (`"ui.status":{check:(n)=>n?.text===void 0?void 0:LVe(n.text), run:lJt("ui.status",(n,r)=>LWt(n.text,r))}`),
whose `run` wrapper is one line (`lJt` [2343880,2343964): `(e,n)=>(r,s)=>(n(r,s.plugin),$2e(s.plugin,e,r.text),Promise.resolve(void 0))`).

**Nothing of that path is in this product**, which is the raise gap stated precisely: no `$` object, no
call table, no `Hze`. What the product does have is the endpoints two of those names need — the status line
(`events.status`, src/agent.ts and src/cli.ts) and the module log sink (`uiLogSink`/`pendingUiLog` in
src/plugin-chain-records.ts, `mce` = `$.ui.log`).

**The cost, measured.** `.audit/w45-13-closure.mjs` seeded on `Hze` converges at 797 + `Cme` 177 + one false
positive (the walker counts property names as free names, so `s.run` pulled a top-level `run`; accounted for,
not copied). The first pass read that as about 2,128 units over 6 modules; the second pass corrected it (see
the next section) to about 1,970 over 3: `Hze` 797, `Cme` 177, `tIt` 505, the well-formed statement 393,
`Yc`/`hf` 110, `ls` 14, `YPn` 33, `TDe` 64, `U$n` 27, the budget constants 35. Everything else `Hze` touches
is already ported (`P0`, `N5t`, `aP`, `aJ`, `He`, `L`, `Ooe`, `Aws`, `fo`, `zt`, `$A`, `J3e`, `Bt`, `Gt`,
`Z$n`, `mlt`, `zd`/`se`), and `$2e` is not needed at all because it belongs to `lJt`, which a product caller
supplies as its own `bottom`.

**Name resolution, mechanized.** The bundle reuses short names across hundreds of chunks, so a name is only
trusted from the *using module's own import map*: `.audit/w45-import-map.mjs chunk-n3ykh62m.js TDe` reports
the real `TDe` ([266967,267031) 64 units) and not the 525-unit impostor in chunk-24k7d6mw.js; `Gt`, `Bt`, `ls`
and `tIt` each have dozens of collisions and were resolved the same way. This is Q-089's rule as a tool, and
it is the step that would otherwise put the wrong body in a copy. The second pass then showed the resolution
is only a candidate: `Bt` and `ls` resolved into bodies whose shape contradicted their call sites, and the
bodies had to be read to find the right ones.

**Recorded, not landed.** This section is reconnaissance: the copy, the seam and the two raise points
(`ui.status` at the product's status line, `ui.log` at its log sink) are the next package, which starts from
`research/ports/W45-host-call-recon.json`. Nothing in this tick changed product behaviour, so the identity
stays `82806551…`.

## W45-19 recon, second pass: the closure shrinks to what the product still lacks (2026-10-15)

The first pass named two bodies that cannot be the ones the copy needs, and both were caught by reading
them rather than by their module attribution:

- `Bt` was chunk-yjc18bey.js [1726,1869) 143 units, a `Promise.race` over a `setTimeout`. `Z$n` calls
  `Bt.has(...)`, so the value must be a `Set`. The right body is module-local to `Z$n`'s own module:
  chunk-m4qpskd4.js [47631,47716) 85 units, `var Bt=new Set(J3e.filter((e)=>e.includes(".")).map((e)=>e.slice(0,e.indexOf("."))))`.
- `ls` was chunk-bk5ct2gw.js [482789,482826) 37 units, a function returning a string. `YPn` calls
  `ls.run(e, n)`. The right body is module-local to `YPn`'s module: chunk-n3ykh62m.js [232741,232755)
  14 units, `var ls=new jD` — and `jD` is that module's import of `AsyncLocalStorage` from `async_hooks`,
  a second instance beside the `Ve` the product already carries in src/plugin-chain-source.ts.

Reading the rest of the closure then showed that **most of it is already carried**: `zd`, `$be`, `Ooe`,
`Aws`, `fo`, `zt`, `$A`, `J3e`, `Bt`, `Gt`, `Z$n`, `mlt`, `aP`, `P0`, `N5t`, `aJ`, `He`, `L`, `se`. The
genuinely new copy is about 1,970 units over three modules: `Cme` 177, `Hze` 797, `tIt` 505, the
well-formed statement 393 (`m`, `a`, `l`, `g` in chunk-ax7r0qj7.js), `Yc`/`hf` 110, `ls` 14, `YPn` 33,
`TDe` 64, `U$n` 27 and the three copier budget constants 35.

**`U$n` needs no rewrite.** It is `(e) => Yc(e) ? e : hf(e)`, and the pair's own bodies dispatch to
`String.prototype.isWellFormed`/`toWellFormed` when the runtime has them
(`l = typeof String.prototype.isWellFormed === "function" ? Function.prototype.call.bind(...) : void 0`),
falling back to their own regexes otherwise. Both the hooks and the fallbacks are measurable text, so the
whole statement copies verbatim.

**A placeholder this package retires.** src/plugin-chain-host.ts:332 carries `TDe` as a pass-through with
the recorded reason that `tIt` was never carried and none of the four chains that used it ran. `Hze` puts
`TDe` on the path of all twelve `Cme` names (`let _e = z ? TDe(he) : he`), so landing `Hze` without `tIt`
would ship a defensive copy that copies nothing. `tIt` comes with this package and the placeholder goes.

Still reconnaissance: the plan, the seam `raiseHostCall`, the `TDe` replacement and the two raise points
(`ui.status` at the product's status line, `ui.log` at its log sink) are the next package, which starts
from `research/ports/W45-host-call-recon.json` (schema `W45HostCallRecon.v2`). No product file changed in
this pass either, so the identity stays `82806551…`.

## W45-20 landed: the module-to-host call path, and the placeholder it retires

Source-first reading: every caller of `Hze` in the bundle is the plugin-call dispatcher — `Ot` at
chunk-kwp08k6x.js [38986,39121) (the `$.` method funnel) and its twin at chunk-sfn1dbxq.js
[2356634,2356788), plus `$.prompt.read` [2341631) and `interface.call` for a two-segment name. The
engine's own status line does not pass through it (it goes through `Vyt` [494176,494224) to the bound
session) and neither does a plugin log line (it goes through `mce`, already carried). That is why this
package does **not** raise at the product's status line or log sink: those write engine text, and the
source raises `Hze` only for a plugin's method call.

What landed: the raise path — `Cme`, `Hze`, the copier `tIt`/`U$n` (with its two budgets and the
lone-surrogate pair `Yc`/`hf`), the async-local store `ls`/`YPn` and `TDe` — as 11 blocks /
2,155 UTF-16 units over four modules, generated into src/plugin-chain-host-call-source.ts, with
src/plugin-chain-host-call.ts as the typed seam (`raiseHostCall`, `hostCallCopied`).

Two corrections the measurements forced, both recorded in the file comments and the regressions:

- **The copier is change-detecting, not a deep copy.** `tIt` rebuilds only the subtree it repaired
  (`s = n.some(...); p = s ? i : e`), so a well-formed argument reaches the floor as the *same* object
  and only a lone surrogate materializes a new one, on the path to the change, with untouched siblings
  still shared. The recon's "a hooked answer object must not be the object the sink receives" was wrong
  on this ground.
- **The copier and the table's `check` run on the dispatch path only.** A name no module hooks
  short-circuits to the floor with the caller's own object, so neither can be observed there; the
  argument refusal (`Z$n`) is likewise reachable only with a module hooked, and only for a name whose
  first segment is no catalog group (`interface.call`, not `ui.log`).

The placeholder retirement is a real behaviour change: src/plugin-chain-host.ts used to hand the answer
through for the four `_yt` names; now those names copy their answer, as `ga` does in the source. The
re-export route was rejected after measuring it: host → host-call-source → host is a cycle whose
evaluation order leaves the host's consts uninitialized, so the two generated callers import `TDe` from
the copy instead.

Verified: check/build/notices pass, 22 copy plans regenerate byte-identically, the new copy scans
0 undeclared, the new regression file is 3/3, the related chain files are 71/71, full 1320/1320, the
thirteenth compiled driver prints `W45HostCallCompiled.v1` against `dist/` beside the twelve earlier
ones, and `scripts/smoke-package.mjs` passes the packaged CLI, offline install and launcher checks with
zero upstream requests. Identity `a3ea88c7…`.

## W45-22 landed the streaming half of the call path (2026-10-15)

`aGe` (chunk-sfn1dbxq.js [1843388,1844317)) is `Hze`'s streaming twin: the same `N5t` wait gate and
the same handler collection, but a streaming dispatch (`iwr` over the stage `Jx`), a floor that
relays a stream (`bottom.stream(args, caller)` plus the entry's `check`) and a withheld-result note
(`tzt`). Its callers are the plugin `$` surface's streaming dispatcher `Iye`, so like W45-20 the
product gets the seam and no call site.

What the measurements forced, all recorded in the seam and the regressions:

- **The two `Q`s are two functions.** chunk-nyce03br.js imports the abortable clock sleep
  (chunk-yjc18bey.js [1118,1503)); chunk-2kdsvp3x.js declares its own `Q`, which the streaming hop
  calls. One file may declare only one of them, so the layout follows the source's module graph:
  chunk-nyce03br.js + the clock in src/plugin-chain-stream-source.ts, the record family in
  src/plugin-chain-records.ts, the raise entry in src/plugin-chain-stream-call-source.ts.
- **A streaming provider is the module's own `streamLinks`.** A module without it is collected as a
  hop record and opens the layer below instead of producing chunks; the product surface had no such
  field, so `ChainModule.streamLinks` and its pass-through in both record factories were added.
- **A refused answer is skipped, not thrown.** The site decides the answer shape per event
  (`model.complete` accepts `{value}`/`{deny}`, `session.receive` accepts `{text}`/`{consumed}`); an
  answer the site refuses falls to the layer below with the copied `ip` effect.
- **The suffix is a state.** `tzt` says whether the *floor* ran, not how many chunks the provider
  yielded: "" / " started, and a plugin withheld its result" / " ran, and a plugin withheld its result".

Verified: check/build/notices pass, 24 copy plans regenerate byte-identically, five copies scan
0 undeclared, the new regression file is 3/3, all 14 chain test files are 67/67, full 1323/1323, the
fourteenth compiled driver prints `W45StreamCallCompiled.v1` against `dist/`, and
`scripts/smoke-package.mjs` passes the packaged CLI, offline install and launcher checks with zero
upstream requests. Identity `0b849c4f…`.

## W45-23 made the copy-gap scan scope-aware, and closed what it had hidden (2026-10-15)

The scan that guards every generated copy reported `unresolved 0` for a file that referenced an
undeclared `a8`. Its pass 1 collected declarations from every depth into one set, and minified bodies
reuse short names as parameters and loop bindings everywhere, so one function's local covered another
function's free name. References now resolve against a scope chain (module, function, block): `var` and
function declarations hoist into their function, `let`/`const`/`class` stay in their block, parameters
belong to their function, and a class expression's name lives only inside its body. The pragma line is
neutralised in place so reported lines match the file on disk.

Two false-positive classes had to be fixed on the way (class declarations were not bound at all, so the
copied error classes `He`/`Gde`/`Ye`/`Hht`/`bN` read as free names), and with those out of the way three
real gaps remained:

- `a8` in the streaming copy: the stage's `plugin: e.isCore === !0 ? a8 : e.name` reads the runner
  copy's `var a8 = "engine"`.
- `ep` (44 units) and `z3e` (13 units) in the streaming copy: the "failed closed: its .catch answered"
  effect text and the catch grace, both declared in runner ranges and reachable only through the
  stage's `.catch` path.
- `x` in the runner copy: the `fromCharCode` chunker `WMt` falls back to when `Buffer` is absent, copied
  as a new block from the module its only caller lives in (chunk-ax7r0qj7.js [1645,1850)).

Each was closed by plan edits and regeneration, with no body copied twice. Verified: check/build/notices,
24 plans byte-identical, every one of the 24 copies `unresolved 0`, the new regression file 2/2 over 11
fixtures (the first being the shape the old semantics passed), chain files 69/69, full 1325/1325, all
fourteen compiled drivers, and the packaged smoke with zero upstream requests. Identity `fead7541…`.

## W45-24 ported the ui.status and ui.log floors (2026-10-15)

The plugin-method table `Iqo(state)` (chunk-sfn1dbxq.js, literal opened at [2346570)) holds one entry
per `$` name. Two of them are this package: `ui.status` and `ui.log`, taken verbatim
([2352180,2352478) 298 units) as arrows in `src/plugin-chain-ui.ts`, since a table fragment is not a
top-level statement the generator can emit. Their bodies are copied (14 blocks / 1,490 units in
`src/plugin-chain-ui-source.ts`): `Vyt` (the session gate), `LWt` (the status writer), `Pzo`/`GCn`/
`Izo` (the ui.log routes and its check), `kye`/`Yb`/`$2e` (the length notice), `lJt` (the shared run
adapter), `uMe`, `LVe`, `HM`, `CK`, `N6`.

What the port produced, measured: an unbound session drops the write with `no session bound; dropped:
…`, a bound one receives `status(plugin, text)` (truncated at 10000, `undefined` clears it), the
transcript route logs and notifies its subscriber while the debug route only logs, an over-long text
notices once per plugin, and the two `check` refusals surface as `(host check)` only through a handler
that opens the floor.

Driving it exposed the host: `it()` handed back a fresh object every call, so the `uiLogSink`/`pendingUiLog`
fields `mce` and `GCn` write were lost (and `GCn` threw outright). The fix restores the source's own
shape — one registry object that carries both fields beside the four earlier ones. The now scope-aware
scan also reported four free names in `src/tui-custom-theme-source.ts`, an untracked copy with no plan;
that is Q-093 and the next package. Verified: check/build/notices, 25 byte-identical plans, the new copy
`unresolved 0`, 3/3 new regressions, chain files 72/72, full 1328/1328, fifteen compiled drivers, and the
packaged smoke with zero upstream requests.

## W45-26 ported the ui.toast floor and its admission policy (2026-10-15)

`ui.toast` is the third entry this port carries. Its own span is chunk-sfn1dbxq.js [2351998,2352180)
182 units, immediately before the W45-24 pair, and it is an arrow in `src/plugin-chain-ui.ts` for the
same reason: a table fragment is not a statement the generator emits. The floor `Kxo` runs the shared
gate around `session.toast(plugin, BDe(text), timeoutMs)`, and `lJt` adds the cut notice after it, so a
plugin's toast is written and then measured against the terminal's own text limit.

The policy behind it is six blocks (1,265 units) in `src/plugin-chain-toast-source.ts`: `sI`/`gLs`
name and read the `plugin-toast-<id>:<plugin>` key, `ACn`/`DWt` cap a plugin at 50 waiting toasts and
pick the one that gives way, `hLs` returns `{isWaiting, givesWay, isCutShort}`, `sLs` splits a queue,
`mLs` reports a give-way and `AQo` notes a spelling once, with `yro`/`F2e`/`fLs`/`Sqt` beside them.
The seam re-exports each under the name a surface reads it by, so a bar that owns a queue decides
exactly as the source does, and the host's own integration site (`chunk-24k7d6mw.js` [179559,179700),
ending in `addNotification({priority:fLs, waitsItsTurn})`) is recorded where the next package starts.

Measured, not asserted from reading: an unbound session drops the write; a bound one gets the text and
the timeout the plugin asked for; the check refuses a non-string text and a `timeoutMs` outside 1..60000
while accepting both bounds; the decision admits an empty bar at once, makes a toast wait behind another
plugin, cuts this plugin's own short, and gives way only at the 50th waiting toast of that plugin under a
held bar; the give-way report is logged always and noticed once per plugin and spelling, and only while a
plugin source is installed. Verified: check/build/notices, 26 byte-identical plans, the new copy
`unresolved 0`, 4/4 new regressions, ui + toast + runtime 29/29, full 1334/1334, fifteen compiled drivers
(the W45-24 driver extended to dist's toast floor), and the packaged smoke with zero upstream requests.
Identity `2c108215…`.

## W45-27 ported the notification bar's ledger core (2026-10-15)

W45-26 left the bar itself with the host; this package takes the half of it that is pure. The run
[1691480,1695123) of chunk-sfn1dbxq.js holds the whole time account, and by reading each declaration's
dependencies it splits cleanly: sixteen blocks (2,897 units) are store-free, while `Ope` (the store key
over the manifest `a8`), `TWt` (the zod schema), `SEt`/`xYr` (the store read and write) and
`lLs` (the append through them) are not, and each is recorded with its range and reason.

`tickLedger` is the seam's one entry for the driver: `aLs(cLs(previous, stored), split, now)` — merge
the store's toasts into the previous ledger, then tick. Measured against the source's own sequence: a
stored 4000 ms toast turns `wasShown` true and takes the slot; a second later it has aged by the slot's
elapsed time while the slot stands; past its time it sits at zero and the slot has no `shown`; with
nothing stored the slot slides forward a slot at a time and no toast is ever shown. Two behaviours the
tests forced into the open and the record now carries: the store holds what the last tick wrote, so a tick
merges against its own ledger, and the split admits plugin toasts only.

Verified: check/build/notices, 27 byte-identical plans, the new copy `unresolved 0`, 3/3 new regressions,
ui + toast + notify 10/10, full 1337/1337, fifteen compiled drivers (the shared driver now prints
`W45NotifyLedgerCompiled.v1`), and the packaged smoke with zero upstream requests. Identity `756c4207…`.

## W45-28 ported the notification bar's stored state (2026-10-15)

W45-27 took the bar's ledger core and stopped at the store; this package takes the other side of that
boundary. Seven blocks (863 units) across four modules carry it: the key the ledger is kept under
(`a8` "engine", `Ope`, `Pye` → `engine\x00bar-toasts`), the schema of the stored ledger (`TWt`), the
registry field the store is reached through (`s_` → `it().pluginState`, the source's own literal), and
the read (`SEt`) that parses the store's value and falls back to the frozen empty ledger.

Two findings shaped the port. `TWt` is not the schema but a `var` holding the bundle's lazy-memo
accessor, so its `p`/`RTr` are copied verbatim rather than bound — binding `p` to `z.lazy` fails
immediately (`TWt is not a function`). And the schema's other five builders are bound name by name to
the product's zod, each with the extracted declaration that identifies it; the boolean is settled by the
pair that must round-trip, and the regression drives that round-trip rather than leaning on the
neighbourhood reading.

Verified: check/build/notices, 28 byte-identical plans, the new copy `unresolved 0`, 4/4 new
regressions, ui + toast + notify + notify-store 14/14, full 1341/1339 (both failures pre-date this
package — see the note below), fifteen compiled drivers (the shared
driver now prints `W45NotifyStoreCompiled.v1`), and the packaged smoke with zero upstream requests.
Identity `023b29cb…` (read from scripts/identity.mjs by the record script itself).

The sweep's two failures and the packaged smoke's startup case are not this package's. All three reproduce
on the committed baseline: a detached worktree at `dca9c20` runs test/lsp.test.ts 15/16 and
test/mcp-progress.test.ts 7/8, and the files they live in, plus the launcher the smoke spawns, are 0-diff
against HEAD. The host is at load 15-29 from other users, where a bare `node -e ''` costs 150-170ms,
above the 90ms, 150ms and 100ms budgets those cases assert against. They are queued as their own package.

## Q-094 closed the fixture budgets that a loaded host killed (2026-10-15)

Three verification cases failed while W45-28's records were written: `test/lsp.test.ts`
(`timeouts cancel requests…`, a 3s wait behind a 150ms request timeout), `test/mcp-progress.test.ts`
(`MCP request "initialize" … timed out after 90ms`) and `scripts/smoke-magpie-startup.mjs`'s 100ms
startup deadline (`starter PID marker missing: 8-deadline-100.pid`). They are pre-existing: a detached
worktree at `dca9c20` reproduces lsp 15/16 and mcp-progress 7/8, and every file involved is 0-diff
against HEAD.

The cause is that each budget also covers the fixture's own spawn and handshake. `requestTimeoutMs`
times the `initialize` request too, and `--startup-timeout-ms` times the launcher's whole start, while a
spawned `node` costs 150-170ms on this host: the handshake expires, the child is reaped, and the log the
assertion waits for stays empty (a probe dump showed `PROBE []`). A probe child that reads one line and
appends to a file answered in 11-12ms at load 39-77, which rules out starvation.

The fixes are budgets, with the measured number in each comment: lsp `waitFor` 3s -> 15s and fixtures
150/150/200 -> 2000; mcp-progress's reporting child parameterized (plus a never-answering variant) with
budgets scaled as step < idle < total (200 / 500-700 / 900-2000) and test ceilings 5s -> 20s; the startup
driver's deadlines 100/300 -> 750/1500 behind one `startupDeadlinesMs` constant that the report reads
(it had been hardcoded `[100, 300]`). Two more sites of the same class went to 2000
(`mcp-subscriptions` 100, `mcp-logging` 200); in-process fixtures kept their budgets because nothing is
spawned. No product code changed.

Verified where the failure was produced: 30 concurrent CPU load generators (load 43-90) leave
test/lsp.test.ts 16/16 and test/mcp-progress.test.ts 8/8, the startup driver reports `passed` with
`deadlinesMs [750,1500]`, the full suite is 1341/1341 on the frozen tree, and the packaged smoke passes
with 229 files and zero upstream requests. Evidence `research/ports/W45-load-budgets-evidence.json`;
identity `949fd95c…`.

## W45-29 ported the notification bar's write half (2026-10-16)

W45-28 ended at the read of the stored ledger; this package takes the write side. Eleven blocks (1,489
units) across four modules carry it: the append (`lLs`), the write-or-skip (`xYr`, which writes unless
both the ledger and the stored one are empty and logs `$.ui.toast: the bar's toasts were not kept: …` when
the write fails), the state store's own set (`o5t`: the JSON round-trip under `jde` = 4194304
characters, the next version as one past the stored value or the floor, the write inside `ls.exit`, then
`vb`), the reader notification (`vb`) and the seat check that decides a toast's `isManaged` flag
(`Ee` over the module record and the seat table, `sOn` over `Zws` = `["prepend","append"]`). The
stored value is deep-frozen by `cho`/`OFe` over the cursor `O`, bounded by `PQt` (1e5).

Four of the names are facilities rather than logic, and they are bound in one hand-written module
(`src/plugin-chain-notify-store-runtime.ts`) instead of being faked: `ls` is the source's own
`AsyncLocalStorage` (`import{AsyncLocalStorage as jD}from"async_hooks"`), `_` and `Y` are the JSON
round-trip, and `Ci` — the plugin-state fold scheduler — is not ported. `Ci` is the whole reactivity
subsystem (readers, folds, surfaces, bump tables) and belongs to its own package, so the port records the
boundary as behaviour: with no reader registered for the key, `vb` returns silently, exactly as the source
does; with one, it throws the reader count it would have scheduled. The regression drives both sides.

The port also surfaced a real defect in W45-28's interface. That package typed `setState` inside
`getState()`'s return, but the source body calls `s_().values.setState(...)` on the store itself, so the
first append failed at runtime and `xYr` logged it as `the bar's toasts were not kept: h.setState is not a
function`. The type was corrected in the source, in the W45-28 regression fixture and in the compiled
driver's fixture — the defect only existed because the type was written from the previous package's shape
instead of from the body being ported.

Verified: check/build/notices, 29 byte-identical plans, the new copy `unresolved 0`, 7/7 new regressions,
the five related suites 30/30, full 1348 tests / 1348 pass / 0 fail on the frozen tree, fifteen compiled drivers (the shared driver
prints `W45NotifyWriteCompiled.v1`), and the packaged smoke (pack 232 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `0090b137…` (read from
scripts/identity.mjs by the record script itself, which asserts the file counts).

Next: the fold/reader subsystem `Ci` that `vb` hands work to, the `TK` clock driver at
chunk-24k7d6mw.js [478823,…), and the host toast method's stacked path `EEe` [173176,…).

## W45-30 ported the fold scheduler and closed W45-29's boundary (2026-10-16)

W45-29 ended at `vb`, which handed a changed key's readers to `Ci` and marked that hand-off as unported
behaviour: a key with a reader threw `the plugin-state fold scheduler is not ported`. This package ports
`Ci` and the cluster it drives, twenty blocks (1,781 units) over five modules, and replaces that stub
with the real body, so a plugin-state write now schedules a fold.

The scheduler's contract, as the copied bodies have it: for each reader it is given, look it up in the
store's `readers` and mark it stale in one of two pace queues — live when the reader's instance is a
terminal PromptHint, a terminal AbovePrompt while the flag store does not hold `true`, or the pane the
panes store shows; steady otherwise, and forced to steady while any of the reader's plugins is inside its
1000ms throttle window. Each touched queue then either runs at once or arms its interval's remainder
(100ms steady, 34ms live). A run resolves the stale keys back to readers, bumps their render versions
(one running counter per store, written under `key\\x00state` into the registry's `renderVersions`) and
hands every reader's instance to the store's stale listeners.

Three of the bodies the cluster needs live outside its own module and are ported too, rather than
guessed: `Ge` is the batch's marker around a store and is the identity function in the shipped bundle
(so the throttle table is a plain `Map` and the flag store is a bare `bs()`), `bs` is that one-value
flag store, and `FDn` is the frozen initial panes state. One read of the source changed the seam: the
scheduler's argument is a list of **reader ids**, not state keys — the first probe passed state keys and
folded nothing, which is how the mistake surfaced.

Verified: check/build/notices, 30 byte-identical plans, the new copy `unresolved 0`, 7/7 new
regressions, the six related suites 37/37, full 1355 tests / 1355 pass / 0 fail on the frozen tree, fifteen compiled drivers (the shared driver now
also prints `W45NotifyFoldCompiled.v1`), and the packaged smoke (pack 234 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `f14d7a4b…` (read
from scripts/identity.mjs by the record script itself, which asserts the file counts).

Next: the `TK` clock driver [478823,…), the host toast method's stacked path `EEe` [173176,…), and the
reader/mount lifecycle (`Tb`/`Gf`/`OH`/`Kf`/`xur` with `Cb`) that puts readers into the store to
begin with.

## W45-31 ported the bar's clock driver (2026-10-16)

W45-27 took the ledger's arithmetic, W45-28/29 the stored read and write, W45-30 the store's readers;
this package takes the tick that puts them in order. Two blocks (500 units) over two modules: `TK`
[478764,479204) and the hidden test it hands the split (`Cj`, `diffPanelVisible || paneHoldsToasts` —
no coercion, so two absent flags give `undefined`).

One tick receives `{clock, store, pending, last}` and, in the copied order: splits the store's queue with
the hidden test and the 4000ms fallback, ticks the previous ledger against that split with the stored
ledger merged in, cancels the timer the previous tick armed, writes the resulting ledger, remembers it,
reports the time each toast lost, refreshes the queue's texts through the store (keeping the same state
object when nothing changed) and arms the next tick at the deadline the ledger gives — keeping only the
first canceller.

Two things the read of the source settled. The driver lays out the *stored* ledger, not the queue: the
queue only decides which toast holds the slot, which is why the first probe, run over an empty store,
showed nothing to arm. And the clock's `setTimeout` returns a canceller rather than a handle — the source's
own clock facade (`mIr`/`nS`, already ported) returns `() => clearTimeout(timer)`, which is exactly what
`pending.current?.()` calls before each write.

Verified: check/build/notices, 31 byte-identical plans, the new copy `unresolved 0`, 4/4 new
regressions, the seven related suites 44/44, full 1359 tests / 1359 pass / 0 fail on the frozen tree, fifteen compiled drivers (the shared driver now
also prints `W45NotifyClockCompiled.v1`), and the packaged smoke (pack 236 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `da0b8e5b…` (read
from scripts/identity.mjs by the record script itself, which asserts the file counts).

Next: the host toast method's stacked path (`EEe` [173176,…)) and the bar component that calls the tick
(`JFe` [479204,…)), which owns the store, the refs and the unmount cleanup.

## W45-32 ported the host toast stack (2026-10-16)

W45-26 took the `$.ui.toast` floor and its admission policy, W45-27 the bar's ledger, W45-28/29 its
stored read and write, W45-30 the store's readers and W45-31 the clock driver; this package takes the
other end of the same path. Seventeen blocks (2,268 units) over three modules: `bu`, `TC`, `yee`,
`aV`, `See`, `bh`, `wee` and `EEe` from chunk-24k7d6mw.js, the constants and the fold transform
`MF`, the shallow list equality `$P` from chunk-3qabb19b.js, and the label policy `Nle`/`SKr`.

A write trims the stack by its per-plugin cap, stores it under `Pye(IF)` = `engine\u0000toasts` only
when the shallow list equality says it differs from the read one, reports every entry that left
without being drawn (an id the bar drew is in `cI` and is not reported), folds the stack through
`MF` and arms one timer for the earliest deadline — unref-ed, so it never holds the process open.

Measured rather than assumed: the cap drops the oldest member of the largest group and keeps
recursing (a managed last entry makes the filter keep every seat, which changes the group it picks);
the fold turns a spent toast into its 240ms leaving phase and drops one that is already leaving; the
timer arms `max(1, deadline - now)` and nothing while paused or empty; and the reader returns the
frozen empty array both when the store has no value and when its value is no array.

One boundary is left open and named. `Nle` is copied, but the sanitiser it resolves names through,
`Mde` (chunk-qq2mgstr.js [16350,16512)), is not: every name in it is free and its closure is the
display-text sanitiser across several modules. A closure walker was written to measure it
(`.audit/w45-32-closure.mjs`) and its scope resolution is not sound yet, so the closure is recorded
as unmeasured rather than estimated. ./plugin-chain-plugin-label.ts throws a `HooksError` naming the
block, which makes the push path (`wee`/`EEe`) inert until the next package ports it — the same
sequence the fold scheduler went through before W45-30 replaced its stub with the real body.

Verified: check/build/notices, passed true, 32 plans, the new copy `unresolved 0`, 7/7 new regressions, the seven
related suites 39/39, full 1366 tests / 1366 pass / 0 fail on the frozen tree, fifteen compiled drivers (the shared driver now also prints
`W45NotifyStackCompiled.v1`), and the packaged smoke (pack 239 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `8262af7b…` (read from
scripts/identity.mjs by the record script itself, which asserts the file counts).

Next: the label sanitiser `Mde` and its closure, then the bar component that owns the store and the
refs (`JFe` [479204,…)) with the registry literal that wires `bu`, `See` and `TC` into `it()`.

## W45-33 ported the toast module's remaining verbs (2026-10-16)

W45-32 took the stack — reader, cap, fold, writer, timer, undrawn report — out of the module that
registers it. This package takes what else that module registers and this product can reach: `IEe`
dismissToast, `pvt` expireToasts, `dV` holdToast and `bee` pauseToasts, four blocks (681 units)
in the same chunk-24k7d6mw.js.

The package boundary was measured, not guessed: each body was parsed and every identifier it reads
from outside itself was checked against the export list of every generated `*-source.ts` in src/.
All of them — `bu`, `cI`, `bh`, `MF`, `TC` — are already ported, so the four verbs close without
dragging a new subsystem in. The record also carries what the check could not settle: the general
closure walker is not trustworthy yet (two versions, two wrong answers), so the label sanitiser's
full closure stays unmeasured and only its first-order dependencies are quoted.

Three behaviours worth the read. A dismiss adds the id to the drawn set and the write it triggers
deletes it again, which is exactly how a dismissed toast escapes the undrawn report; an id the stack
never held writes nothing at all. A hold that changes nothing and a pause that does not change the
pause state both write nothing, because the stack writer is gated on the shallow list equality. And
a resume moves every deadline *and* every hold by the time the bar was stopped, so a paused toast
does not lose its place.

Verified: check/build/notices, passed true, 33 plans, the new copy `unresolved 0`, 4/4 new regressions, the eight
related suites 43/43, full 1370 tests / 1370 pass / 0 fail on the frozen tree, fifteen compiled drivers (the shared driver now also prints
`W45NotifyVerbsCompiled.v1`), and the packaged smoke (pack 241 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `722d1f50…` (read from
scripts/identity.mjs by the record script itself, which asserts the file counts).

Next: the label sanitiser `Mde` and the display-text sanitiser under it, then the registry's stores
(`edo` / `gs` / `Zco`), then the bar component `JFe` that owns the store and the refs.

## W45-35 ported the plugin-state registry (2026-10-16)

Every ported body reaches the plugin registry through `it()`. This product answered with a
hand-written literal of ten fields whose stores started at `null`; the source builds one registry per
host from its own factory. This package takes the factory: `s()` (2,367 units, 89 fields), the two
stores it installs (`Zco`, `edo`), and the three helpers underneath (`gs`, `Oe`, `Ein`) — six
blocks, 3,330 units, two generated copies, verified against their ledgers by the chain verifier.

Two things the port turned up. The source's `hooksRespawns` is a `Set`, and this seam had modelled it
as `Promise[]`; the ported `N5t` gates the respawn hop on `.size`, which is `undefined` on an array,
so the hop could never fire. And the registry has to be built lazily: `s()` reads `FDn` out of the fold
chunk, and the fold chunk imports this seam back, so an eagerly built registry reads `FDn` before that
chunk's body has assigned it — `panes.getState()` came back `undefined` until the seam moved the build
to the first `it()` call, which is where the source builds it too. The host lookup the source wraps
around the registry (`q``s memo, `B`/`Wi``s application host) stays open, with its ranges in the record.

The first write of this package landed on the path of the product's chain catalog, which already
existed and was untracked. It was restored from its file-history backup and verified by rebuilding
`dist/plugin-chain-registry.js` byte-identical to the build made before the overwrite; the new seam
lives at `src/plugin-chain-registry-state.ts`. Both the recovery and the verification are in the
package record.

Verified: check/build/notices, both copies `unresolved 0`, passed true, 35 plans, 7/7 new regressions, the eleven
related suites 81/81, full 1377 tests / 1377 pass / 0 fail on the frozen tree (the first sweep at the same concurrency failed once in an
integration fixture that passes alone and in the re-run), nine compiled drivers (the shared driver now
also prints `W45RegistryStateCompiled.v1`), and the packaged smoke (pack 244 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `dba85512…`
(read from scripts/identity.mjs by the record script itself, which asserts the file counts).

Next: the label sanitiser `Mde` and the display-text sanitiser under it (frontier measured), the bar
component `JFe`, the reader/mount lifecycle, and the rest of the `$` table.

## W45-36 ported the plugin label sanitiser (2026-10-16)

The host toast stack draws every plugin under a label it resolves through `Mde`, and W45-32 left that
one-line body unported because every name in it was free. This package takes the whole pipeline:
45 blocks, 4579 units, five modules, three generated copies — the predicate chain
(`on`/`an`/`L`/`dn`), the sanitiser `O` with its variation-selector, joiner and Mongolian-selector
rules, the visibility tests, the eight-mark budget, the trim, the fold `kt`/`Zs`, the grapheme-budget
preview `Lr` with the width machinery under it, and the truncations `ct`/`jo`/`Ar`/`Qe`/`$8` over the
product's own `Bun.stringWidth` seam.

The label path is live now: `pluginLabel('engine')` is `engine`, and the host toast stacks under the
sanitised label — the regression and the compiled driver assert the stacked entry where they used to
assert the boundary throw. What is still open is the tab and ESC-sequence expander, and under the
label path only a tab can reach it, because the fold above it replaces every ESC-class byte first;
`Mde('\u001b[31mred')` is `'\uFFFD[31mred'`, which is the source's own output, and `Mde('a\\tb')` is the
input that fails loudly. That pass is a package of its own, because this product already owns a
tokenizer and slicer to reconcile it with.

One silent defect fell out of unblocking the push path: `bindToastClock(null)` left the registry
carrying a null clock, and the copied `wee` reads `TC().pausedAt` on every push — the source's registry
builds that clock with `edo()` and never leaves it unset. Unbinding now hands the registry a fresh
factory handle, and the seam's stale comment about the field was corrected with it.

Verified: check/build/notices, all three copies `unresolved 0`, passed true, 38 plans, 12/12 new regressions, the
whole chain family 113/113, full 1389 tests / 1389 pass / 0 fail on the frozen tree (the full sweep was clean on its first run at --test-concurrency=4), 15 compiled drivers (the shared driver
now also prints `W45LabelTextCompiled.v1`), and the packaged smoke (pack 248 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `5aadcdff…`
(read from scripts/identity.mjs by the record script itself, which asserts the file counts).

Next: the tab and ESC-sequence expander as its own package, the bar component `JFe`, the reader/mount
lifecycle, and the rest of the `$` table.

## W45-37 closed the tab and ESC-sequence boundary (2026-10-16)

W45-36 ended with one block still missing under the label sanitiser: the tab and ESC-sequence
expander, which a label carrying a tab reached and failed on. This package copies it — `Epe` the
entry, `mCo` the expander, `ht` the tokenizer entry, `yt` the token reader and `mt` the C1
replacement, five blocks and 890 units — and does not copy the ESC machine they drive,
because this product already carries it: src/tui-ansi-tokenizer.ts holds `twe` [3260,3602) and
`L` [3672,6275) byte-identical to chunk-yn0pfn70.js. Reuse is only defensible when the carried body
is the source body, so .audit/w45-37-tokenizer-identity.mjs recomputes both comparisons from the
module and the file and exits non-zero on any difference.

The three throwing stubs and src/plugin-chain-text-ansi.ts are deleted. A tab now expands to the
next eight-column stop with the column tracked per line (`Epe('a\\tb')` is `'a       b'`,
`mCo(['abcdefg\\th'])` is `'abcdefg h'`), a bare escape is left alone while a C1 control is rewritten,
and a sequence survives its own tab being expanded. Through the label path: `Mde('a\\tb')` is the
expanded label, `Mde('a\\tb\\nc\\td')` is its first line elided, and `Mde('\\t\\t')` is still nothing
to draw. Both places that asserted the boundary throw now assert the expanded label, and the shared
driver prints `W45TabExpanderCompiled.v1` against dist.

One claim from the previous package was wrong and is corrected where it was made: W45-36 recorded
`check: pass` from a run that predated the test file it added. This tick re-ran `npm run check`,
found a TS7006 in that file (an unannotated callback parameter), fixed it, and rewrote the field in
`research/ports/W45-label-text-evidence.json` to say what actually happened.

Verified: check/build/notices, all three copies `unresolved 0`, passed true, 38 plans, the tokenizer identity check,
the two rewritten suites 21/21, full 1391 tests / 1391 pass / 0 fail on the frozen tree (the full sweep was clean on its first run at --test-concurrency=4), 15 compiled drivers (the shared
driver now also prints `W45TabExpanderCompiled.v1`), and the packaged smoke (pack 247 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity
`4116ca3e…` (read from scripts/identity.mjs by the record script itself, which asserts the counts).

Next: the bar component `JFe`, the reader/mount lifecycle, and the rest of the `$` table.

## W45-38 mounted the clock tick on a host (2026-10-16)

W45-31 ported the tick and W45-28 the ledger it reads, but nothing mounted either: the effect lives in
the bar component `JFe` (chunk-24k7d6mw.js [479208,479514)), which reads a clock context, a store
handle, makes two refs (`M = R(void 0)`, `L = R(RYr)`) and re-runs on the five-member array
`[h, T, ee, he, we]` — the joined notification keys, `Cj(state)` and the joined stored-ledger keys.
Its body is one line: `TK({clock, store, pending, last})` with `() => M.current?.()` on cleanup. The
sibling `XFe` [479518,479736) holds the pane: `Re(Ri(), gro)` selects whether the shown pane's
placements hold toasts, and the effect raises `paneHoldsToasts` while they do and, on release, clears
it and drains the queue.

This product has no React, so src/plugin-chain-bar-mount.ts keeps each body's logic and takes the host
layers as parameters: `createBarClockDriver` is the two refs, `mountBarClockDriver` is the effect and
its cleanup, `barClockDriverChanged` is React's `Object.is` comparison of the five members,
`barNotificationKeys`/`storedToastKeys` are the two selectors (the second through the ported
`SEt`), and `readPaneHold`/`holdPaneToasts` are the pane read and the raise/release pair.

Nothing was copied twice. `TK` and `Cj` were already in
src/plugin-chain-notify-clock-source.ts (W45-31) and `SEt`/`RYr` in the ledger copies (W45-28); the
record script asserts each declaration where it lives. The two bodies still missing — `YAt` and
`gro`, the shown-pane read behind the hold — are copied verbatim into
src/plugin-chain-bar-mount-source.ts (chunk-tvdq3hrk.js [7622,7723), 2 blocks, 101 units).

Measured before asserted, in .audit/w45-38-probe.mts: the two keys join exactly as the source joins
them (`'a b c'`, `' a'` for an empty current slot, `''` for an empty bar); mounting ticks once,
writes the ledger and arms the delay, and the cleanup cancels it; a dependency change re-runs the
effect over the same driver, so the ledger ages rather than restarts — and because the source never
clears the ref, the canceller the cleanup ran is called again by the next tick, which
`clearTimeout` makes a no-op; the pane read is true only for the shown pane with placements and
`holdToasts`; the hold writes nothing when no pane holds, and on release clears the flag before it
drains.

The queue drain is the host boundary: `processQueue` comes from the notification context `vo`
(chunk-356hrhz3.js [1735,5205), 3,470 units), which also owns `addNotification` and
`removeNotification` and is the next package.

Verified: check/build/notices, the new copy `unresolved 0`, passed true, 39 plans, the new suite 9/9, the chain
family 124/124, full 1400 tests / 1400 pass / 0 fail on the frozen tree (the full sweep was clean on its first run at --test-concurrency=4), 15 compiled drivers (the shared driver now also
prints `W45BarMountCompiled.v1`), and the packaged smoke (pack 249 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `04b7e3b5…` (read from
scripts/identity.mjs by the record script itself, which asserts the counts).

## W45-39 ported the notification queue and its ten surrounding bodies (2026-10-16)

The notification context `vo` (chunk-356hrhz3.js [1735,5205), 3,470 units) is where the bar's toasts
come from: it holds `processQueue` (the drain W45-38 handed its pane hold to), `addNotification`
and `removeNotification`, plus the mount effect and the `clearTimer`/`mountCount` pair a React
context or a local holder carries.

Ten bodies around it are pure and were copied verbatim into
src/plugin-chain-notify-queue-source.ts: the suppression gate `vps`/`QD`/`i4n` (the capability
probe answers `!1`, so the gate is a constant false — which is why the presentation input is
inert), the holder factory `I`, the drop `XXe`, the diff-panel exemption `hEe`, the key class
`D` and the priority helpers `Xmt`/`C`/`F`. The hook itself could not be lifted verbatim, so
its five pieces are transcribed with the hook's own local names kept, which makes each closure body
the module's text: `T` [1607,1707), the drain [1896,2895), `addNotification` [2895,4791),
`removeNotification` [4791,4996) and the mount effect [4997,5195).
.audit/w45-39-vo-identity.mjs extracts both sides, removes the `le(…, [deps])`/`P(…, [])` wrappers
and the two `noImplicitAny` annotations, and exits non-zero on any difference; all four closures come
back identical. The drain's hidden test `Cj` is not copied again — it is W45-31's, and the record
script asserts the declaration is still there.

What the host supplies instead of React: the store and its setter, the clock, the provider's holders,
and the two context values. `p4n`, the presentation normaliser, ends in the host capability `Rc`
(a tmux/env probe this product has no counterpart for), so a caller passes the normaliser and the
default presentation; `S = 8000` is taken as a constant because the statement it lives in also
creates a React context.

Behaviour, measured in .audit/w45-39-probe.mts before any assertion: the drain takes the
highest-priority entry only into a free slot (`[low a, high b]` gives `b` in the slot, `a` queued,
`222` armed) and does nothing at all while the slot is occupied; with a diff panel up it considers
only entries that are `exemptFromDiffPanelHold`; the push has four branches and two duplicate paths
(a queued duplicate writes `same`, an immediate duplicate re-takes the slot and writes
`changed`); an immediate notification behind a panel is held and nothing is armed for it; and the
mount effect drains what is queued on the first mount and cancels the timer on the last unmount.

Verified: check/build/notices, the new copy `unresolved 0`, passed true, 40 plans, the transcription identity
check, the new suite 14/14, the chain family 138/138, full 1414 tests / 1414 pass / 0 fail on the frozen tree (the full sweep was clean on its first run at --test-concurrency=4), 15
compiled drivers (the shared driver now also prints `W45NotifyQueueCompiled.v1`), and the packaged
smoke (pack 251 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `c7f0bece…` (read from scripts/identity.mjs by the record script itself,
which asserts the counts).

Next: the reader/mount lifecycle, the rest of the `$` table, Q-086, and the notification context
provider `a4n` with the clearTimer context it renders.

## W45-40 ported the registry's invalidation surface and closed chunk-3ph567jx.js (2026-10-16)

The seven bodies the plugin sources call when a source they were built from changes are now a product
surface: `registeredAgentExists` (`wms`, a `.has` on the registry's own map), `pluginLoadCacheOnly`
(`$Dn`, the slot itself, so "not decided" and "decided false" stay apart) and the five clears
`resetCommands`/`resetSkills`/`resetAgents`/`resetOutputStyles`/`resetWorkflows`. They are copied
verbatim into src/plugin-chain-registry-reset-source.ts (7 blocks, 306 units) and reached through
src/plugin-chain-registry-reset.ts.

The accessor they call is a host boundary, not a body: the source reads
`function it(){return a().registry}` with `a()` = `r.of(B().host)` under the memo `q(() => new n)`,
one registry per host keyed by a context value. This product has one host for the process, and
./plugin-chain-host.ts builds the same state lazily inside a function that carries the source's own
name, so the copied `it().<field>` expressions mean the same thing on both sides. The seam header
quotes [3650,3763) verbatim and .audit/w45-40-module-scan.mjs asserts that quote equals the module
text.

With W45-31's `FDn` and W45-35's literal in place, the module is fully accounted for, and the check is
derived from the ledgers rather than listed: 19 top-level statements,
12 recorded ranges (three ledgers plus the boundary), and the only
statements outside them are the module's 4 imports/exports. Nothing was
copied twice — a second copy of the registry literal would put two registries in the product and the
five clears would empty the wrong one.

Behaviour, measured in .audit/w45-40-probe.mts before any assertion: each reset moves its own slots and
no sentinel field (`pluginLoad`, `handedIn`, `hookRegistrationEpoch`, `registeredAgents` are seeded
and never move); a repeat over a cleared slot is a no-op; and the four compositions the source's call
sites build clear the union of their parts — `bM()` = `Nhr(); Fhr()`, the reset half of the
plugin-source re-read `zLr()` = `Nhr(); $hr(); Uhr(); UDn()`, `_7()` = `$hr()`, `bCn()` = `Uhr()`.
All seven fields are present in the registry literal this product installs and all seven start
unset, which is what makes a clear on a cold registry a no-op and would fail if a field were missing.

Verified: check/build/notices, the new copy `unresolved 0`, passed true, 41 plans, the module coverage check, the
new suite 6/6, the chain family (test/plugin-chain-*.test.ts) 144/144, full 1420 tests / 1420 pass / 0 fail on the frozen tree, 15 compiled drivers (the shared driver
now also prints `W45RegistryResetCompiled.v1`), and the packaged smoke (pack 253 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity
`284b02aa…` (read from scripts/identity.mjs by the record script itself, which asserts the counts).

Next: the plugin-source re-read itself — `bM`, `zLr`, `_7` and `bCn` in chunk-sfn1dbxq.js, the callers
that give these seven bodies their meaning.



## W45-41 ported the source registry (2026-10-16)

W45-40 ended with five clears that all named the same unknown: `xr()`. Reading the plugin-source re-read
(`VT`, `bM`, `Hz`, `_7`, `bCn`, `zLr`, `sc`) showed that most of what it drops is not the plugin
registry but a second store — the derived tables for markdown files, agent definitions, output styles,
workflows, commands and skills. That store is chunk-qm4226vk.js in full: 3,516 units, one class with
forty-five fields and eight methods, two helpers, and a per-host memo.

Four declarations are copied verbatim into src/plugin-chain-sources-registry-source.ts (4 blocks, 2,728
units): `o` (the `"cli"` source kind, module-internal exactly as in the source), the class, `pQ` and
`fQ`. The accessor is the host boundary, the same lowering W45-40 recorded: the source reaches the
store through `var a=new q(()=>new s)` and `function xr(){return a.of(B().host)}`, one store per host,
and this product has one host for the process, so src/plugin-chain-sources-registry.ts exports `xr()`
building the singleton on first use, plus `createSourcesRegistry()` for isolated stores. The module is
fully accounted for: nine top-level statements, one ledger's ranges plus the boundary, the only
statements outside being its two imports and its export list. `Oe()` is not copied again — W45-35's
copy is the authority, because two signal factories would make `skillsChanged` a different object from
the one other ported listeners subscribe to.

Behaviour, measured in .audit/w45-41-probe.mts before any assertion: the cold store's eighteen Maps,
four arrays, two Sets and two signals, with the four weak containers really weak (a string key throws);
`dynamicSkillStateKey()` = `"cli"`; `invalidateCommands` putting the three command tables back to
`undefined` and emptying its four Maps while `markdownFiles` keeps its entry; `invalidateSkillDirs`
clearing the current key's conditional tables and skipping the second half when the key has no state;
`clearLoadCaches` as that invalidation plus the eight derived tables; `evictDynamicSkillState("p1")`
deleting the `p1:` prefix only (`p1x:one` survives) with the state and its collision extras;
`reservedSpellingsFor` memoising per loaded result by weak identity; and `fQ` mapping both null and
undefined to `"\u0000"`.

Verified: check/build/notices, the new copy `unresolved 0`, passed true, 42 plans, the module coverage check, the
new suite 10/10, the chain family (test/plugin-chain-*.test.ts) 154/154, full 1430 tests / 1430 pass / 0 fail on the frozen tree, 15 compiled drivers (the shared driver
now also prints `W45SourcesRegistryCompiled.v1`), and the packaged smoke (pack 255 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity
`0489fdde…` (read from scripts/identity.mjs by the record script itself, which asserts the counts).

Next: the invalidation family — `VT`, `bM`, `Hz`, `YCn`, `_7` and `bCn`, six bodies whose callees are
now all ported, with `zLr`/`sc` and the async reload behind them after that.

## W45-42 ported the invalidation calls (2026-10-16)

Four of the six bodies W45-41 queued are now product surface, copied verbatim into
src/plugin-chain-invalidate-source.ts (4 blocks, 281 units) behind named wrappers in
src/plugin-chain-invalidate.ts: `invalidateSkillSources` (Hz), `clearHookRegistration` (YCn),
`invalidateAgentSources` (_7) and `invalidateOutputStyleSources` (bCn). Nothing new had to be ported
for them — the plugin registry's clears come from W45-40's copy, its accessor from the host, and the
source registry's accessor from W45-41's seam.

The other two wait, and the record says why in the source's own terms. `VT()` is
`xr().invalidateCommands(),BEo()`, and `BEo` is `MR(M()).shadowedHelperSources` in chunk-x0dc37w9.js,
where `M()` is the per-host config record (644 units). `shadowedHelperSources` is in no product file,
so copying `VT` verbatim would need a `BEo` that does not exist here, and a stub returning an empty
table would decide for the source what shadowed helper sources mean. `bM()` calls `VT()`, so both wait
on the helpers/config store; the record script re-reads both bodies and asserts the name is still
absent from the product, which makes the blocked verdict expire on its own.

Behaviour, measured in .audit/w45-42-probe.mts before any assertion, with every watched name seeded
first: each call moves exactly its own names and no others; a second call is a no-op; the skills call
also clears the current source kind's conditional tables and leaves its refused names; the command
table survives all four, because the command surface belongs to the blocked `VT`; and the hook call
leaves the markdown files alone while the three source calls drop them.

Verified: check/build/notices, the new copy `unresolved 0`, passed true, 43 plans, the blocked verdict's own check,
the new suite 6/6, the chain family (test/plugin-chain-*.test.ts) 160/160, full 1436 tests / 1436 pass / 0 fail on the frozen tree, 15 compiled drivers (the shared
driver now also prints `W45InvalidateCompiled.v1`), and the packaged smoke (pack 257 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity
`554cb016…` (read from scripts/identity.mjs by the record script itself, which asserts the counts).

Next: the helpers/config store behind `BEo` (`M()` and `MR`), which unblocks the last two members of
this family.

## W45-43 cleaned the documentation artifact (2026-10-16)

The W45-38 and W45-39 record writers were assembled through shell heredocs, so the escape their template
literals needed for a backtick survived into the files: 1,146 inline code spans across
research/CURRENT.md (2), research/STATUS.md (366), this document (642) and .audit/w45-runtime.todo.md
(136) carried a literal backslash. .audit/w45-43-fix-spans.mjs removes exactly those backslashes and
writes only after checking, position by position, that the difference is exactly those removals;
.audit/w45-43-span-scan.mjs is the guard, and the W45-43 record runs it and fails on anything but zero.

The same tick re-read the two queue items this package stands in for, because starting either would have
been a doomed copy. The helpers/config store behind `BEo` is `M()`, a per-host record built from about
twenty accessors (`ji`, `ql`, `Kr`, `L1e`, `Fpt`, `fy`, `GO`, `rk`, `jsn`, `V8`, `U5e`, `ar`, `cr`,
`dr`, `Ot`, `FW`, `Ktn`, `G$s`, `z$s`, `Eut`), and none of its field names is in the product. The reload
behind `zLr`/`sc` calls a load pipeline (`fZo` → `Xs`, `X6o`, `jN`, `PPr`; `D_` → `xas`, `lvo`,
`Pxs`; `$5` → `L$() = FXe.of(B())`) that is unported too. Both are subsystems rather than packages, and
the record asserts the absences, so the demotion expires when the product grows them.

No product file, test or build output changed. The tree identity is still `554cb016…` (inputs
359 / validation 138 / build 249), the same
hash W45-42 recorded, which is the checkable reason this package re-runs no sweep and W45-42's
1436 tests / 1436 pass / 0 fail and its packaged smoke stand. Verified here: the guard reports 0 over
the whole W45 evidence set, the cleaner reports 0 further changes, and each cleaned document equals a
pre-cleanup copy with exactly the escapes removed.

Next: the `$` table beyond the three ui floors, then Q-086 and the notification context provider
`a4n` — all sliceable, unlike the two subsystems this tick demoted.


## W45-44 ported the `$` session read floor (2026-10-16)

Seven entries of the `$` table now answer a plugin's questions about its own process, copied
verbatim into src/plugin-chain-session-source.ts (9 blocks, 1,601 units of three modules) behind
src/plugin-chain-session.ts: `session.cwd`, `session.root`, `session.model` and `session.id` through
`Bpe`; `session.turns` through `WAo`; and `session.surface`/`session.surfaces` through `uMo`/`cMo` over
`Xte`. The table's own entry spans are 63, 59, 61, 42, 55, 44 and 45 units (chunk-sfn1dbxq.js
[2347677,2347961) and [2348063,2348153)) and their text sits in the seam as the arrows above.

Nothing new had to be ported for them. `bI` is W45-24's bound-session slot, `t` the host's chain log,
`Ge` and `D` the copied chain source, and `Oe` W45-35's sources-change signal, which the drawing
registry emits a detach on. The registry itself (`ie` [2085,2727) and its instance `gE` [2727,2792) in
chunk-tvdq3hrk.js) is copied whole, and its nine operations are product surface: attach, detach, list,
surfaces, hasSurface, onDetach, missed, heard, isSilent.

The four process fallbacks are the package's one boundary. `K`, `se`, `Ee` and `tt` read the session
record, the process config, the ambient cwd store and the model a command asked for — none of which
this port carries yet — so plugin-chain-host.ts binds them as one record with this process's cwd as
the default, and the seam header quotes all four bodies with their chunk and range. The record script
re-reads each quoted range from the module and compares it with the header, so the boundary cannot
drift from the source it claims to bind.

What the source says, read back out of the ported bodies: with no session bound the floor answers from
the process and logs one of four lines (`$.session (plugin): no session bound; id, cwd and model
answered from the process`, `$.session.turns … 0`, `$.session.surface … null`,
`$.session.surfaces … []`); only `model` asks the bound session first; a caller's own `cwd` wins;
`session.turns` drops tool results, meta, virtual and non-user messages; and `"terminal"` leads the
surface list only when the bound session draws to one.

The four entries this package leaves are named from the table and asserted unbound in product code:
`session.messages` (`PAo`, 387 units, the conversation store), `session.repo` (`MAo`, the git work
tree), `session.authorize` (`oJt` = `rAo(plugin)`) and `session.compact` (the turn machinery). Binding
one later fails the record's own check, which is how the gap stays visible.

Verified: check/build/notices, the new copy `unresolved 0`, passed true, 44 plans, the entry and boundary checks,
the new suite 7/7, the chain family (test/plugin-chain-*.test.ts) 167/167, full 1443 tests / 1443 pass / 0 fail on the frozen tree, 15 compiled drivers
(the shared driver now also prints `W45SessionFloorCompiled.v1`), and the packaged smoke (pack 259 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0).
Identity `88a8e495…` (read from scripts/identity.mjs by the record script itself, which asserts the
counts).

Next: the same table, entry by entry — `session.messages`, `session.repo` and the `state.*`,
`clock.*`, `fs.*` and `store.*` families.



## W45-45 ported the `$` clock and env floors (2026-10-16)

Six more entries of the `$` table are product surface, copied verbatim into
src/plugin-chain-clock-env-source.ts (10 blocks, 1,158 units of two modules) behind
src/plugin-chain-clock-env.ts: `clock.now` (`cDo`, 21 units of table text), the single entry object
`vme` that `clock.sleep`, `clock.after` and `clock.every` all share (53 units of text, three keys),
`env.get` (`s2t` + `pFo`) and `env.set` (`s2t` + `gFo`). The clock's three names differ only in the
spelling they are logged under: one `check` and one `run` serve all three.

The abandonment of a second copy is the package's one reuse: the wait is `Q`, which W45-22 already
carried with its clock (`mIr`, `nS`) in src/plugin-chain-stream-source.ts. The copy imports it, and
the record reads that module's export line and its body to assert the reuse rather than describing it.

What the ported bodies say, each measured: `clock.now` is `()=>Promise.resolve(Date.now())`, so it
never goes through the injectable clock; the wait runs on the caller's own signal and rejects with
`pwr`'s answer — an Error as it stands, another reason's text, a bare abort's own DOMException, and
`wait aborted` only for a signal with no reason; the ms check asks for a finite number and nothing
more; `env.get` answers the process environment with `USER_TYPE` always reported as `external`; and
`env.set` with no value deletes the variable. Both `check`s run only when a handler is in the chain,
so a refused sleep never waits and a refused `env.set` writes nothing.

`state.get` and `state.set` were the other candidates and are not ready: their bodies reach `Jf` and
`KD`, the scope accessors Q-086 is about, and neither is in the product. The rest of the same literal
— `http.fetch`, `process.run`/`process.spawn`, `settings.read` — is named in the seam header and in
next_package rather than half-taken.

Verified: check/build/notices, the new copy `unresolved 0`, passed true, 45 plans, the entry, ledger and reuse
checks, the new suite 8/8, the chain family (test/plugin-chain-*.test.ts) 175/175, full 1451 tests / 1451 pass / 0 fail on the frozen tree, 15 compiled
drivers (the shared driver now also prints `W45ClockEnvCompiled.v1`), and the packaged smoke
(pack 261 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `c76fb592…` (read from scripts/identity.mjs by the record script itself, which
asserts the counts).

Next: the `fs.*` and `store.*` families, then the remaining `ui.*` entries; `state.*` waits on the
scope accessors.


## W45-46 ported the `$` filesystem floor (2026-10-16)

Five more entries of the `$` table are product surface, copied verbatim into
src/plugin-chain-fs-source.ts (15 blocks, 3,003 units of three modules) behind
src/plugin-chain-fs.ts: `fs.read` (`hzt`), `fs.write` (`_zt`), `fs.list` (`gzt`), `fs.exists` (the
one inline entry object, ported as its own arrow) and `fs.stat` (`yzt`). All five run one body,
`HE` (1,819 units), which resolves the path against the caller's cwd or the process's, checks the
location policy, and then reads, writes, probes, stats or lists.

What the ported body says, each measured: the read walks the file in 64 KiB chunks, refuses past
`cGe` (4 MiB, the byte count in the text) and answers `{ base64 }` for `as:"bytes"` against plain
UTF-8 otherwise; the write refuses text past `C3` (4 MiB) **before** touching the disk, makes the
missing directories, and logs `$.fs.write (plugin): path (N bytes)`; `exists` is a stat that answers
false instead of throwing; `stat` follows a symbolic link only when its target is a reachable
location, reporting the target's kind and size with `isLink` true and `realPath` only when the
caller asked to resolve; and `list` sorts by name with kinds through `uGe`, so a link is `other`.

Two names inside `HE` are not carried, and they are the package's one deliberate boundary.
`$ne` (chunk-n3ykh62m.js [241513,241740), 227 units) is the containment policy: the reachable root
(`_4`), that root's segments (`lYe`), the network and volume classification (`gin`, `BH`, `ks`,
`qa`, `ree`, `oie`) — none of it ported. `O` (chunk-xaes9ysz.js [3527,3565), 38 units) is the
platform, over the descriptor `s` [3287,3493) whose WSL detector is not ported either. Both are
quoted verbatim in src/plugin-chain-fs-boundaries.ts with their unported reach named, and bound as
hooks whose unbound defaults are "reached" and the host platform; the record re-reads each quoted
body from its module, so the boundary cannot drift from the source.

`fs.ancestors` (`mzt` 458 units over the check `kNs` 492 units) is the family's other entry and is
not ready: it walks the roots the tool context holds (`fzt`, `pzt`, `RCn`, `cLo`). The four
`store.*` entries bottom out in the per-plugin store `NDe` through the memoized handle `ct = le()`.

Verified: check/build/notices, the new copy `unresolved 0`, passed true, 46 plans, the entry, ledger and boundary
checks, the new suite 14/14, the chain family (test/plugin-chain-*.test.ts) 189/189, full 1465 tests / 1465 pass / 0 fail on the frozen tree, 15 compiled
drivers (the shared driver now also prints `W45FsCompiled.v1`), and the packaged smoke
(pack 264 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `ac04c073…` (read from scripts/identity.mjs by the record script itself, which
asserts the counts).

Next: the `store.*` family over `NDe`, then `fs.ancestors` once the tool-context roots are ported,
then the remaining `ui.*` entries; `state.*` waits on the scope accessors.





## W45-47 ported `$` ui.selection and audited the literal's remaining entries (2026-10-16)

One entry was ready and is product surface: `"ui.selection":{run:u2t}` (chunk-sfn1dbxq.js
[2353525,2353549), 24 units) over the copied body `u2t` ([1869714,1869767), 53 units) —
`()=>Promise.resolve(bI()?.selection?.read())`, the selection the bound loader context holds, read
through that context's own accessor. It added no import, no source file and no build input: the ui
copy already imported `bI`, so the copy grew from 14 blocks to 15 (1,490 → 1,543 units) and nothing
else moved.

Its shape is the one oddity in this slice: no `check`, so no argument is ever refused, and the
floor is the body itself rather than a wrapper. Nothing bound and a context without a selection both
answer `undefined` — the source's own optional chain — which the tests assert on both paths.

Everything else the literal still holds is blocked, and each blocker was measured here rather than
found later: the store family waits on a lockfile library (`Wa` → `lt()` → `ft()`, chunk-c6qwr3kc.js
at 23,134 bytes), the atomic writer `vn` (chunk-1t033v1j.js, 12,458 bytes) and the data directory
`bl()`; `settings.read` waits on the settings store; `http.fetch` on its request runner `dNo`;
`ui.copy` on the clipboard encoder `Sv` (823 units) and the surface catalog; `ui.blit` on the image
and raster registries; `fs.ancestors` on the tool-context roots; `state.*` on `Jf`/`KD`.

The audit also produced a finding for the next seam: table entries can carry `stamp` in addition to
`check` and `run` — `"ui.copy":{check:wGo,stamp:uzo,run:dzo}` is the first that does, and the
record measures its span and text so the finding cannot drift.

Verified: check/build/notices, the ui copy `unresolved 0`, passed true, 46 plans, the entry, ledger and blocker
checks, the ui suites 8/8, the chain family (test/plugin-chain-*.test.ts) 194/194, full 1470 tests / 1470 pass / 0 fail on the frozen tree, 15 compiled
drivers (the shared driver now also prints `W45UiSelectionCompiled.v1`), and the packaged smoke
(pack 264 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `4e14f80d…` (read from scripts/identity.mjs by the record script itself, which
asserts the counts).

Next: the lockfile library with the atomic writer and the data directory — the three pieces the
`store.*` family waits on — then the store family itself, then the remaining `ui.*` entries by the
same measure-first rule.





## W45-48 ported the `$` store file layer (2026-10-16)

The store family's three preconditions turned out to be three subsystems — a lockfile library
(chunk-c6qwr3kc.js, 23,134 bytes), an atomic writer (`Ope` at 2,167 units) and a read/carry layer —
so this package took the one layer of the store that stands alone: where a plugin's store file lives.
Eight blocks, 574 units, one module (chunk-tvdq3hrk.js): the safe-name rule and the two constants, the
Windows device-name rule, the name itself, the path, the directory and the touch.

The naming rule is the whole of the source: a safe id (lowercase, digits, dots, underscores, dashes,
at most 64 characters, not a device name, not `.` or `..`) is `<id>.json`; anything else is sanitized
to word characters, cut to 64 and given `-` plus the first 12 hex digits of the id's sha256; an id with
nothing left contributes the literal `plugin`. The path is the data directory, `store`, the name; the
directory is made recursively at 0700; and the touch logs `$.store (plugin): could not touch …` rather
than throwing.

This is the first plan located by needle: each block names the declaration as the module spells it
(`var S=(e)=>gt(bl(),"store",ue(e));`, `function ue(`, …), so the generator computes the ranges and
the record re-reads them — no hand-measured coordinates to drift.

The one name the layer cannot carry is `bl()`, the data directory: it reads an environment override
through `Ld`, and otherwise joins the configuration directory `be` (a memoized `~/.claude` unless the
process names another) with the directory name `Y` answers. That is the config/home layer, so all four
bodies are quoted verbatim in src/plugin-chain-store-dir.ts with their unported reach named, and the
hook has no default: unbound, it refuses rather than guessing a path.

Verified: check/build/notices, the new copy `unresolved 0`, passed true, 47 plans, the ledger and boundary checks,
the new suite 6/6, the chain family (test/plugin-chain-*.test.ts) 200/200, full 1476 tests / 1476 pass / 0 fail on the frozen tree, 15 compiled drivers
(the shared driver now also prints `W45StorePathCompiled.v1`), and the packaged smoke (pack 267 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0).
Identity `b0645327…` (read from scripts/identity.mjs by the record script itself).

Next: the lockfile library, then the atomic writer, then the read/carry layer — the store family's
three remaining preconditions — and then the `store.*` entries themselves.


## W45-49 ported the lockfile library (2026-10-16)

The store's first precondition, taken whole: chunk-c6qwr3kc.js is one module, and for this slice its
closure is its entire body — sixteen statements, 22,356 units, all of one chunk. That includes what
proper-lockfile locks through: graceful-fs (its polyfills, legacy streams, clone and the fs itself),
retry (the operation and its timeouts) and signal-exit (the signal list and the exit hook that
releases a lock the process still holds).

The closure was computed, not guessed. `.audit/w45-49-closure.mjs` walks the module with acorn from
the names the store imports and prints what is reachable: sixteen statements, five imports, and only
standard globals unresolved — so nothing inside is missing and nothing outside is referenced. The
plan locates each block by the needle the module spells it with, and the record re-reads every range.

One name is bound rather than copied: `Le`, the bundle's own require
(chunk-txt1tvjz.js [1624,1647) `Le=import.meta.require;`), which the vendored code calls for `fs`,
`constants`, `path`, `stream` and `util`. src/plugin-chain-bundle-require.ts quotes that
declaration and binds `createRequire(import.meta.url)`, which answers the same module objects —
including the fs object graceful-fs patches.

Measured before asserted: the lock is a directory beside the file; the handle is the release itself
with `Symbol.asyncDispose` pointing back at it; a live lock is refused `ELOCKED`; a waiter wins only
inside the retry schedule; a stale lock is taken over and the displaced holder's release removes the
lock path it finds (the library's own behaviour, and why the store treats a takeover as a lost
section); and the release wrapper describes whatever it is handed at warn level, never throwing.

Verified: check/build/notices, the new copy `unresolved 0`, passed true, 48 plans, the ledger and boundary checks,
the new suite 6/6, the chain family (test/plugin-chain-*.test.ts) 206/206, full 1482 tests / 1482 pass / 0 fail on the frozen tree, 15 compiled drivers
(the shared driver now also prints `W45LockfileCompiled.v1`), and the packaged smoke (pack 270 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0).
Identity `95ce8fce…` (read from scripts/identity.mjs by the record script itself).

Next: the store under its lock — `le()` and the `ct` wrapper, the option object `pt` (whose
`onCompromised` this library supports as-is), the dispatcher `JAt`, and the four entries of `Ce`
with `Se` — then the read/carry layer `vt` and the atomic writer `vn`.


## W45-50 ported the atomic writer (2026-10-16)

The store's `Se.write` calls `vn(file, text, 0600)`. `vn` is four lines over `Ope`, and the closure
around them is 34 whole top-level statements — 33 in chunk-1t033v1j.js and one error class in
chunk-886tf6ja.js — 6,509 units. The write stages the contents beside the target (temp name the target
plus `.tmp.` and four random hex bytes, taken by exclusive create, in `stagingDir` when one is given)
and publishes by rename; a rename that cannot cross a device, or a staged create refused with EACCES
when `inPlaceOnTempCreateRefused` is set, falls back to an in-place arm that snapshots the file first
and restores or removes it on failure. `exactMode` and `flush` take the file-handle path so the mode
can be fixed and the write synced.

Two names come from copies the product already holds — `E` (W45-46) and the abortable wait `Q`
(W45-22, exported by its chunk under that name) — and the telemetry-safe error the in-place refusal is
raised in is copied here, because no earlier closure had it.

Measured before asserted: the mode the call leaves and the staging area it cleans; the refused
publish's own error (`PublishRefusedError`, `beforePublish refused the write; nothing was published`)
with nothing written; a rename that fails without a retryable code publishing nothing; EXDEV falling
back to the in-place arm; a symlink target replaced rather than followed; and the read-only-directory
EACCES that becomes an in-place rewrite only when the caller allows it.

Two honesty notes are recorded: the in-place "other names (a hard link)" refusal is unreachable in this
bundle (the gate flag `te` is `!1` and its only setter is outside the closure), so the in-place arm
is reached only through those two fallbacks — which is what the tests assert; and this build's retry
helper `le` answers false, so a rename is attempted exactly once.

The record script also gained an acorn check that every copied block is a whole top-level statement and
none is copied twice. It caught six blocks in this package's first plan: a `var` needle given without
`k: "stmt"` resolves through `extractFn` and swallows the declaration after it.

Verified: check/build/notices, the new copy `unresolved 0`, passed true, 49 plans, the ledger, acorn and boundary
checks, the new suite 9/9, the chain family (test/plugin-chain-*.test.ts) 215/215, full 1491 tests / 1491 pass / 0 fail on the frozen tree, 15 compiled
drivers (the shared driver now also prints `W45AtomicCompiled.v1`), and the packaged smoke (pack 272 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0).
Identity `ff345d24…` (read from scripts/identity.mjs by the record script itself).

Next: the store's read and carry layer — `vt` with `he`, `W`, `ke` and `mR` (whose own closure is
nine statements in chunk-nrk8z90j.js and reaches `xQt` and `wD`, to be sized first) — and then the four
`store.*` entries under their lock.


## W45-51 ported the store's read and carry layer (2026-10-16)

The store's `Se.read` calls `vt(id, S(id))`. `vt` reads the file; when the file is not there it asks
`he` to carry the content from the same plugin's built-in twin (`cc-plugin-tips@builtin` from
`tips@builtin`, looked up through the short-name to package-id table) and reads again. The carry writes
the twin's text as `<file>.carry-<uuid>` with an exclusive create, links that file into the store's
place, falls back to `copyFile` with COPYFILE_EXCL when the link is refused for any reason other than
the target already existing, and removes the staged file on every path. Content that does not parse, or
parses to something other than a plain object, is refused; a link refused with EEXIST is a concurrent
carry and is logged at debug; anything else that fails is logged at warn.

The closure is 20 whole top-level statements — the store's own three bodies, the id table's map and its
five lookups, one id constant, the ENOENT test, the plain-object test, and the parse helper with its
disposable guard — 2,133 units across five chunks.

One name reaches a different subsystem: `wD`, the platform-id test `AUn` canonicalizes the id's second
half through, is a free name inside a table whose closure this record measured at more than 75,000 units
of the application core. It is bounded in src/plugin-chain-store-carry-boundaries.ts, quoting the
source's own body with its chunk and range. Unbound, the hook answers the test's own negative branch, so
the half is used as it was written — a real answer for an id that table does not hold, and measured both
ways here and in the compiled driver.

Measured before asserted: the candidate list in all four of its shapes; both answers of the platform-id
hook; the carry landing on disk with its staged file removed and no log; a store that is present being
read rather than carried; `ye` answering the candidate's own id; the three refused shapes (`[1,2]`,
`null`, `"text"`) refused silently; unparseable content and a read-only directory each producing one
warn line and nothing written; the concurrent carry's debug line with the earlier content left alone; and
the carry taking whatever the twin holds at that moment.

One limitation is recorded rather than papered over: `mR`'s `toReversed()` cannot be observed ordering
anything, because the shipped table maps exactly one short name to each package id.

Verified: check/build/notices, the new copy `unresolved 0`, passed true, 50 plans, the ledger, acorn and boundary
checks (including that the store entry itself is still outside this closure), the new suite
9/9, the chain family (test/plugin-chain-*.test.ts) 224/224, full 1500 tests / 1500 pass / 0 fail on the frozen tree, 15 compiled drivers (the shared
driver now also prints `W45StoreCarryCompiled.v1`), and the packaged smoke (pack 275 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0).
Identity `a926be43…` (read from scripts/identity.mjs by the record script itself).

Next: the store entry itself — `Se` with `He`, the write through the W45-50 writer under the W45-49
lock, and the four `store.*` entries with the dispatcher `JAt` and the option object `pt` — and then
`settings.read`, `http.fetch`, `ui.copy` with its `stamp` field, and the remaining `ui.*` names.


## W45-52 ported the store entry and its dispatcher (2026-10-16)

The `$` store's four table entries hand their event to `JAt`, which runs the dispatcher `Ce` behind a
serial queue per storage id (`ct` is `le()`: one chain per id, and a rejection does not stop the next
caller). The dispatcher refuses a key longer than 256 for every event but `keys`, reads through the
store entry, takes the store's lock for set and delete and releases it through `Um` whatever happens,
refuses a write that would push the whole store past 4,194,304 characters, logs the key it wrote as
`$.store.set (plugin): key`, and wraps anything the backend throws in the hooks error class. The store
entry `Se` is `{read, write, lock}` — W45-51's read and carry, W45-50's atomic writer at 0600 after
W45-48's directory, and W45-49's lock beside the store file with the options `pt` (no realpath, ten
retries from 5ms to 100ms, a compromised lock logged rather than thrown). With that, the store subsystem
is complete from the plugin surface to the file.

The closure is 18 whole top-level statements, 2,343 units across four chunks, and no node builtin is
reached: every dependency is a copy the product already holds. Three small cross-module bodies come with
it — the store's size limit `jde`, the backend slot `bs`, and the storage-id reader `fW`. The four
entries themselves are fragments of the plugin-method table's literal, so they are ported verbatim into
src/plugin-chain-store.ts with their spans quoted, the way the ui entries were in W45-24; their `run`
bodies and the checks `ppr`/`xNs`/`_ro` are the source's own.

The dispatch context. The source's entries close over the table function's `e` and read
`e.knownArgs.get(plugin)?.pluginStorageId`; this product has no plugin interface dispatcher, so the seam
keeps that map itself (`bindStoreStorageId`) and an unbound plugin runs against its own name — which is
exactly `fW`'s fallback, not a default invented here.

Measured before asserted: the four events round-tripping through a real file (`{}\n`, mode 0600, the
directory left with the store file alone); the own-key read (`toString` is not a key); the key limit
with its exact text and count; the store limit with its exact count and no file written; the value check
rejecting only what has no JSON text; two writes to one store not interleaving; the bound storage id
against the plugin name; the backend slot replacing and restoring the store; the lock handle, its file
and its release; both malformed-store texts; and the entry checks, which reach the caller only through a
chain that has a handler — with none, the call short-circuits to `run` and the check never runs.

One plan grew rather than being duplicated: the JSON text helper `_` joined the store-carry copy,
because it holds the same disposable guard as the parse and reports its length through the same `Pe`,
and because this package's own module has an unrelated `Pe` (the backend factory). That copy is now 21
blocks / 2,217 units and exports `_`, `L` and `Y`.

Verified: check/build/notices, the new copy `unresolved 0`, passed true, 51 plans, the ledger, acorn and boundary
checks, the new suite 11/11, the chain family (test/plugin-chain-*.test.ts) 235/235, full 1511 tests / 1511 pass / 0 fail on the frozen tree, 15 compiled
drivers (the shared driver now also prints `W45StoreEntryCompiled.v1`), and the packaged smoke
(pack 277 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `11bbcb81…` (read from scripts/identity.mjs by the record script itself).

Next: `settings.read` over the settings store, now that the store family is complete; then `http.fetch`
over the request runner, `ui.copy` with its `stamp` field, the remaining `ui.*` names, `fs.ancestors`,
`state.*`, and the config/home layer behind `be`.



## W45-53 ported `settings.read` over the settings store (2026-10-16)

The `$` table's `settings.read` entry hands its whole body to `hGo`, which reads the argument's
`source`: absent means the merged settings (`ft()`), a name means that source's settings file
(`fe(J9[source])`), either way projected through `ZH` — `undefined` stays `undefined`, everything else
is the value's JSON round-trip, so the caller gets a copy rather than the store's own object — and
answered as a promise with `{}` for a store that has nothing. The check `yGo` admits no argument, an
argument with no source, or a string naming one of `J9`'s five keys, and refuses the rest with the list
and the type it got. The closure is 4 whole top-level statements, 449 units, all in chunk-sfn1dbxq.js.
The entry is a fragment of the plugin-method table's literal, so it is ported verbatim into
src/plugin-chain-settings.ts with its span quoted, the way the ui and store entries were.

Explicit ranges, not needles. chunk-sfn1dbxq.js is one of the 60k-line chunks whose top-level map
cannot be walked reliably — the limitation W45-51 recorded for chunk-gyf58rwf.js, which made the
generator's needles unresolvable there. All four blocks were measured and written as ranges.

The boundary. `hGo` reads through two bodies that are not this package: `fe`
(chunk-x0dc37w9.js [88486,88550) 64u) — the managed-settings gate `CT()&&Tp.has(e)` answering null,
otherwise `y9e(e,M())` — and `ft` ([96865,96904) 39u) — `yg().settings||{}`. Their reach is 205
statements / 66,141 units over 60+ imports, so they are quoted verbatim in
src/plugin-chain-settings-store.ts and a hook stands in their place, the way W45-48 and W45-51 bounded
their own unported layers. One difference is recorded rather than papered over: the source has no
negative branch here, so the refusal a caller sees while the store is unbound is this seam's own text,
not the source's behaviour.

Measured before asserted: the five names; the check's admitted and refused shapes with their exact
texts; the argument's `source` being what is read (`{}` and `"user"` pass, `{source:"nope"}` does not);
the copy semantics, including a property whose value is `undefined` dropping out of the answer; the
synchronous circular-structure throw, because the store is read before the promise is built; the store
being asked by file name in that order; the chain's no-handler short-circuit past the check (the path
W45-20 recorded) and the `{value:…}` wrapper a handler produces; and the body's own unguarded failure
on an absent argument.

Verified: check/build/notices, the new copy `unresolved 0`, passed true, 52 plans, the ledger, acorn and boundary
checks, the new suite 7/7, the chain family (test/plugin-chain-*.test.ts) 242/242, full 1518 tests / 1518 pass / 0 fail on the frozen tree, 15 compiled
drivers (the shared driver now also prints `W45SettingsReadCompiled.v1`), and the packaged smoke
(pack 280 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `aeed9147…` (read from scripts/identity.mjs by the record script itself).

Next: the settings store behind `fe`/`ft` — the largest item in the queue at 205 statements / 66,141
units over 60+ imports, and the one that would replace this package's bound hook with the source's own
bodies. Then `http.fetch`, `ui.copy` with its `stamp`, the remaining `ui.*` names, `fs.ancestors`,
`state.*`, and the config/home layer behind `be`.



## W45-54 ported the settings source → file layer (2026-10-16)

`settings.read` reaches `fe(source, M())` for the file to read; this package is what turns a source
name into that file. `GW(source, ctx)` is the resolver — user settings are the `.claude` directory
joined with the settings file name, project and local are the resolved directory joined with
`.claude/settings.json` and `.claude/settings.local.json`, policy is `managed-settings.json` inside
the managed directory, and flag is the context's flag path — and `Ynn` is the directory behind it.
The local-settings decision is `RN`/`pTr`/`Z$s`: when the cwd and its canonical git root disagree
and the root is not the real home directory, the root wins only if the root, its `.git` entry and its
`.claude` entry are all owned by the current user; otherwise the store stays at the session cwd and
one of three warn lines says why. The closure is 36 whole top-level statements, 7,881 units across
five chunks, plus the local store's probe cache `Ht` in its own 549-unit copy.

Two boundaries, both recorded rather than approximated. The local store handle: the source's `ji` is
`Ixr.of(B().host)` and `Ixr` is the whole store class, so src/plugin-chain-local-store.ts owns the
handle — but its default is the source's own, because the only field the copied bodies read
(`localStoreProbes`) is a class this package carries whole, so the probes are real and no refusal is
needed. The config context: the source's `M()` builds about thirty fields and passes it to all of
these, and the copied bodies read five, so the seam names exactly those. The fs facade `ie()` and the
realpath cache came with the copy instead of bounding, because their source text is obtainable — which
is what the hard rule asks for.

Measured before asserted, and two measurements corrected the port: the directory resolver answers the
*cwd* for a policy source (the managed directory is reached through `m_ in the file resolver`, not
through that branch), and the context's `canonicalGitRoot` is a *function* the decision calls with the
cwd rather than a path — a seam that typed it as a string fails inside `path.resolve`, which is how
the probe caught it. Also measured: `TO` is a relative path rather than a bare file name; the null
guard is strict, so `cwd: null` answers `undefined` from the file resolver and throws
`NoProjectDirectoryError` from the directory resolver while `cwd: undefined` falls through both
`===null` checks; the managed-settings path and drop-in directory are cached in one instance until
reset; the ownership gate's three answers carry the source's own warn texts; the probe cache remembers
answers but not throws; and the probes are read through the store handle, since binding a handle
changes the answer and unbinding restores it.

Verified: check/build/notices, both new copies `unresolved 0`, passed true, 54 plans, the two ledgers, acorn and
boundary checks, the new suite 8/8, the chain family (test/plugin-chain-*.test.ts) 250/250, full 1526 tests / 1526 pass / 0 fail on the frozen tree, 15 compiled
drivers (the shared driver now also prints `W45SettingsSourceCompiled.v1`), and the packaged smoke
(pack 284 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `b1612aa6…` (read from scripts/identity.mjs by the record script itself).

Next: the settings *read* path behind `y9e` (`Qnn` + `$t`, 325,824 units) and the merge behind `bTr`
(335,278 units), which are what turn these answers into parsed settings; then the managed-settings gate
`CT`/`Tp` (61,983 units) that would let `settings.read` drop its bound hook, and the local store's
remaining fields, which belong on the handle this package created.


## W45-55 ported the settings merge layer (2026-10-16)

When several settings sources are folded into one object, the fold is `mergeWith(..., Y3)`: `bTr` opens with
`MB(r, e.store.pluginBase, Y3)` and merges every source into the same accumulator, and the per-source reader
`Qnn` answers `MB(i||{}, d, Y3)` for the flag file and `MB(c, i||{}, Y3)` for the legacy local one. `Y3` is
what "merge" means per key, and it is not lodash's default: `modelPicker` with a defined value is normalized by
`ic`; two arrays concatenate and deduplicate under any key except `fallbackModel`, which takes the source array
outright; `extraKnownMarketplaces` and `managedMcpServers` take a one-level override when both sides are plain
objects; everything else returns `undefined`, which asks lodash for the default deep merge. The closure is 52
whole top-level statements, 4,033 units, all in chunk-3cynezh1.js — the 49 lodash-merge internals statements
spanning [340302,343952) plus `CHt`, `Y3` and `ic`.

No new boundary: every free name the copied bodies close over resolves to a copy the product already carries, so
nothing had to be bounded or invented. The reach behind the layer is stated rather than ported — `Qnn` and
`bTr` are 325,824 and 335,278 units of schema-driven reading with the file reader inside them, and the seam
names them as the callers. One port is recorded in the plan: the copied CommonJS preamble reads a module
reference the minifier left free as `Cn`, which no statement in the chunk declares, so the plan declares it and
quotes the span rather than inventing a branch.

This package closed a defect W45-14 left behind, and the way it surfaced is the point. That closure followed
declaration use, so a class whose methods are assigned on its prototype came across as a constructor alone:
`P` (the Stack) was copied without its five prototype assignments or their bodies. Nothing noticed until the
merge walked its first nested object, where `baseMerge` builds `new k1e` and `baseMergeDeep` reads it back with
`c.get(m)` — `TypeError: c.get is not a function`. The fix is four blocks, 784 units: the five stack prototype
assignments, the five method bodies with their aliases, the `Fn` sentinel with the SetCache methods, and the
SetCache prototype. A second lesson came with it: statement order is load-bearing in these copies, because the
aliases are `var`s — a prototype assignment ordered before its method body assigns `undefined` — so the plan
carries the blocks in source order and the ledger asserts it.

Measured before asserted, and three measurements corrected the port: the array union is not keyed (any two
arrays union, whatever the field is called), `ic` is a one-level shallow spread rather than a deep copy, and an
array target with an object source keeps its elements and takes the source's keys as own properties —
`JSON.stringify` hides that, so the suite asserts it property by property. Also measured: the merge accumulates
into and returns the target it is handed; nested values are copies; `undefined` never overwrites;
a cyclic source terminates on the merge stack; and `vse` answers the legacy local path only when the store root
is not the session cwd.

Verified: check/build/notices, all four copies `unresolved 0`, span scan `total 0`, passed true, 55 plans, the two ledgers,
acorn and body and seam checks, the new suite 7/7, the chain family (test/plugin-chain-*.test.ts) 257/257, full 1533 tests / 1533 pass / 0 fail on the frozen tree,
15 compiled drivers (the shared driver now also prints `W45SettingsMergeCompiled.v1`), and the packaged
smoke (pack 286 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `32f318a5…` (read from scripts/identity.mjs by the record script itself).

Next: the settings *read* path behind `y9e` (`Qnn` + `$t`, 325,824 units) and the all-sources merge `bTr`
(335,278 units), one layer closer now that the file each source reads and the merge each result is folded with
are ported; then the managed-settings gate `CT`/`Tp` (61,983 units), and the local store's remaining fields,
which belong on the handle W45-54 created.


## W45-56 ported the local settings store (2026-10-16)

Every settings read mutates one store per host. `Ixr` is `new q(() => new F8e)` — the factory class remembers one
instance per host key in a `WeakMap` — and `F8e` is the store: the merged settings, the per-source map the read
fills, the parsed-file map with its primed companion, the managed-read and listing caches, the repository tier, the
probe cache the ownership gate reads, the epoch, and the methods that load, seed, invalidate and diff them. The
settings diff compares `Et(entry)` — `settings` and `unfiltered` each passed through `XMt`, which answers null
for a null or empty object, and `legacy` only when the entry carries one — and `Gr` answers the keys of both maps
whose wrapped snapshots are not equal, target keys first. The install verdict is a ladder: unparsed or equal
installs; changed and unprimed has raced; changed and primed with no walk yet installs; past a walk, `deferred`
within the threshold and `raced` above it.

13 whole top-level statements, 6,401 units: ten from chunk-4bw62nzm.js, and the policy pin — its state, the flag
reader `j`, and the setter `nHs` — from chunk-k1419ccf.js. The closure that seeded the package is 98 statements,
13,825 units, but 88 of them (7,556 units) are the lodash comparison stack the product already carries, so they are
imported rather than copied twice: the store copy is what no other copy holds. The only change on the other side is
one export, `M`, whose statement was already inside a copied range.

No new boundary, and one retired. `LocalStoreHandle` was the seam W45-54 introduced when the only field the
settings-source bodies read was `localStoreProbes`; `ji()` now answers `Ixr.of(host)` for a bound host, so that
package's default is the source's own instance rather than a stand-in — and its eight tests pass unchanged against
the real store. The source reaches its store through `B().host`; the seam keeps the no-argument shape the copied
bodies call with one module-level host key, which is one store for the process, and lets a caller that owns the real
host object bind it.

Measured before asserted, and two measurements corrected the first draft. The install verdict reads its threshold
only *past* the walk check, so a negative threshold cannot race on its own — with no walk counted the answer is
still `install`, and with the pin off the walk counter cannot move at all, which is why an unpinned store has only
the install and raced arms. And `primedFolderListing` is gated on the pin rather than on a prior walk: it answers
the newest seeded listing, and `noteWalkListing` records a walked folder without counting a walk. Also measured:
`Et` throws the source's own `TypeError` when an entry carries `settings` but no `unfiltered`, which the suite
asserts rather than smooths over; the retain closures back the identity of the entry they installed, so an older
undo leaves a newer layer alone; `invalidateAll` bumps the epoch and empties every cache; the seed, unseed and
clear methods are no-ops on a stale epoch, and `clearFolderListing` also refuses a walked folder; and the pin is
write-once per process — `pinned`, then `unchanged`, then `conflict` with the flag left set — so the suite and
the compiled driver both assert it last.

Verified: check/build/notices, all five touched copies `unresolved 0`, span scan `total 0`, passed true, 56 plans, the store
ledger re-read block by block with acorn and five order assertions (the pin's state before its reader before its
setter, the factory class before the store it builds, the walk cache and the repository tier before the store that
owns one), body comparisons for every named statement including the verdict ladder and the pin trio, the seam's
twelve exports, the new suite 8/8, the chain family (test/plugin-chain-*.test.ts) 265/265, full 1541 tests / 1541 pass / 0 fail on the frozen tree,
15 compiled drivers (the shared driver now also prints `W45LocalStoreCompiled.v1`), and the packaged smoke
(pack 287 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `03c7b9f5…` (read from scripts/identity.mjs by the record script itself).

Next: the settings *read* path behind `y9e` (`Qnn` + `$t`, 325,824 units) and the all-sources merge `bTr`
(335,278 units) now sit on three ported pieces — the file each source reads, the merge each result is folded with,
and the store each mutation lands in — so the read path is the next unit that can come across whole; then the
managed-settings gate `CT`/`Tp` (61,983 units).


## W45-57 ported the `$` table's ui.notify entry (2026-10-16)

The entry is `"ui.notify":{check:Dzo,stamp:Fzo,run:Nzo}` — 41 units of the source's table literal — and all three bodies came
across in two blocks: the four contiguous statements at chunk-sfn1dbxq.js [2338792,2339663) (871 units) and the committed
flag's three statements at chunk-r2vtj1kh.js [150398,150468) (70 units). The check reads the text through `LVe` (`takes a
string text` for anything that is not one) and, when a title is present, refuses a non-string with `title is a string, when
given`. The stamp fills an absent or empty title with the plugin name. The run reads `wn()` first: once the surface is
committed it answers `{isSent:false, reason:'no-surface'}` without asking the session at all. Otherwise it calls the session's
`notify` with `{message, title, notificationType:'plugin_notification'}` and the caller's origin, then maps the channel
through `qQt` — five send channels answer `{isSent:true, channel}`, `disabled` and `none`/`no_method_available` answer their
reasons, and `error` throws the source's own error class — and logs one line per attempt.

No new boundary. `LVe` was already in the same copy, `bI` comes from the loader copy, `t` from the host copy, and `He` from
./plugin-chain-source.ts, where chunk-kd3dbbtb.js [661,807) has been copied since W45-2x. The ui copy grew 15 → 17 blocks and
1,543 → 2,484 units, and the plan's exports 15 → 21.

This package also models what the seam had only recorded: the `stamp` field. Its consumer is `G2e`
(chunk-sfn1dbxq.js [2356082,…)), the plugin-facing `$` dispatcher, which applies `h.raise?.(caller)` then
`h.stamp?.(raised, caller)` before `run` — so a check sees the raw argument and a run the stamped one. `G2e` is not ported;
`Hze`, the hooks-then-floor path `raiseUiCall` mirrors, never reads the field, and the suite asserts that difference rather
than assuming it: with no hooks registered the floor runs without its check, so a bad title still reaches the run. The
neighbouring `ui.copy` entry's stamp has no ported body yet.

Measured before asserted, and two measurements corrected the draft. The error class a failed write throws reports its `name`
as `HooksError` — its constructor is `He` — and the check is only consulted when hooks are registered ahead of the floor. A
third measurement is the source's own hole, asserted as such: `qQt`'s switch has no default, so a channel name it does not
know answers `undefined` and the log line built after it throws a `TypeError`. The committed gate is measured with a counting
session: committed, the session is never called, and uncommitting restores the send path.

Verified: check/build/notices, both scanned copies `unresolved 0`, span scan `total 0`, passed true, 56 plans, the ui ledger re-read block
by block with acorn and an order assertion on the flag block, body comparisons for the four statements and the table fragment,
the seam's new event, stamp field, entry and session surface, the new suite 8/8 (the selection
suite's table assertion now names five), the chain family (test/plugin-chain-*.test.ts) 273/273, full 1549 tests / 1549 pass / 0 fail on the frozen tree, 15 compiled drivers (the shared driver now
also prints `W45UiNotifyCompiled.v1`), and the packaged smoke (pack 287 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `e6020f51…` (read from scripts/identity.mjs
by the record script itself).

Next: the remaining `$` table entries, each measured the same way first — `ui.blit` (`fNs`/`mNs` 23 statements / 3,349 units
plus `kFo` 701u and `bFo` 48u in the big chunk), `ui.scroll`, `ui.focus`, `ui.copy`, `state.get`/`state.set`, `fs.ancestors` —
and the dispatcher `G2e`, which would give this package's `stamp` field its consumer. The settings read path behind `y9e` is
now measured: 590 statements / 327,047 units, 79 of them already carried, so 318,262 fresh units — a subsystem to walk in
pieces rather than one package.





## W45-58 ported the `$` table's ui.blit entry (2026-10-16)

The entry is `"ui.blit":{check:fNs,run:(n,r)=>bFo(n)?kFo(n,r):mNs(n,r)}` — 57 units of the source's table literal — and it is two
floors behind one name. `bFo` routes an argument whose `source` is a plain object to `kFo`, the Image's `swap` path, and
everything else to `mNs`, the Raster's `paint` path. The check takes exactly one of `cells` (a string) or `source`, a non-empty
`requestId` and `key`, and numeric `columns`/`rows` when they are given. Both runs look the plugin's own mounted row up by
`e5t`'s NUL-joined key and answer `{deny: text}` rather than throwing: no row for the key, another plugin holding that
requestId/key, a size the mounted element does not have, more than 120 blits in a second, or cells that are not the base64 of
exactly `columns * rows` cells of 12 bytes. A blit that lands paints every mounted element of the size and answers `{}`.

Seven blocks, 7,852 units. Four are contiguous runs of chunk-n3ykh62m.js: [241244,241478) the base64 ratio and decoder,
[241740,242738) the ImageSource shapers, [242947,245185) the rest of the ImageSource machinery including the validator `Mss`,
and [248812,252131) the whole Raster side. The Image side and its selector are chunk-sfn1dbxq.js [1868588,1869519), the
separator is chunk-p16hdq43.js [2833,2864) and the control-character pattern is chunk-tvdq3hrk.js [6302,6403).

`$ne` — the location policy that opens the ImageSource run, chunk-n3ykh62m.js [241513,241740) 227 units — is deliberately not
copied. ./plugin-chain-fs-boundaries.ts has answered it for `$.fs` since W45-46, quotes the body and names the closure this
product does not carry (36 statements / 5,096 units of Bun's own namespace layer across chunk-ae84tp6z.js and chunk-4bw62nzm.js),
so the copied run starts where that statement ends and imports the one boundary. Two bodies the entry needs were already carried
by ./plugin-chain-source.ts without being exported — `h$` (chunk-nyce03br.js [38157,38216) 59 units) and `b3` ([5183,5322) 139
units) — so this package added the two names to that plan's export list instead of copying the same text twice; the copy's sha
moves from `670e5658…` to `58c01b12…` and the verifier re-proves all 57 plans. `ae` comes from the text-clamp copy, `it` from the
host copy, and `JN` is the source's own `isAbsolute` from `path`, bound to the node builtin exactly as the fs copy binds its
path imports.

Measured before asserted, and four first drafts were corrected by the probe: the fixture for the other-plugin denial had to be
keyed under the rival plugin (the test only looks at rows that are not the caller's), the PNG fixture needed 33 bytes before the
IHDR check could pass, the rate window had to be driven by the row's own `blits`/`windowStart` rather than by a loop that can
cross a second, and the Image path's habit of reporting only the first mounted element's answer is asserted as the source's own
hole rather than smoothed over. The rows the runs read are the site mount's: `{rasters: new Set, windowStart: 0, blits: 0}`
written by `hNs` through `Yto` on `hs()`, and the Image's `{images: new Set, …}` written by `ELs` — the statement immediately
after this package's last block. Both, with the raster encoder family that follows the Raster run in the same module (`mb`,
`Sb`, `$f` at [253828,…) to [254123,…)), are recorded as the next package: until they are ported nothing in the product fills
the registries this entry reads.

The tick also repaired a defect of this product's own records: the W45-57 coding-standard entry carried 106 escaped code spans
and had been written twice, because its strip mark did not match the escaped text. The duplicate line is gone, the escapes are
back to plain backticks, the span scan reads `total 0` again, and the record script asserts both properties from now on.

Verified: check/build/notices, both scanned copies `unresolved 0`, span scan `total 0`, passed true, 57 plans, every block of the blit ledger
re-read from its module and matched against the copy with acorn (whole statements, contiguous, no cut, no repetition), the
absence of `$ne` asserted together with the boundary that still quotes it, the table fragment and both mount-row shapes quoted
from their modules, the seam's entry, event and re-exports, the registry-state typing, the new suite 12/12,
the chain family (test/plugin-chain-*.test.ts) 285/285, full 1561 tests / 1561 pass / 0 fail on the frozen tree, 15 compiled drivers (the shared driver now also prints `W45UiBlitCompiled.v1`), and the
packaged smoke (pack 288 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `3223c005…` (read from scripts/identity.mjs by the record script itself).

Next: the mount side of the blit (`Yto`/`hNs` and `ELs`/`vLs`) and the raster encoder family, then the remaining `$` table
entries — `ui.scroll`, `ui.focus`, `ui.copy`, `state.get`/`state.set`, `fs.ancestors` — and the dispatcher `G2e`, which would
give the ui.notify entry's `stamp` field its consumer. The settings read path behind `y9e` stays the measured subsystem:
590 statements / 327,047 units, 318,262 of them fresh.


## W45-59 ported the site mount (2026-10-16)

W45-58 ported the blit — what reads the registries. This package ports what fills them, measured at the same time and
named as the next package in that record. Two blocks, 541 units.

`Yto` (chunk-n3ykh62m.js [256712,256899) 187 units) is the register helper: it takes `{sites, siteKey, mount, mountsOf, freshSite}`,
resolves the row as `sites.get(siteKey) ?? freshSite()`, adds the mount to `mountsOf(row)`, writes the row back under the key, and
answers an unregister that deletes the mount and then deletes the key only when the set has emptied **and** `sites.get(siteKey) === row`.
Two properties follow from that body and are asserted rather than assumed: every later mount under a key writes into the *same* row
object, so a row's `windowStart` and `blits` — which is where the blit's 120-per-second window lives — survive a remount; and a row
someone else has replaced is left alone even when its set empties. The row holds a `Set`, so mounting one element twice is one entry.

`hNs` ([256899,257058) 159 units) drives it against `hs()`, the mounted-raster registry, with the key `e5t(requestId, key, plugin)`
and the row `{rasters: new Set, windowStart: 0, blits: 0}`. `ELs` (chunk-sfn1dbxq.js [1869519,1869676) 157 units) does the same for
`Yj()` and `{images: new Set, windowStart: 0, blits: 0}`; that block starts exactly where W45-58's last block ended, in the same
module, with no statement between them — the record script asserts that continuity. `vLs` ([1869676,1869714) 38 units) is the
builder an Image site spreads its element and props through to gain its swap: `{...element, ...props, swap}`, so the props win over
the element and the swap the caller passes is the one the blit will call.

`hs`, `Yj` and `e5t` are imports of the W45-58 blit copy, not copies a second time — the record asserts the mount copy does not
declare them, and that it reaches into neither the blit run nor the fs boundary. The element shapes are typed from the
`MountedRasterSite` / `MountedImageSite` rows that package added to ./plugin-chain-registry-state.ts, so a mount cannot be written in
a shape the blit does not read. The seam adds four named wrappers (`registerSiteMount`, `mountRaster`, `mountImage`, `withSwap`), the
two element aliases, and re-exports the bodies under their source names; the suite calls only the seam.

Two probe corrections, both measured rather than reasoned: the Image path reads `e.source` (`bFo` tests `"source" in e`), so an
argument carrying `png` instead goes down the Raster run and is refused with the Raster denial — the first probe did exactly that and
read a Raster sentence from an Image mount. And what a swap receives is the source object as it arrived, not a decoded buffer, so
the assertion is object identity. The swap's convention is the blit's own: `undefined` accepts, a string is the reason it refuses
(any truthy value is wrapped by `xDe` as `{deny: that value}`).

Verified: check/build/notices, both scanned copies `unresolved 0`, span scan `total 0`, passed true, 58 plans, both ledger blocks re-read from
their modules and matched against the copy with acorn (whole statements, contiguous, no cut, no repetition), the four bodies quoted
verbatim in the seam header with their ranges, the continuity between the Image block and W45-58's, the "does not declare what it
imports" and "does not reach into the blit run" checks, the new suite 9/9, the chain family (test/plugin-chain-*.test.ts) 294/294, full
1570 tests / 1570 pass / 0 fail on the frozen tree, 15 compiled drivers (the shared driver now also prints `W45RasterMountCompiled.v1`), and the packaged smoke
(pack 290 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `3e062309…` (read from scripts/identity.mjs by the record script itself).

Next: the raster encoder and admission family that follows the mount pair in the same module (`fb`/`mb` the token bucket at
[253828,…), `Sb` the refill at [253980,…), `$f` the cell encoder at [254123,…), `tF` at [257058,…) — the statement right after
this package's first block) and the site components that call these writers (`Tc(jo, …)` in chunk-kjfwbh4w.js), then the remaining
`$` table entries (`ui.scroll`, `ui.focus`, `ui.copy`, `state.get`/`state.set`, `fs.ancestors`) and the dispatcher `G2e`. The
settings read path behind `y9e` stays the measured subsystem: 590 statements / 327,047 units, 318,262 of them fresh.



## W45-60 ported the raster cell encoder and the admission bucket (2026-10-16)

W45-58 ported what reads the registries and W45-59 what fills them. This package ports what a surface paints a frame *with*, and
what admits the frame: eleven blocks, 1,209 units.

A cell is eight words (`gn`, [252898,253057) 159 units): a default flag and three channels for the foreground at 0..3, then the
same four for the background at 4..7. `$f` ([254123,254367) 244 units) writes one from a single packed colour pair — `mc` takes
the low half as the foreground, `dc` the high half as the background, over `Lr` — and each channel is the four bits at its shift
(`Gn`: green at 4, red at 8, maximum 15). A channel equal to the sentinel `ys` (32768) is written as the default flag with its
channels cleared, and it marks only the field it is passed as: the whole pair set to the sentinel marks the foreground, because
`dc(32768)` is 0, so a background default needs it in the high half.

A frame is admitted by `Sb` ([253980,254123) 143 units), which refills the row against a clock and spends one token:
`tokens = min(4096, tokens + max(0, now - refilledAt) * 160 / 1000)`, the clock recorded, then `tokens - cost >= 1` decides and
`tokens -= spent ? 1 : 0`. The cost is therefore a reserve the row must keep, not a price: with a full row, cost 0, cost 1024 and
cost 4095 each admit and each leave 4095, while a cost equal to the tokens is refused and a refused frame spends nothing. That
distinction is the one a reader is most likely to get backwards, and the suite asserts it field by field. The row itself is `fb`'s
`{tokens: 4096, refilledAt: 0}`, held in the host registry as `rasterAdmission` and built on the first read by `mb`
([253866,253943) 77 units) through `it().rasterAdmission ??= fb()`.

`mb` is worth reading twice. The source writes `Ge(() => it().rasterAdmission ??= fb(), () => { it().rasterAdmission = void 0 })`,
which reads as a memoized row with an invalidator — but `Ge` is `function Ge(t,e){return t}` (chunk-ae84tp6z.js [5355,5381) 26
units, a body the chain-runner copy already carries), an identity in this build, so the binding *is* the factory and the
invalidator is dropped by the source itself. There is no reset through the accessor; a caller that wants the row gone clears the
registry field. The suite asserts that, rather than assuming the memoizer the call reads like.

The last two blocks are the validating mount: `bb`/`wb` the default 512 by 256, `tF` ([257058,257102) 44 units) which passes those
as the limit, and `Xto`, the field list a mount admits. Its check `Kbr` is the one foreign body (chunk-nyce03br.js [87140,87341)
201 units), and it needs exactly one free name, `h$` — a body that copy has carried since W45-58 exported it, so nothing here
reaches a new boundary.

What was *not* copied matters as much. `nb` (64), `fc`, `Ff`, `pc`, `Sc` (1024), `gb` (1024) and `hb` (131072) sit inside or
immediately beside these runs and belong to the engine that follows — `gb` and `hb` are the costs `gNs` passes to `Sb`, and
`Sc`/`hb` its slot limits — so the plan takes ten small blocks rather than one span, and the record asserts both that each is
still a statement of the module and that its body is absent from the copy.

Verified: check/build/notices, both scanned copies `unresolved 0`, span scan `total 0`, passed true, 59 plans, all eleven blocks re-read from
their modules and matched against the copy with acorn (whole statements, contiguous, no cut, no repetition), the seven excluded
neighbours asserted absent, `Kbr`, `h$` and `Ge` re-read from their modules with the copy asserted not to declare them, the
bodies and their ranges quoted verbatim in the seam header, the new suite 11/11, the chain family (test/plugin-chain-*.test.ts) 305/305,
full 1581 tests / 1581 pass / 0 fail on the frozen tree, 15 compiled drivers (the shared driver now also prints `W45RasterCellsCompiled.v1`), and the packaged smoke
(pack 292 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `8033fe3f…` (read from scripts/identity.mjs by the record script itself).

Next: the surface engine that drives all of this — `gNs` at chunk-n3ykh62m.js [254367,256143) 1,776 units (`function gNs(e=Date.now,n=mb())`)
with `_b` ([256143,256382) 239 units) and `Lss` ([256382,256690) 308 units, which calls `r.beginPaint(...)`), plus `db`
([253451,253816) 365 units) and the constants they own; its closure measured 31 statements / 4,211 units and reaches `fl` in
chunk-yn0pfn70.js. Then the site components that call these bodies (`tF` is called at 257441, and the Raster/Image sites are
`Tc(jo, …)` in chunk-kjfwbh4w.js — the React layer becomes a seam, as W45-38 did for the bar), the remaining `$` table entries
(`ui.scroll`, `ui.focus`, `ui.copy`, `state.get`/`state.set`, `fs.ancestors`) and the dispatcher `G2e`. The settings read path
behind `y9e` stays the measured subsystem: 590 statements / 327,047 units, 318,262 of them fresh.


## W45-61 ported the raster surface engine (2026-10-16)

This is the last piece of the raster surface: W45-58 ported what reads the registries, W45-59 what fills them, W45-60 what a frame
is painted *with*, and here the pass that takes a frame's colours, admits them, matches them against what the surface already
holds, and answers the escape that draws each one. Ten blocks, 4,374 units — seven runs of chunk-n3ykh62m.js and three statements
of chunk-yn0pfn70.js.

A frame is a flat array of cells, `CELL_STRIDE` (3) entries each: the code point, then the foreground and the background as 24-bit
colours. `_b` reads it into the keys a row is made of, and the measurement corrected a first misreading of that: a key is pushed
where the colour *changes*, not once per cell, so a row of one colour is one key and a row that changes and changes back is three
keys for two distinct colours. A key is `pc(fg, bg)` — each colour narrowed by `Ff` from its 24 bits to four bits a channel
(red becomes 0xF00) with the no-colour sentinel answering the default marker, then packed with the foreground low.

`gNs` builds a surface over `lb`'s state. `beginPaint` bumps the paint counter, records the frame, clears `evaluated` and the
four status flags, sets `lastSgr` back to `hc()` — the both-sides reset `ESC[39mESC[49m` — and then walks the frame: a key the
surface already holds only has its `lastPaint` touched, while anything else takes a free slot or the stalest one `cb` offers, and
every one of those is admitted through the token row W45-60 ported, at a cost of nothing for a fresh slot and `gb` (1024) for a
reused one, its cell written by `$f`. `sgrOf` answers a key's escape in three steps: the entry the surface holds, else the entry
`db` matched — the slot whose cell is nearest the probe by squared channel distance, counting `Lr.defaultMismatch` where a default
flag differs and taking the first slot on a tie — recorded as an alias, else the last escape the surface emitted. So a colour the
surface does not hold is drawn with the escape of the slot it matched, which is measured (green, with only a red slot present,
answers red's escape) and is the source's own behaviour rather than a fallback this port added.

`standing()` reports the paint's progress, and the measurement pinned its third value exactly: `progressing` appears on the
131073rd evaluation, because the matcher stops once `evaluated + slots` exceeds `hb` (131,072). `waiting` is a paint the token
row refused; `complete` is everything else, including a paint of colours the surface already held.

The CSI helper `fl` is **ported, not bound**: its closure measured three statements and no imports at all, so the source body was
obtainable and is copied. Its own behaviour corrected a second first draft — every argument but the last is joined with the
separator and the last is appended as it stands, so `fl(38, 2, 255, 0, 0, "m")` is the sequence one expects but `fl(1, 2, 3)` is
`ESC[1;23`. That is why the SGR builder passes its final byte as a string. Everything else the engine reaches is imported from
copies already carried — the cell stride `xo`, the colour grammar `gs` and the sentinel `ko` from the W45-58 blit copy, thirteen
bucket and encoder names from W45-60, `Ge` from the chain-runner copy — with the copy asserted not to declare any of them, and
`REUSE_COST`/`EVALUATION_BUDGET` derived from the copied `gb`/`hb` rather than written as literals.

Verified: check/build/notices, both scanned copies `unresolved 0`, span scan `total 0`, passed true, 60 plans, all ten blocks re-read from their
modules and matched against the copy with acorn (whole statements, contiguous, no cut, no repetition), the engine's four key
fragments and `fl`'s first line re-read from their modules, the four import lines quoted verbatim with the eighteen imported names
asserted absent as declarations, the matcher's background-stride walk and the row builder's code-point read asserted, the two
derived constants asserted derived, the registry-state typing for the row and the surface, the suites 25/25,
the chain family (test/plugin-chain-*.test.ts) 319/319, full 1595 tests / 1595 pass / 0 fail on the frozen tree, 15 compiled drivers (the shared driver now also prints `W45RasterSurfaceCompiled.v1`), and the
packaged smoke (pack 294 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `282f0ed6…` (read from scripts/identity.mjs by the record script itself).

Next: the site components that mount a surface and drive it — `tF` is called at chunk-n3ykh62m.js 257441, just past this package's
last block, and the Raster/Image sites are `Tc(jo, …)` in chunk-kjfwbh4w.js, where the React layer becomes a seam over the bodies
now ported (as W45-38 did for the bar). Then the remaining `$` table entries (`ui.scroll`, `ui.focus`, `ui.copy`,
`state.get`/`state.set`, `fs.ancestors`) and the dispatcher `G2e`. The settings read path behind `y9e` stays the measured
subsystem: 590 statements / 327,047 units, 318,262 of them fresh.


## W45-62 ported the raster leaf problems (2026-10-16)

The raster surface is now readable from the site tree. W45-58 ported what `$.ui.blit` paints through, W45-59 what fills the
registries, W45-60 what a frame is painted with, W45-61 the engine that turns a frame into escapes, and here the two checks a
Raster or an Image site is *admitted* by — the leaf half of the problem table the tree walker reads as
`tno[type](leaf) ?? ano(leaf, depth) ?? lur(...)`.

Eight blocks, 1,980 units, 14 statements of chunk-n3ykh62m.js. The first thing the work turned up is that the overlap scan is
not the whole story: it reported fifteen fresh statements, but one of them, `$ne` the location policy, is already owned by
`src/plugin-chain-fs-boundaries.ts` and imported from there by the blit copy, so it is named and not carried a second time —
the record asserts the ownership *and* that this copy does not hold it.

What the two leaves share is the shape of a problem, not a function. Both build a sentence out of a label and the first check
that objected, both run their checks in the same order with the stamp last, and both name the site through `IL`, which
replaces whatever the line pattern matches with a question mark and cuts the key to 40 with an ellipsis. Where they differ is
the source's own and is kept. A Raster's props go through a picker, so a stray field is refused with one sentence and the
field is never named; an Image destructures its five known props and *names the leftover key it found*, because a press goes on
an enclosing Button and the message says so. A Raster's cells go through the decoder and the decoder's own `.problem` is the
message; an Image's source goes through the image-source shape, which answers the sentence itself. And an Image always has to
state its columns and rows, because a missing size is refused before anything else is looked at.

Three measurements corrected first drafts. The control test is the *pattern* and not the sentence it answers with: an escape, a
NUL, a DEL and a lone surrogate are refused, while a tab, a newline, a paired surrogate (an emoji), U+FFFD and U+FFFC are all
admitted — so the message says "control character" about a set that is really escapes, lone surrogates and placeholders, and
the port keeps the pattern. An Image's alt and key **type** sentences carry no key at all, because they are answered before the
label is built, and only the checks from the alt check onward are prefixed. And a leftover prop inside the props is a different
sentence from the leaf's own children, which is a distinction the props destructuring makes.

One plan extension. The runner copy carried `y$`, the line scrub `IL` builds its replacement from, without exporting it. The
body was already in that copy, so the plan grew one export rather than binding a host hook for something the product owns —
the same call W45-60 made for `h$`. Everything else the leaves reach comes from copies already carried: `L`, `ne` and `y$`
from the runner, the image-source shape, the control pattern and the cell decoder from the blit copy, and the size check with
the mount and its field list from W45-60.

Verified: check/build/notices, both scanned copies `unresolved 0`, span scan `total 0` over 294 documents, passed true, 61 plans, all eight
blocks re-read from their module and matched against the copy with acorn (14 statements, whole and contiguous, no cut, no
repetition), the eight bodies quoted verbatim in the seam with their ranges, the nine imported names asserted absent as
declarations with `$ne`'s ownership asserted both ways, the runner plan asserted to export `y$`, the three source plans
asserted to still export what is imported from them, the registry-state typing for the leaf problem and its two inputs, the
suites 42/42 (the three raster suites 42/42), the chain family (test/plugin-chain-*.test.ts) 336/336, full 1612 tests / 1612 pass / 0 fail on the frozen tree,
15 compiled drivers (the shared driver now also prints `W45RasterSitesCompiled.v1`, 36 markers in
the shared run and 47 across every driver), and the packaged smoke (pack 296 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `98220fee…` (read from
scripts/identity.mjs by the record script itself).

Next: the rest of the site tree, which is a package of its own — the other leaf problems (Select with its option check, Svg,
Link, and the input/code/markdown ones), the depth walker that reads them, and the `tno` table that maps a site type to its
problem. Then the React layer (`Tc(jo, …)` in chunk-kjfwbh4w.js), the remaining `$` table entries, the dispatcher `G2e`, and
the settings read path behind `y9e` (590 statements / 327,047 units, 318,262 of them fresh).


## W45-63 ported the site leaves (2026-10-16)

Four more leaves of the site tree, chosen by what they *don't* need. The whole table measured 41 fresh statements and 11,731 units,
which is a package and a half; the question that cut it was whether a leaf's checks reach anything outside the module, and four of
them do not. Code, Input, Select with its option check, and Svg came across at eight blocks, 3,557 units and 15 statements, with
every name they reach imported from a copy already carried — `L` from the runner, the control pattern from the blit copy, and the
label, length and string checks from the W45-62 leaf-problem copy.

Each leaf answers in its own order and the orders are the source's own. Code destructures its known props and *names* the leftover,
then source by the label check with language and path by the capped one, then a start line within a billion and two enums. Input
sweeps its own key list and never names a field, checks its four fields in list order, then autoFocus, then the press, and its
children only after all of that — so `Input "<key>" takes no children` is the one sentence with no field name in it. Select checks
the same key list, then label and value, then between one and 64 options, each through an option check that is threaded a single Set
so a repeated value is caught on its second sighting. Svg names its leftover the way the Image does, and measures both sides with
one sentence, so a problem with the height is reported as if either could be wrong.

The shared predicates are small, and measuring them was worth more than reading them. autoFocus must be exactly `true` or absent,
and a `false` is *answered* rather than taken as the default. A press needs a plugin name and a `handle` that is a whole number,
which means a leaf handed no press at all is refused by that check — so an admitted Input or Select in a test has to be handed one.
A pixel side may be a *fraction*: the check wants a finite positive number within the bound, not a whole one. And a hover-scope key
that is wrong is dropped rather than refused, with two differently shaped sentences saying so, both scrubbing the key and both
cutting it at 40.

Three leaves of the same table were measured and deliberately left out, and the reason is the package's shape. The Button needs a
version table (10 statements, 14,212 units) and an error formatter (24 statements, 3,794 units); the Client needs two statements of
that formatter; Markdown needs a renderer that needs the formatter; and the Link needs a URI helper (454 units). Each is a
subsystem rather than a leaf, so each is its own package. The leaf table `tno` cannot come before the Button and the Client,
because it maps those two of its nine types to their leaves. The record asserts the copy carries none of them or their helpers, so
a later package cannot half-take one by accident.

Verified: check/build/notices, both scanned copies `unresolved 0`, span scan `total 0`, passed true, 62 plans, all eight blocks re-read from their
module and matched against the copy with acorn (15 statements, whole and contiguous, no cut, no repetition), the eight bodies
quoted verbatim in the seam with their ranges, the seven imported names asserted absent as declarations, the seven held-out names
and their six helpers asserted absent as copies, the three source plans asserted to still export what is imported from them, the
four shared predicates asserted whole in the copy, the registry-state typing for the leaf input and its pressable form, the suites
58/58, the chain family (test/plugin-chain-*.test.ts) 352/352, full 1628 tests / 1628 pass / 0 fail on the frozen tree, 15 compiled drivers (the shared driver now also prints
`W45SiteLeavesCompiled.v1`, 37 markers in the shared run and 48 across every driver), and the packaged smoke
(pack 298 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `28bb4040…` (read from scripts/identity.mjs by the record script itself).

Next: one package per held-out dependency — the version table behind the Button, the error formatter behind the Client and Markdown,
the URI helper behind the Link — and then the leaf table `tno` with the depth walker that reads it (measured at 18 statements /
3,506 units). Then the React layer `Tc(jo, …)`, the remaining `$` table entries, the dispatcher `G2e`, and the settings read path
behind `y9e` (590 statements / 327,047 units, 318,262 of them fresh).


## W45-64 ported the style props (2026-10-16)

The dependency W45-63 measured and held out is now carried whole, and it measured the same on the way in: 24 statements and 3,794
units, exactly what that record named as the error formatter behind the Client and the Markdown. Two things live in it. A plugin's
prop name is looked up in six sets and one table, in a fixed order, and a prop value that failed is described back to the author by a
walk with a budget.

The rule order is the behaviour. The ten enum props answer with the whole list joined by commas — even when the value is not a string
at all — and only then are the sizes, the spacing names, the sides, the colours and the text styles tried. Anything else answers
`has no value rule`, which includes props this chain knows perfectly well elsewhere: `key`, `options` and `autoFocus` are not
style props, so they get the same sentence as gibberish. The validator answers a reason and never a name; the caller prefixes the site
and the prop.

The three numeric rules differ in ways that reading them side by side hides, so they were measured. A size is `0 ≤ v ≤ 10000`, and a
fraction is fine. A spacing is a *magnitude*: `|v| ≤ 10000`, so `gap: -1` is admitted where `width: -1` is refused. A side is the
strictest of the three, an integer within the same bound, because it names character cells — `top: 1.5` is refused. A colour is a
character class rather than a list, `[#a-zA-Z0-9_().,% -]{1,40}`, so a theme key, a name and a hex are one rule and
`rgb(1,2,3)` is admitted. A percentage is one to three digits, so `100%` fits and `1000%` does not.

A value that failed is walked against a budget: 100,000 characters, 32 levels, 20,000 values, with a scalar cost of five for a boolean
or `null`, a string's length plus two quotes, and a number's own digits. The order of the walker's checks is the whole answer. Depth
is first, so a deep value answers depth rather than its shape. Then the budget, then a value already walked, then a number that is not
finite — *before* it is counted, because `NaN` would otherwise cost three characters and be skipped. Then a scalar, `undefined`
(which the sentence explains as an array hole), a non-object, a cycle, and an object whose prototype chain is deeper than one plain
level, which is how a class instance and a `Map` are described. A value seen twice is not a cycle: it is charged its stored cost
again, which is why one call builds one budget, and why a caller that hands its own budget back in is charged twice.

Two names are imported rather than copied. `He` is the error the list-length guard throws — the one body here that refuses instead
of describing, and the one that coerces before it does: `"12"` is 12, `1.5` is 1, a negative and a `NaN` are both zero, and only
a bigint, a symbol or anything above 4,294,967,295 throws. `PFs` is the border table from the W44 tui copy: `new Set(PFs)` is the
Set the validator consults and the Set the `borderStyle` entry *is*, so the border names are one table read twice rather than a list
written out a third time. Two statements inside the package's own span — `Ago` and `B3e` — are referenced by nothing in it, so the
plan splits the span around them and the record asserts the copy carries neither.

The queue is corrected as measured. The Link's URI helper `hf` is not a new dependency: the site module imports it from
`chunk-ax7r0qj7.js`, whose copy has carried it since W45-42, so that item closes. What is left behind the leaves is the version table
the Button needs (10 statements / 14,212 units) and the renderer the Markdown needs (`zto`, 441 units).

Verified: check/build/notices, both scanned copies `unresolved 0`, span scan `total 0`, passed true, 63 plans, all seventeen blocks re-read from
their module and matched against the copy with acorn (24 statements, whole and contiguous, no cut, no repetition), the seventeen bodies
quoted verbatim in the seam with their ranges, the two imported names asserted absent as declarations and present in the copies that own
them, the two statements inside the span asserted absent as copies, the `hf` claim re-read from three artifacts, the registry-state
typing for the walk budget, the suites 55/55, the chain family (test/plugin-chain-*.test.ts) 374/374, full 1650 tests / 1650 pass / 0 fail on the frozen tree, 15 compiled drivers (the
shared driver now also prints `W45StylePropsCompiled.v1`, 38 markers in the shared run and 49 across every
driver), and the packaged smoke (pack 300 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `ca25c63e…` (read from scripts/identity.mjs by the record script itself).

Next: the version table behind the Button, then the leaf table `tno` with the depth walker that reads it (18 statements / 3,506 units),
then the Markdown's renderer and the Link's URI helper package, the React layer `Tc(jo, …)`, the remaining `$` table entries, the
dispatcher `G2e`, and the settings read path behind `y9e`.


## W45-65 ported the Client, the Markdown and the Link (2026-10-16)

The three leaves W45-63 measured and held out are in, and they came in cheap: three blocks, 2,785 units, seven statements, with every one of
the fourteen names they reach imported from a copy already carried. Six copies supply them — the chain runner, the W45-64 style-prop copy,
the blit copy, the leaf-problem copy, the site-leaf copy and the host-call copy — and the copy declares none of them itself. The Link was
the reason W45-63 held the group back, and W45-64 had already found its URI helper carried, so what stood between the site table and its
Button was nothing at all.

The Client is the leaf whose checks belong to other packages: the first-field problem names its keys, the value budget describes its prop
bag, that copy's prop rules measure its three numbers, and the raster leaves' own predicate stamps it. The order is the answer — props
shape, keys, bag, sizes, stamp, children — and it was measured, so a bad width is reported even when a child is there. A size that is
neither a number nor a string answers the Client's own sentence; a string goes on to the prop rules of its name. And a stamp is a plugin
name and nothing else: the predicate asks for no handle, unlike the press check one package over.

The Markdown is the one leaf here that names its own site through a variable — `Markdown "<key>"` when it has a key and `Markdown` alone
when it has not — and the exception is worth stating: the props sentence, the children sentence and both halves of the press-and-links
pairing carry no key even when the leaf has one. A missing text is not a props problem (the props are a sound bag with no text in them),
and a press needs a key whatever else the leaf carries, so a Markdown with links and a press but no key answers that it answers its links
without an address.

The pressable-link list is a check of its own, with its own limits and its own habit of naming a shape rather than a problem: a number is
`holds a number, not an href`, and an empty string is reported by its type rather than its emptiness. The one place it differs from the
Link is the measurement: it measures an href as written, while the Link measures it as written *and* percent-encoded, so 1,024 accented
characters pass there and fail here. The Link's own href check is guarded by the non-blank-string predicate, which means an href that is
not a string at all is not refused at all — a blank href is not an address to measure rather than a mistake to name. Its encoder
percent-encodes everything outside the range that starts at a space and ends at the tilde, and repairs a lone surrogate to U+FFFD first,
which is why a lone high surrogate encodes as `%EF%BF%BD` rather than as a malformed escape.

Two things came out of the run itself, and both are recorded as measured. The `ne` helper the Markdown's closure reached — the UTF-16-safe
truncation with its two fallbacks — is the runner copy's own statement at chunk-ax7r0qj7.js [1128,1272), so nothing was copied twice. And a
pre-existing flake in the lockfile regression block turned out to be the library's design: it keeps its locks in one process-global map
keyed by path, so a takeover overwrites the slot and a displaced holder's refresh timer can no longer be cleared; the orphan fires later,
finds the path gone and calls `onCompromised`, which the source's own default throws. It was reproduced in isolation (.audit/w45-65-lockprobe2.mjs:
a plain acquire and release is clean, a takeover without releasing the holder dies, a takeover with both releases dies too) before the
block's displaced-holder window was widened past the end of the run. That is a harness fix with a measurement behind it, not a product change.

Verified: check/build/notices, both scanned copies `unresolved 0`, span scan `total 0`, passed true, 64 plans, all three blocks re-read from their
module and matched against the copy with acorn (7 statements, whole and contiguous, no cut, no repetition), the three bodies quoted verbatim
in the seam with their ranges, the fourteen imported names asserted absent as declarations and present in the six export lists that own them,
the neighbours and the two unported leaves asserted absent as copies, the `ne` and `hf` blocks re-read from the copies that carry them, the
registry-state typing for the client input, the suites 75/75, the chain family (test/plugin-chain-*.test.ts) 394/394, full 1670 tests / 1670 pass / 0 fail on the frozen tree, 15 compiled
drivers (the shared driver now also prints `W45ClientMarkdownLinkCompiled.v1`, 39 markers in the shared run and 50 across
every driver), and the packaged smoke (pack 302 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `e4a3ee4b…` (read from scripts/identity.mjs by the record script itself).

Next: the Button and the version subsystem behind it — measured at 430 statements and 127,575 units over sixteen modules, so it is walked in
pieces starting from `dcs`/`acs` themselves (33 and 190 units) and the three names they import. Then the leaf table `tno` with the depth
walker that reads it, the React layer `Tc(jo, …)`, the remaining `$` table entries, the dispatcher `G2e`, and the settings read path
behind `y9e`.



## W45-66 ported the Button and the keybinding tables (2026-10-16)

The site table is complete. Nine leaves — Raster, Image, Code, Input, Select, Svg, Client, Markdown, Link and the Button —
are all in the product, and the Button came in last because it is the only one whose check reaches outside the table. An
action is refused twice: once when the engine does not know the name, quoted back with its serializer, and once when the
engine holds it alone with the reason the reserved-key table carries. Both answers live in the keybinding module, and the
ten statements it takes to answer them are the defaults per context, the 174 action names, the seven reserved keys, the
key normaliser with its alias table, and the two membership checks.

The module's first statement is a lesson in reading before cutting. It looks like a header and it is: the platform the
defaults were computed for, whether that platform is Windows, the paste binding it uses, and the toggle binding the
version gate decides. But it is also the defaults table itself — one statement, 7,075 units — so the whole thing comes
with the two checks that read it. Nothing here adds a host hook: the platform comes from `O`, which W45-46 already bound
in the fs boundary, so the copy imports it, and the version comparison is a runtime global the copied body keeps
verbatim. The scanner now knows that global the way it knows `process`, and the second suite in this package binds the
platform to the source's own word for Windows and installs the global as a fixture, which proves the header asks
`satisfies("1.4.3", ">=1.2.23")` first — because the probe beside it answers true — and then derives its toggle key from
the answer.

What reading turned up, measured rather than assumed: a Button must be held by a plugin to be admitted at all, because
the press check it runs last is the shared predicate, and that predicate refuses an absent press where the Link's href
check is guarded and admits one. The engine holds exactly two actions alone — `app:interrupt` and `app:exit`, the two
the Button's own sentence names — and five of the seven reserved keys are bound to nothing at all, so the set is built
from the bindings rather than from the reserved list. The option checks run in the order the source destructures them,
and two pairs of them are provably ordered: a bad plain beats a bad autoFocus, and a bad hotkey beats an engine-only
action. The two normalisers differ in a way easy to miss: `pqe` names the space key as a word and keeps the space inside
a chord, while `Ye` alone answers an empty string for a lone space.

Verified: check/build/notices, both scanned copies `unresolved 0`, span scan `total 0`, passed true, 66 plans, both ledgers re-read
from their modules and matched against the copies with acorn (13 statements, whole and contiguous, no cut, no repetition),
twelve body slices quoted verbatim in the keys seam with their ranges, the platform constants derived from the copy rather
than restated, the neighbourhood left out asserted absent (the key parser, the two further membership checks, the schema
builders and the platform-dependent reserved-key list — the binding editor), the imported names asserted absent as
declarations and present in the export lists that own them, the suites 88/88 across the six
site-table files, the chain family (test/plugin-chain-*.test.ts) 407/407, full 1683 tests / 1683 pass / 0 fail on the frozen tree, 15 compiled drivers (the shared driver now also prints
`W45ButtonKeysCompiled.v1`, 40 markers in the shared run and 51 across every driver), and the packaged
smoke (pack 306 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). The full sweep's first run showed two MCP timing failures while other work ran beside it — a frame count
and a 300 ms `initialize` timeout — and the re-run on an idle machine is clean; neither file is touched by this package.
Identity `53bdec15…` (read from scripts/identity.mjs by the record script itself).

Next: the binding editor the keybinding module still holds (`mJ` the key parser, `lcs` and `F` the further membership
checks, `ze`/`Bn` the schema builders, `fe` the platform-dependent reserved-key list); then the leaf table `tno` with the
depth walker that reads it, the React layer `Tc(jo, …)`, the remaining `$` table entries, the dispatcher `G2e`, and the
settings read path behind `y9e`.


## W45-67 ported the keybinding editor (2026-10-16)

The keybinding module is complete but for its row reader. W45-66 took the tables a Button is measured against; this
package takes the editor — what a keybindings file is checked against when it is read, and again when it is used. The
key parser and the chord splitter, the six legacy action names with the check that reads them, the 29 contexts with
theirs, the action-or-command check, the reserved keys for the platform the build runs on, and the two schemas with the
runtime checks that ask them: fifteen blocks, 3,091 units, fifteen statements over two modules.

The parser turned out not to be the function one package over, and that is the first thing reading bought. `Ye`, the
normaliser W45-66 ported, folds `meta` into `alt` so that `meta+up` and `opt+up` compare equal. `mJ` keeps
`meta` and `super` apart, because what it answers is not a name to compare but the record a binding is stored as —
the key plus five flags. It splits on `+` alone, so a chord keeps its space inside a key, and the four short aliases
and the four arrow glyphs resolve before anything else. The chord splitter beside it answers the exact single space
first, which is why two spaces and an empty chord both come back as one empty key rather than no keys at all.

The second thing reading bought is the shape of the check. The file schema checks the values: a context from the 29, an
action the engine knows, one of the six legacy names, a `command:` pattern or `null` to unbind. The runtime schema
holds the shapes only, and it is weaker by measurement rather than by intention — an unknown context, an unknown action
and a legacy name all pass it — because the values were checked once, when the file was read. The two checks that ask it
are correspondingly plain: one block against the schema, and a document as an array whose every block passes, which
answers `true` for an empty array and `false` for one bad block in two.

The one boundary this package adds is a second one of the kind W45-46 bound. The copied bodies build their schemas
through seven names that reach the application's bundled zod — `u`, `U`, `o`, `ue`, `Ue`, `Bm`, `A` — and
this product already depends on zod, so src/plugin-chain-schema-aliases.ts binds those names to it, one name per call
site: an object schema with `describe` hanging off it, an enum from an array of literals, a string with `regex` and
`optional`, a two-argument record, a union, null, and an array of a schema. The mapping is observable rather than
nominal, because the suite writes a keybindings document through both schemas and asserts what each accepts and refuses.

The row reader is what is left, and it is left deliberately. `Ace` flattens blocks into rows and `ge` rewrites the
legacy names as it goes, through lodash `mapValues` under this chunk's name `oo` — and this chunk does not declare
that helper: the one `oo=` in it is a state store called `$oo`. The map-values copy the product carries came from a
different chunk, so the package that takes the reader decides how the two are bound. Both bodies are asserted absent
here, in the source, in the copy and in the seam.

Verified: check/build/notices, both scanned copies `unresolved 0`, span scan `total 0`, passed true, 67 plans, the ledger re-read from
its modules and matched against the copy with acorn (15 statements, whole and contiguous, no cut, no repetition), fifteen
body slices quoted verbatim in the seam with twelve ranges cited, the eighteen names the copy owns and re-exports counted
and checked one by one, the thirteen imported names asserted absent as declarations and present in the export lists that
own them, the deferred bodies excluded three ways, and the alias boundary's seven bindings asserted one at a time. The
suites 102/102 across the eight site-table and leaf files, the chain family (test/plugin-chain-*.test.ts) 421/421, full 1697 tests / 1697 pass / 0 fail on the frozen tree,
15 compiled drivers (the shared driver now also prints `W45KeybindingEditorCompiled.v1`,
41 markers in the shared run and 52 across every driver), and the packaged smoke (pack 309 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0).
Identity `9b311560…` (read from scripts/identity.mjs by the record script itself).

Next: the row reader with its mapper and the lodash binding it needs; then the leaf table `tno` with the depth walker
that reads it, the React layer `Tc(jo, …)`, the remaining `$` table entries, the dispatcher `G2e`, and the settings
read path behind `y9e`.


## W45-68 ported the keybinding row reader (2026-10-16)

The keybinding module is complete. W45-66 took the tables a Button is measured against, W45-67 the editor a
keybindings file is read through, and this package the reader a table is drawn from: five blocks, 395 units,
six statements over two modules, and no body of the module left uncarried.

The reader is two bodies. `Ace` walks the blocks and answers one row per binding, handing each chord to the
editor's own splitter as the row is built, which is why a row carries keys rather than the string the file
wrote; the action is copied as it stands, `null` included, because unbinding a default is a row like any
other and the reader is not the place that decides what a null action means. `ge` is what a freshly read
file passes through before the rows are read: each block's bindings are mapped value-wise, and the six
legacy action names are replaced by the names they are read as, while everything else — `null` included,
since the check refuses it before the map is consulted — is left where it was. Both were measured against
the call the source's own caller makes: the product's defaults answer 226 rows over 27 contexts.

What the mapper calls is this chunk's own lodash `mapValues`, and the measurement is what kept the package
small. Walking that function's dependency graph naively reports 153 statements, 10,660 units and 13 imported
helpers; all 13 imports were already carried by the memoize copy and 150 of the statements by the internals
copy, so what this package takes from that chunk is three statements — the iteratee folded to arity three,
the own-key walk, and the write. It is the write that matters: a value is stored through a guard rather than
assigned, which is what keeps a key literally named `__proto__` a property of the answer instead of its
prototype, and the suite measures exactly that.

One edit reaches outside this package, and it is recorded rather than silent. The own-key walk the
map-values iterates with was declared in the internals chunk but not exported from the copy that carries it,
so the internals plan gains one export (`Wpe`) — the convention that copy was built for, since its exports
exist so later packages can read helpers out of it instead of copying them a second time. Its product digest
moves to `2708e44c…`, and the evidence record states the change, the plan's new export count and why it beat
the alternative of copying the walk again.

Verified: check/build/notices, both scanned copies `unresolved 0`, span scan `total 0`, passed true, 68 plans, the ledger
re-read from its modules and matched against the copy with acorn (5 statements, whole and contiguous, no cut,
no repetition), five body slices quoted verbatim in the seam with four ranges cited, the six names the copy
owns and the four it exports counted and checked one by one, the seven imported names asserted absent as
declarations and present in the export lists that own them, the internals plan's export and the two bodies it
publishes asserted both ways, the naive closure re-measured at 153 statements / 10,660 units with its imports
still coming from the memoize chunk, and the two types the reader's blocks and rows need asserted present. The
suites 110/110 across the nine site-table, leaf and keybinding files,
the chain family (test/plugin-chain-*.test.ts) 429/429, full 1705 tests / 1705 pass / 0 fail on the frozen tree, 15 compiled drivers (the shared driver now also prints
`W45KeybindingRowsCompiled.v1`, 42 markers in the shared run and 53 across every
driver), and the packaged smoke (pack 311 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `3a8fefd7…` (read from scripts/identity.mjs by the record
script itself).

Next: the leaf table `tno` with the depth walker that reads it; then the React layer `Tc(jo, …)`, the remaining
`$` table entries, the dispatcher `G2e`, and the settings read path behind `y9e`.




## W45-69 ported the leaf table and the walkers that read it (2026-10-16)

The site-table side is complete. W45-60 to W45-66 took the nine leaf checks one at a time; this package takes
the table that names them and the three walkers the pane that draws leaves runs over a tree — fifteen blocks,
4,183 units, twenty statements over five modules, and no host boundary added.

The table is the dispatch, and it is one statement: the nine leaf types, each mapped to the check that refuses
a bad leaf. Every value is a body another package already ported, so what the table adds is the answer a caller
holding a leaf of unknown type asks for, and what it costs is nothing — it is imported around rather than
copied again. The three walkers are what a tree costs to draw. `rno` is the text a leaf contributes: a Svg's
alt, a Button's children joined (and its children win over its label when it has both), a Button's or an
Input's label, and nothing for the rest of the types — with the one case reading alone would have got wrong,
an Input without a label contributing the empty string rather than nothing. `ono` is the height that text
takes: a Raster's or an Image's rows, a Markdown's lines, one line plus the wrapped text for everything else,
and for a Code leaf the only answer that needs parsing — its own line count while it is under the twelve-line
cap, and past it the diff it holds, through the hunks it adds, the gutter its line numbers take and whether
the answer is the truncation. `ano` is the duplicate check, keyed by type and key together, so the same key
under two types is admitted and only the second sighting of one leaf is refused.

The parser behind the Code leaf's height is the largest body in the package and the reason it is here: the
reader over it (`Dto`) drops the parser's no-newline marker lines, checks each header to be `@@ -a,b +c,d @@`
with all four numbers safe integers inside a billion lines, and answers a refusal value rather than throwing —
so a malformed diff costs the pane a sentence, and the parser's own count-mismatch wording reaches the caller
inside that sentence. The four helpers under the walkers are one statement each: the tab expansion a width
measurement needs, the counter, the gutter width, and the two constants the cap and the wrap width are, which
the bundle declares in one statement with four others this module does not read.

One import was decided by measurement rather than by name. Two copies declare `ae`: the runner copy's is a
plugin-state predicate, and the text-clamp copy's is the width helper the walkers count with. The closure
reports the walker's `ae` as coming out of the text-clamp chunk, so the import is written against the closure;
importing by the name alone would have silently substituted a predicate for a measurement, and the first probe
answered 0 for a width that is 6. Beyond that the package reaches outside itself only to read: the nine checks,
the two string helpers, the width helper and the error describer are 14 names imported from seven copies that
already carry them, and no other package's artifact changes.

Verified: check/build/notices, both scanned copies `unresolved 0`, span scan `total 0`, passed true, 69 plans, the ledger
re-read from its modules and matched against the copy with acorn (20 statements, whole and contiguous, no cut,
no repetition), fifteen bodies quoted in the seam — twelve verbatim and the three that hold a real line break
quoted head and tail with the elision marked — with fifteen ranges cited, the sixteen names the copy owns and
the sixteen it exports counted and checked one by one, the four constants that share the statement asserted
present but not exported, the fourteen imported names asserted absent as declarations and present in the export
lists that own them, both `ae` declarations asserted where the closure says they are, and the naive closure
re-measured at 81 statements / 16,715 units. Its suites 13/13 alone and
136/136 across the nine site-table, leaf and keybinding files, the chain family (test/plugin-chain-*.test.ts) 442/442,
full 1718 tests / 1718 pass / 0 fail on the frozen tree, 15 compiled drivers (the shared driver now also prints
`W45LeafWalkersCompiled.v1`, 43 markers in the shared run and 54 across every
driver), and the packaged smoke (pack 313 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `6c6497b4…` (read from scripts/identity.mjs by the record
script itself).

Next: the React layer `Tc(jo, …)`, the remaining `$` table entries, the dispatcher `G2e`, and the settings
read path behind `y9e`.


## W45-70 ported the `$` call dispatcher (2026-10-16)

The call path has a front door now. A plugin's `$.<name>(...)` call is the dispatcher's business before it is
the call table's: twenty-one blocks, 4,182 units, twenty-three statements over three modules, no host boundary
added, and one artifact outside the package touched.

`G2e` reads the call table's entry, copies the arguments when the call carries a reference — so a hook cannot
reach the object the plugin still holds — and hands the call to the gate. The gate is four rules. The caller's
hooks module must be loaded and must have declared the call in its scan; the call must not be withheld; and no
hooks module behind the call may be unadmitted, with a clock call exempt from that last rule, because a plugin
that is not yet admitted can still ask the time. Every refusal is the plugin's own mistake in its own name,
except the withheld one, which is the host's sentence naming the module that removed the call, logged once per
plugin and first segment. Two scan rules hold a declared module to what it declared: `nzt` for the environment,
where the variable an `env.get` or `env.set` call names must be in the scan's reads or writes by direction, and
`Qqo` for the state, where the `{plugin, key}` reference a `state.get` or `state.set` call passes must be one
the scan lists. Both refuse a call that carries no name or reference at all with a sentence of their own.

Past the gate the call table takes three steps, and the probe measured their order — `raise`, then `stamp`,
then the call. An event the value-event catalog holds goes through the funnel instead, with the call table's
entry as its floor; a two-segment `interface.call` takes the funnel's own road, its bottom wrapped so the
floor's answer becomes the call's one argument. That is why the spelling a call is refused under matters: an
interface call is named by the name and method it passes (`srv.m`, which the gate sees), everything else by the
name it was called with. A call whose refusal is a dropped call rather than a thrown one leaves the sentence
beside the record the pane reads, so the pane can say a call was dropped while the plugin is told the same thing.

Two names decided by reading rather than by the name. The runner copy declares `Xt` as a budget reader and the
relay copy declares `Yo` as a text comparison; this module's are the two environment call names and the
plain-or-JSON name writer, so both statements are copied rather than imported — importing by name alone would
have silently substituted a different function for each. The one change outside the package is the runner copy's
export list gaining `swr`, the override-dispatcher getter the dispatcher asks before it runs a call; the record
re-measures that copy's digest so a later package cannot widen it again unnoticed.

Verified: check/build/notices, the scanned copy `unresolved 0`, span scan `total 0`, passed true, 70 plans, the ledger
re-read from its modules and matched against the copy with acorn (23 statements, whole and contiguous, no cut,
no repetition — two blocks hold two statements each because the bundle declares a list and its predicate
together), all twenty-one bodies quoted verbatim with twenty-one ranges cited, the twenty-three names the copy
owns and the twenty-three it exports counted and checked one by one, the fourteen imported names asserted absent
as declarations and present in the export lists that own them, both same-name traps asserted against the bodies
the other copies actually declare, and the runner copy's widened digest re-measured. Its suite
29/29 alone and 76/76 across the ten call-path
seam files, the chain family (test/plugin-chain-*.test.ts) 471/471, full 1747 tests / 1747 pass / 0 fail on the frozen tree, 15 compiled drivers (the shared driver now also prints
`W45CallDispatchCompiled.v1`, 44 markers in the shared run and 55 across every
driver), and the packaged smoke (pack 315 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity `5d38f513…` (read from scripts/identity.mjs by the record
script itself).

Next: the React layer `Tc(jo, …)` (partitioned first — 115 statements, 34,411 units), the remaining `$` table
entries, and the settings read path behind `y9e`.

## W45-71 ported the `ui.scroll` and `ui.focus` call path (2026-10-16)

Two `$` call entries and the two site descriptors behind them: nineteen blocks, 2,051 units, nineteen
statements over two chunks and two copies, no host boundary added.

An entry is the site table's descriptor paired with a core handler by the entry seam's `Mm`, so
`bse` (ui.scroll) carries `wa` and `PY`, and `vse` (ui.focus) carries `Ci` and `IY`. A call
reaches a site through a registry the UI side fills — `it().scrollSites` and `it().focusSites`, filed
under `component:requestId` with nothing escaped, so a component containing a colon cannot be told from
a longer key. `PY` refuses a call for a site that is not there, then one whose site another plugin owns,
then answers the site's own `commit(offset, origin)`: `{}` when the window moved and the site's
sentence when it did not. `IY` refuses the same first case, then a **forwarded** call — a plugin
carrying another plugin's call for a site it does not own, where the same plugin calling on its own
behalf passes — then a site that does not hold the keyboard, then another plugin's element holding it,
and last passes the site's own commit sentence through as the refusal.

The descriptors are what a call must carry before any of that. `wa` checks the offset is a whole row
number 0 or more and then that a rewrite did not change the call's envelope; the offset is checked and
never restored, which is measured rather than assumed (it is absent from the seven names the descriptor
restores, and a stray key is not refused). `Ci` checks the element against the previous envelope in
both directions — an element where the move named none is one of the engine's stops, none where it named
one is a rewrite naming another — and then the envelope itself, naming the first key a rewrite changed.
Both share `pr`: a refusal has to be a non-empty string, so a silent refusal cannot read as success,
and an answer that is not an object at all is refused with its own sentence.

The descriptors are their own module because the order they evaluate in is part of the behaviour:
`Mm` reads `zd[name]` while the entries' copy is evaluated, so the entries' seam imports the
descriptors' module above its bodies, and the product's registry imports it above the chain copies and
registers the two cores. The site table is 113 entries now, and the three suites that count it say where
the two came from.

This package also adds the recovered-source index: every chunk the product draws from, the statements it
carries out of it and the statements still missing, measured against the bundle's own layout rather than
the package layout. Fifty-four chunks are drawn from so far — 1,394 of their 28,540 statements and
243,108 of their 10,315,424 bytes, out of 2,609 modules in the bundle — and each chunk's covered
statements digest in the source's own order, so a chunk can be reassembled from the copies and compared
with the module it came out of. The record re-runs the index and recomputes the digest for the two
chunks this package touches.

Verified: check/build/notices, both scanned copies `unresolved 0`, span scan `total 0`, passed true, 72 plans, both
ledgers re-read from their modules and matched against the copies with acorn (12 and 7 statements, whole
and contiguous, no cut, no repetition), all nineteen bodies quoted verbatim with nineteen ranges cited,
the names both copies own and export counted and checked one by one, the twelve imported names asserted
absent as declarations and present in the export lists that own them, both closures re-measured with no
fresh statement left, the seam's import order asserted (the descriptors' module above the entries' copy),
the registry wiring asserted, and the index's totals and reassembly digests recomputed. Its suite
21/21 alone and 94/94 across the ten
call-path seam files, the chain family (test/plugin-chain-*.test.ts) 492/492, full 1768 tests / 1768 pass / 0 fail on the frozen tree (one parallel-load run had a timing-sensitive
integration fixture time out; it passes alone and the re-run was clean), 15 compiled
drivers (the shared driver now also prints `W45ScrollFocusCompiled.v1`, 45 markers
in the shared run and 56 across every driver), and the packaged smoke (pack 319 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0). Identity
`a8d69526…` (read from scripts/identity.mjs by the record script itself).

Next: the React layer `Tc(jo, …)` (partitioned first — 115 statements, 34,411 units), the remaining
`$` table entries, and the settings read path behind `y9e`.


## W45-72 ported partition 1 of the React layer (2026-10-17)

The React layer is partitioned before it is taken, and this package takes the first slice: the Raster
site component and the surface hook that binds a mounted raster to the node it paints through. Ten
source blocks, 1,479 units, two chunks; the host layer is a seam, because this build has no React.

The source's site components are React functions. The source bodies are obtainable, so they are
copied verbatim and the host layer is the seam, the way W45-38 took the bar. `jo` renders a Box with
one `ink-raw-ansi` child, sized to the frame, and calls `Ko` for the ref. `Ko` makes the paint
scheduler `Fo`, registers the mount through `hNs` with `Wo({plugin, requestId, key}, {columns, rows},
paint)`, repaints on a frame change through `nr`, and on unmount unregisters and cancels. `Fo` paints
the first frame at once and coalesces the rest within `eg` (16 ms); `nr` schedules only while the
surface is not complete — 16 ms progressing, `Bo` (250 ms) waiting. `_o` writes a painted frame into
the node's `rawText` and marks the node and its ancestors dirty through the two ink helpers.

The seam is two modules, split so there is no import cycle. `./plugin-chain-react-hooks.ts` carries
`qt` (the context token), `Tc` (element creation), `s`/`n` (Box/Text tokens), `y`/`Z`/`R`/`en`/`Ae`,
the component runner and commit, and the two node helpers. The source copy imports it; the surface
module re-exports both. `runComponent` renders once, commits the element tree (which is what binds a
`ref` to its node), then runs the queued effects; `unmount` runs their cleanups in reverse. The two
ink helpers are ported, not copied: they are declarators inside one large `var` statement in
chunk-06azbynj.js, so no statement range holds them alone. Their source text is quoted above each.

The rest of the layer is partitioned in the evidence: the Image component with its source/decode
bodies (`No`, `Ao`, `lFo`); the leaf components (Code, Markdown, text and links); the Input/Select/
Button and hover group; the Client host; and last the site-tree walker `je` with the terminal glue,
taken only when every component it names is carried.

Verified: check/build/notices, the scanned copy `unresolved 0`, span scan `total 0`, passed true,
eleven new tests (element tree, mount key and unmount, the detached fallback, the paint path, paint
coalescing, the scheduler and its cancel, the two `nr` delays, `Wo`, ref binding after commit), the
chain family 503/503, full 1779 tests / 1779 pass / 0 fail on the frozen tree, and the recovered-source
index at 56 chunks / 1,404 statements / 244,587 units (2.4%). Identity `571df984…`.

Next: partition 2, the Image site component and the image source/decode bodies (`No`, `Ao`, `lFo`).

## W45-73 ported the image wire layer, partition 2a of the Image slice (2026-10-17)

The Image site component has two terminal-facing outputs: the transmit that asks the terminal to draw
a source, and the alt text drawn when it cannot. Both are built by the wire layer of chunk-fzk4rpqy.js,
and this package takes it whole: 12 blocks, 3,783 units. The source text is copied verbatim into
`src/plugin-chain-image-wire-source.ts`; `src/plugin-chain-image-wire.ts` re-exports it under the
wire layer's own name.

One name of the layer lives in another chunk. `hxn` is chunk-kexg5hxg.js `var hxn=PH+"\\"`, the string
terminator `d` appends; chunk-kexg5hxg.js is not one of this package's modules, so `hxn` is ported with
the source expression quoted in the copy header. The other 21 exports are whole copied blocks. The CSI
builder `fl` and the two constants `CZ`/`PH` come from the raster surface copy that already carries
them; the layer adds no behaviour of its own.

What the bodies do, as measured through them (probe log `.audit/w45-73-probe.txt`): `cFo` checks the id
against 4294967295 and both cell counts against the 297-entry placeholder table, requires a pixel size
for every non-png format `before` it looks at the medium, then branches — a file or shm name (`k`:
non-empty, no NUL, at most 3072 UTF-8 bytes) is sent as a `q=1` control message whose payload is the
name in base64 (`v`), while an inline payload (`D`: standard base64) is sent as `q=2`, split at 4096
characters with `m=1` on every chunk but the last (`m=0`). `lFo` renders the alt text: `O` writes the
colour (`38;5;n` below 256, from 256 the number read as a 24-bit colour), `S` takes the first n code
points of the table `y`, and each cell is the prefix `N` (U+10F286) plus the row and column
placeholders, each row terminated by `hun` (SGR 39) and rows joined by a newline. `d` frames one
message: the introducer `G` (ESC _ G), the body, an optional `;payload`, and the terminator ESC
backslash.

The remainder of the Image slice is partition 2b: the source/decode bodies (`Z4t`, `Uto`, `Dss`) and
the Image component itself (`Ao`, `No`), which also needs the client, settings and theme seams it
reads. The leaves, the interactive elements, the Client host, and last the site-tree walker `je` with
the terminal glue follow.

Verified: check/build/notices, the scanned copy `declared 56, unresolved 0`, 28 new tests over the
three checks, both colour forms, the alt layout, framing, the file/shm and inline transmits and the
chunk split, the chain family 531/531, full 1807 tests / 1807 pass / 0 fail, and the recovered-source
index at 57 chunks / 1,416 statements / 248,370 units (2.4%). Identity `9c6d2d17…`.

Next: partition 2b, the image source/decode bodies `Z4t`/`Uto`/`Dss` and the Image component
`Ao`/`No` with the client, settings and theme seams they read.

## W45-74 ported the Image source model, partition 2b-i of the Image slice (2026-10-17)

The Image component holds a plugin-supplied source in one of four shapes — inline png, inline rgba,
a file path, or a shared-memory name — and hands it to the transmit. This package takes the bodies
that test those shapes and convert them: `ac`/`Z4t`/`B_` (the png and file/shm tests and the decoded
byte size) and `Uto`/`Dss` (the shm test and the encoder). Two statements, 554 units, copied verbatim
into `src/plugin-chain-image-model-source.ts`; `src/plugin-chain-image-model.ts` re-exports them.

Most of the source layer was already carried. The validators that admit the four shapes (`Mss` and
its `G_`/`z_`/`Y_`/`q_`/`F_` helpers) and the base64 decoder `ds` live in the ui.blit copy from
W45-58, so only the statements the Image component calls directly are copied, and `B_` imports `ds`
from that copy instead of carrying a second decoder.

What the bodies answer, as measured (probe log `.audit/w45-74-probe.txt`): `ac` is true only for the
inline png shape, `Z4t` for the two reference shapes and `Uto` only for shm; `B_` answers the base64
payload's decoded byte count (four characters are three bytes) and 0 for a reference; `Dss` passes
an inline png through, passes an inline rgba source through with its pixel size, and for a reference
answers the medium, the name and — unless the format is png — the pixel size. A malformed source with
both `file` and `shm` encodes as shm, because the shm test is asked first. The result is exactly the
transmit shape: fed to W45-73's `cFo`, a reference yields the q=1 control message and an inline
source the q=2 message.

The remainder of the Image slice is 2b-ii: the component `No` and its resolver `Ao` (`Oo`, `Mo`,
`vo`, `Eo`, `Ho`, `dt`, `Lo`, `tr`, `rr`, `or`, `xt`, `Ke`), with seams for the plugin client
(`bC`), the internal querier (`QO`), terminal capability level (`Z8n`, `aWo`, `ge`), the file probe
(`lPe`) and the mount writers (`vLs`/`ELs`).

Verified: check/build/notices, the scanned copy `declared 15, unresolved 0`, 13 new tests over the
predicates, the size reader, the four encode forms, the shm preference and the transmit integration,
the chain family 544/544, full 1820 tests / 1820 pass / 0 fail, and the recovered-source index at
57 chunks / 1,421 statements / 248,924 units (2.4%). Identity `88e22d52…`.

Next: partition 2b-ii, the Image component `No` and resolver `Ao` with the client, querier,
terminal-capability, file-probe and mount-writer seams they read.

## W45-75 ported the terminal capability and image-file probe stores (2026-10-17)

The Image component asks the terminal two questions — whether it draws kitty graphics, and whether it
reads files on this machine — and must not ask either twice. Both answers are kept in two state
machines of chunk-mvsmkx6d.js, and this package takes them whole: one block, 1,835 units, copied
verbatim into `src/plugin-chain-terminal-capabilities-source.ts`. The only external body is the signal
emitter `Oe()`, which the registry-stores copy already carries; the seam aliases the four copied names
to `ImageFileProbe`, `CapabilityReadings`, `DEFAULT_CAPABILITIES` and `CAPABILITY_NAMES`.

The file probe (`i`) starts `unasked`; `begin` moves it to `asking` once; `unask` returns an asking
probe to unasked; `answer` settles it once and emits the value; `onSettle` calls back at once when
settled and otherwise subscribes. The capability store (`o`) is built from per-capability readings —
`settled` at a value, or `pending` at a guess — and answers `now` with the settled value or the
default (never the guess), settles a pending capability once, records a yes, lists what is still
pending, and on `deadline` settles every pending capability at its guess with `, no answer` appended
to its source. The defaults (`s`) assume kitty keyboard on and everything else off.

What was measured (probe log `.audit/w45-75-probe.txt`): the probe's one-shot transitions and the
listener order; `now` returning the default for a pending capability (`synchronizedOutput` false
although its guess was true); `answer` refusing to change a settled capability; `confirmed` recording
only true answers; and `deadline` appending `, no answer` while leaving the value at the guess.

The environment guesses (`d()`) and the host wrappers that build these stores are not part of the
package; the stores are tested from explicit readings. Next is 2b-ii: the Image component `No` and
resolver `Ao` over these stores, with seams for the plugin client (`bC`), the internal querier
(`QO`), the capability wrappers (`LT`/`Z8n`/`aWo`/`$1t`), the file path helper (`lPe`), the probe
query (`uFo`), the source key (`er`) and the mount writers (`vLs`/`ELs`).

Verified: check/build/notices, the scanned copy `declared 10, unresolved 0`, 9 new tests over both
state machines, the chain family 553/553, full 1829 tests / 1829 pass / 0 fail, and the
recovered-source index at 58 chunks / 1,424 statements / 250,759 units (2.4%). Identity `4b7f1d22…`.

Next: partition 2b-ii, the Image component `No` and resolver `Ao` over these stores.

## W45-76 ported the Image component, partition 2b-ii, closing the Image slice (2026-10-17)

The Image site component asks the terminal to draw a plugin image. Nine blocks are copied verbatim
(4,944 units): the probe query `uFo` and the error-code reader `E`; the alt decision `Eo`; the probe
constants, `Lo`/`tr`/`rr`/`dt`, the transmit builder `or`, the refusal log `Po`/`Ho` and the tracker
`xt`; the id-width table `Ke`; the mount registration `Mo`; the file-answer subscription `Oo`; the
resolver `Ao`; and the component `No`. The seam (`src/plugin-chain-image-component.ts`) re-exports
them; the host boundary is `src/plugin-chain-image-host.ts`.

The resolver allocates an id on mount, transmits on the first render and on a source or size change,
skips a resend of the same file/shm reference, and registers a callback through the image mount
writer (`ELs`/`vLs`, carried since W45-59) whose answer is the alt element or undefined. The
component renders that answer as a Box holding one `ink-raw-ansi` element, or the alt text when the
resolver answers undefined. The file-read probe writes a 4-byte probe image to a temp path, asks
through `uFo`, and settles the W45-75 store; six transient filesystem errors leave it inconclusive.

The host seam serves what the source reaches through the bundle: `LT`/`Z8n`/`aWo`/`$1t` over the
copied capability and probe stores, the client and querier contexts (null by default, which the
source already treats as absent), the colour level `ge` and the temp path builder `lPe`. The client
and querier contracts are read from the source's calls, and the fixture that implements them lives
with the tests.

The component forced two additions to the W45-72 hook seam. `y` now accepts the source's three
initializer forms (`y(fn)`, `y(value)`, `y()`), and `runComponent` re-renders after a state setter,
the way React does: the resolver's id only exists after its mount effect, so the component's first
render sees none. Effects also run the previous cleanup when their dependencies change, so the
re-render does not leave a second mount registration behind. The eleven W45-72 tests still pass.

What was measured (probe log `.audit/w45-76-probe.txt`): the five alt reasons in order; the refusal
log's 5 s per-key window; the id width at colour levels 0/1/2/3 and without kitty graphics; the three
probe outcomes (answered OK, flushed no reply, dropped); the probe request `uFo(9, temp)` with the id
allocated at width 24 and the temp file removed; the inline component's single `resend: true`
transmit and `lFo(id, columns, rows)` alt; the id freed on unmount; and the cannot-read-files answer
the file source registers.

Verified: check/build/notices, the scanned copy `declared 81, unresolved 0`, 15 new tests over the
alt decision, the refusal log, the transmit builder, the id width, the mount registration, the three
probe outcomes and the component renders, the chain family 568/568, full 1844 tests / 1844 pass /
0 fail, and the recovered-source index at 58 chunks / 1,441 statements / 255,604 units (2.5%).
Identity `7b53418e…`.

The Image slice is closed: W45-73 the wire layer, W45-74 the source model, W45-75 the capability and
probe stores, W45-76 the component and resolver. Next is partition 3, the leaf components (`lt`
Code, `Xt` Markdown, the text/link group), then the interactive elements, the Client host, and last
the site-tree walker `je` with the terminal glue.

## W45-77 ported the Code leaf, the code block renderer and the diff renderer (2026-10-17)

Partition 3 of the React layer starts with the Code site component. Thirty-eight blocks are copied
verbatim (24,196 units) into four modules: the leaf (`lt`, `Oe`, `Te`, `et`, `tt`, `adn`, `rt`,
`st`, 1,433 units) from chunk-kjfwbh4w.js; the code block renderer (`Wt`/`Ob`, `B`, `nt`, `he`,
`j`, `H`, `K`, `gt`, 4,606 units) from chunk-yfhs3yf4.js; the unified-diff renderer (`tq`, `H4`,
`_`, `fe`, `le`, `ue`, `he`, `U`, `me`, `oe`, `X`, `I`, `ee`, `ie`, `uwe`, `uu`, `DIe`, `DXe`,
`dje`, `ydn`, 7,732 units) from chunk-nnwag7zt.js, chunk-04m6g9sr.js, chunk-1r9zp6s1.js and
chunk-3qabb19b.js; and the `diff` package body `Zoo` (10,425 units) from chunk-34bv7wfw.js. The host
seam is `src/plugin-chain-code-host.ts`; the generated modules are
`plugin-chain-code-source.ts`, `plugin-chain-code-block-source.ts`, `plugin-chain-code-diff-source.ts`
and `plugin-chain-diff-source.ts`.

`lt` reads its width from a ref measured through `Ys` (zero until laid out) or the `adn` context,
defaults to 80, and renders `tq` for a diff or `Ob` for source text; `wrap: "truncate-end"` runs
`et`/`tt` first. `Ob` draws a dim `"… from line N"` gutter when the start line is beyond the first,
asks the render settings for syntax highlighting, and delegates each source to `B`, which colours
through `nt` or draws the plain text. `nt` rounds the source through the render cache and falls back
to markdown, reporting the fallback. `H4` draws the plain hunk through `_` whenever the structured
highlighter answers null; with a structured answer it draws the gutter and content columns. `tq`
interleaves the hunks with a left-edge `"..."` row through `uwe`.

The host seam serves what the bodies reach: `kc` over a no-op layout subscription, `Ys`, `Tj`,
`nt`, `hr`, `Qdn` and `Kl` read against the product contexts through `_currentValue` (this runner
does not install the TUI dispatcher), `Mi` answering false because this host draws inline, and
`rDr`/`CNo` answering null because the structured highlighters are gated in the source by
`CLAUDE_CODE_SYNTAX_HIGHLIGHT`, which this host does not expose — exactly the source's own answer
when the flag is unset, so the copied renderers take their non-structured path.

The renderers forced one addition to the W45-72 hook seam. The compiled site chunks create elements
through `react/jsx-runtime`: children travel in `props.children` and the third argument is the key.
The Image component's createElement bodies pass children as trailing arguments. One factory cannot
serve both, so the seam now carries `Tc` (createElement) and `Xe` (jsx/jsxs); the three renderer
plans import `Xe as e` and `Xe as r`, and `SurfaceElement` carries the jsx key.

Also carried in this commit: the W45-76 typing seam in `src/plugin-chain-terminal-capabilities.ts` —
the store interfaces and the `ImageFileProbe`/`CapabilityReadings` constructor casts the Image test
imports. The W45-76 commit left it unstaged; it changes no behaviour.

What was measured (probe log `.audit/w45-77-probe.txt`, measurements in
`.audit/w45-77-measure.ts`): `Oe("abcdefghij", 5)` answers `"abcd…"`; `tt` at width 5 with start
line 9 answers `"…\n…"`; `lt` source answers `Ob` with width 80 and no line numbers, a mounted
`adn` of 33 changes the width, and `language: "ts"` labels it `source.ts`; `lt` diff answers `tq`
with the parsed hunks, and `truncate-end` at width 4 answers `["-…", "+…", " …"]`; `Ob` on start
line 5 draws `"… from line " 5` first; `B` under `/a.js` draws `nt` with `language: "js"`, and a
2,005-character line is cut to 2,000 and ends with `" … [+5 chars]"` (2,013 characters); `nt` on an
unsupported language reports the markdown fallback and draws the plain text; `tq` over two hunks
answers `hunk-0`, the `uu` ellipsis keyed `ellipsis-1`, and `hunk-1`; `DXe` cuts 2,100 characters
to 2,000 with `truncatedChars: 100`; `dje(37)` answers `" … [+37 chars]"`; `Zoo("abc", "abd")`
answers the removed and the added run; `uu` answers `noSelect: true` or, at the left edge,
`{ alignSelf: "stretch", noSelect: "from-left-edge" }`; `DIe` draws one raw ANSI element whose height
is the line count and whose width is the given width, and answers null for no lines.

Verified: tsc 0, the four copies scan `unresolved 0` (47/88/76/55 declared), notices 0, the 24 new
tests plus 2 element-factory tests, the chain family 594/594, full 1,870/1,870, and the
recovered-source index at 62 chunks / 1,507 statements / 278,059 units (2.7%). Identity
`0baf2436…`.

`Xt` Markdown is the last leaf, and it needs the ui.press/held-press pipeline: the held-press store
(`AK`), the press handle walkers (`Yl`, `SFs`), the press site descriptor (`Tf`) and the dispatch
(`BPn`/`Xl`). That pipeline is partition 4's core and becomes the next package. Then the interactive
elements, the Client host, and last the site-tree walker `je` with the terminal glue.

## W45-78 ported the held-press store and the terminal input/select dispatch (2026-10-17)

Partition 4 of the React layer starts with the core the last leaf needs: a drawing holds one handle
per pressable element, and an input or select event runs the plugin that drew it. Fifty-two blocks
are copied verbatim (8,476 units) into two modules: the press cluster (42 blocks, 6,846 units) from
chunk-n3ykh62m.js and chunk-p16hdq43.js, and the three press-site descriptors (10 blocks, 1,630
units) from chunk-nyce03br.js. The generated modules are `plugin-chain-press-source.ts` and
`plugin-chain-press-sites-source.ts`; the seams are `plugin-chain-press.ts` and
`plugin-chain-press-sites.ts`, the latter rebuilding the site table `zd` with exactly the three
events the terminal dispatch reads.

`XPt` walks a drawing and returns one entry per pressable element (Button, Input, Select, Markdown),
reading a Select's drawn option values; `Rto` files those entries in the held-press store `AK`
under a key of plugin, component, requestId and surface, rewrites every `press.handle` through
`SFs`/`le`, and reuses the handle a previous drawing of the same plugin drew through `bf`. The
store keys presses by the hosted handle but keeps the handle the drawing held on the entry — the
value the module's press receives. Hosting a replacement drawing deletes the entries it no longer
holds and reports them as released; `FM`/`BM` release the module runners and hosted-button
bookkeeping for the handles that survive that cleanup.

The dispatch `Xl` finds the held entry by hosted handle, or by the full key when the handle misses,
refuses a tag that does not match the event, and runs `aP` over `Yl` — the module's own press, plus
any per-handle runner `Hrt` registered — with the site's `check` over the answer. `x_` builds the
input argument from the held entry, its surface, the kind and the value; `T_` builds the select
argument and admits only a value the drawing offered. `UPn`/`jPn` queue the dispatch per plugin
through `kf`/`Cf`, and `ql` runs it only when the plugin holds the element.

The copied handler forced one seam addition. `Yl` reads the loaded module record and calls
`h.press(handle, argument)`, which is the record `tGe` builds with `press` and `releasePresses`;
this product's in-process record factory did not carry either, so a held press would have thrown.
The record now routes `press` to the module's own press and answers `releasePresses` as a no-op (an
in-process module holds no environment handles), and `ChainModule.press` names the handle a drawing
held instead of a string.

What was measured (probe log `.audit/w45-78-probe.txt`): `XPt` on the fixture drawing answers five
entries in drawing order, the Select carrying `options: ["a", "b"]`, and a Text or an element
without a string `props.key` contributes nothing; `Rto` replaces the source handles 1,2,3,4,7 with
five distinct hosted handles below `S_` = 1073741824, and `_f` is
`plugin\u0000component\u0000requestId\u0000surface`; a second drawing of the same plugin reuses
its hosted handle and the reused entry carries the newer requestId; `x_` answers
`{element:"i1", value:"hello"}` and the fixture press receives handle 2 (the drawn handle) with the
argument `{plugin, element, component, requestId, surface, kind, value}`; `T_` admits `"a"`, refuses
`"z"` without running anything, and the select argument has no kind; a handle miss with the full key
still dispatches, an unheld element answers undefined, and a matching-tag press for an unloaded
plugin rejects with `ui.input: ghost, which drew g1, is not loaded`; `Rto(newDrawing)` reports the
dropped handles `[1, 3, 4]`, `FM(old, new)` the same, and `BM(new)` reports `[2]`; `m_` numbers
handles from -1 and releases them; the three sites answer `ui.press`, `ui.input`, `ui.select`, and
`ot`/`mn`/`Cn` answer the source's own refusal messages.

The ui.press dispatch `BPn`/`TIe` is deferred to W45-79. Its link guard calls `Rf`/`nur`, which
reaches the URL normalizer `mxn`; that module's graph is 706 units and imports node:path/node:url,
the Windows UNC and encoded-path handling, and two more chunks, so it is its own package. W45-80
then copies `Xt` Markdown, the last leaf.

Verified: tsc 0, both copies scan `unresolved 0` (75/16 declared), notices 0, 20 new tests, the
chain family 614/614, full 1,890/1,890, and the recovered-source index at 62 chunks / 1,557
statements / 286,430 units (2.7%). Identity `eb114e4a…`.

## W45-79 ported the ui.press dispatch and the link normalizer (2026-10-17)

Partition 4's press pipeline closes with the dispatch. Forty blocks are copied verbatim (4,897
units) into two modules: the dispatch (7 blocks, 1,269 units — `Rf`, `nur`, `E_`, `Tf`, `BPn` from
chunk-n3ykh62m.js, `TIe` from chunk-kjfwbh4w.js, `Ohe` from chunk-sfn1dbxq.js) and the link
normalizer (33 blocks, 3,628 units — `mxn`/`An`/`IF` from chunk-j8hqhz0c.js, the UNC and posix
path-safety bodies from chunk-ae84tp6z.js, the traversal and percent-decoding checks from
chunk-d1ctn2b7.js, `uG` from chunk-ax7r0qj7.js). The generated modules are
`plugin-chain-press-dispatch-source.ts` and `plugin-chain-press-url-source.ts`; the only host
boundary is `plugin-chain-press-url-host.ts`, which binds node's path/url modules and answers
`se()` with the process cwd — the source's own fallback when no session cwd is installed.

`BPn` finds the held press by plugin, handle and optional element, names a Button when the
dispatch carries no link and a Markdown press otherwise, and refuses a Markdown press whose href
does not normalize to one of the drawing's `pressableLinks`. The argument `E_` carries plugin,
element, component, requestId, surface and the link, and runs through `aP` with the module press
`Yl` under the ui.press site `Tf`. `TIe` starts that dispatch without waiting and hands the promise
to `Ohe`, which logs a rejection and answers undefined.

The normalizer forced two distinctions worth recording. `BPn` has no full-key fallback: a handle
the store does not hold logs the miss and runs nothing, where `Xl` falls back to
`heldByKeyOf`. And `mxn` resolves a local path against the cwd before the traversal checks, so a
dot-dot path collapses to its target instead of being refused — `/tmp/../etc/passwd` becomes
`file:///etc/passwd`, while the encoded and UNC shapes `Cot`/`Yoo` flag are the ones the posix
parser reports.

What was measured (probe log `.audit/w45-79-probe.txt`): `Rf` keeps a web href, prefixes a bare
host with `http://`, leaves a relative or UNC href raw, and turns `/tmp/a b` into
`file:///tmp/a%20b`; `mxn` keeps `?q=1#f`, strips a localhost file host, answers `file:///` for
`/` and the input for an empty string; both dot-dot forms collapse before the URL is built;
`Cot`/`Yoo` answer false for the plain relative dot-dot; `nur` accepts a trailing-slash and a
space/escape difference, refuses two different hosts; `BPn` runs a Button with the drawn handle and
the argument, answers `{element:"b1"}`, logs the exact missing-key and bad-link sentences, refuses
a Markdown press dispatched as a Button, and rejects for an unloaded plugin; `TIe` answers
undefined immediately, lands the press after it, and logs the unloaded rejection at error level
through `Ohe`; `Ohe` passes a resolved value through and turns a rejection into a log line.

Verified: tsc 0, both copies scan `unresolved 0` (52/29 declared), notices 0, 16 new tests, the
chain family 630/630, full 1,906/1,906, and the recovered-source index at 64 chunks / 1,596
statements / 291,177 units (2.8%). Identity `485a5dd1…`.

W45-80 copies `Xt` Markdown, the last leaf; it reads the drawn text, dims by context and turns a
Markdown link into a `TIe` press. After it the partition leaves are done, and the Client host and
last the site-tree walker `je` with the terminal glue remain.

## W45-80 ported the Markdown leaf (2026-10-17)

The last of the nine leaf types. Five blocks are copied verbatim (1,747 units) into one module,
`plugin-chain-markdown-source.ts`: the component `Xt` and the scheme set `mdn` from
chunk-kjfwbh4w.js [24313,25250), the two click timings `vje`/`tun` from chunk-06azbynj.js
[135682,135731), and the clock hook `on` plus the selection accessor `wC` from
chunk-1r9zp6s1.js [17969,18071) and [26659,27318). The renderer `Ya` is not copied again: this
product already carries the identical recovered body in `tui-markdown-components.ts` (provenance
research/ports/W44-visual-copies.json), so the leaf imports that copy.

The component reads three host bindings through `plugin-chain-markdown-host.ts`: the clock context
`eE` (`var eE=qt(null)` in chunk-k1caxvem.js), the selection context `Gfe` (chunk-z7whhrje.js,
read only for hook order), and `oi()`, the per-host map of terminal selection instances
(chunk-kexg5hxg.js). The map starts empty, so `wC` takes its own no-instance branch and answers the
fixed no-selection object; a caller may bind a reader under `process.stdout` for the instance branch.

What the leaf does: it draws the text through `Ya` with `{https, http, file}` kept as schemes, and
when the drawing holds a press it wraps the answer in a Box with the plugin, the key and a click
handler. That handler stops the terminal's activation only when the click carries a hyperlink that
is not ctrl/alt-modified and that `nur` matches against the drawing's `pressableLinks`; anything
else is left to the terminal. It then subscribes to the selection, schedules a 500 ms timer, and
presses through `TIe` with `{href}` when the timer lands — unless a selection appeared, which
unsubscribes, cancels the timer and presses nothing. A click within 300 ms of the drawing, or a
window activation, is dropped as a stray.

What was measured (probe log `.audit/w45-80-probe.txt`): `mdn` holds the three schemes and the
timings are 300 and 500; `on` throws the source sentence without a provider and answers the mounted
clock with one; `wC` answers the fixed object with no instance and delegates every reader with one
bound, and the map empties on unbind; the plain render answers the `Ya` element with
`stripPromptTags:false` and the scheme set, the keyed render adds a column Box, and the press render
adds `elementPlugin` and `onClick`; clicks with no link, ctrl, alt or an undeclared link call
`allowDefault` and schedule nothing; a window activation and a click inside the window call
`dropAsStray`; a declared link 500 ms after the drawing stops propagation, subscribes once, queues
one 500 ms timer, and the timer runs the module press with the drawn handle and the argument carrying
`link:{href}`; a selection during the wait unsubscribes and cancels (press 0), and a second click
cancels the first timer the same way.

Verified: tsc 0, the copy scans `unresolved 0` (37 declared), notices 0, 14 new tests, the chain
family 644/644, full 1,920/1,920, and the recovered-source index at 65 chunks / 1,601 statements /
292,924 units (2.7%). Identity `da9ff72e…`.

All nine leaf types are ported. The Client host and the site-tree walker `je` with the terminal glue
remain in partition 4; after that the C packages.

## W45-81 ported the Select site component and the site-focus reader (2026-10-17)

The interactive elements start with the Select. Nine blocks are copied verbatim (1,360 units) from
chunk-kjfwbh4w.js into `plugin-chain-select-field-source.ts`: the four contexts `ldn`/`pdn`/`fdn`/
`gdn`, the click adapter `udn`, the focus reader `xe`, the visible-option count `ht`, the window
`S3n` and the component `sr`.

`sr` is pure over its contexts. It draws the label, the picked option — from `gdn.pickedOf(plugin,
element)`, falling back to the drawn `value`, and "none" when neither names one — and the ▾/▴ marker,
then the visible window `S3n` from `gdn.open` when that names this plugin and handle: eight rows
(`ht`) with the first index keeping the highlight in view, each row `  <label>` (or its value), the
highlighted one inverse, and a `  … N more` row when options are cut. `xe` answers the focus flag
only when `fdn` names this plugin and handle, binds the `pdn` ref only then, and always wraps the
`ldn` handler through `udn`: a hyperlink goes to the terminal, and the handler runs unless the event
is a window activation or a dropped stray.

What was measured (probe log `.audit/w45-81-probe.txt`): `S3n` answers the five window shapes —
empty, shorter than the window, ten at 0/5 (eight visible, two hidden, nine rows), ten at 9 (first 2,
eight visible, no hidden row); `udn` runs a plain click, allows a hyperlink default and still runs,
skips a window activation and a stray, and allows the default even on a window activation; `xe`
without providers answers false/undefined/undefined, with a matching `fdn` answers focus, the ref and
a click that hands `{plugin,handle}` to `ldn`, and a different handle loses the focus and ref but
keeps the click; `sr` closed draws one header row (`Pick: `, `none`, ` ▾`), a picked label draws
the label and a bare option its value, an open Select draws ` ▴` plus the option rows, ten options at
highlight 0 draw `L0`…`L7` and `… 2 more`, at highlight 9 draw `L2`…`L9`, and an `open` naming
another press leaves it closed.

Verified: tsc 0, the copy scans `unresolved 0` (34 declared), notices 0, 12 new tests, the chain
family 656/656, full 1,932/1,932, and the recovered-source index at 65 chunks / 1,610 statements /
294,284 units (2.7%). Identity `e367fd4d…`.

Next: the Button with its hover group and action keys, then the Input field, the Client host, and last
the site-tree walker `je` with the terminal glue.

## W45-82 ported the Input field site (2026-10-17)

The second interactive element is the Input field. Six blocks are copied verbatim (992 units) into
`plugin-chain-input-field-source.ts`: the minimum field width `Gt` (12), the input-fields context
`cdn`, the site-columns context `ddn`, the terminal-size hook `ke` with its context `Zm` (from
chunk-tz1x0g31.js and chunk-z7whhrje.js) and the component `Vt`.

`Vt` is a view over host state. It reads the site focus through `xe` (the same reader the Select
uses), the field value from `cdn.textOf(plugin, element)` falling back to the drawn `value` and
then "", and the terminal columns from `ke` unless a mounted `ddn` number replaces them. The cursor
offset lives in `y(g.length)`; while the field holds focus the effect raises it to
`Number.MAX_SAFE_INTEGER` so the editor keeps the caret at the end. Focused — which requires both
`cdn` and the exact press in `fdn` — it draws the bold label, the host text editor `wr` with the
value, an `onChange` that calls `cdn.edit({plugin,handle,element}, value)`, the placeholder, the
width `max(Gt, columns - width(label) - width(hint))`, the clamped caret and the editor flags, and
the dim ` ⏎ <submitLabel|submit>` hint. Unfocused it draws the value dim, the placeholder when empty,
and no editor or hint.

The host seam is `plugin-chain-input-field-host.ts`: `wr` is the shell's text-editor token. Its
source body (chunk-s7977spq.js [7424,11062), 3,638 units) closes over the key decoder, the
offset/history machines, the paste pipeline, the highlight and theme mapping and its renderer, a
subsystem outside the site layer; the site draws it with one fixed prop set, the same way `Box` and
`Text` are tokens.

What was measured (probe log `.audit/w45-82-probe.txt`): `Gt` is 12; `ke` throws
"useTerminalSize must be used within an Ink App component" without a provider and answers the mounted
size; an unfocused field draws the label, the dim value (placeholder when empty, "" without one) and
no editor or hint; focus without `cdn` stays unfocused; a focused field draws the bold label,
`TextEditor{value:"fromhost",columns:25,cursorOffset:8,focus:true,showCursor:true,multiline:false,
disableEscapeDoublePress:true}` at `ddn` 40 and the ` ⏎ submit` hint, and `onChange("next")` calls
`edit({plugin:"p",handle:1,element:"i1"},"next")`; host text wins over the drawn value; the width is
`max(12, columns - width(label) - width(hint))` — 12 at `ddn` 10 with label "L", 25 at 40 with
label "Name", 68 from the 80-column terminal — and the ` ⏎ go` label replaces the default hint.

Verified: tsc 0, the copy scans `unresolved 0` (33 declared), notices 0, 11 new tests, the chain
family 667/667, full 1,943/1,943, and the recovered-source index at 67 chunks / 1,616 statements /
295,276 units (2.7%). Identity `5d48dc6d…`.

Next: the Button with its hover group and action keys, the Client host, and last the site-tree
walker `je` with the terminal glue.

## W45-83 ported the hover group (2026-10-17)

The Button depends on the hover group, so it lands first. Fifteen blocks are copied verbatim (2,240
units) into `plugin-chain-hover-source.ts`: the store accessor `Fe`, the count adjuster `mt`, the
member handle `_t`, the group key `Bt` and its `Dbr` string, the override split `ft`, the
subscription hook `ut`, the color props `Kt`, the normalizer `De`, the scope context `_e`, the
resolver `jt`, the components `$t`/`Ut`, and the selector hook `Re` with its two helpers.

The group is a count store. `it().hoverGroups` is the registry's own Map store; every member
increments and decrements its `plugin\0scope\0scope` key, and a site is hot while any member is
counted in. `_t` holds at most one group at a time (`enter` while already in a group is ignored;
`regroup` moves it). `jt` gives a grouped site the group's own hot state and an ungrouped one the
enclosing `_e` scope; `De` maps the three color props through the named-color table already ported
in `plugin-chain-decorations-source.ts`. `$t` keeps its own hover state for a live scope, provides
it to the subtree and merges the hover overrides into the layout; `Ut` draws a Text or Box with the
resolved overrides.

The seam extends `qt` to the source's own shape — a context is its own `Provider` (`e.Provider=e`),
so `$t`'s provider element is constructed exactly as the source does; the runner still resolves
values from the render's `contexts` map. The store scheduler `PU` is a host context: with no
provider `Re` subscribes directly, the source's default.

What was measured (probe log `.audit/w45-83-probe.txt`): `Dbr` is `p\0scope\0s`; `Bt` answers
`{plugin,scope}` only when both exist; `ft` strips `scope`; `De` maps red/blue and leaves unknown
names and hex; `mt` adjusts and drops at zero; a member counts one group at a time and `regroup`
moves it; `ut` cold/hot, enter twice (2), unmount (1), no group false; `jt` cold/scope/group paths;
a hot HoverScope's Box merges layout and the mapped hover block with both handlers and
`hoverFollowsPaint`; HoverStyled draws Box or Text; `Re` selects and calls the mounted scheduler.

Verified: tsc 0, the copy scans `unresolved 0` (43 declared), notices 0, 10 new tests, the chain
family 677/677, full 1,953/1,953, and the recovered-source index at 68 chunks / 1,631 statements /
297,516 units (2.7%). Identity `92f69502…`.

Next: the Button with its action keys, the Client host, and last the site-tree walker `je` with the
terminal glue.

## W45-84 ported the Button and its action keys (2026-10-17)

Twenty-three blocks are copied verbatim (3,496 units) into `plugin-chain-press-button-source.ts`:
the action-key comparator `co`, the store `xo` and the shared `Yt`, the binding contexts `Ds` and
the component rank `_s`, the render-instance context `ee`, the seat `Qt` and its component form
`Jt`, the hotkey seat context `y3n`, the blur `_3n`, the Button `Zt`, the alignment map `yo`, the
click subscriber `wFt`, the key table `go` and normalization `ko`, the identity `Ge`, the
keybinding service `Lc`, the dialog store `aq`/`Ff`/`iv`/`kj`, and the default app context
`Pg`/`Zy`.

The Button owns no press state. Every actionable press is an entry in the shared action-key store;
the seat registers one handler per binding context of its action and the handler dispatches the
winning held entry (highest rank, then latest sequence). Registration is skipped without a
keybinding service and while a dialog is open. The label is the action box render prop: focus and
hover come from the box, and the bracketed/plain, hotkey, held and variant blocks differ only in the
props they add.

The seam supplies the three host bindings. `u` is the keybinding-service context; with none mounted
`Lc` answers null and the seat registers nothing, the source's own no-service path. `ix` answers a
node's focus manager; this build has no node registry, so a host binds one per committed node
(`bindFocusManager`) and the unbound path throws. `KH` is the focusable action-box token, exposed
the way `s`/`n` are.

The scanner gained `ReferenceError` as a language global because the copied `Ff` provider error
reads it.

What was measured (probe log `.audit/w45-84-probe.txt`): rank then sequence ordering and the
later-entry winner; `Ds` dedupe/order; `_s` 2/1/0/0; `ko` space, named, ctrl/meta and ignored
wheel; `Lc` null and mounted; `Ff` source error; `iv` last non-user dialog; `kj` open gate; two
registrations with `singleKey`/`fallback`, rank-2 descriptor, unmount removal and no-winner false;
no registration while a dialog is open or without a service; the button root Box, `KH` tabIndex -1
and focus ref, the seat first with an action; every label variant; click blur only for a descendant
and the immediate stop; `ix` unbound throw; hotkey mount/unbind; the click subscriber's three paths
and the `Pg` fallback.

Verified: tsc 0, the copy scans `unresolved 0` (67 declared), notices 0, 13 new tests, the chain
family 690/690, full 1,966/1,966, and the recovered-source index at 70 chunks / 1,652 statements /
300,970 units (2.8%). Identity `b6c1c882…`.

Next: the Client host (`Io`/`So`/`To`/`wo`/`Ro`/`Co`), and last the site-tree walker `je`
with the terminal glue.

## W45-85 ported the Client host (2026-10-17)

Nine blocks are copied verbatim (3,896 units) into `plugin-chain-client-host-source.ts`: the error
boundary `Vo`/`XD`, the hosted client's input binding `wo`, the terminal mount `To`, the clock
adapter `Ro`, the loading snapshot `bo`, the inert client `Co`, the acquisition hook `So`, the
Client host `Io`, and the keybinding pre-dispatch hook `Ey` from chunk-am9mebpw.js.

The host is an acquisition boundary, not a renderer. `So` asks the registry for one client per
element — keyed by plugin, component, request id (`requestId\0client\0key`), surface, element key,
module and props, with `Ro` adapting the clock — and releases it on unmount. `Io` subscribes to the
snapshot and mounts `To` under `XD`, with the layout box as the fallback. `To` forwards props,
redraw, layout, resize, pointer and key events to the instance and draws only what
`host.rebuild(snapshot.tree)` returns; a failed snapshot draws its truncating text. `wo` shares the
host focus store with the pane layer: a pane taking focus clears the client, and the pre-dispatch key
handler only consumes keys for the focused client, dropping focus first on escape and ctrl+c/d.
`XD` resets on a new `resetKey` and reports a throw once.

The seam supplies the host bindings: the focus store `Kje`/`$pn`/`W1o`, the pane store `Ri` with the
copied `c9`, the client registry `G1o` (default: the inert `Co` shape), the telemetry helpers (the
copied `Qrt`/`kAt`/`ot`/`VV`, a null `i5t` sink), the layout context `Zy` with the copied `m4n`,
and the component base `iZr` with no-op capture/log sinks. `Ey` extends the keybinding service with
`registerPreDispatch`.

What was measured (probe log `.audit/w45-85-probe.txt`): the clock early/due/cleanup and the
interval fallback; the frozen snapshot and inert client; the acquire request, release and defaults;
the `Io` boundary/fallback/mount tree; the mount's box, effects, rebuilt tree, pointer mapping and
focus, failed text and the loading no-handler shape; the `wo` focus clear and its key paths; the
`Ey` bind/unbind/active gate; the `XD` states, statics, telemetry attach, frozen replacement and
`onError`; the focus setters, `c9` paths, `kAt` descriptors, `Qrt`, `i5t`, `m4n` and the inert
registry default.

Verified: tsc 0, the copy scans `unresolved 0` (67 declared), notices 0, 20 new tests, the chain
family 710/710, full 1,986/1,986, and the recovered-source index at 71 chunks / 1,662 statements /
304,866 units (2.8%). Identity `dee1094f…`.

Next: the site-tree walker `je` with the terminal glue, taken last when every component it names is
carried.

## W45-86 ported the site-tree walker (2026-10-17)

Five blocks are copied verbatim (3,051 units) into `plugin-chain-walker-host-source.ts`: the walker
`je` from chunk-kjfwbh4w.js, the display href encoder `Mrt` and the Box-key scope check `X4t` from
chunk-n3ykh62m.js, the control-character class `y$` from chunk-nyce03br.js, and the bidi table
`zDe`/`zpr`/`pot` from chunk-t58kj6z7.js.

The walker is one recursive dispatch on `type`, not a component table. A string becomes a Text child.
An `engine` node answers `draw(ref)`. Every site type is constructed with the press handle the node
carries: Button maps plugin/handle/element plus the held children, Input and Select pass their own
prop sets, Code passes its props through, Markdown always carries `press` (undefined without one),
Client is keyed `client:<plugin>:<key>` with `drawn` equal to the whole prop bag and a rebuild that
recurses with a null draw, Svg becomes a dim Text, Image and Raster add their kind prefix to the key
only when an element key exists, and a Link draws the host link token `Wt` with the well-formed URL
`Nrt(href)` and a fallback of label, space and the dim display href `Mrt(href)`.

Containers split inline and block: inline types keep string children, block types walk them into
Text. A keyed Box becomes `$t` only when `X4t` admits the key — a string of 1 to 10000 characters
without control characters, seen once per parent; the first keeps `key` and `isLive:true`, a repeat
draws with `isLive:false` and no key, and each rejection is reported once with its exact reason. A
Box or Text carrying a hover block draws through `Ut` with the group `Bt(group.plugin, hover)`;
everything else draws `Box`/`Text` with `De(props)`.

What was measured (probe log `.audit/w45-86-probe.txt`): every node type and its exact prop map; the
Button held children; Input/Select/Code/Markdown/Client/Svg/Image/Raster shapes; the Link fallback
with and without a label; the keyed Box's layout (key removed), hover block and group; the plain Box;
the hovered Text at `isInline:true` and Box at false; a duplicate key's live/no-key second draw; the
inline/block string split; the four `X4t` messages verbatim (repeat, empty/non-string/over-long, and
the control character); `Mrt` on space, tab, newline, control, bidi mark and printable Unicode; and
the `zDe` ranges `[[1564,1564],[8234,8238],[8294,8297]]` with `zpr` as the bidi class body.

What remains of partition 4 is the terminal glue that renders a site through row accounting — `yt`,
`pr`, the row helpers `lr`/`mr`/`fr`, `ur`, `cr`/`dr`, `xr`, `ar`, `$e`, `hdn`, `TU` and `VH` —
with its row/draw accounting imports (`dce`, `g4n`, `GPn`, `pIn`, `uIn`, `LAt`, `MF`, `Fss`,
`che`, `Ioe`, `iur`, `$ur`, `mIn`, `kVe`, `OL`, `oIn`, `j3e`, `Frt`, `l9`, `Omt`). That is the next
package.

Verified: tsc 0, the copy scans `declared 44 / unresolved 0`, notices 0, 13 new tests, the chain
family 723/723, full 1,999/1,999, and the recovered-source index at 72 chunks / 1,666 statements /
307,819 units (2.8%). Identity `14255a2d…`.

## W45-87 ported the render-version layer (2026-10-17)

Twenty-two blocks are copied verbatim (2,667 units) into `plugin-chain-render-keys-source.ts`.
They are the render event name `vA`, the viewport key `oIn`, the render-key builder `MF`, the
props key `mIn`, the versioned-key reader `$H`, the event reader `kVe`, the visible-map reader
`Tc`, the version bump `wc`, the live/steady key helpers (`kc`, `wH`, `kH`, `xc`, `Rb`), the
drawing tests `sur`/`iur`, the on-screen range `$ur`, the message list `j3e`, the engine sentinel
`Ioe`, the two stores `Omt`/`l9`, the hook gates `Frt`/`LAt`/`WPn`/`SVe`/`GPn`, and the hash
helpers `at`/`eA`/`hno`/`yno`/`blt`.

A render key is `surface\0component\0requestId`. Its versioned form appends the version of the
state-suffixed key (`jf`) only when the store holds one. The props key is
`columns\0fullscreen\0sha256(props)`. `kVe` composes the event counter with the versioned request
key. `Tc` walks the visible map and skips the viewport key and every live or state-suffixed
duplicate, so the visible map is versioned by the steady keys alone. `wc` bumps one key through the
host-owned store `it().renderVersions`.

The package also exposed a defect in the seam's matcher module: `l` had resolved to an error-text
helper, so `aUn`/`Slt` passed an always-true test and every scalar matcher matched. Seven blocks
now restore the recovered runner and its alias table from chunk-ed7zyzrn.js and chunk-z6p21rxk.js:
the runner `l`, the server name normalization `In`, the tool alias table and its lookups
(`c`/`Bl`/`gpe`/`_Z`/`qW`), the anchored regex shape `Twr`, the root test `I`, the name expansion
`W`, the literal matcher `S`, the normalization `K`/`C`, the regex test `F` and `z`, and the
nested context `G`. Scalar mismatches are false again, object matchers stay partial, aliases expand
on either side and regex matchers test the value.

What was measured (probe log `.audit/w45-87-probe.txt`): the key shapes and digests; `$H` with and
without a stored version; `Tc` over the full map and over listed keys under both paces; `mIn`'s
three fields; `wc`'s single bump; six `sur`/`iur` cases; four `$ur` cases; the eight message types;
`Ioe`; `Omt.defaultValue`; `l9.get()`; the hook gates with two installed modules; the sha256 and
JSON-id helpers; and nine seam aliases against the source names.

What remains of partition 4 is the terminal glue that renders a site through row accounting — `yt`,
`pr`, the row helpers `lr`/`mr`/`fr`, `ur`, `cr`/`dr`, `xr`, `ar`, `$e`, `hdn`, `TU` and `VH` —
with `dce` and the engine render service `che` as the remaining host seams. That is the next
package.

Verified: tsc 0, the copy scans `declared 55 / unresolved 0` and `declared 54 / unresolved 0`,
notices 0, 25 new tests, the chain family 748/748, full 2,024/2,024, and the recovered-source index
at 74 chunks / 1,698 statements / 310,408 units (2.9%). Identity `f1522ee4…`.

## W45-88 ported the terminal glue (2026-10-17)

Eight blocks are copied verbatim (4,823 units) into `plugin-chain-terminal-glue-source.ts`: the
glue itself from chunk-kjfwbh4w.js, the site input matcher `uo`, the render-descriptor WeakMap
`bVe`/`CAt`, the settled-list reader `Vss`/`Lur`, the module filter `pIn`, and the render-failure
notes `cIn`/`dIn`/`mno`/`uIn` with their dedupe (`cce`/`HM`/`s5t`/`sIn`/`CK`/`Iye`) from
chunk-n3ykh62m.js.

A site becomes one surface node. `yt` walks the tree under a plugin context built from component
and request id, and the draw callback receives the input the drawn descriptor names (`uo`). `pr`
keeps a Pane bare and wraps every other component in the error boundary `XD`: the fallback redraws
the engine sentinel tree, and a caught throw notes the site, files one failure note and calls
`onThrown`. `ur` resolves the on-screen input only while fullscreen and hooked, attaching the
asked range and keeping the held rows as the fallback. `xr` reads the settled answer for the
current render version, subscribes to the engine render service while hooked, holds the mount
counter `Fss`, and maps a rejected answer to the sentinel through `onThrown`. `hdn` composes the
Box with the drawn site ref, the render event and component, the held-row height and the overflow
decision, and `TU` is its node. The row helpers keep the held rows stable across off-screen draws:
a changed draw or filled content clears them, turning off stores the last rows, and the first empty
content restores them.

The failure note is deduplicated by component and teller, and its module list is the plugins that
contributed to the settled site, or every candidate when none is recorded.

Host boundary: the engine render client `che`, the settled-evaluation cache `dce`, the frame row
accounting `g4n`, the mount counter `Fss` and the terminal mode `Mi` are host seams, because the
engine that answers a render and owns the frame graph is outside this product. `src/plugin-chain-terminal-host.ts`
mirrors the source contracts the glue reads, keeps the engine injectable, and adapts the host
render-version store for the selector hook (`OL`). `dce.uiRender` delegates evaluation to the
injected service instead of copying the engine pipeline `gno`, whose dependency closure is the next
subsystem, not this package.

What was measured (probe log `.audit/w45-88-probe.txt`): the render key and its digest; the row
helper transitions; the fullscreen on-screen input; the settled render with and without a cached
answer; the terminal input merge; the context element; the Pane bypass and the boundary wrapper;
the fallback Box and the hooked boundary node; the first-run ref; `uo`/`CAt`/`pIn`; the mount
release; the failure text and the dedupe check; and the public aliases.

Partition 4 (the plugin chain runner) is complete through its terminal glue. The next ready item
is C-1 (Magpie startup and recovery); A-1 remains a user action.

Verified: tsc 0, the copy scan `declared 101 / unresolved 0`, notices 0, 19 new tests, the chain
family 767/767, full 2,043/2,043, and the recovered-source index at 74 chunks / 1,736 statements /
315,116 units (2.9%). Identity `76b9199c…`.

