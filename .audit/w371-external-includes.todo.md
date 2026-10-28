# W371 external instruction includes

Source owners (extracted-v2/modules, zero-based half-open UTF-16):
- `Q6t` chunk-sfn1dbxq.js [676285,676512) body16 941bf97cd081c4b5: an include is external when `type !== "User"`, it has a `parent` (or `linkedFrom`) and `!IL(path)`.
- `m9r` [676512,676551) e961a5986bc80b41; `HXo` [676557,676708) e79d39785e895444: ask once unless approved or the warning was shown.
- `IL` [656718,656751) 104b417586d4b466: inside the working directory (`Wd` containment).
- `lCt` [666879,666922) a2be8af63c7a5c70: `qE() !== "local-agent"`, so local-agent mode gates User files too.
- `t1` [661767,662489) dcc7a3e5b7dd3741: `if(h>0&&!V&&!IL(he))return[]` and the recursion `if(!IL(Me)&&!V)continue`.
- `zae` [662489,664541) 474deff27981d295: the rules walker's external discovery gate.
- `ir` chunk-1dhzexv1.js [27153,27416) 749862b5bc647cb2: passes `hasClaudeMdExternalIncludesApproved` as `includeExternal` into `t1`/`zae`.
- `qZn` [668060,672726) 530f0207daa5256c: `he = s || approved`.
- `Qcn` chunk-bcnhka5p.js [1498,1742) 578fdf7ab3486d6f persists approved + warning-shown; `e3n` [1742,4206) 1fe346440e20abdd is the dialog (focus on cancel, "Yes, allow external imports").
- Defaults chunk-bk5ct2gw.js 558344: both flags false.
- Consumer chunk-msy0wfrd.js 11: a startup approval provider.

Host surface: `loadProjectConfig` (`appendInstruction`, `pinRuleImports`), the user-layer settings idiom `approveAllProjectMcpServers` (config.ts 1364-1404, 1645), the CLI notice site, `loadPathInstructions` (already refuses every escape; unchanged).

Plan:
- [x] User-layer-only `approveExternalIncludes` boolean, default false, removed from effective settings.
- [x] Gate imports at depth > 0 whose resolved path leaves the workspace; record `{path, parent}` on LoadedConfig (deduplicated); same gate in `pinRuleImports`.
- [x] CLI prints the skipped includes once at startup with the approval switch.
- [x] Tests: unapproved skip + report, approved read, project layer refused, non-boolean refused, in-workspace import unaffected, rule-import gate; the home-import group and the absolute-path fixture moved to the new rule.
- [x] Compiled driver: unapproved vs approved request system prompts through owned loopback SSE; red baseline captured on the pre-change build.
- [x] check/build/focused 80/full 3453 at identity 5ff82582; CURRENT/FEATURES/partial-closure/record.
- [x] One bounded independent review: four findings, all confirmed (HIGH child-loader gate, MEDIUM reload notice, LOW depth-0 report, LOW case folding).
- [x] Repair round: child-loader gate, SessionConfig-carried notice with applyConfig printing on change, report filtered against read files, folded/inode containment; three regression tests.
- [x] Re-validate: check/build, config 83/83, full 3456/3456, source and compiled driver, identity 60910703.
- [ ] Commit the repair locally (exact paths, no amend).

Local only. No account, OAuth, hosted subscription, paid upstream, push, coauthor or schedule.
