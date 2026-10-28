# W369 managed-only child (omitClaudeMd)

- [x] Read the recovered owners before any product edit: `gd` chunk-40cepjpq.js [147565,147921), the spawn gate [123469,123561), the child option propagation [133848,133872), the managed filters chunk-5b2hxy2e.js [29841,29911) and chunk-sfn1dbxq.js [3671615,3671685), the definition schema [429193,429451) and the built-in Explore literal [201834,202021).
- [x] Capture the compiled baseline: the strict schema rejected a definition with `omitClaudeMd`, the spawn returned `Unknown agent type: no-md`, and no child request was made.
- [x] Port the definition field, the managed-tier loader mode, the `childConfig` rewrite and the flag on both isolation rewrites.
- [x] Add three regression groups (agent types, config, agent registry) and extend `scripts/smoke-managed-instructions-cli.mjs` with a same-workspace managed-only child; six owned loopback requests.
- [x] Run check, build, focused 142/142, the source and compiled driver, and the full suite 3445/3445; freeze identity b33823e5 (939/360/662).
- [ ] One bounded independent review; record its verdict.
- [x] Update CURRENT, FEATURES, partial-closure and the package record (W369-omit-claude-md.md plus evidence JSON).
- [ ] Commit exact paths locally after the review verdict.

Local only. No account, OAuth, hosted subscription, paid upstream, push, coauthor or schedule.
