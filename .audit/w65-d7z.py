# -*- coding: utf-8 -*-
"""Dependency-pruning record: four files, one commit."""
def rd(p): return open(p, encoding='utf-8').read()
def wr(p, t): open(p, 'w', encoding='utf-8').write(t)
def rep(p, old, new):
    t = rd(p)
    n = t.count(old)
    assert n == 1, (p, old[:80], n)
    wr(p, t.replace(old, new))

W = 'research/ports/W65-account-network.md'
rep(W, """
## Protocol slip (recorded)""", """
## Dependency-pruning pass (`827583f`, landed)

**Four declared packages had no importer left.** `@growthbook/growthbook` lost its client with the telemetry transport in step 7a — the module now keeps only the env-var and local-config override channels. `@opentelemetry/core` lost its direct importers in the same step, but it remains a dependency of the retained `@opentelemetry/sdk-*` packages, so only its root declaration is removed and its lock entry stays. `asciichart`'s only consumer was the removed usage-chart UI, and `themeColorToAnsi` — the exported helper that converted theme colors for that chart — had no caller itself. `qrcode` has no reference in the tree.

**The lock was pruned by reachability, not by hand.** The cut walks node resolution from the remaining root dependency set and removes every entry no remaining package can reach (36 entries across the four packages and their transitive-only dependencies). The fixture reruns the same walk: every declared dependency resolves, and no entry is unreachable.

**The record's earlier count was stale.** The "nine zero-importer dependencies" named from step 7p onward predated steps 7a-7y; a fresh scan over the committed tree finds four. `utils/theme.ts` keeps its theme tables and `getTheme`.

### Verification

tsc 0, thirty-four fixtures pass (the new `w65-d7z-verify` plus thirty-three carried, none amended), `git diff --check` clean, the orphan scan unchanged at its ten legitimate entries over 1607 files. No historical evidence file moved: the pruning touches package files and the theme module, which no earlier fixture records. The first cut left a blank line at EOF where the removed helper ended the file; the script trims to one final newline and the files were restored from `HEAD` before the replay.

**Next:** the `utils/filePersistence/` rename and the analytics transports.

## Protocol slip (recorded)""")

C = 'research/CURRENT.md'
rep(C, "Fifteen earlier evidence records refreshed digest-only.\n", """Fifteen earlier evidence records refreshed digest-only.

Dependency-pruning pass (`827583f`): four zero-importer packages leave package.json — `@growthbook/growthbook`, `asciichart`, `qrcode` and `@opentelemetry/core`'s root declaration (its entry stays as a transitive dependency of the retained SDK packages). The lock is pruned by a node-resolution reachability walk (36 unreachable entries), and `utils/theme.ts` loses the callerless `themeColorToAnsi`/`chalkForChart` that was asciichart's last mention. 3 files, +1/-409; tsc exits 0; thirty-four fixtures pass (none amended). No earlier evidence record moved.
""")

S = 'research/STATUS.md'
rep(S, "fifteen earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).\n",
"""fifteen earlier evidence records refreshed digest-only. [W65 record](ports/W65-account-network.md).

Dependency-pruning pass (`827583f`) removes the four zero-importer packages (`@growthbook/growthbook`, `@opentelemetry/core`'s root declaration, `asciichart`, `qrcode`), the 36 lock entries unreachable from the remaining dependency set, and the callerless `themeColorToAnsi`/`chalkForChart` helper in `utils/theme.ts`; the fixture reruns the same reachability walk and asserts the lock has no unreachable entry. 3 files, +1/-409; tsc exits 0; thirty-four fixtures pass (none amended); no earlier evidence record moved. [W65 record](ports/W65-account-network.md).
""")

F = 'research/FEATURES.md'
rep(F, "Next: the dependency-pruning pass, the `utils/filePersistence/` rename and the analytics transports. [W65](ports/W65-account-network.md). |",
    "The dependency-pruning pass (`827583f`) drops four zero-importer packages (@growthbook/growthbook, @opentelemetry/core's root declaration, asciichart, qrcode) with 36 unreachable lock entries and the dead themeColorToAnsi helper. Next: the `utils/filePersistence/` rename and the analytics transports. [W65](ports/W65-account-network.md). |")

print('record ok')
