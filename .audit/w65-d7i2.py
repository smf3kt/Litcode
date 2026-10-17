"""W65 wave D step 7i part 2: the opt-in state and the startup paths that set it.

`userMsgOptIn` existed only to gate the brief tool's `isEnabled()`; with the
tool gone every setter and reader goes, and so does the AppState `isBriefOnly`
mirror that drove the brief view. The three startup opt-in paths (`--tools`
listing, `--brief`, `defaultView: 'chat'`) and the /config picker that wrote the
last one are the flag-gated false arms.
"""

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


# ============================================================ bootstrap/state.ts
cut('bootstrap/state.ts', '  userMsgOptIn: boolean\n')
cut('bootstrap/state.ts', '    userMsgOptIn: false,\n')
cut(
    'bootstrap/state.ts',
    """// Field name 'userMsgOptIn' avoids excluded-string substrings ('BriefTool',
// 'SendUserMessage' — case-insensitive). All callers are inside feature()
// guards so these accessors don't need their own.
export function getUserMsgOptIn(): boolean {
  return STATE.userMsgOptIn
}

export function setUserMsgOptIn(value: boolean): void {
  STATE.userMsgOptIn = value
}

""",
)

# ========================================================= state/AppStateStore.ts
cut('state/AppStateStore.ts', '  isBriefOnly: boolean\n')
cut('state/AppStateStore.ts', '    isBriefOnly: false,\n')

# ======================================================= the tool render option
cut('Tool.ts', '      isBriefOnly?: boolean\n')
cut(
    'components/messages/UserToolResultMessage/UserToolSuccessMessage.tsx',
    """  // Hook stays inside feature() ternary so external builds don't pay a
  // per-scrollback-message store subscription — same pattern as
  // UserPromptMessage.tsx.
  const isBriefOnly =
    feature('KAIROS') || feature('KAIROS_BRIEF')
      ? // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
        useAppState(s => s.isBriefOnly)
      : false

""",
)
cut(
    'components/messages/UserToolResultMessage/UserToolSuccessMessage.tsx',
    '        isBriefOnly,\n',
)

# ==================================================== settings: the view picker
cut(
    'utils/settings/types.ts',
    """      ...(feature('KAIROS') || feature('KAIROS_BRIEF')
        ? {
            defaultView: z
              .enum(['chat', 'transcript'])
              .optional()
              .describe(
                'Default transcript view: chat (SendUserMessage checkpoints only) or transcript (full)',
              ),
          }
        : {}),
""",
)

# ================================================================ main.tsx
cut('main.tsx', '  getUserMsgOptIn,\n')
cut('main.tsx', '  setUserMsgOptIn,\n')

# the --tools opt-in path
cut(
    'main.tsx',
    """      // SDK opt-in for SendUserMessage via --tools. All sessions require
      // explicit opt-in; listing it in --tools signals intent. Runs BEFORE
      // initializeToolPermissionContext so getToolsForDefaultPreset() sees
      // the tool as enabled when computing the base-tools disallow filter.
      // Conditional require avoids leaking the tool-name string into
      // external builds.
      if (
        (feature('KAIROS') || feature('KAIROS_BRIEF')) &&
        baseTools.length > 0
      ) {
        /* eslint-disable @typescript-eslint/no-require-imports */
        const { BRIEF_TOOL_NAME, LEGACY_BRIEF_TOOL_NAME } =
          require('./tools/BriefTool/prompt.js') as typeof import('./tools/BriefTool/prompt.js')
        const { isBriefEntitled } =
          require('./tools/BriefTool/BriefTool.js') as typeof import('./tools/BriefTool/BriefTool.js')
        /* eslint-enable @typescript-eslint/no-require-imports */
        const parsed = parseToolListFromCLI(baseTools)
        if (
          (parsed.includes(BRIEF_TOOL_NAME) ||
            parsed.includes(LEGACY_BRIEF_TOOL_NAME)) &&
          isBriefEntitled()
        ) {
          setUserMsgOptIn(true)
        }
      }

""",
)

# the defaultView opt-in path and the call beside it
cut(
    'main.tsx',
    """      maybeActivateBrief(options)
      // defaultView: 'chat' is a persisted opt-in — check entitlement and set
      // userMsgOptIn so the tool + prompt section activate. Interactive-only:
      // defaultView is a display preference; SDK sessions have no display, and
      // the assistant installer writes defaultView:'chat' to settings.local.json
      // which would otherwise leak into --print sessions in the same directory.
      // Runs right after maybeActivateBrief() so all startup opt-in paths fire
      // BEFORE any isBriefEnabled() read below (proactive prompt's
      // briefVisibility). A persisted 'chat' after a GB kill-switch falls
      // through (entitlement fails).
      if (
        (feature('KAIROS') || feature('KAIROS_BRIEF')) &&
        !getIsNonInteractiveSession() &&
        !getUserMsgOptIn() &&
        getInitialSettings().defaultView === 'chat'
      ) {
        /* eslint-disable @typescript-eslint/no-require-imports */
        const { isBriefEntitled } =
          require('./tools/BriefTool/BriefTool.js') as typeof import('./tools/BriefTool/BriefTool.js')
        /* eslint-enable @typescript-eslint/no-require-imports */
        if (isBriefEntitled()) {
          setUserMsgOptIn(true)
        }
      }
""",
)

# the other three maybeActivateBrief call sites
drop_lines('main.tsx', 'maybeActivateBrief(options)')

# the proactive prompt's brief visibility
cut(
    'main.tsx',
    """        /* eslint-disable @typescript-eslint/no-require-imports */
        const briefVisibility =
          feature('KAIROS') || feature('KAIROS_BRIEF')
            ? (
                require('./tools/BriefTool/BriefTool.js') as typeof import('./tools/BriefTool/BriefTool.js')
              ).isBriefEnabled()
              ? 'Call SendUserMessage at checkpoints to mark where things stand.'
              : 'The user will see any text you output.'
            : 'The user will see any text you output.'
        /* eslint-enable @typescript-eslint/no-require-imports */
        const proactivePrompt = `\\n# Proactive Mode\\n\\nYou are in proactive mode. Take initiative — explore, act, and make progress without waiting for instructions.\\n\\nStart by briefly greeting the user.\\n\\nYou will receive periodic <tick> prompts. These are check-ins. Do whatever seems most useful, or call Sleep if there's nothing to do. ${briefVisibility}`
""",
    """        const proactivePrompt = `\\n# Proactive Mode\\n\\nYou are in proactive mode. Take initiative — explore, act, and make progress without waiting for instructions.\\n\\nStart by briefly greeting the user.\\n\\nYou will receive periodic <tick> prompts. These are check-ins. Do whatever seems most useful, or call Sleep if there's nothing to do. The user will see any text you output.`
""",
)

# the initial AppState field
cut(
    'main.tsx',
    """      // All startup opt-in paths (--tools, --brief, defaultView) have fired
      // above; initialIsBriefOnly just reads the resulting state.
      const initialIsBriefOnly =
        feature('KAIROS') || feature('KAIROS_BRIEF') ? getUserMsgOptIn() : false
""",
)
cut('main.tsx', '        isBriefOnly: initialIsBriefOnly,\n')

# the --brief option
cut(
    'main.tsx',
    """  if (feature('KAIROS') || feature('KAIROS_BRIEF')) {
    program.addOption(
      new Option(
        '--brief',
        'Enable SendUserMessage tool for agent-to-user communication',
      ),
    )
  }
""",
)

# the activation function itself
cut(
    'main.tsx',
    """function maybeActivateBrief(options: unknown): void {
  if (!(feature('KAIROS') || feature('KAIROS_BRIEF'))) return
  const briefFlag = (options as { brief?: boolean }).brief
  const briefEnv = isEnvTruthy(process.env.CLAUDE_CODE_BRIEF)
  if (!briefFlag && !briefEnv) return
  // --brief / CLAUDE_CODE_BRIEF are explicit opt-ins: check entitlement,
  // then set userMsgOptIn to activate the tool + prompt section. The env
  // var also grants entitlement (isBriefEntitled() reads it), so setting
  // CLAUDE_CODE_BRIEF=1 alone force-enables for dev/testing — no GB gate
  // needed. initialIsBriefOnly reads getUserMsgOptIn() directly.
  // Conditional require: static import would leak the tool name string
  // into external builds via BriefTool.ts → prompt.ts.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const { isBriefEntitled } =
    require('./tools/BriefTool/BriefTool.js') as typeof import('./tools/BriefTool/BriefTool.js')
  /* eslint-enable @typescript-eslint/no-require-imports */
  const entitled = isBriefEntitled()
  if (entitled) {
    setUserMsgOptIn(true)
  }
  // Fire unconditionally once intent is seen: enabled=false captures the
  // "user tried but was gated" failure mode.
  logEvent('tengu_brief_mode_enabled', {
    enabled: entitled,
    gated: !entitled,
    source: (briefEnv
      ? 'env'
      : 'flag') as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
  })
}

""",
)

# ============================================================ Settings/Config.tsx
cut(
    'components/Settings/Config.tsx',
    "import { getUserMsgOptIn, setUserMsgOptIn } from '../../bootstrap/state.js'\n",
)
cut(
    'components/Settings/Config.tsx',
    """  // Chat/Transcript view picker is visible to entitled users (pass the GB
  // gate) even if they haven't opted in this session — it IS the persistent
  // opt-in. 'chat' written here is read at next startup by main.tsx which
  // sets userMsgOptIn if still entitled.
  /* eslint-disable @typescript-eslint/no-require-imports */
  const showDefaultViewPicker =
    feature('KAIROS') || feature('KAIROS_BRIEF')
      ? (
          require('../../tools/BriefTool/BriefTool.js') as typeof import('../../tools/BriefTool/BriefTool.js')
        ).isBriefEntitled()
      : false
  /* eslint-enable @typescript-eslint/no-require-imports */
""",
)
cut('components/Settings/Config.tsx', '      isBriefOnly: s.isBriefOnly,\n')
cut('components/Settings/Config.tsx', '      isBriefOnly: ia.isBriefOnly,\n')
cut(
    'components/Settings/Config.tsx',
    """  // Bootstrap state snapshot — userMsgOptIn is outside AppState, so
  // revertChanges needs to restore it separately. Without this, cycling
  // defaultView to 'chat' then Escape leaves the tool active while the
  // display filter reverts — the exact ambient-activation behavior this
  // PR's entitlement/opt-in split is meant to prevent.
  const [initialUserMsgOptIn] = useState(() => getUserMsgOptIn())
""",
)
cut(
    'components/Settings/Config.tsx',
    """    // Bootstrap state: restore userMsgOptIn. Only touched by the defaultView
    // onChange above, so no feature() guard needed here (that path only
    // exists when showDefaultViewPicker is true).
    if (getUserMsgOptIn() !== initialUserMsgOptIn) {
      setUserMsgOptIn(initialUserMsgOptIn)
    }
""",
)
cut('components/Settings/Config.tsx', '    initialUserMsgOptIn,\n')
drop_between(
    'components/Settings/Config.tsx',
    '    ...(showDefaultViewPicker',
    '    {\n      id: \'language\',',
)

# ============================================================== the keybindings
cut(
    'keybindings/defaultBindings.ts',
    """      ...(feature('KAIROS') || feature('KAIROS_BRIEF')
        ? { 'ctrl+shift+b': 'app:toggleBrief' as const }
        : {}),
""",
)
cut(
    'hooks/useGlobalKeybindings.tsx',
    """  // Toggle transcript mode (ctrl+o). Two-way prompt ↔ transcript.
  // Brief view has its own dedicated toggle on ctrl+shift+b.
  const isBriefOnly =
    feature('KAIROS') || feature('KAIROS_BRIEF')
      ? // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
        useAppState(s => s.isBriefOnly)
      : false
""",
    """  // Toggle transcript mode (ctrl+o). Two-way prompt ↔ transcript.
""",
)
cut(
    'hooks/useGlobalKeybindings.tsx',
    """  const handleToggleTranscript = useCallback(() => {
    if (feature('KAIROS') || feature('KAIROS_BRIEF')) {
      // Escape hatch: GB kill-switch while defaultView=chat was persisted
      // can leave isBriefOnly stuck on, showing a blank filterForBriefTool
      // view. Users will reach for ctrl+o — clear the stuck state first.
      // Only needed in the prompt screen — transcript mode already ignores
      // isBriefOnly (Messages.tsx filter is gated on !isTranscriptMode).
      /* eslint-disable @typescript-eslint/no-require-imports */
      const { isBriefEnabled } =
        require('../tools/BriefTool/BriefTool.js') as typeof import('../tools/BriefTool/BriefTool.js')
      /* eslint-enable @typescript-eslint/no-require-imports */
      if (!isBriefEnabled() && isBriefOnly && screen !== 'transcript') {
        setAppState(prev => {
          if (!prev.isBriefOnly) return prev
          return { ...prev, isBriefOnly: false }
        })
        return
      }
    }

    const isEnteringTranscript = screen !== 'transcript'
""",
    """  const handleToggleTranscript = useCallback(() => {
    const isEnteringTranscript = screen !== 'transcript'
""",
)
cut('hooks/useGlobalKeybindings.tsx', '    isBriefOnly,\n')
cut(
    'hooks/useGlobalKeybindings.tsx',
    """
  // Toggle brief-only view (ctrl+shift+b). Pure display filter toggle —
  // does not touch opt-in state. Asymmetric gate (mirrors /brief): OFF
  // transition always allowed so the same key that got you in gets you
  // out even if the GB kill-switch fires mid-session.
  const handleToggleBrief = useCallback(() => {
    if (feature('KAIROS') || feature('KAIROS_BRIEF')) {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const { isBriefEnabled } =
        require('../tools/BriefTool/BriefTool.js') as typeof import('../tools/BriefTool/BriefTool.js')
      /* eslint-enable @typescript-eslint/no-require-imports */
      if (!isBriefEnabled() && !isBriefOnly) return
      const next = !isBriefOnly
      logEvent('tengu_brief_mode_toggled', {
        enabled: next,
        gated: false,
        source:
          'keybinding' as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      })
      setAppState(prev => {
        if (prev.isBriefOnly === next) return prev
        return { ...prev, isBriefOnly: next }
      })
    }
  }, [isBriefOnly, setAppState])
""",
)
cut(
    'hooks/useGlobalKeybindings.tsx',
    """  if (feature('KAIROS') || feature('KAIROS_BRIEF')) {
    // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
    useKeybinding('app:toggleBrief', handleToggleBrief, {
      context: 'Global',
    })
  }
""",
)

print('d7i2 ok')
