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


# ---------- bootstrap/state.ts ----------
S = 'bootstrap/state.ts'
cut(S, """  // Track teleported session for reliability logging
  teleportedSessionInfo: {
""", """  teleportedSessionInfoRemoved: {
""")
cut(S, """  teleportedSessionInfoRemoved: {
    isTeleported: boolean
    hasLoggedFirstMessage: boolean
    sessionId: string | null
  } | null
""")
cut(S, "    teleportedSessionInfo: null,\n")
cut(S, """
// Teleported session tracking for reliability logging
export function setTeleportedSessionInfo(info: {
  sessionId: string | null
}): void {
  STATE.teleportedSessionInfo = {
    isTeleported: true,
    hasLoggedFirstMessage: false,
    sessionId: info.sessionId,
  }
}

export function getTeleportedSessionInfo(): {
  isTeleported: boolean
  hasLoggedFirstMessage: boolean
  sessionId: string | null
} | null {
  return STATE.teleportedSessionInfo
}

export function markFirstTeleportMessageLogged(): void {
  if (STATE.teleportedSessionInfo) {
    STATE.teleportedSessionInfo.hasLoggedFirstMessage = true
  }
}
""")

L = 'services/api/logging.ts'
cut(L, "  getTeleportedSessionInfo,\n")
cut(L, "  markFirstTeleportMessageLogged,\n")
cut_all(L, """
  // Log first error for teleported sessions (reliability tracking)
  const teleportInfo = getTeleportedSessionInfo()
  if (teleportInfo?.isTeleported && !teleportInfo.hasLoggedFirstMessage) {
    logEvent('tengu_teleport_first_message_error', {
      session_id:
        teleportInfo.sessionId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
      error_type:
        errorType as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    markFirstTeleportMessageLogged()
  }
""")
cut(L, """
  // Log first successful message for teleported sessions (reliability tracking)
  const teleportInfo = getTeleportedSessionInfo()
  if (teleportInfo?.isTeleported && !teleportInfo.hasLoggedFirstMessage) {
    logEvent('tengu_teleport_first_message_success', {
      session_id:
        teleportInfo.sessionId as AnalyticsMetadata_I_VERIFIED_THIS_IS_NOT_CODE_OR_FILEPATHS,
    })
    markFirstTeleportMessageLogged()
  }
""")

# ---------- remote session URL state ----------
A = 'state/AppStateStore.ts'
cut(A, "  remoteSessionUrl: string | undefined\n")
cut(A, "    remoteSessionUrl: undefined,\n")
M = 'main.tsx'
cut(M, "        remoteSessionUrl: undefined,\n")

F = 'components/PromptInput/PromptInputFooterLeftSide.tsx'
cut(F, "  const [remoteSessionUrl] = useState(() => store.getState().remoteSessionUrl)\n")
cut(F, """    // Remote session indicator
    ...(remoteSessionUrl
      ? [
          <Link url={remoteSessionUrl} key="remote">
            <Text color="ide">{figures.circleDouble} remote</Text>
          </Link>,
        ]
      : []),
""")

# ---------- stale comments ----------
C = 'utils/sessionTitle.ts'
cut(C, """ * git dependency chain that teleport.tsx carries.
""")
cut(C, " * - teleport.tsx generateTitleAndBranch (6-word title + branch for CCR)\n")

T = 'types/textInputTypes.ts'
cut(T, "   * Used for ultraplan keyword detection so pasted content containing the\n")
cut_range(T, "   * Used for ultraplan keyword detection", "\n")

G = 'utils/config.ts'
cut(G, "  // GitHub repo path mapping for teleport directory switching\n")
cut(G, "  hasSeenUltraplanTerms?: boolean // ant-only: whether the one-time CCR terms notice has been shown in the ultraplan launch dialog\n")

U = 'utils/processUserInput/processUserInput.ts'
cut_range(U, "   * Input before [Pasted text #N] expansion.", "\n")

X = 'utils/processUserInput/processSlashCommand.tsx'
cut_range(X, "            // commands that early-exit before showing a modal (/ultraplan", "\n")

X2 = 'constants/xml.ts'
cut(X2, "// XML tag name for remote /review results (teleported review session output).\n")

M2 = 'main.tsx'
cut(M2, "// TeleportRepoMismatchDialog, TeleportResumeWrapper dynamically imported at call sites\n")
cut(M2, "        // continue/resume/teleport paths don't fire startup hooks (or fire them\n",
        "        // continue/resume paths don't fire startup hooks (or fire them\n")

SS = 'utils/sessionStorage.ts'
cut(SS, " * Used by restoreRemoteAgentTasks to reconnect to still-running CCR sessions.\n")
cut_range(SS, " * Used by restoreRemoteAgentTasks to reconnect", "\n")

print('e4 clean ok')
