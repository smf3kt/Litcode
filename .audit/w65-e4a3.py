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


def cut_all(p, old, new=''):
    t = rd(p)
    n = t.count(old)
    assert n >= 1, (p, old[:90], n)
    wr(p, t.replace(old, new))


def cut_range(p, start, end, new=''):
    t = rd(p)
    i = t.index(start)
    j = t.index(end, i) + len(end)
    wr(p, t[:i] + new + t[j:])


D = 'components/tasks/BackgroundTasksDialog.tsx'
cut(D, """    count(
        _ => _.status === 'running' || _.status === 'pending',
    ) + count(agentTasks, _ => _.status === 'running')
""", "    count(agentTasks, _ => _.status === 'running')\n")
cut(D, """      } else if (
        currentSelection.type === 'remote_agent' &&
        currentSelection.status === 'running'
      ) {
        if (currentSelection.task.isUltraplan) {
          void stopUltraplan(
            currentSelection.id,
            currentSelection.task.sessionId,
            setAppState,
          )
        } else {
          void killRemoteAgentTask(currentSelection.id)
        }
      }
""")
cut(D, """
  async function killRemoteAgentTask(taskId: string): Promise<void> {
    await RemoteAgentTask.kill(taskId, setAppState)
  }
""")
cut(D, """      case 'remote_agent':
        return (
          <RemoteSessionDetailDialog
            session={task}
            onDone={onDone}
            toolUseContext={toolUseContext}
            onBack={goBackToList}
            onKill={
              task.status !== 'running'
                ? undefined
                : task.isUltraplan
                  ? () =>
                      void stopUltraplan(task.id, task.sessionId, setAppState)
                  : () => void killRemoteAgentTask(task.id)
            }
            key={`session-${task.id}`}
          />
        )
""")
cut_all(D, "                  remoteSessions.length > 0 ||\n")
cut_all(D, "                  remoteSessions.length > 0\n")
cut(D, """            {remoteSessions.length > 0 && (
              <Box
                flexDirection="column"
                marginTop={
                  teammateTasks.length > 0 ||
                  bashTasks.length > 0 ||
                  mcpMonitors.length > 0
                    ? 1
                    : 0
                }
              >
                <Text dimColor>
                  <Text bold>{'  '}Remote agents</Text> ({remoteSessions.length}
                  )
                </Text>
                <Box flexDirection="column">
                  {remoteSessions.map(item => (
                    <Item
                      key={item.id}
                      item={item}
                      isSelected={item.id === currentSelection?.id}
                    />
                  ))}
                </Box>
              </Box>
            )}

""")
cut(D, """      currentSelection?.type === 'dream' ||
      currentSelection?.type === 'remote_agent') &&
""", """      currentSelection?.type === 'dream') &&
""")
cut(D, """    case 'remote_agent':
      return {
        id: task.id,
        type: 'remote_agent',
        label: task.title,
        status: task.status,
        task,
      }
""")

L = 'dialogLaunchers.tsx'
cut_range(L,
  "/**\n * Site ~4549: TeleportResumeWrapper (interactive teleport session picker).\n",
  "      initialPaths={props.initialPaths}\n      onSelectPath={done}\n      onCancel={() => done(null)}\n    />\n  ))\n}\n\n")

A = 'tools/AgentTool/AgentTool.tsx'
cut(A, """import {
  checkRemoteAgentEligibility,
  formatPreconditionError,
  getRemoteTaskSessionUrl,
  registerRemoteAgentTask,
} from '../../tasks/RemoteAgentTask/RemoteAgentTask.js'
""")
cut(A, "import { teleportToRemote } from '../../utils/teleport.js'\n")
cut(A, "  isolation?: 'worktree' | 'remote'\n", "  isolation?: 'worktree'\n")
cut(A, """// Private type for remote-launched results — excluded from exported schema
// like TeammateSpawnedOutput for dead code elimination purposes. Exported
// for UI.tsx to do proper discriminated-union narrowing instead of ad-hoc casts.
export type RemoteLaunchedOutput = {
  status: 'remote_launched'
  taskId: string
  sessionUrl: string
  description: string
  prompt: string
  outputFile: string
}

type InternalOutput = Output | TeammateSpawnedOutput | RemoteLaunchedOutput
""", "type InternalOutput = Output | TeammateSpawnedOutput\n")
cut(A, "    {}\n    // System prompt + prompt messages: branch on fork path.\n",
       "    // System prompt + prompt messages: branch on fork path.\n")
cut(A, """    if ('status' in internalData && internalData.status === 'remote_launched') {
      const r = internalData
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: [
          {
            type: 'text',
            text: `Remote agent launched in CCR.\\ntaskId: ${r.taskId}\\nsession_url: ${r.sessionUrl}\\noutput_file: ${r.outputFile}\\nThe agent is running remotely. You will be notified automatically when it completes.\\nBriefly tell the user what you launched and end your response.`,
          },
        ],
      }
    }
""")

K = 'tools/TaskOutputTool/TaskOutputTool.tsx'
cut(K, "import type { RemoteAgentTaskState } from '../../tasks/RemoteAgentTask/RemoteAgentTask.js'\n")
cut(K, """  if (task.type === 'remote_agent') {
    const remoteTask = task as RemoteAgentTaskState
    return {
      ...baseOutput,
      prompt: remoteTask.command,
    }
  }

""")

PL = 'tasks/pillLabel.ts'
cut_range(PL, "      case 'remote_agent': {\n", "\n")

BS = 'bridge/createSession.ts'
cut_all(BS, "  const { getOAuthHeaders } = await import('../utils/teleport/api.js')\n")
cut(BS, "type GitSource = {\n",
   """// Ported from utils/teleport/api.ts:276-282 — the Sessions API header set.
function getOAuthHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  }
}

type GitSource = {
""")

print('e4a3 ok')
