# W344 mounted editor fixture closure

- [x] Reproduce it yourself on the matching surface. W343 full and separate statusline run reproduce two editor-handoff timeouts and inherited nvim launches.
- [x] Binary-search the cause. Read manifest-verified cached resolver/launcher and W287 owner contract. Both tests change VISUAL after TUI startup.
- [x] Plan the fix. Configure the existing owned editor before mount,restore environment after close with the test cleanup hook,retain all assertions/timeouts.
- [x] Verify on the same surface. Related141/141,check/build and existing compiled26checks/1ownedloopbackrequest pass. Independent review runs at1856fileb355a00d.
- [x] Stage the commits so the failing repro lands before the fix in git history. Skip separate red commit;unchanged tests and W343 logs already reproduce the failures.
- [x] Run Opening a PR. Skip under explicit no-push/local-only scope.
- [x] Freeze identity,independent review and record full-suite boundary. Fresh Opus6/6,compiled26and1856before/after records b355a00d pass;94assertions/timers/options retained;0confirmeddefects/ownedresources. Exact-path local commit follows without coauthor or push.
