# -*- coding: utf-8 -*-
"""Analytics transport closure record: four files, one commit."""
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
## Wave D closure — the analytics transport surface (`0a488b3`, landed)

**The transports went in step 7a; the payload builders survived it.** `logEvent`/`logEventAsync` became empty functions, but two helpers kept gathering local state to hand to them: `main.tsx`'s `logStartupTelemetry` (git/worktree/gh status, sandbox flags, reduced motion, the cert-env flags) and `utils/api.ts`'s `logContextMetrics` (MCP prefetch, tool enumeration, user and system context, a ripgrep file count and token estimation on every session). Their bodies were dead work with real cost.

**Their last readers close with them.** `isAnalyticsDisabled` had exactly those two callers, so `services/analytics/config.ts` goes; `getGhAuthStatus` existed only for the startup payload, so `utils/github/ghAuthStatus.ts` goes and the directory with it. Two imports lost their last reader in the pass (`hasNodeOption`, `roughTokenCountEstimation`).

**The no-op API stays by the recorded step-7a decision.** `services/analytics/index.ts` keeps `logEvent`/`logEventAsync` and their marker types so the remaining ~190 call sites keep compiling; `growthbook.ts` keeps its local env/config override channels and `metadata.ts` its PII-redaction surface. No outbound telemetry path remains in the analytics directory.

### Port coordinate refresh

Fourteen historical evidence files moved, all by re-running their own fixtures: `w65-d7h`, `d7i`, `d7j`, `d7l`, `d7n`, `d7o`, `d7p`, `d7q`, `d7r`, `d7s`, `d7t`, `d7u`, `d7x` and `d7y`. `portSha256` only; no `sourceSha256` changed and no range moved.

### Verification

tsc 0, thirty-six fixtures pass (the new `w65-d7zb-verify` plus thirty-five carried), `git diff --check` clean, the orphan scan back at its ten legitimate entries over 1605 files. Eight carried fixtures were amended to the new file count (the four `160[0-8]` ranges and four exact pins). The first replay exposed the new orphan `utils/github/ghAuthStatus.ts`; it is deleted with the payload builder that was its only caller.

**The 2026-10-16 local-only directive has no remaining items.**

## Protocol slip (recorded)""")

C = 'research/CURRENT.md'
rep(C, "thirty-five fixtures pass (7n follows the path). No earlier evidence record moved.\n", """thirty-five fixtures pass (7n follows the path). No earlier evidence record moved.

Wave D closure (`0a488b3`): the analytics transport surface is closed. The two payload builders that survived step 7a's no-op switch — `main.tsx`'s `logStartupTelemetry` with `getCertEnvVarTelemetry`, and `utils/api.ts`'s `logContextMetrics` with its MCP-prefetch/ripgrep/token-estimation body — are removed with the analytics gate `isAnalyticsDisabled` (`services/analytics/config.ts`) and the gh-CLI probe `utils/github/ghAuthStatus.ts`. The no-op `logEvent` API, `growthbook.ts`'s local override channels and `metadata.ts`'s redaction surface stay. 4 files, -208; tsc exits 0; thirty-six fixtures pass (eight counts amended). Fourteen earlier evidence records refreshed digest-only.
""")

S = 'research/STATUS.md'
rep(S, "thirty-five fixtures pass (7n follows the path); no earlier evidence record moved. [W65 record](ports/W65-account-network.md).\n",
"""thirty-five fixtures pass (7n follows the path); no earlier evidence record moved. [W65 record](ports/W65-account-network.md).

Wave D closure (`0a488b3`) closes the analytics transport surface: the two payload builders that survived the no-op switch (`logStartupTelemetry` with `getCertEnvVarTelemetry`, and `logContextMetrics` with its MCP prefetch, tool enumeration, context gathering, ripgrep file count and token estimation), the analytics gate `isAnalyticsDisabled` whose only readers they were, and the gh-CLI probe that existed solely for the startup payload. The no-op `logEvent`/`logEventAsync` API stays by the step-7a decision, as do `growthbook.ts`'s local override channels and `metadata.ts`'s redaction surface; no outbound telemetry path remains. 4 files, -208; tsc exits 0; thirty-six fixtures pass (eight counts amended); fourteen earlier evidence records refreshed digest-only. The local-only directive has no remaining items. [W65 record](ports/W65-account-network.md).
""")

F = 'research/FEATURES.md'
rep(F, "Remaining under the 2026-10-16 local-only directive: the analytics transports",
    "The 2026-10-16 local-only directive is complete. The analytics item, closed by step 7zb (`0a488b3`), began here")

rep(F, "Next: the analytics transports. [W65](ports/W65-account-network.md). |",
    "Step 7zb (`0a488b3`) closes the analytics transport surface: the logStartupTelemetry/logContextMetrics payload builders, the analytics gate, and the gh probe are removed; the no-op logEvent API stays by the recorded step-7a decision. No items remain under the local-only directive. [W65](ports/W65-account-network.md). |")

print('record ok')
