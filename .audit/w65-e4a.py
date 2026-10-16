import os

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


# ---------- cli/print.ts ----------
P = 'cli/print.ts'
cut_all(P, "    teleport: string | true | null | undefined\n")
cut(P, "    teleport: options.teleport,\n")
cut(P, """  // Handle teleport in print mode
  if (options.teleport) {
    try {
      logEvent('tengu_teleport_print', {})

      if (typeof options.teleport !== 'string') {
        throw new Error('No session ID provided for teleport')
      }

      const {
        checkOutTeleportedSessionBranch,
        processMessagesForTeleportResume,
        teleportResumeCodeSession,
        validateGitState,
      } = await import('src/utils/teleport.js')
      await validateGitState()
      const teleportResult = await teleportResumeCodeSession(options.teleport)
      const { branchError } = await checkOutTeleportedSessionBranch(
        teleportResult.branch,
      )
      return {
        messages: processMessagesForTeleportResume(
          teleportResult.log,
          branchError,
        ),
      }
    } catch (error) {
      logError(error)
      gracefulShutdownSync(1)
      return { messages: [] }
    }
  }

""")
cut(P, "  hydrateRemoteSession,\n")
cut(P, """      } else if (
        parsedSessionId.isUrl &&
        parsedSessionId.ingressUrl &&
        isEnvTruthy(process.env.ENABLE_SESSION_PERSISTENCE)
      ) {
        // v1: fetch session logs from Session Ingress
        await hydrateRemoteSession(
          parsedSessionId.sessionId,
          parsedSessionId.ingressUrl,
        )
      }
""", """      }
""")

# ---------- commands/clear/caches.ts ----------
C = 'commands/clear/caches.ts'
cut(C, "import { clearAllSessions } from '../../services/api/sessionIngress.js'\n")
cut(C, "  clearAllSessions()\n")

# ---------- utils/sessionStorage.ts ----------
S = 'utils/sessionStorage.ts'
cut(S, "import * as sessionIngress from '../services/api/sessionIngress.js'\n")
cut(S, """
    // v1 Session Ingress path
    if (
      !isEnvTruthy(process.env.ENABLE_SESSION_PERSISTENCE) ||
      !this.remoteIngressUrl
    ) {
      return
    }

    const success = await sessionIngress.appendSessionLog(
      sessionId,
      entry,
      this.remoteIngressUrl,
    )

    if (!success) {
      logEvent('tengu_session_persistence_failed', {})
      gracefulShutdownSync(1, 'other')
    }
  }
""", """  }
""")
cut(S, """  setRemoteIngressUrl(url: string): void {
    this.remoteIngressUrl = url
    logForDebugging(`Remote persistence enabled with URL: ${url}`)
    if (url) {
      // If using CCR, don't delay messages by any more than 10ms.
      this.FLUSH_INTERVAL_MS = REMOTE_FLUSH_INTERVAL_MS
    }
  }

""")
cut(S, "  private remoteIngressUrl: string | null = null\n")
cut(S, """/**
 * Set the remote ingress URL on the current Project for testing.
 * This simulates what hydrateRemoteSession does in production.
 */
export function setRemoteIngressUrlForTesting(url: string): void {
  getProject().setRemoteIngressUrl(url)
}

""")
cut_range(S,
  "export async function hydrateRemoteSession(\n",
  "    project.setRemoteIngressUrl(ingressUrl)\n  }\n}\n\n")

# ---------- utils/filePersistence/outputsScanner.ts ----------
O = 'utils/filePersistence/outputsScanner.ts'
cut(O, "import type { EnvironmentKind } from '../teleport/environments.js'\n",
   """// Ported from utils/teleport/environments.ts:9 — the environment-kind union
// the scanner reads out of CLAUDE_CODE_ENVIRONMENT_KIND.
type EnvironmentKind = 'anthropic_cloud' | 'byoc' | 'bridge'
""")

# ---------- Task.ts ----------
T = 'Task.ts'
cut(T, "  | 'remote_agent'\n")
cut(T, "  remote_agent: 'r',\n")

# ---------- tasks.ts ----------
S = 'tasks.ts'
cut(S, "import { RemoteAgentTask } from './tasks/RemoteAgentTask/RemoteAgentTask.js'\n")
cut(S, """    LocalShellTask,
    LocalAgentTask,
    RemoteAgentTask,
    DreamTask,
""", """    LocalShellTask,
    LocalAgentTask,
    DreamTask,
""")

# ---------- tasks/types.ts ----------
Y = 'tasks/types.ts'
cut(Y, "import type { RemoteAgentTaskState } from './RemoteAgentTask/RemoteAgentTask.js'\n")
cut_all(Y, "  | RemoteAgentTaskState\n")

# ---------- components/tasks/BackgroundTask.tsx ----------
G = 'components/tasks/BackgroundTask.tsx'
cut(G, "import { RemoteSessionProgress } from './RemoteSessionProgress.js'\n")
cut_range(G, "    case 'remote_agent': {\n", "    }\n    case 'local_agent':\n",
          "    case 'local_agent':\n")

# ---------- components/tasks/BackgroundTasksDialog.tsx ----------
D = 'components/tasks/BackgroundTasksDialog.tsx'
cut(D, """import {
  RemoteAgentTask,
  type RemoteAgentTaskState,
} from 'src/tasks/RemoteAgentTask/RemoteAgentTask.js'
""")
cut(D, "import { stopUltraplan } from '../../commands/ultraplan.js'\n")
cut(D, "import { RemoteSessionDetailDialog } from './RemoteSessionDetailDialog.js'\n")
cut(D, """  | {
      id: string
      type: 'remote_agent'
      label: string
      status: string
      task: DeepImmutable<RemoteAgentTaskState>
    }
""")
cut(D, "    const remote = sorted.filter(item => item.type === 'remote_agent')\n")
cut_all(D, "    remoteSessions,\n")
cut(D, "      remoteSessions: remote,\n")
cut(D, "        ...remote,\n")
cut(D, "../* remote_agent) so", "/* remote_agent) so")
cut(D, """    count(
      remoteSessions,
      _ => _.status === 'running' || _.status === 'pending',
    ) + count(agentTasks, _ => _.status === 'running')
""", "    count(agentTasks, _ => _.status === 'running')\n")
cut(D, """      remoteSessions,\n""")
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
cut(D, "                  remoteSessions.length > 0\n")
cut(D, """      currentSelection?.type === 'remote_agent') &&
""", """      currentSelection?.type === 'dream') &&
""")
cut(D, """      currentSelection?.type === 'dream' ||
      currentSelection?.type === 'dream') &&
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

# ---------- dialogLaunchers.tsx ----------
L = 'dialogLaunchers.tsx'
cut_range(L,
  "/**\n * Site ~4549: TeleportResumeWrapper (interactive teleport session picker).\n",
  "      initialPaths={props.initialPaths}\n      onSelectPath={done}\n      onCancel={() => done(null)}\n    />\n  ))\n}\n\n")

# ---------- tools/AgentTool/AgentTool.tsx ----------
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

# ---------- tools/TaskOutputTool/TaskOutputTool.tsx ----------
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

# ---------- tasks/pillLabel.ts ----------
PL = 'tasks/pillLabel.ts'
cut_range(PL, "      case 'remote_agent': {\n", "\n")

# ---------- bridge/createSession.ts ----------
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

print('e4a ok')
