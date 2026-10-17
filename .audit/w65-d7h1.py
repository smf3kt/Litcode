"""W65 wave D step 7h part 1: assistant mode's own state.

`setKairosActive` has no caller anywhere in the build (only the import in
main.tsx), and main.tsx's `let kairosEnabled = false` is never reassigned, so
the bootstrap `kairosActive` bit and the AppState `kairosEnabled` field are
permanently false. Every read of either is therefore a constant fold: the
`feature('KAIROS')`-guarded blocks drop out entirely, the `||` terms added to a
runtime expression drop as single terms, and the two accessors go with their
last reader.
"""

B = '/Users/mant1ssa/Projects/cc-base-2188/'


def rd(p):
    return open(B + p, encoding='utf-8').read()


def wr(p, t):
    open(B + p, 'w', encoding='utf-8').write(t)


def cut(p, old, new=''):
    """Replace one exact occurrence; the anchor must be unique and present."""
    t = rd(p)
    c = t.count(old)
    assert c == 1, (p, old[:70], c)
    wr(p, t.replace(old, new))


def cut_all(p, old, new=''):
    """Replace every occurrence; prints how many were removed."""
    t = rd(p)
    c = t.count(old)
    assert c >= 1, (p, old[:70], c)
    wr(p, t.replace(old, new))
    print('  %d x %s' % (c, p))


def drop(p, start_sub, end_sub, new=''):
    """Delete from the line holding start_sub through the line holding the
    first end_sub after it (inclusive), and write `new` in its place."""
    t = rd(p)
    c = t.count(start_sub)
    assert c == 1, (p, 'start', start_sub[:70], c)
    i = t.rindex('\n', 0, t.index(start_sub)) + 1
    k = t.index(end_sub, i)
    assert k > i, (p, 'end', end_sub[:70])
    k = t.index('\n', k + len(end_sub)) + 1
    wr(p, t[:i] + new + t[k:])
    print('  dropped %d lines from %s' % (t[:k].count('\n') - t[:i].count('\n'), p))


def drop_between(p, start_sub, keep_sub, gap=''):
    """Delete from the line holding start_sub up to (not including) the line
    holding keep_sub."""
    t = rd(p)
    assert t.count(start_sub) == 1, (p, 'start', start_sub[:70], t.count(start_sub))
    assert t.count(keep_sub) == 1, (p, 'keep', keep_sub[:70], t.count(keep_sub))
    i = t.rindex('\n', 0, t.index(start_sub)) + 1
    k = t.rindex('\n', 0, t.index(keep_sub, i)) + 1
    wr(p, t[:i] + gap + t[k:])
    print('  dropped %d lines from %s' % (t[:k].count('\n') - t[:i].count('\n'), p))


# ==================================================================== main.tsx
cut('main.tsx', '  setKairosActive,\n')
drop(
    'main.tsx',
    '// Dead code elimination: conditional import for KAIROS (assistant mode)',
    '/* eslint-enable @typescript-eslint/no-require-imports */',
)
drop_between(
    'main.tsx',
    '      let kairosEnabled = false',
    '      const {\n        debug = false,',
    gap='\n',
)
drop(
    'main.tsx',
    "          // kairosEnabled gates the async fire-and-forget path in",
    "          ...(feature('KAIROS') ? { kairosEnabled } : {}),",
)
cut(
    'main.tsx',
    'const fullRemoteControl = getRemoteControlAtStartup() || kairosEnabled',
    'const fullRemoteControl = getRemoteControlAtStartup()',
)
cut('main.tsx', '        kairosEnabled,\n')
drop(
    'main.tsx',
    '        // Compute teamContext synchronously to avoid useEffect setState during render.',
    '          : computeInitialTeamContext?.(),',
    new='        teamContext: computeInitialTeamContext?.(),\n',
)
cut(
    'main.tsx',
    """  if (feature('KAIROS')) {
    program.addOption(
      new Option(
        '--assistant',
        'Force assistant mode (Agent SDK daemon use)',
      ).hideHelp(),
    )
  }
""",
)

# ============================================================ bootstrap/state.ts
cut('bootstrap/state.ts', '  kairosActive: boolean\n')
cut('bootstrap/state.ts', '    kairosActive: false,\n')
cut(
    'bootstrap/state.ts',
    """export function getKairosActive(): boolean {
  return STATE.kairosActive
}

export function setKairosActive(value: boolean): void {
  STATE.kairosActive = value
}

""",
)

# ========================================================= state/AppStateStore.ts
cut(
    'state/AppStateStore.ts',
    """  // Assistant mode fully enabled (settings + GrowthBook gate + trust).
  // Single source of truth - computed once in main.tsx before option
  // mutation, consumers read this instead of re-calling isAssistantMode().
  kairosEnabled: boolean
""",
)
cut('state/AppStateStore.ts', '    kairosEnabled: false,\n')

# ============================================ the ten remaining readers of the bit
cut(
    'services/autoDream/autoDream.ts',
    '  if (getKairosActive()) return false // KAIROS mode uses disk-skill dream\n',
)
cut('services/autoDream/autoDream.ts', '  getKairosActive,\n')

cut(
    'memdir/memdir.ts',
    """  // KAIROS daily-log mode takes precedence over TEAMMEM: the append-only
  // log paradigm does not compose with team sync (which expects a shared
  // MEMORY.md that both sides read + write). Gating on `autoEnabled` here
  // means the !autoEnabled case falls through to the tengu_memdir_disabled
  // telemetry block below, matching the non-KAIROS path.
  if (feature('KAIROS') && autoEnabled && getKairosActive()) {
    logMemoryDirCounts(getAutoMemPath(), {
      memory_type:
        'auto' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    return buildAssistantDailyLogPrompt(skipIndex)
  }

""",
)
cut('memdir/memdir.ts', "import { getKairosActive, getOriginalCwd } from '../bootstrap/state.js'\n",
    "import { getOriginalCwd } from '../bootstrap/state.js'\n")

cut(
    'utils/fastMode.ts',
    """  // Assistant daemon mode is exempt — it's first-party orchestration, and
  // kairosActive is set before this check runs (main.tsx:~1626 vs ~3249).
""",
)
cut(
    'utils/fastMode.ts',
    """    getIsNonInteractiveSession() &&
    preferThirdPartyAuthentication() &&
    !getKairosActive()
""",
    """    getIsNonInteractiveSession() &&
    preferThirdPartyAuthentication()
""",
)
cut('utils/fastMode.ts', '  getKairosActive,\n')

cut(
    'components/StatusLine.tsx',
    """  // Assistant mode: statusline fields (model, permission mode, cwd) reflect the
  // REPL/daemon process, not what the agent child is actually running. Hide it.
  if (feature('KAIROS') && getKairosActive()) return false
""",
)
cut('components/StatusLine.tsx', '  getKairosActive,\n')

# The `||` terms: each drops out of the runtime expression on its own.
drop(
    'components/Spinner.tsx',
    '    (getKairosActive() ||',
    '    !viewingAgentTaskId',
    new="""    getUserMsgOptIn() &&
    (briefEnvEnabled ||
      getFeatureValue_CACHED_MAY_BE_STALE('tengu_kairos_brief', false)) &&
""",
)
cut('components/Spinner.tsx', "import { getKairosActive, getUserMsgOptIn } from '../bootstrap/state.js'\n",
    "import { getUserMsgOptIn } from '../bootstrap/state.js'\n")

drop(
    'components/messages/UserPromptMessage.tsx',
    '      ? (getKairosActive() ||',
    '        !viewingAgentTaskId',
    new="""      ? getUserMsgOptIn() &&
        (briefEnvEnabled ||
          getFeatureValue_CACHED_MAY_BE_STALE(
            'tengu_kairos_brief',
            false,
          )) &&
        isBriefOnly &&
        !isTranscriptMode &&
""",
)
cut(
    'components/messages/UserPromptMessage.tsx',
    "import { getKairosActive, getUserMsgOptIn } from '../../bootstrap/state.js'\n",
    "import { getUserMsgOptIn } from '../../bootstrap/state.js'\n",
)

cut(
    'tools/BriefTool/BriefTool.ts',
    """    ? getKairosActive() ||
        isEnvTruthy(process.env.CLAUDE_CODE_BRIEF) ||
""",
    """    ? isEnvTruthy(process.env.CLAUDE_CODE_BRIEF) ||
""",
)
cut(
    'tools/BriefTool/BriefTool.ts',
    '    ? (getKairosActive() || getUserMsgOptIn()) && isBriefEntitled()\n',
    '    ? getUserMsgOptIn() && isBriefEntitled()\n',
)
cut(
    'tools/BriefTool/BriefTool.ts',
    """ * Assistant mode (kairosActive) bypasses opt-in since its system prompt
 * hard-codes "you MUST use SendUserMessage" (systemPrompt.md:14).
 *
""",
)
cut(
    'tools/BriefTool/BriefTool.ts',
    """ * getKairosActive() and getUserMsgOptIn() are set in main.tsx before any
 * caller reaches here.
""",
    """ * getUserMsgOptIn() is set in main.tsx before any caller reaches here.
""",
)
cut('tools/BriefTool/BriefTool.ts',
    "import { getKairosActive, getUserMsgOptIn } from '../../bootstrap/state.js'\n",
    "import { getUserMsgOptIn } from '../../bootstrap/state.js'\n")

cut(
    'services/compact/compact.ts',
    """/* eslint-disable @typescript-eslint/no-require-imports */
const sessionTranscriptModule = feature('KAIROS')
  ? null
  : null

""",
)
cut('services/compact/compact.ts', '/* eslint-enable @typescript-eslint/no-require-imports */\n')
cut(
    'services/compact/compact.ts',
    """    // Write a reduced transcript segment for the pre-compaction messages
    // (assistant mode only). Fire-and-forget — errors are logged internally.
    if (feature('KAIROS')) {
      void sessionTranscriptModule?.writeSessionTranscriptSegment(messages)
    }

""",
)
cut(
    'services/compact/compact.ts',
    """    if (feature('KAIROS')) {
      void sessionTranscriptModule?.writeSessionTranscriptSegment(
        messagesToSummarize,
      )
    }

""",
)

cut(
    'utils/attachments.ts',
    """const sessionTranscriptModule = feature('KAIROS')
  ? null
  : null
""",
)
cut(
    'utils/attachments.ts',
    """  // Assistant mode: flush yesterday's transcript to the per-day file so
  // the /dream skill (1–5am local) finds it even if no compaction fires
  // today. Fire-and-forget; writeSessionTranscriptSegment buckets by
  // message timestamp so a multi-day gap flushes each day correctly.
  if (feature('KAIROS')) {
    if (getKairosActive() && messages !== undefined) {
      sessionTranscriptModule?.flushOnDateChange(messages, currentDate)
    }
  }

""",
)
cut('utils/attachments.ts', '  getKairosActive,\n')

# ================================================ the scheduler's assistantMode
cut(
    'screens/REPL.tsx',
    """    // Assistant mode bypasses the isLoading gate (the proactive tick →
    // Sleep → tick loop would otherwise starve the scheduler).
    // kairosEnabled is set once in initialState (main.tsx) and never mutated — no
    // subscription needed. The tengu_kairos_cron runtime gate is checked inside
    // useScheduledTasks's effect (not here) since wrapping a hook call in a dynamic
    // condition would break rules-of-hooks.
    const assistantMode = store.getState().kairosEnabled
""",
)
cut(
    'screens/REPL.tsx',
    '    useScheduledTasks!({ isLoading, assistantMode, setMessages })\n',
    '    useScheduledTasks!({ isLoading, setMessages })\n',
)
cut(
    'hooks/useScheduledTasks.ts',
    """  /**
   * When true, bypasses the isLoading gate so tasks can enqueue while a
   * query is streaming rather than deferring to the next 1s check tick
   * after the turn ends. Assistant mode no longer forces --proactive
   * (#20425) so isLoading drops between turns like a normal REPL — this
   * bypass is now a latency nicety, not a starvation fix. The prompt is
   * enqueued at 'later' priority either way and drains between turns.
   */
  assistantMode?: boolean
""",
)
cut('hooks/useScheduledTasks.ts', '  assistantMode = false,\n')
cut(
    'hooks/useScheduledTasks.ts',
    """    // effect won't re-run on value flip (assistantMode is the only dep),
""",
    """    // effect won't re-run on value flip,
""",
)
cut('hooks/useScheduledTasks.ts', '      assistantMode,\n')
cut(
    'hooks/useScheduledTasks.ts',
    """    // assistantMode is stable for the session lifetime; store/setAppState are
    // stable refs from useSyncExternalStore; setMessages is a stable useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantMode])
""",
    """    // store/setAppState are stable refs from useSyncExternalStore; setMessages
    // is a stable useCallback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
""",
)

drop(
    'utils/cronScheduler.ts',
    '   * auto-enable is the load-bearing part — assistant mode has tasks in',
    '  assistantMode?: boolean',
)
cut('utils/cronScheduler.ts', '    assistantMode = false,\n')
cut(
    'utils/cronScheduler.ts',
    """    if (isLoading() && !assistantMode) return
""",
    """    if (isLoading()) return
""",
)
cut(
    'utils/cronScheduler.ts',
    """      if (
        !getScheduledTasksEnabled() &&
        (assistantMode || hasCronTasksSync())
      ) {
""",
    """      if (!getScheduledTasksEnabled() && hasCronTasksSync()) {
""",
)
cut(
    'tools/ScheduleCronTool/prompt.ts',
    """ * graph (cronScheduler/cronTasks/cronTasksLock/cron.ts + the three tools +
 * /loop skill) has zero imports into src/assistant/ and no feature('KAIROS')
 * calls. The REPL.tsx kairosEnabled read is safe:
 * kairosEnabled is unconditionally in AppStateStore with default false, so
 * when KAIROS is off the scheduler just gets assistantMode: false.
 *
""",
    """ * graph (cronScheduler/cronTasks/cronTasksLock/cron.ts + the three tools +
 * /loop skill) has zero imports into src/assistant/ and no feature('KAIROS')
 * calls.
 *
""",
)

# ============================================================ AgentTool's two
cut(
    'tools/AgentTool/AgentTool.tsx',
    """  const schema = feature('KAIROS')
    ? fullInputSchema()
    : fullInputSchema().omit({ cwd: true })
""",
    """  const schema = fullInputSchema().omit({ cwd: true })
""",
)
cut(
    'tools/AgentTool/AgentTool.tsx',
    """    // Assistant mode: force all agents async. Synchronous subagents hold the
    // main loop's turn open until they complete — the daemon's inputQueue
    // backs up, and the first overdue cron catch-up on spawn becomes N
    // serial subagent turns blocking all user input. Same gate as
    // executeForkedSlashCommand's fire-and-forget path; the
    // <task-notification> re-entry there is handled by the else branch
    // below (registerAsyncAgentTask + notifyOnCompletion).
    const assistantForceAsync = feature('KAIROS')
      ? appState.kairosEnabled
      : false

""",
)
cut('tools/AgentTool/AgentTool.tsx', '        assistantForceAsync ||\n')

# ============================================== processSlashCommand's fire-and-forget
drop(
    'utils/processUserInput/processSlashCommand.tsx',
    '  // Assistant mode: fire-and-forget. Launch subagent in background, return',
    '    return { messages: [], shouldQuery: false, command }',
)
cut(
    'utils/processUserInput/processSlashCommand.tsx',
    '  }\n\n  // Collect messages from the forked agent\n',
    '  // Collect messages from the forked agent\n',
)

# ================================================= settings keys and the dream skill
cut(
    'utils/settings/types.ts',
    """      ...(feature('KAIROS')
        ? {
            assistant: z
              .boolean()
              .optional()
              .describe(
                'Start Claude in assistant mode (custom system prompt, brief view, scheduled check-in skills)',
              ),
            assistantName: z
              .string()
              .optional()
              .describe(
                'Display name for the assistant, shown in the claude.ai session list',
              ),
          }
        : {}),
""",
)
cut(
    'skills/bundled/index.ts',
    """  if (feature('KAIROS') || feature('KAIROS_DREAM')) {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { registerDreamSkill } = require('./dream.js')
    /* eslint-enable @typescript-eslint/no-require-imports */
    registerDreamSkill()
  }
""",
)

print('d7h1 ok')
