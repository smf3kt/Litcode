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


def cut_range(p, start, end, new=''):
    t = rd(p)
    i = t.index(start)
    j = t.index(end, i) + len(end)
    wr(p, t[:i] + new + t[j:])


M = 'main.tsx'

# ---------- imports ----------
cut(M, "import { getRemoteSessionUrl } from './constants/product.js'\n")
cut(M, "import { filterCommandsForRemoteMode, getCommands } from './commands.js'\n",
    "import { getCommands } from './commands.js'\n")
cut(M, "  TeleportOperationError,\n")
cut(M, "import { createRemoteSessionConfig } from './remote/RemoteSessionManager.js'\n")
cut(M, "import { fetchSession, prepareApiRequest } from './utils/teleport/api.js'\n")
cut(M, """import {
  checkOutTeleportedSessionBranch,
  processMessagesForTeleportResume,
  teleportToRemoteWithErrorHandling,
  validateGitState,
  validateSessionRepository,
} from './utils/teleport.js'
""")
cut(M, "  setIsRemoteMode,\n")
cut(M, "  setTeleportedSessionInfo,\n")
cut(M, "  setDirectConnectServerUrl,\n")
cut(M, """  createDirectConnectSession,
  DirectConnectError,
} from './server/createDirectConnectSession.js'
""")
cut(M, """  launchTeleportRepoMismatchDialog,
  launchTeleportResumeWrapper,
""")

# ---------- PendingConnect (direct connect) ----------
cut_range(M,
  "// Set by early argv processing when `claude open <url>` is detected (interactive mode only)\ntype PendingConnect = {",
  "  : undefined\n\n")

# ---------- PendingSSH type ----------
cut_range(M,
  "// `claude ssh <host> [dir]` — parsed from argv early (same pattern as\n",
  "      extraCliArgs: [],\n    }\n  : undefined\n\n")

# ---------- ssh argv parsing ----------
cut_range(M,
  "  // `claude ssh <host> [dir]` — strip from argv so the main command handler\n",
  "      process.argv = [process.argv[0]!, process.argv[1]!, ...rest]\n    }\n  }\n\n")

# ---------- teleport/remote option extraction ----------
cut(M, """      // Extract teleport option
      const teleport =
        (options as { teleport?: string | true }).teleport ?? null

      // Extract remote option (can be true if no description provided, or a string)
      const remoteOption = (options as { remote?: string | true }).remote
      const remote = remoteOption === true ? '' : (remoteOption ?? null)

""")

# ---------- session start hook guard ----------
cut(M, "          options.continue || options.resume || teleport || setupTrigger\n",
    "          options.continue || options.resume || setupTrigger\n")

# ---------- print-mode options ----------
cut(M, "            userSpecifiedModel: effectiveModel,\n            fallbackModel: userSpecifiedFallbackModel,\n            teleport,\n            sdkUrl,\n",
    "            userSpecifiedModel: effectiveModel,\n            fallbackModel: userSpecifiedFallbackModel,\n            sdkUrl,\n")

# ---------- direct connect branch ----------
cut_range(M,
  "      } else if (feature('DIRECT_CONNECT') && _pendingConnect?.url) {\n",
  "      ) {\n",
  "      } else if (options.resume || options.fromPr) {\n")

# ---------- remote/teleport branches ----------
cut_range(M,
  "        // --remote and --teleport both create/resume Claude Code Web (CCR) sessions.\n",
  "        {}\n\n")

# ---------- messages variable + resumeData ----------
cut(M, "        let messages: MessageType[] | null = null\n")
cut(M, """        // If we have a processed resume or teleport messages, render the REPL
        const resumeData =
          processedResume ??
          (Array.isArray(messages)
            ? {
                messages,
                fileHistorySnapshots: undefined,
                agentName: undefined,
                agentColor: undefined as AgentColorName | undefined,
                restoredAgentDef: mainThreadAgentDefinition,
                initialState,
                contentReplacements: undefined,
              }
            : undefined)
""", """        // If we have a processed resume, render the REPL
        const resumeData = processedResume
""")

# ---------- CLI option registrations ----------
cut(M, """  // Enable teleport/remote flags for all builds but keep them undocumented until GA
  program.addOption(
    new Option(
      '--teleport [session]',
      'Resume a teleport session, optionally specify session ID',
    ).hideHelp(),
  )
  program.addOption(
    new Option(
      '--remote [description]',
      'Create a remote session with the given description',
    ).hideHelp(),
  )
""")

# ---------- `claude ssh` command registration ----------
cut_range(M,
  "\n  // `claude ssh <host> [dir]` — registered here only so --help shows it.\n",
  "        process.exit(1)\n      })\n  }\n")

print('e4 main ok')
