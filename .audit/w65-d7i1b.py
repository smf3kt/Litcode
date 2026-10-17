"""W65 wave D step 7i part 1, resumed: the resume classifier's function, then
steps 6-8 (the permission-rule alias, the tool-search bypass, the two nags)."""

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


def drop_between(p, start_sub, keep_sub, gap=''):
    t = rd(p)
    assert t.count(start_sub) == 1, (p, 'start', start_sub[:60], t.count(start_sub))
    assert t.count(keep_sub) == 1, (p, 'keep', keep_sub[:60], t.count(keep_sub))
    i = t.rindex('\n', 0, t.index(start_sub)) + 1
    k = t.rindex('\n', 0, t.index(keep_sub, i)) + 1
    wr(p, t[:i] + gap + t[k:])
    print('  dropped %d lines from %s' % (t[:k].count('\n') - t[:i].count('\n'), p))


drop_between(
    'utils/conversationRecovery.ts',
    '/**\n * Is this tool_result the output of a tool that legitimately terminates a',
    '/**\n * Restores skill state from invoked_skills attachments in messages.',
)

cut(
    'utils/permissions/permissionRuleParser.ts',
    """const BRIEF_TOOL_NAME: string | null =
  feature('KAIROS') || feature('KAIROS_BRIEF')
    ? (
        require('../../tools/BriefTool/prompt.js') as typeof import('../../tools/BriefTool/prompt.js')
      ).BRIEF_TOOL_NAME
    : null
""",
)
cut(
    'utils/permissions/permissionRuleParser.ts',
    """  ...((feature('KAIROS') || feature('KAIROS_BRIEF')) && BRIEF_TOOL_NAME
    ? { Brief: BRIEF_TOOL_NAME }
    : {}),
""",
)

cut(
    'tools/ToolSearchTool/prompt.ts',
    """// Dead code elimination: Brief tool name only needed when KAIROS or KAIROS_BRIEF is on
/* eslint-disable @typescript-eslint/no-require-imports */
const BRIEF_TOOL_NAME: string | null =
  feature('KAIROS') || feature('KAIROS_BRIEF')
    ? (
        require('../BriefTool/prompt.js') as typeof import('../BriefTool/prompt.js')
      ).BRIEF_TOOL_NAME
    : null

/* eslint-enable @typescript-eslint/no-require-imports */
""",
)
cut(
    'tools/ToolSearchTool/prompt.ts',
    """
  // Brief is the primary communication channel whenever the tool is present.
  // Its prompt contains the text-visibility contract, which the model must
  // see without a ToolSearch round-trip. No runtime gate needed here: this
  // tool's isEnabled() IS isBriefEnabled(), so being asked about its deferral
  // status implies the gate already passed.
  if (
    (feature('KAIROS') || feature('KAIROS_BRIEF')) &&
    BRIEF_TOOL_NAME &&
    tool.name === BRIEF_TOOL_NAME
  ) {
    return false
  }
""",
)

cut(
    'utils/attachments.ts',
    """/* eslint-disable @typescript-eslint/no-require-imports */
const BRIEF_TOOL_NAME: string | null =
  feature('KAIROS') || feature('KAIROS_BRIEF')
    ? (
        require('../tools/BriefTool/prompt.js') as typeof import('../tools/BriefTool/prompt.js')
      ).BRIEF_TOOL_NAME
    : null
/* eslint-enable @typescript-eslint/no-require-imports */
""",
)
cut(
    'utils/attachments.ts',
    """  // When SendUserMessage is in the toolkit, it's the primary communication
  // channel and the model is always told to use it (#20467). TodoWrite
  // becomes a side channel — nudging the model about it conflicts with the
  // brief workflow. The tool itself stays available; this only gates the
  // "you haven't used it in a while" nag.
  if (
    BRIEF_TOOL_NAME &&
    toolUseContext.options.tools.some(t => toolMatchesName(t, BRIEF_TOOL_NAME))
  ) {
    return []
  }

""",
)
cut(
    'utils/attachments.ts',
    """  // When SendUserMessage is in the toolkit, it's the primary communication
  // channel and the model is always told to use it (#20467). TaskUpdate
  // becomes a side channel — nudging the model about it conflicts with the
  // brief workflow. The tool itself stays available; this only gates the nag.
  if (
    BRIEF_TOOL_NAME &&
    toolUseContext.options.tools.some(t => toolMatchesName(t, BRIEF_TOOL_NAME))
  ) {
    return []
  }

""",
)

print('d7i1b ok')
