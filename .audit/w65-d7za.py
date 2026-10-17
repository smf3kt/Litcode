# -*- coding: utf-8 -*-
"""filePersistence rename record: four files, one commit."""
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
## Follow-up: the `filePersistence` rename (`2823ec8`, landed)

**The directory outlived its contents.** `utils/filePersistence/` held the ingress scanner, its types and the persistence implementation; the file-upload lane's removal took all but `outputsScanner.ts`, a four-line reader of `CLAUDE_CODE_ENVIRONMENT_KIND` whose only export is `getEnvironmentKind` and whose only user is `utils/plans.ts` (remote-session plan recovery and file snapshots). Keeping it in a directory named for persistence misdescribed it, so the module moves to `utils/environmentKind.ts` beside its reader.

**The body is unchanged.** The union (`anthropic_cloud | byoc | bridge`), the two remote-kind returns and the null fallback are byte-identical; only the relative `debug.js` import path and one comment word (the removed scanner) differ. The declared SDK `files_persisted` subtype and the environment-kind contract stay.

### Verification

tsc 0, thirty-five fixtures pass (the new `w65-d7za-verify` plus thirty-four carried), `git diff --check` clean, the orphan scan unchanged at ten entries over 1607 files. One carried fixture was amended: `w65-d7n` read the old path and compared the module body, and now follows the rename. No historical evidence file moved. The first tsc run caught the moved module's relative import, which is now `./debug.js`.

**Next:** the analytics transports.

## Protocol slip (recorded)""")

C = 'research/CURRENT.md'
rep(C, "No earlier evidence record moved.\n", """No earlier evidence record moved.

Follow-up (`2823ec8`): the `utils/filePersistence/` path retires. The directory held only the environment-kind reader after the file-upload lane went, so `outputsScanner.ts` moves to `utils/environmentKind.ts` beside its only user `utils/plans.ts`; the body is unchanged apart from the relative debug import and the module comment. 2 files (one rename), +3/-3; tsc exits 0; thirty-five fixtures pass (7n follows the path). No earlier evidence record moved.
""")

S = 'research/STATUS.md'
rep(S, "no earlier evidence record moved. [W65 record](ports/W65-account-network.md).\n",
"""no earlier evidence record moved. [W65 record](ports/W65-account-network.md).

Follow-up (`2823ec8`) renames the surviving `utils/filePersistence/outputsScanner.ts` to `utils/environmentKind.ts` beside its only reader `utils/plans.ts`, retiring a directory that held nothing but the environment-kind reader after the file-upload lane was removed. The union, return arms and null fallback are unchanged; only the relative debug import and one comment word differ. 2 files (one rename), +3/-3; tsc exits 0; thirty-five fixtures pass (7n follows the path); no earlier evidence record moved. [W65 record](ports/W65-account-network.md).
""")

F = 'research/FEATURES.md'
rep(F, "Next: the `utils/filePersistence/` rename and the analytics transports. [W65](ports/W65-account-network.md). |",
    "Follow-up (`2823ec8`) renames the surviving filePersistence module to utils/environmentKind.ts beside its only reader, retiring the directory. Next: the analytics transports. [W65](ports/W65-account-network.md). |")

print('record ok')
