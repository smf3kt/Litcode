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


# ---------- screens/REPL.tsx ----------
R = 'screens/REPL.tsx'
cut(R, "import { useAssistantHistory } from '../hooks/useAssistantHistory.js'\n")
cut(R, """// Stable stub for useAssistantHistory's non-KAIROS branch — avoids a new
// function identity each render, which would break composedOnScroll's memo.
const HISTORY_STUB = { maybeLoadOlder: (_: ScrollBoxHandle) => {} }
""")
cut(R, """  // Assistant-chat: lazy-load remote history on scroll-up. No-op unless
  // KAIROS build + config.viewerOnly. feature() is build-time constant so
  // the branch is dead-code-eliminated in non-KAIROS builds (same pattern
  // as useUnseenDivider above).
  const { maybeLoadOlder } = feature('KAIROS')
    ? // biome-ignore lint/correctness/useHookAtTopLevel: feature() is a compile-time constant
      useAssistantHistory({
        config: remoteSessionConfig,
        setMessages,
        scrollRef,
        onPrepend: shiftDivider,
      })
    : HISTORY_STUB
""")
cut(R, "        if (feature('KAIROS')) maybeLoadOlder(handle)\n")
cut(R, "    [onRepin, onScrollAway, maybeLoadOlder, setAppState],\n",
    "    [onRepin, onScrollAway, setAppState],\n")
cut(R, """  // so useAssistantHistory's prepends don't spuriously repin.
""", """  // so history prepends don't spuriously repin.
""")

# ---------- dialogLaunchers.tsx ----------
D = 'dialogLaunchers.tsx'
cut(D, "import type { AssistantSession } from './assistant/sessionDiscovery.js'\n")

# ---------- delete files ----------
for p in [
    'assistant/sessionDiscovery.ts',
    'assistant/sessionHistory.ts',
    'hooks/useAssistantHistory.ts',
    'services/api/adminRequests.ts',
    'components/RemoteEnvironmentDialog.tsx',
]:
    os.remove(B + p)
os.rmdir(B + 'assistant')
print('e3 ok')
