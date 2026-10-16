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


# ---------- services/api/withRetry.ts ----------
W = 'services/api/withRetry.ts'
cut(W, "  handleFastModeOverageRejection,\n")
cut(W, """        // If the 429 is specifically because extra usage (overage) is not
        // available, permanently disable fast mode with a specific message.
        const overageReason = error.headers?.get(
          'anthropic-ratelimit-unified-overage-disabled-reason',
        )
        if (overageReason !== null && overageReason !== undefined) {
          handleFastModeOverageRejection(overageReason)
          retryContext.fastMode = false
          continue
        }

""")

# ---------- utils/fastMode.ts ----------
F = 'utils/fastMode.ts'
cut_range(F, """// --- Overage rejection listeners ---
""", """  overageRejection.emit(message)
}

""")

# ---------- hooks/notifs/useFastModeNotification.tsx ----------
N = 'hooks/notifs/useFastModeNotification.tsx'
cut(N, "  onFastModeOverageRejection,\n")
cut(N, "const OVERAGE_REJECTED_KEY = 'fast-mode-overage-rejected'\n")
cut(N, """  // Notify when fast mode is rejected due to overage/extra usage issues
  useEffect(() => {
    if (getIsRemoteMode()) return
    if (!isFastModeEnabled()) return

    return onFastModeOverageRejection(message => {
      setAppState(prev => ({ ...prev, fastMode: false }))
      addNotification({
        key: OVERAGE_REJECTED_KEY,
        color: 'warning',
        priority: 'immediate',
        text: message,
      })
    })
  }, [addNotification, setAppState])

""")

print('c6 ok')
