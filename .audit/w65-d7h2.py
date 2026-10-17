"""W65 wave D step 7h part 2: the auto-background plumbing that only the
assistant-mode block ever set.

`assistantAutoBackgrounded` was written in exactly one place per tool — the
`feature('KAIROS') && getKairosActive()` auto-background block removed in part
1 — so the field, the schema entry the model saw, the result-plumbing and the
"assistant-mode blocking budget" message branch all go with it, along with the
budget constant whose only reader was that same block.
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
    """Remove every line whose stripped form equals `stripped`."""
    t = rd(p)
    lines = t.split('\n')
    out = []
    n = 0
    for line in lines:
        if line.strip() == stripped:
            n += 1
            continue
        out.append(line)
    assert n >= 1, (p, stripped[:60], n)
    wr(p, '\n'.join(out))
    print('  %d x %s' % (n, p))


BLOCK_COMMENT = """  // In assistant mode, the main agent should stay responsive. Auto-background
  // blocking commands after ASSISTANT_BLOCKING_BUDGET_MS so the agent can keep
  // coordinating instead of waiting. The command keeps running — no state loss.
"""
BRANCH_HEAD = """      if (assistantAutoBackgrounded) {
        backgroundInfo = `Command exceeded the assistant-mode blocking budget (${ASSISTANT_BLOCKING_BUDGET_MS / 1000}s) and was moved to the background with ID: ${backgroundTaskId}. It is still running — you will be notified when it completes. Output is being written to: ${outputPath}. In assistant mode, delegate long-running work to a subagent or use run_in_background to keep this conversation responsive.`
      } else if (backgroundedByUser) {
"""

TOOLS = [
    {
        'path': 'tools/BashTool/BashTool.tsx',
        'const': """// In assistant mode, blocking bash auto-backgrounds after this many ms in the main agent
const ASSISTANT_BLOCKING_BUDGET_MS = 15_000
""",
        'schema': """    assistantAutoBackgrounded: z
      .boolean()
      .optional()
      .describe(
        'True if assistant-mode auto-backgrounded a long-running blocking command',
      ),
""",
        'block': BLOCK_COMMENT + """  if (
    feature('KAIROS') &&
    getKairosActive() &&
    isMainThread &&
    !isBackgroundTasksDisabled &&
    run_in_background !== true
  ) {
    setTimeout(() => {
      if (
        shellCommand.status === 'running' &&
        backgroundShellId === undefined
      ) {
        assistantAutoBackgrounded = true
        startBackgrounding('tengu_bash_command_assistant_auto_backgrounded')
      }
    }, ASSISTANT_BLOCKING_BUDGET_MS).unref()
  }

""",
    },
    {
        'path': 'tools/PowerShellTool/PowerShellTool.tsx',
        'const': """// In assistant mode, blocking commands auto-background after this many ms in the main agent
const ASSISTANT_BLOCKING_BUDGET_MS = 15_000
""",
        'schema': """    assistantAutoBackgrounded: z
      .boolean()
      .optional()
      .describe(
        'True if the command was auto-backgrounded by the assistant-mode blocking budget',
      ),
""",
        'block': BLOCK_COMMENT + """  if (
    feature('KAIROS') &&
    getKairosActive() &&
    isMainThread &&
    !isBackgroundTasksDisabled &&
    run_in_background !== true
  ) {
    setTimeout(() => {
      if (
        shellCommand.status === 'running' &&
        backgroundShellId === undefined
      ) {
        assistantAutoBackgrounded = true
        startBackgrounding(
          'tengu_powershell_command_assistant_auto_backgrounded',
        )
      }
    }, ASSISTANT_BLOCKING_BUDGET_MS).unref()
  }

""",
    },
]

for tool in TOOLS:
    p = tool['path']
    cut(p, tool['const'])
    cut(p, tool['schema'])
    cut(p, tool['block'])
    drop_lines(p, 'let assistantAutoBackgrounded = false')
    drop_lines(p, 'assistantAutoBackgrounded,')
    drop_lines(p, 'assistantAutoBackgrounded: result.assistantAutoBackgrounded,')
    cut(p, BRANCH_HEAD, '      if (backgroundedByUser) {\n')
    cut(p, "import { getKairosActive } from '../../bootstrap/state.js'\n")

cut(
    'utils/ShellCommand.ts',
    """  /** Set when assistant-mode auto-backgrounded a long-running blocking command. */
  assistantAutoBackgrounded?: boolean
""",
)

print('d7h2 ok')
