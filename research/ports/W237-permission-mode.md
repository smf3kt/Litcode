# W237 Config Default permission mode

Status: implemented and verified locally, 2026-10-21. Local only; no push, no paid calls.

## Task card

- Entry is the remaining local Config "Default permission mode" enum row behind the slash composer.
- Outcome requires the row to show the authored settings default, cycle the recovered option list,
  persist the nested `permissions.defaultMode`, survive restart/resume and be adopted by a fresh
  CLI session that names no mode flag.
- Reuse the existing Config panel, settings queue, successor-session application and permission
  resolution. No account, network or OAuth work.
- Validate the compiled CLI, source ranges and independent review. One lead writer.

## Baseline

At 51b14ca the Config panel lists twelve rows and has no permission-mode row; `permissions.defaultMode`
reaches the session policy at startup but nothing edits it from the terminal. The recovered tree
exposes the row after Time format, reads `r?.permissions?.defaultMode || "default"`, and writes the
nested value to `userSettings`.

## Source gate

Artifact SHA-256 c9b5341637becbd423ddffc5b254afb645682a3868cb708bbc6cc0e7bb419937.
Ranges are zero-based UTF-16 code units, half-open, verified with the static Acorn reader against
extracted-v2/manifest.json. Recovered application entrypoints remain inert.

| Module | SHA-256 | Bodies |
| --- | --- | --- |
| chunk-nybcbd9t.js | 0abe0d704940977466d81c1efab7f953d8f9dac0f30cd758c4a3d0286b5c1bca | row permissionMode [21907,22578); local writer `P` [8029,8117) |
| chunk-a60ee1ne.js | fe5d3ed9cb5d16b40ded156d060aeed714dc3a382405609422688756f0707ee1 | `BE` at 765: the six mode names |
| chunk-3cynezh1.js | c3fc78a29a64dc725d32fe549b7dc11190e7646368c939bb8d61e755799955b3 | `ur` descriptors [69464,70196), `mT` 70510, `V3` 70196, `vc` 70271 |
| chunk-x0dc37w9.js | 0b4db31ad035eb234d6943552606135e83405b719e32a114283cadad4ed957d92 | `An` at decoded-byte 102209 delegates to `ta`, the nested settings merge |

The row body:

```js
{id:"permissionMode",label:"Default permission mode",value:r?.permissions?.defaultMode||"default",
 options:(()=>{let e=["default","plan"],o=BE,u=["bypassPermissions"];return[...e,...o.filter((h)=>!e.includes(h)&&!u.includes(h))]})(),
 type:"enum",async onChange(e){let o=mT(e),u=V3(o)?vc(o):o,h=r?.permissions?.defaultMode;
   T((R)=>({...R,permissions:{...R?.permissions,defaultMode:u}})),U.record("permissionMode",e);
   let E=await P({permissions:{defaultMode:u}});
   if(E.error)return T((R)=>({...R,permissions:{...R?.permissions,defaultMode:h}})),U.clear("permissionMode"),
     t(`Failed to update default permission mode setting: ${E.error.message}`,{level:"error"}),{error:E.error}}}
```

The displayed value is the authored settings default, not the live session mode. `BE` is
`["acceptEdits","auto","bypassPermissions","default","dontAsk","plan"]`; the row prefixes
`default`/`plan`, filters those from `BE`, and drops `bypassPermissions`, so the list is
`default, plan, acceptEdits, auto, dontAsk`. `mT` normalizes a retired name to `default` and `vc`
maps an internal name to its external spelling. `P` calls `An("userSettings", patch)`, and `An`
delegates to the settings merge, so the write keeps every other authored `permissions` key.

## Adaptations and ownership

- `src/config-panel.ts` adds `PERMISSION_MODE_OPTIONS`, the `permissionMode` update variant, the row
  after Time format and its enum activate arm. The row reads
  `config.permissions?.defaultMode ?? 'default'`.
- `src/config-panel-input.ts` projects `permissions` so the row sees the authored value.
- `src/theme-settings.ts` splits the existing document reader into `updateSettingsDocument` and adds
  `writePermissionDefaultMode`, which merges `defaultMode` into an existing plain-object
  `permissions` value, preserving every other key, and replaces any non-object or array leaf with a
  new object carrying `defaultMode`, matching the source merge (`us`/`MB`). It writes through the
  same per-file `queuePermissionSettingsWrite` and atomic replacement as the other rows.
- `src/interactive.ts` handles the Config update by re-reading the merged settings after the write,
  so a higher settings layer keeps precedence, then replaces `config.permissions.defaultMode` and
  runs the usual successor-session application. The row changes the settings default only; the
  live mode is unchanged, matching the source.
- The value applies on the next session start: `src/runtime.ts` already maps
  `permissions.defaultMode` into the policy `mode`, and `src/cli.ts` already resolves the policy
  from merged settings. No new runtime branch was added.

## Throughput

One bounded independent reader checked the row body, option construction, write merge and startup
adoption against the cited ranges. One lead writer owns all product changes. The compiled
acceptance drives the real CLI under a PTY.

## Validation

- `npm run check` and `npm run build` pass.
- 28 affected regressions pass across config-panel, theme-settings, permission-settings and
  interactive.
- Full suite: 2981 tests, 2980 pass. The single failure, CLI effort flag overrides environment,
  remains the pre-existing W231 divergence reproduced at HEAD5717eb9; recorded in question.md.
- Compiled acceptance `.audit/w237-permission.mjs`: 13/13 checks at identity
  d2658e31dde51016be63a91fa57a8390a8d546ee08f7ecfaf5e915cae25fe22d. It covers: the row shows the
  authored default while the live footer stays on bypass; Right cycles to plan and the panel
  shows it while the live chip stays bypass; the write persists nested `permissions.defaultMode`
  beside an authored `allow` rule and unrelated top-level keys; a resumed session keeps plan from
  its pinned config; a fresh session with no mode flag starts live in plan mode; an absent key
  reads as default and starts manual; a write into an absent `permissions` object creates it; and
  a project layer declaring `plan` keeps the row at plan after a user write of `acceptEdits`
  (persisted in userSettings), with a fresh session adopting the project value. Every CLI exits
  zero.
- Independent review found no high findings. Its two medium items are closed by the acceptance
  additions above (higher-layer precedence both in the row and live; the live mode unchanged
  after the write). Low items are closed: the non-object leaf now takes the source merge instead
  of rejecting, with a unit assertion; the record's resume wording names the pinned config; and
  the row use of `||` matches the source exactly.

## Residual

Config rows still unported for lack of a complete local consumer: timestamps, prompt suggestions,
tab status, copy-on-select, auto-scroll, recap, gitignore, copyFullResponse and notifications.
Their gate is recorded in `.audit/tui-remaining.todo.md`.
