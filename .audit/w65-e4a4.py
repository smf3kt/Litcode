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


D = 'components/tasks/BackgroundTasksDialog.tsx'
cut(D, """                  mcpMonitors.length > 0 ||
                    ? 1
""", """                  mcpMonitors.length > 0
                    ? 1
""")

P = 'tasks/pillLabel.ts'
cut(P, """        const first = tasks[0]!
        // Per design mockup: ◇ open diamond while running/needs-input,
        // ◆ filled once ExitPlanMode is awaiting approval.
        if (n === 1 && first.type === 'remote_agent' && first.isUltraplan) {
          switch (first.ultraplanPhase) {
            case 'plan_ready':
              return `${DIAMOND_FILLED} ultraplan ready`
            case 'needs_input':
              return `${DIAMOND_OPEN} ultraplan needs your input`
            default:
              return `${DIAMOND_OPEN} ultraplan`
          }
        }
        return n === 1
          ? `${DIAMOND_OPEN} 1 cloud session`
          : `${DIAMOND_OPEN} ${n} cloud sessions`
      }
""")
cut(P, """
/**
 * True when the pill should show the dimmed " · ↓ to view" call-to-action.
 * Per the state diagram: only the two attention states (needs_input,
 * plan_ready) surface the CTA; plain running shows just the diamond + label.
 */
export function pillNeedsCta(tasks: BackgroundTaskState[]): boolean {
  if (tasks.length !== 1) return false
  const t = tasks[0]!
  return (
    t.type === 'remote_agent' &&
    t.isUltraplan === true &&
    t.ultraplanPhase !== undefined
  )
}
""")

S = 'components/tasks/BackgroundTaskStatus.tsx'
cut(S, "import { getPillLabel, pillNeedsCta } from 'src/tasks/pillLabel.js'\n",
       "import { getPillLabel } from 'src/tasks/pillLabel.js'\n")
cut(S, """      {pillNeedsCta(runningTasks) && (
        <Text dimColor> · {figures.arrowDown} to view</Text>
      )}
""")

print('e4a4 ok')
