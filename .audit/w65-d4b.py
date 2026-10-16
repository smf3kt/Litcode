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


# ---- 5. the two config fields the deleted surveys owned (d4a died here) ----
CF = 'utils/config.ts'
cut(CF, """  // Feedback survey tracking
  feedbackSurveyState?: {
    lastShownTime?: number
  }

  // Transcript share prompt tracking ("Don't ask again")
  transcriptShareDismissed?: boolean

""")

# ---- 6. REPL hosts ----
R = 'screens/REPL.tsx'
cut(R, """import { useFeedbackSurvey } from 'src/components/FeedbackSurvey/useFeedbackSurvey.js'
import { useMemorySurvey } from 'src/components/FeedbackSurvey/useMemorySurvey.js'
import { usePostCompactSurvey } from 'src/components/FeedbackSurvey/usePostCompactSurvey.js'
import { FeedbackSurvey } from 'src/components/FeedbackSurvey/FeedbackSurvey.js'
""")
cut(R, """import {
  AutoRunIssueNotification,
  shouldAutoRunIssue,
  getAutoRunIssueReasonText,
  getAutoRunCommand,
  type AutoRunIssueReason,
} from '../utils/autoRunIssue.js'
""")
cut(R, """// Frustration detection is ant-only (dogfooding). Conditional require so external
// builds eliminate the module entirely (including its two O(n) useMemos that run
// on every messages change, plus the GrowthBook fetch).
//
// The fallback below is the source's own — it is what an external build runs. Its type was a type
// query at the module, which this build does not contain, so the signature is written out here the
// way the `getCoordinatorUserContext` declaration just below writes its own.
const useFrustrationDetection: (
  messages: unknown,
  isLoading: boolean,
  hasActivePrompt: boolean,
  anySurveyOpen: boolean,
) => { state: "closed"; handleTranscriptSelect: (id?: string) => void } = () => ({
  state: 'closed',
  handleTranscriptSelect: () => {},
})
""")
cut(R, """                      {autoRunIssueReason && (
                        <AutoRunIssueNotification
                          onRun={handleAutoRunIssue}
                          onCancel={handleCancelAutoRunIssue}
                          reason={getAutoRunIssueReasonText(autoRunIssueReason)}
                        />
                      )}
""")
cut_range(
    R,
    "                      {postCompactSurvey.state !== 'closed' ? (\n",
    "                      {/* Skill improvement survey",
    "                      {/* Skill improvement survey",
)
cut_range(
    R,
    "  const feedbackSurveyOriginal = useFeedbackSurvey(\n",
    "      memorySurvey.state !== 'closed',\n  )\n\n",
)
cut(R, """  // Handler for when user presses 1 on survey thanks screen to share details
  const handleSurveyRequestFeedback = useCallback(() => {
    const command = ('/feedback')
    onSubmit(command, {
      setCursorOffset: () => {},
      clearBuffer: () => {},
      resetHistory: () => {},
    }).catch(err => {
      logForDebugging(
        `Survey feedback request failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    })
  }, [onSubmit])

""")
cut(R, """  // Handlers for auto-run /issue or /good-claude (defined after onSubmit)
  const handleAutoRunIssue = useCallback(() => {
    const command = autoRunIssueReason
      ? getAutoRunCommand(autoRunIssueReason)
      : '/issue'
    setAutoRunIssueReason(null) // Clear the state
    onSubmit(command, {
      setCursorOffset: () => {},
      clearBuffer: () => {},
      resetHistory: () => {},
    }).catch(err => {
      logForDebugging(`Auto-run ${command} failed: ${errorMessage(err)}`)
    })
  }, [onSubmit, autoRunIssueReason])

  const handleCancelAutoRunIssue = useCallback(() => {
    setAutoRunIssueReason(null)
  }, [])

""")
cut(R, """  // Auto-run /issue state
  const [autoRunIssueReason, setAutoRunIssueReason] =
    useState<AutoRunIssueReason | null>(null)
  // Ref to track if autoRunIssue was triggered this survey cycle,
  // so we can suppress the [1] follow-up prompt even after
  // autoRunIssueReason is cleared.
  const didAutoRunIssueRef = useRef(false)

""")
print('d4b ok')
