import os
import shutil

B = '/Users/mant1ssa/Projects/cc-base-2188/'
Q = '/Users/mant1ssa/Projects/cc_reverse/.audit/w65-d4-baks/'


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
    """Delete from `start` through the first `end` at or after it."""
    t = rd(p)
    i = t.index(start)
    j = t.index(end, i) + len(end)
    wr(p, t[:i] + new + t[j:])


# ---- 1. quarantine the baks (two of the ten live files have none) ----
for rel in [
    'components/FeedbackSurvey/FeedbackSurvey.tsx.w54bak',
    'components/FeedbackSurvey/FeedbackSurveyView.tsx.w54bak',
    'components/FeedbackSurvey/TranscriptSharePrompt.tsx.w54bak',
    'components/FeedbackSurvey/useFeedbackSurvey.tsx.w54bak',
    'components/FeedbackSurvey/useMemorySurvey.tsx.w54bak',
    'components/FeedbackSurvey/usePostCompactSurvey.tsx.w54bak',
    'components/FeedbackSurvey/useSurveyState.tsx.w54bak',
]:
    src = B + rel
    if os.path.exists(src):
        dst = Q + rel
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
        assert open(src, 'rb').read() == open(dst, 'rb').read(), rel
        print('quarantined', rel)

# ---- 2. the survey family and the auto-run-/issue helper ----
shutil.rmtree(B + 'components/FeedbackSurvey')
os.remove(B + 'utils/autoRunIssue.tsx')

# ---- 3. rehome the two symbols the skill survey shares with the deleted dir ----
# `FeedbackSurvey/utils.ts` was a reconstruction stub (`any` aliases), so the
# response vocabulary is read off this host's own two users: the view passes
# 'good' | 'dismissed' into onSelect, and the hook tests `!== 'dismissed'`.
S = 'utils/hooks/skillImprovement.ts'
cut(S, """export type SkillUpdate = {""", """/**
 * The skill-improvement survey's answer vocabulary. Rehomed from the deleted
 * `components/FeedbackSurvey/utils.ts`, whose `FeedbackSurveyResponse` was a
 * reconstruction stub with no source body; these two literals are what the
 * survey's own view emits (`SkillImprovementSurvey.tsx:77`) and what the hook
 * tests against (`useSkillImprovementSurvey.ts:58`).
 */
export type SkillSurveyResponse = 'good' | 'dismissed'

export type SkillUpdate = {""")

V = 'components/SkillImprovementSurvey.tsx'
cut(V, """import { isValidResponseInput } from './FeedbackSurvey/FeedbackSurveyView.js'
import type { FeedbackSurveyResponse } from './FeedbackSurvey/utils.js'
""")
cut(V, """import type { SkillUpdate } from '../utils/hooks/skillImprovement.js'
""", """import type {
  SkillSurveyResponse,
  SkillUpdate,
} from '../utils/hooks/skillImprovement.js'
""")
cut(V, "  handleSelect: (selected: FeedbackSurveyResponse) => void", "  handleSelect: (selected: SkillSurveyResponse) => void")
cut(V, "  onSelect: (option: FeedbackSurveyResponse) => void", "  onSelect: (option: SkillSurveyResponse) => void")
cut(V, """// Only 1 (apply) and 0 (dismiss) are valid for this survey
const VALID_INPUTS = ['0', '1'] as const

function isValidInput(input: string): boolean {
""", """// Only 1 (apply) and 0 (dismiss) are valid for this survey
const VALID_INPUTS = ['0', '1'] as const

/**
 * Ported from `components/FeedbackSurvey/FeedbackSurveyView.tsx:13-24` — the
 * digit-input test lifted out with the survey it belonged to. The accepted set
 * is this host's own VALID_INPUTS rather than the source's ['0','1','2','3'],
 * which is the one adaptation: a two-option survey must not accept '2'.
 */
function isValidResponseInput(input: string): input is ResponseInput {
  return (VALID_INPUTS as readonly string[]).includes(input)
}
type ResponseInput = (typeof VALID_INPUTS)[number]

function isValidInput(input: string): boolean {
""")

H = 'hooks/useSkillImprovementSurvey.ts'
cut(H, """import type { FeedbackSurveyResponse } from '../components/FeedbackSurvey/utils.js'
""")
cut(H, """import type { SkillUpdate } from '../utils/hooks/skillImprovement.js'
""", """import type {
  SkillSurveyResponse,
  SkillUpdate,
} from '../utils/hooks/skillImprovement.js'
""")
t = rd(H)
assert t.count('FeedbackSurveyResponse') == 2, t.count('FeedbackSurveyResponse')
wr(H, t.replace('FeedbackSurveyResponse', 'SkillSurveyResponse'))

# ---- 4. the gate, which only the three deleted hooks read ----
C = 'services/analytics/config.ts'
cut(C, """
/**
 * Check if the feedback survey should be suppressed.
 *
 * Unlike isAnalyticsDisabled(), this does NOT block on 3P providers
 * (Bedrock/Vertex/Foundry). The survey is a local UI prompt with no
 * transcript data — enterprise customers capture responses via OTEL.
 */
export function isFeedbackSurveyDisabled(): boolean {
  return process.env.NODE_ENV === 'test' || isTelemetryDisabled()
}
""")

# ---- 5. the two config fields the surveys owned ----
CF = 'utils/config.ts'
cut(CF, '  feedbackSurveyState?: {\n    lastShownTime: number\n  }\n')
cut(CF, '  transcriptShareDismissed?: boolean\n')

# ---- 6. REPL hosts ----
R = 'screens/REPL.tsx'
# 6a. imports
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
# 6b. the always-closed local stub for the ant-only detector
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
# 6c. the survey JSX, from the ternary chain through the frustration prompt
cut_range(
    R,
    "                      {postCompactSurvey.state !== 'closed' ? (\n",
    "                      {/* Skill improvement survey",
    "                      {/* Skill improvement survey",
)
cut(R, """                      {autoRunIssueReason && (
                        <AutoRunIssueNotification
                          onRun={handleAutoRunIssue}
                          onCancel={handleCancelAutoRunIssue}
                          reason={getAutoRunIssueReasonText(autoRunIssueReason)}
                        />
                      )}
""")
# 6d. the four hook calls and the handler the survey's [1] key submits through
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

print('d4a ok')
