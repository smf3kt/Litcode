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


def cut_range(p, start, end, new=''):
    t = rd(p)
    i = t.index(start)
    j = t.index(end, i) + len(end)
    wr(p, t[:i] + new + t[j:])


R = 'screens/REPL.tsx'
cut(R, """  const ultraplanPendingChoice = useAppState(s => s.ultraplanPendingChoice)
  const ultraplanLaunchPending = useAppState(s => s.ultraplanLaunchPending)
""")
cut(R, """  // showBashesDialog is REPL-level so it survives PromptInput unmounting.
  // When ultraplan approval fires while the pill dialog is open, PromptInput
  // unmounts (focusedInputDialog → 'ultraplan-choice') but this stays true;
  // after accepting, PromptInput remounts into an empty "No tasks" dialog
  // (the completed ultraplan task has been filtered out). Close it here.
  useEffect(() => {
    if (ultraplanPendingChoice && showBashesDialog) {
      setShowBashesDialog(false)
    }
  }, [ultraplanPendingChoice, showBashesDialog])

""")
cut(R, """    | 'ultraplan-choice'
    | 'ultraplan-launch'
""")
cut(R, """
    if (
      feature('ULTRAPLAN') &&
      allowDialogsWithAnimation &&
      !isLoading &&
      ultraplanPendingChoice
    )
      return 'ultraplan-choice'

    if (
      feature('ULTRAPLAN') &&
      allowDialogsWithAnimation &&
      !isLoading &&
      ultraplanLaunchPending
    )
      return 'ultraplan-launch'
""")
cut(R, """            // Yield wheel/ctrl+u/d to UltraplanChoiceDialog's own scroll
            // handler while the modal is showing.
            isActive={focusedInputDialog !== 'ultraplan-choice'}
""", """            isActive={true}
""")

P = 'components/PromptInput/PromptInput.tsx'
cut(P, "import { findUltraplanTriggerPositions } from '../../utils/ultraplan/keyword.js'\n")
cut(P, """  const ultraplanSessionUrl = useAppState(s => s.ultraplanSessionUrl)
  const ultraplanLaunching = useAppState(s => s.ultraplanLaunching)
  const ultraplanTriggers = useMemo(
    () =>
      feature('ULTRAPLAN') && !ultraplanSessionUrl && !ultraplanLaunching
        ? findUltraplanTriggerPositions(displayedValue)
        : [],
    [displayedValue, ultraplanSessionUrl, ultraplanLaunching],
  )

""")
cut(P, """    // Same rainbow treatment for the ultraplan keyword
    if (feature('ULTRAPLAN')) {
      for (const trigger of ultraplanTriggers) {
        for (let i = trigger.start; i < trigger.end; i++) {
          highlights.push({
            start: i,
            end: i + 1,
            color: getRainbowColor(i - trigger.start),
            shimmerColor: getRainbowColor(i - trigger.start, true),
            priority: 10,
          })
        }
      }
    }

""")
cut(P, "    thinkTriggers,\n    ultraplanTriggers,\n    buddyTriggers,\n",
       "    thinkTriggers,\n    buddyTriggers,\n")
cut(P, """  useEffect(() => {
    if (feature('ULTRAPLAN') && ultraplanTriggers.length) {
      addNotification({
        key: 'ultraplan-active',
        text: 'This prompt will launch an ultraplan session in Claude Code on the web',
        priority: 'immediate',
        timeoutMs: 5000,
      })
    } else {
      removeNotification('ultraplan-active')
    }
  }, [addNotification, removeNotification, ultraplanTriggers.length])

""")

U = 'utils/processUserInput/processUserInput.ts'
cut(U, """import {
  hasUltraplanKeyword,
  replaceUltraplanKeyword,
} from '../ultraplan/keyword.js'
""")
cut_range(U,
  "    !context.getAppState().ultraplanSessionUrl &&\n",
  "  }\n\n")

S = 'state/AppStateStore.ts'
cut(S, """  // Set synchronously in launchUltraplan before the detached flow starts.
  // Prevents duplicate launches during the ~5s window before
  // ultraplanSessionUrl is set by teleportToRemote. Cleared by launchDetached
  // once the URL is set or on failure.
  ultraplanLaunching?: boolean
  // Active ultraplan CCR session URL. Set while the RemoteAgentTask runs;
  // truthy disables the keyword trigger + rainbow. Cleared when the poll
  // reaches terminal state.
  ultraplanSessionUrl?: string
  // Approved ultraplan awaiting user choice (implement here vs fresh session).
  // Set by RemoteAgentTask poll on approval; cleared by UltraplanChoiceDialog.
  ultraplanPendingChoice?: { plan: string; sessionId: string; taskId: string }
  // Pre-launch permission dialog. Set by /ultraplan (slash or keyword);
  // cleared by UltraplanLaunchDialog on choice.
  ultraplanLaunchPending?: { blurb: string }
  // Remote-harness side: set via set_permission_mode control_request,
  // pushed to CCR external_metadata.is_ultraplan_mode by onChangeAppState.
  isUltraplanMode?: boolean
""")

O = 'state/onChangeAppState.ts'
cut(O, """    ...(typeof metadata.is_ultraplan_mode === 'boolean'
      ? { isUltraplanMode: metadata.is_ultraplan_mode }
      : {}),
""")
cut(O, """      // Ultraplan = first plan cycle only. The initial control_request
      // sets mode and isUltraplanMode atomically, so the flag's
      // transition gates it. null per RFC 7396 (removes the key).
      const isUltraplan =
        newExternal === 'plan' &&
        newState.isUltraplanMode &&
        !oldState.isUltraplanMode
          ? true
          : null
      notifySessionMetadataChanged({
        permission_mode: newExternal,
        is_ultraplan_mode: isUltraplan,
      })
""", """      notifySessionMetadataChanged({ permission_mode: newExternal })
""")

PR = 'cli/print.ts'
cut(PR, "            isUltraplanMode: m.ultraplan ?? prev.isUltraplanMode,\n")

SS = 'utils/sessionStorage.ts'
cut(SS, "  isUltraplan?: boolean\n")

X = 'constants/xml.ts'
cut(X, "// XML tag names for ultraplan mode (remote parallel planning sessions)\n")
cut(X, "export const ULTRAPLAN_TAG = 'ultraplan'\n")

E = 'components/permissions/ExitPlanModePermissionRequest/ExitPlanModePermissionRequest.tsx'
cut(E, "import { launchUltraplan } from '../../../commands/ultraplan.js'\n")
cut(E, "  | 'ultraplan'\n")
cut(E, "  const ultraplanSessionUrl = useAppState(s => s.ultraplanSessionUrl)\n")
cut(E, "  const ultraplanLaunching = useAppState(s => s.ultraplanLaunching)\n")
cut(E, """  // Hide the Ultraplan button while a session is active or launching —
  // selecting it would dismiss the dialog and reject locally before
  // launchUltraplan can notice the session exists and return "already polling".
  // feature() must sit directly in an if/ternary (bun:bundle DCE constraint).
  const showUltraplan = feature('ULTRAPLAN')
    ? !ultraplanSessionUrl && !ultraplanLaunching
    : false
""")
cut(E, "        showUltraplan,\n        usedPercent: null,", "        usedPercent: null,")
cut(E, "        showUltraplan,\n        usedPercent,", "        usedPercent,")
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
cut(E, """  if (showUltraplan) {
    options.push({
      label: 'No, refine with Ultraplan on Claude Code on the web',
      value: 'ultraplan',
    })
  }

""")
cut(E, """  showUltraplan,
  usedPercent,
  isAutoModeAvailable,
  isBypassPermissionsModeAvailable,
  onFeedbackChange,
}: {
  showClearContext: boolean
  showUltraplan: boolean
""", """  usedPercent,
  isAutoModeAvailable,
  isBypassPermissionsModeAvailable,
  onFeedbackChange,
}: {
  showClearContext: boolean
""")
cut(E, """      showClearContext,
      showUltraplan,
      usage,
""", """      showClearContext,
      usage,
""")

# ---------- delete files ----------
os.remove(B + 'commands/ultraplan.tsx')
os.remove(B + 'utils/ultraplan/keyword.ts')
os.rmdir(B + 'utils/ultraplan')
print('e4 ultra ok')
