"""W65 wave D step 7i part 3: the brief view.

With the tool and the opt-in state gone (`isBriefOnly` is no longer in AppState),
every layout branch keyed off it folds to the plain arm: the spinner wrapper
becomes its own inner component, the chat-style "You"/"Claude" labels and their
queue padding go, and the two theme keys only that layout used go with them.
"""

import os

B = '/Users/mant1ssa/Projects/cc-base-2188/'


def rd(p):
    return open(B + p, encoding='utf-8').read()


def wr(p, t):
    open(B + p, 'w', encoding='utf-8').write(t)


def cut(p, old, new=''):
    t = rd(p)
    c = t.count(old)
    assert c == 1, (p, old[:70], c)
    wr(p, t.replace(old, new))


def cut_all(p, old, new=''):
    t = rd(p)
    c = t.count(old)
    assert c >= 1, (p, old[:70], c)
    wr(p, t.replace(old, new))
    print('  %d x %s' % (c, p))


def drop_lines(p, stripped, new=''):
    t = rd(p)
    out = []
    n = 0
    for line in t.split('\n'):
        if line.strip() == stripped:
            n += 1
            continue
        out.append(line)
    assert n >= 1, (p, stripped[:60], n)
    wr(p, '\n'.join(out))
    print('  %d x %s (%s)' % (n, stripped[:40], p))


def drop_between(p, start_sub, keep_sub, gap=''):
    t = rd(p)
    assert t.count(start_sub) == 1, (p, 'start', start_sub[:60], t.count(start_sub))
    assert t.count(keep_sub) == 1, (p, 'keep', keep_sub[:60], t.count(keep_sub))
    i = t.rindex('\n', 0, t.index(start_sub)) + 1
    k = t.rindex('\n', 0, t.index(keep_sub, i)) + 1
    wr(p, t[:i] + gap + t[k:])
    print('  dropped %d lines from %s' % (t[:k].count('\n') - t[:i].count('\n'), p))


# ================================================================ Spinner.tsx
cut(
    'components/Spinner.tsx',
    """// Thin wrapper: branches on isBriefOnly so the two variants have independent
// hook call chains. Without this split, toggling /brief mid-render would
// violate Rules of Hooks (the inner variant calls ~10 more hooks).
export function SpinnerWithVerb(props: Props): React.ReactNode {
  const isBriefOnly = useAppState(s => s.isBriefOnly)
  // REPL overrides isBriefOnly→false when viewing a teammate transcript
  // (see isBriefOnly={viewedTeammateTask ? false : isBriefOnly}). That
  // prop isn't threaded here, so replicate the gate from the store —
  // teammate view needs the real spinner (which shows teammate status).
  const viewingAgentTaskId = useAppState(s => s.viewingAgentTaskId)
  // Hoisted to mount-time — this component re-renders at animation framerate.
  const briefEnvEnabled =
    feature('KAIROS') || feature('KAIROS_BRIEF')
      ? // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
        useMemo(() => isEnvTruthy(process.env.CLAUDE_CODE_BRIEF), [])
      : false

  // Runtime gate mirrors isBriefEnabled() but inlined — importing from
  // BriefTool.ts would leak tool-name strings into external builds. Single
  // spinner instance → hooks stay unconditional (two subs, negligible).
  if (
    (feature('KAIROS') || feature('KAIROS_BRIEF')) &&
    getUserMsgOptIn() &&
    (briefEnvEnabled ||
      getFeatureValue_CACHED_MAY_BE_STALE('tengu_kairos_brief', false)) &&
    !viewingAgentTaskId
  ) {
    return (
      <BriefSpinner mode={props.mode} overrideMessage={props.overrideMessage} />
    )
  }

  return <SpinnerWithVerbInner {...props} />
}

function SpinnerWithVerbInner({
""",
    """export function SpinnerWithVerb({
""",
)
drop_between(
    'components/Spinner.tsx',
    '// Brief/assistant mode spinner: single status line. PromptInput drops its',
    '// Idle placeholder for brief mode. Same 2-row [blank, content] footprint',
)
drop_between(
    'components/Spinner.tsx',
    '// Idle placeholder for brief mode. Same 2-row [blank, content] footprint',
    'export function Spinner(): React.ReactNode {',
)
cut('components/Spinner.tsx', "import { getUserMsgOptIn } from '../bootstrap/state.js'\n")

# ============================================================== REPL.tsx
cut(
    'screens/REPL.tsx',
    """import {
  SpinnerWithVerb,
  BriefIdleStatus,
  type SpinnerMode,
} from '../components/Spinner.js'
""",
    """import { SpinnerWithVerb, type SpinnerMode } from '../components/Spinner.js'
""",
)
cut(
    'screens/REPL.tsx',
    """  // BriefTool.isEnabled() reads getUserMsgOptIn() from bootstrap state, which
  // /brief flips mid-session alongside isBriefOnly. The memo below needs a
  // React-visible dep to re-run getTools() when that happens; isBriefOnly is
  // the AppState mirror that triggers the re-render. Without this, toggling
  // /brief mid-session leaves the stale tool list (no SendUserMessage) and
  // the model emits plain text the brief filter hides.
  const isBriefOnly = useAppState(s => s.isBriefOnly)

""",
)
cut(
    'screens/REPL.tsx',
    """    // Hide spinner when streaming text is visible (the text IS the feedback),
    // but keep it when isBriefOnly suppresses the streaming text display
    (!visibleStreamingText || isBriefOnly)
""",
    """    // Hide spinner when streaming text is visible (the text IS the feedback)
    !visibleStreamingText
""",
)
cut('screens/REPL.tsx', '                isBriefOnly={viewedAgentTask ? false : isBriefOnly}\n')
cut(
    'screens/REPL.tsx',
    """              {!showSpinner &&
                !isLoading &&
                !userInputOnProcessing &&
                !hasRunningTeammates &&
                isBriefOnly &&
                !viewedAgentTask && <BriefIdleStatus />}
""",
)
cut(
    'screens/REPL.tsx',
    """    [toolPermissionContext, proactiveActive, isBriefOnly],
""",
    """    [toolPermissionContext, proactiveActive],
""",
)

# ======================================================= UserPromptMessage.tsx
cut(
    'components/messages/UserPromptMessage.tsx',
    """import { feature } from 'bun:bundle'
import type { TextBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import React, { useContext, useMemo } from 'react'
import { getUserMsgOptIn } from '../../bootstrap/state.js'
import { Box } from '../../ink.js'
import { getFeatureValue_CACHED_MAY_BE_STALE } from '../../services/analytics/growthbook.js'
import { useAppState } from '../../state/AppState.js'
import { isEnvTruthy } from '../../utils/envUtils.js'
import { logError } from '../../utils/log.js'
""",
    """import type { TextBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import React, { useContext, useMemo } from 'react'
import { Box } from '../../ink.js'
import { logError } from '../../utils/log.js'
""",
)
cut(
    'components/messages/UserPromptMessage.tsx',
    """type Props = {
  addMargin: boolean
  param: TextBlockParam
  isTranscriptMode?: boolean
  timestamp?: string
}
""",
    """type Props = {
  addMargin: boolean
  param: TextBlockParam
  isTranscriptMode?: boolean
}
""",
)
cut(
    'components/messages/UserPromptMessage.tsx',
    """export function UserPromptMessage({
  addMargin,
  param: { text },
  isTranscriptMode,
  timestamp,
}: Props): React.ReactNode {
""",
    """export function UserPromptMessage({
  addMargin,
  param: { text },
  isTranscriptMode,
}: Props): React.ReactNode {
""",
)
drop_between(
    'components/messages/UserPromptMessage.tsx',
    '  // REPL.tsx passes isBriefOnly={viewedTeammateTask ? false : isBriefOnly}',
    '  // Truncate before the early return so the hook order is stable.',
)
cut(
    'components/messages/UserPromptMessage.tsx',
    """      backgroundColor={
        isSelected
          ? 'messageActionsBackground'
          : useBriefLayout
            ? undefined
            : 'userMessageBackground'
      }
      paddingRight={useBriefLayout ? 0 : 1}
    >
      <HighlightedThinkingText
        text={displayText}
        useBriefLayout={useBriefLayout}
        timestamp={useBriefLayout ? timestamp : undefined}
      />
""",
    """      backgroundColor={
        isSelected ? 'messageActionsBackground' : 'userMessageBackground'
      }
      paddingRight={1}
    >
      <HighlightedThinkingText text={displayText} />
""",
)

# ======================================================= HighlightedThinkingText
cut(
    'components/messages/HighlightedThinkingText.tsx',
    """import { formatBriefTimestamp } from '../../utils/formatBriefTimestamp.js'
""",
)
cut(
    'components/messages/HighlightedThinkingText.tsx',
    """type Props = {
  text: string
  useBriefLayout?: boolean
  timestamp?: string
}

export function HighlightedThinkingText({
  text,
  useBriefLayout,
  timestamp,
}: Props): React.ReactNode {
  // Brief/assistant mode: chat-style "You" label instead of the ❯ highlight.
  // Parent drops its backgroundColor when this is true, so no grey shows
  // through. No manual wrap needed — Ink wraps inside the parent Box.
  const isQueued = useQueuedMessage()?.isQueued ?? false
  const isSelected = useContext(MessageActionsSelectedContext)
  const pointerColor = isSelected ? 'suggestion' : 'subtle'
  if (useBriefLayout) {
    const ts = timestamp ? formatBriefTimestamp(timestamp) : ''
    return (
      <Box flexDirection="column" paddingLeft={2}>
        <Box flexDirection="row">
          <Text color={isQueued ? 'subtle' : 'briefLabelYou'}>You</Text>
          {ts ? <Text dimColor> {ts}</Text> : null}
        </Box>
        <Text color={isQueued ? 'subtle' : 'text'}>{text}</Text>
      </Box>
    )
  }

  const triggers = isUltrathinkEnabled()
""",
    """type Props = {
  text: string
}

export function HighlightedThinkingText({ text }: Props): React.ReactNode {
  const isQueued = useQueuedMessage()?.isQueued ?? false
  const isSelected = useContext(MessageActionsSelectedContext)
  const pointerColor = isSelected ? 'suggestion' : 'subtle'

  const triggers = isUltrathinkEnabled()
""",
)

# ========================================================= QueuedMessageContext
cut(
    'context/QueuedMessageContext.tsx',
    """type Props = {
  isFirst: boolean
  useBriefLayout?: boolean
  children: React.ReactNode
}

export function QueuedMessageProvider({
  isFirst,
  useBriefLayout,
  children,
}: Props): React.ReactNode {
  // Brief mode already indents via paddingLeft in HighlightedThinkingText /
  // BriefTool UI — adding paddingX here would double-indent the queue.
  const padding = useBriefLayout ? 0 : PADDING_X
""",
    """type Props = {
  isFirst: boolean
  children: React.ReactNode
}

export function QueuedMessageProvider({
  isFirst,
  children,
}: Props): React.ReactNode {
  const padding = PADDING_X
""",
)

# ================================================== PromptInputQueuedCommands.tsx
cut(
    'components/PromptInput/PromptInputQueuedCommands.tsx',
    """  // Brief layout: dim queue items + skip the paddingX (brief messages
  // already indent themselves). Gate mirrors the brief-spinner/message
  // check elsewhere — no teammate-view override needed since this
  // component early-returns when viewing a teammate.
  const useBriefLayout =
    feature('KAIROS') || feature('KAIROS_BRIEF')
      ? // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
        useAppState(s => s.isBriefOnly)
      : false

""",
)
cut(
    'components/PromptInput/PromptInputQueuedCommands.tsx',
    """        <QueuedMessageProvider
          key={i}
          isFirst={i === 0}
          useBriefLayout={useBriefLayout}
        >
""",
    """        <QueuedMessageProvider key={i} isFirst={i === 0}>
""",
)

# ==================================================== PromptInput.tsx
cut(
    'components/PromptInput/PromptInput.tsx',
    """  // Brief mode: BriefSpinner/BriefIdleStatus own the 2-row footprint above
  // the input. Dropping marginTop here lets the spinner sit flush against
  // the input bar. viewingAgentTaskId mirrors the gate on both (Spinner.tsx,
  // REPL.tsx) — teammate view falls back to SpinnerWithVerbInner which has
  // its own marginTop, so the gap stays even without ours.
  const briefOwnsGap =
    feature('KAIROS') || feature('KAIROS_BRIEF')
      ? // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
        useAppState(s => s.isBriefOnly) && !viewingAgentTaskId
      : false
""",
)
cut(
    'components/PromptInput/PromptInput.tsx',
    """        // position=absolute takes zero layout height so the spinner
        // doesn't shift when a notification appears/disappears. Yoga
        // anchors absolute children at the parent's content-box origin;
        // marginTop=-1 pulls it into the marginTop=1 gap row above the
        // prompt border. In brief mode there is no such gap (briefOwnsGap
        // strips our marginTop) and BriefSpinner sits flush against the
        // border — marginTop=-2 skips over the spinner content into
        // BriefSpinner's own marginTop=1 blank row. height=1 +
""",
    """        // position=absolute takes zero layout height so the spinner
        // doesn't shift when a notification appears/disappears. Yoga
        // anchors absolute children at the parent's content-box origin;
        // marginTop=-1 pulls it into the marginTop=1 gap row above the
        // prompt border. height=1 +
""",
)
cut(
    'components/PromptInput/PromptInput.tsx',
    """          marginTop={briefOwnsGap ? -2 : -1}
""",
    """          marginTop={-1}
""",
)

# ============================================================ Notifications.tsx
cut(
    'components/PromptInput/Notifications.tsx',
    """  const isBriefOnly =
    feature('KAIROS') || feature('KAIROS_BRIEF')
      ? // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
        useAppState(s => s.isBriefOnly)
      : false
""",
)
cut(
    'components/PromptInput/Notifications.tsx',
    """      {!isBriefOnly && (
        <TokenWarning tokenUsage={tokenUsage} model={mainLoopModel} />
      )}
""",
    """      <TokenWarning tokenUsage={tokenUsage} model={mainLoopModel} />
""",
)

# ================================================================ Messages.tsx
cut(
    'components/Messages.tsx',
    """  /** When true, only show Brief tool output (hide everything else) */
  isBriefOnly?: boolean
""",
)
cut('components/Messages.tsx', '  isBriefOnly = false,\n')
cut(
    'components/Messages.tsx',
    """      {streamingText && !isBriefOnly && (
""",
    """      {streamingText && (
""",
)
cut(
    'components/Messages.tsx',
    """      {isStreamingThinkingVisible && streamingThinking && !isBriefOnly && (
""",
    """      {isStreamingThinkingVisible && streamingThinking && (
""",
)

# ================================================== the brief label theme keys
cut(
    'utils/theme.ts',
    """  // Brief/assistant mode label colors
  briefLabelYou: string
  briefLabelClaude: string
""",
)
for line in [
    "briefLabelYou: 'rgb(37,99,235)', // Blue",
    "briefLabelYou: 'ansi:blue',",
    "briefLabelYou: 'ansi:blueBright',",
    "briefLabelYou: 'rgb(122,180,232)', // Light blue",
    "briefLabelClaude: 'rgb(215,119,87)', // Brand orange",
    "briefLabelClaude: 'ansi:redBright',",
    "briefLabelClaude: 'rgb(255,153,51)', // Orange adjusted for deuteranopia (matches claude)",
]:
    drop_lines('utils/theme.ts', line)

# ================================================= the timestamp formatter
os.remove(B + 'utils/formatBriefTimestamp.ts')
print('  deleted utils/formatBriefTimestamp.ts')

print('d7i3 ok')
