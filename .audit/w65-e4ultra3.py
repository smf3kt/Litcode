import os

B = '/Users/mant1ssa/Projects/cc-base-2188/'


def rd(p):
    return open(B + p, encoding='utf-8').read()


def wr(p, t):
    open(B + p, 'w', encoding='utf-8').write(t)


def cut(p, old, new=''):
    t = rd(p)
    n = t.count(old)
    assert n == 1, (p, old[:90], n)
    wr(p, t.replace(old, new))


E = 'components/permissions/ExitPlanModePermissionRequest/ExitPlanModePermissionRequest.tsx'
cut(E, """    // Ultraplan: reject locally, teleport the plan to CCR as a seed draft.
    // Dialog dismisses immediately so the query loop unblocks; the teleport
    // runs detached and its launch message lands via the command queue.
    if (value === 'ultraplan') {
      logEvent('tengu_plan_exit', {
        planLengthChars: currentPlan.length,
        outcome:
          'ultraplan' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
        interviewPhaseEnabled: isPlanModeInterviewPhaseEnabled(),
        planStructureVariant,
      })
      onDone()
      onReject()
      toolUseConfirm.onReject(
        'Plan being refined via Ultraplan — please wait for the result.',
      )
      void launchUltraplan({
        blurb: '',
        seedPlan: currentPlan,
        getAppState: store.getState,
        setAppState: store.setState,
        signal: new AbortController().signal,
      })
        .then(msg =>
          enqueuePendingNotification({ value: msg, mode: 'task-notification' }),
        )
        .catch(logError)
      return
    }

""")
cut(E, "import { launchUltraplan } from '../../../commands/ultraplan.js'\n")

for p in ['commands/ultraplan.tsx', 'utils/ultraplan/keyword.ts']:
    os.remove(B + p)
os.rmdir(B + 'utils/ultraplan')
print('e4 ultra3 ok')
