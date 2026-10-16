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


# ---------- remote-agent metadata sidecars ----------
S = 'utils/sessionStorage.ts'
cut_range(S,
  "export type RemoteAgentMetadata = {\n",
  "  return results\n}\n\n")

# ---------- remaining stale comments ----------
T = 'types/textInputTypes.ts'
cut(T, """  /**
   * The input string before [Pasted text #N] placeholders were expanded.
   * keyword does not trigger a CCR session. Falls back to `value` when
   * unset (bridge/UDS/MCP sources have no paste expansion).
   */
""", """  /**
   * The input string before [Pasted text #N] placeholders were expanded.
   * Falls back to `value` when unset (bridge/UDS/MCP sources have no paste
   * expansion).
   */
""")

G = 'utils/config.ts'
cut(G, "  // GitHub repo path mapping for teleport directory switching\n")
cut(G, "  hasSeenUltraplanTerms?: boolean // ant-only: whether the one-time CCR terms notice has been shown in the ultraplan launch dialog\n")

U = 'utils/processUserInput/processUserInput.ts'
cut(U, """  /**
   * Input before [Pasted text #N] expansion. Used for ultraplan keyword
   * detection so pasted content containing the word cannot trigger. Falls
   * back to the string `input` when unset.
   */
""")

X = 'utils/processUserInput/processSlashCommand.tsx'
cut(X, """            // Only skip "<Name> dismissed" modal-close notifications —
            // commands that early-exit before showing a modal (/ultraplan
            // usage, /rename, /proactive) use display:system for actual
            // output that must reach the transcript.
""", """            // Only skip "<Name> dismissed" modal-close notifications —
            // commands that early-exit before showing a modal (/rename,
            // /proactive) use display:system for actual output that must
            // reach the transcript.
""")

C = 'utils/sessionTitle.ts'
cut(C, " * git dependency chain that teleport.tsx carries.\n")

print('e4 clean2 ok')
