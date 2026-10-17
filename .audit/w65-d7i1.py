"""W65 wave D step 7i part 1: the brief tool and everything that names it.

SendUserMessage (module-local name BriefTool) sat behind `feature('KAIROS') ||
feature('KAIROS_BRIEF')`, and its own gate `isBriefEnabled()` is that same
build-time ternary, so in this build the tool is never enabled: the false arm
the source already wrote is "no tool". This pass removes the module tree, its
registration, its system-prompt section, and every reader that named it by
string (the transcript filters, the resume classifier, the permission-rule
alias, the tool-search bypass, the two todo/task nags).
"""

import os
import shutil

B = '/Users/mant1ssa/Projects/cc-base-2188/'
Q = '/Users/mant1ssa/Projects/cc_reverse/.audit/w65-d7i-baks/'


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


# ---- 1. the module tree ----------------------------------------------------
os.makedirs(Q + 'tools/BriefTool/', exist_ok=True)
for f in sorted(os.listdir(B + 'tools/BriefTool')):
    if '.w' in f:
        shutil.copy2(B + 'tools/BriefTool/' + f, Q + 'tools/BriefTool/' + f)
        assert open(B + 'tools/BriefTool/' + f, 'rb').read() == open(
            Q + 'tools/BriefTool/' + f, 'rb'
        ).read()
        print('  quarantined', f)
    os.remove(B + 'tools/BriefTool/' + f)
os.rmdir(B + 'tools/BriefTool')

# ---- 2. tools.ts: the import and the pool entry ----------------------------
cut('tools.ts', "import { BriefTool } from './tools/BriefTool/BriefTool.js'\n")
cut('tools.ts', '    BriefTool,\n')

# ---- 3. the system-prompt section -----------------------------------------
cut(
    'constants/prompts.ts',
    """const BRIEF_PROACTIVE_SECTION: string | null =
  feature('KAIROS') || feature('KAIROS_BRIEF')
    ? (
        require('../tools/BriefTool/prompt.js') as typeof import('../tools/BriefTool/prompt.js')
      ).BRIEF_PROACTIVE_SECTION
    : null
const briefToolModule =
  feature('KAIROS') || feature('KAIROS_BRIEF')
    ? (require('../tools/BriefTool/BriefTool.js') as typeof import('../tools/BriefTool/BriefTool.js'))
    : null
""",
)
cut(
    'constants/prompts.ts',
    """    ...(feature('KAIROS') || feature('KAIROS_BRIEF')
      ? [systemPromptSection('brief', () => getBriefSection())]
      : []),
""",
)
cut(
    'constants/prompts.ts',
    """function getBriefSection(): string | null {
  if (!(feature('KAIROS') || feature('KAIROS_BRIEF'))) return null
  if (!BRIEF_PROACTIVE_SECTION) return null
  // Whenever the tool is available, the model is told to use it. The
  // /brief toggle and --brief flag now only control the isBriefOnly
  // display filter — they no longer gate model-facing behavior.
  if (!briefToolModule?.isBriefEnabled()) return null
  // When proactive is active, getProactiveSection() already appends the
  // section inline. Skip here to avoid duplicating it in the system prompt.
  if (
    (feature('PROACTIVE') || feature('KAIROS')) &&
    proactiveModule?.isProactiveActive()
  )
    return null
  return BRIEF_PROACTIVE_SECTION
}

""",
)

# ---- 4. the transcript filters --------------------------------------------
cut(
    'components/Messages.tsx',
    """const BRIEF_TOOL_NAME: string | null =
  feature('KAIROS') || feature('KAIROS_BRIEF')
    ? (
        require('../tools/BriefTool/prompt.js') as typeof import('../tools/BriefTool/prompt.js')
      ).BRIEF_TOOL_NAME
    : null
""",
)
drop_between(
    'components/Messages.tsx',
    '/**\n * In brief-only mode, filter messages to show ONLY Brief tool_use blocks,',
    'type Props = {',
)
cut(
    'components/Messages.tsx',
    """      // Three-tier filtering. Transcript mode (ctrl+o screen) is truly unfiltered.
      // Brief-only: SendUserMessage + user input only. Default: drop redundant
      // assistant text in turns where SendUserMessage was called (the model's
      // text is working-notes that duplicate the SendUserMessage content).
      const briefToolNames = [BRIEF_TOOL_NAME].filter(
        (n): n is string => n !== null,
      )
      const dropTextToolNames = [BRIEF_TOOL_NAME].filter(
        (n): n is string => n !== null,
      )
      const briefFiltered =
        briefToolNames.length > 0 && !isTranscriptMode
          ? isBriefOnly
            ? filterForBriefTool(messagesToShowNotTruncated, briefToolNames)
            : dropTextToolNames.length > 0
              ? dropTextInBriefTurns(
                  messagesToShowNotTruncated,
                  dropTextToolNames,
                )
              : messagesToShowNotTruncated
          : messagesToShowNotTruncated

      const messagesToShow = shouldTruncate
        ? briefFiltered.slice(-MAX_MESSAGES_TO_SHOW_IN_TRANSCRIPT_MODE)
        : briefFiltered

      const hasTruncatedMessages =
        shouldTruncate &&
        briefFiltered.length > MAX_MESSAGES_TO_SHOW_IN_TRANSCRIPT_MODE
""",
    """      const messagesToShow = shouldTruncate
        ? messagesToShowNotTruncated.slice(
            -MAX_MESSAGES_TO_SHOW_IN_TRANSCRIPT_MODE,
          )
        : messagesToShowNotTruncated

      const hasTruncatedMessages =
        shouldTruncate &&
        messagesToShowNotTruncated.length >
          MAX_MESSAGES_TO_SHOW_IN_TRANSCRIPT_MODE
""",
)

# ---- 5. the resume classifier ---------------------------------------------
cut(
    'utils/conversationRecovery.ts',
    """const BRIEF_TOOL_NAME: string | null =
  feature('KAIROS') || feature('KAIROS_BRIEF')
    ? (
        require('../tools/BriefTool/prompt.js') as typeof import('../tools/BriefTool/prompt.js')
      ).BRIEF_TOOL_NAME
    : null
const LEGACY_BRIEF_TOOL_NAME: string | null =
  feature('KAIROS') || feature('KAIROS_BRIEF')
    ? (
        require('../tools/BriefTool/prompt.js') as typeof import('../tools/BriefTool/prompt.js')
      ).LEGACY_BRIEF_TOOL_NAME
    : null
""",
)
cut(
    'utils/conversationRecovery.ts',
    """    if (isToolUseResultMessage(lastMessage)) {
      // Brief mode (#20467) drops the trailing assistant text block, so a
      // completed brief-mode turn legitimately ends on SendUserMessage's
      // tool_result. Without this check, resume misclassifies every
      // brief-mode session as interrupted mid-turn and injects a phantom
      // "Continue from where you left off." before the user's real next
      // prompt. Look back one step for the originating tool_use.
      if (isTerminalToolResult(lastMessage, messages, lastMessageIdx)) {
        return { kind: 'none' }
      }
      return { kind: 'interrupted_turn' }
    }
""",
    """    if (isToolUseResultMessage(lastMessage)) {
      return { kind: 'interrupted_turn' }
    }
""",
)
drop_between(
    'utils/conversationRecovery.ts',
    '/**\n * Is this tool_result the output of a tool that legitimately terminates a',
    'export function ',
)

# ---- 6. the permission-rule alias -----------------------------------------
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

# ---- 7. the tool-search deferral bypass -----------------------------------
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

# ---- 8. the two todo/task nags the tool suppressed ------------------------
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

print('d7i1 ok')
