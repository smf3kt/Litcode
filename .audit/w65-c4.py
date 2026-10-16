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


# ---------- screens/REPL.tsx ----------
R = 'screens/REPL.tsx'
cut(R, """  // onSubmit is unstable (deps include `messages` which changes every turn).
  // `handleOpenRateLimitOptions` is prop-drilled to every MessageRow, and each
  // MessageRow fiber pins the closure (and transitively the entire REPL render
  // scope, ~1.8KB) at mount time. Using a ref keeps this callback stable so
  // old REPL scopes can be GC'd — saves ~35MB over a 1000-turn session.
""", """  // onSubmit is unstable (deps include `messages` which changes every turn); a
  // ref keeps the closure from being pinned at mount time, so old REPL scopes
  // can be GC'd.
""")
cut(R, """  const handleOpenRateLimitOptions = useCallback(() => {
    void onSubmitRef.current('/rate-limit-options', {
      setCursorOffset: () => {},
      clearBuffer: () => {},
      resetHistory: () => {},
    })
  }, [])

""")
cut_all(R, "                onOpenRateLimitOptions={handleOpenRateLimitOptions}\n")
cut_all(R, "        onOpenRateLimitOptions={handleOpenRateLimitOptions}\n")

# ---------- components/Messages.tsx ----------
M = 'components/Messages.tsx'
cut(M, "  onOpenRateLimitOptions?: () => void\n")
cut(M, "  onOpenRateLimitOptions,\n")
cut(M, "        onOpenRateLimitOptions={onOpenRateLimitOptions}\n")
cut(M, """// 1. onOpenRateLimitOptions callback is recreated (doesn't affect render output)
// 2. streamingToolUses array is recreated on every delta, but only contentBlock matters for rendering
// 3. streamingThinking changes on every delta - we DO want to re-render for this
""", """// 1. streamingToolUses array is recreated on every delta, but only contentBlock matters for rendering
// 2. streamingThinking changes on every delta - we DO want to re-render for this
""")
cut(M, "      key === 'onOpenRateLimitOptions' ||\n")

# ---------- components/MessageRow.tsx ----------
D = 'components/MessageRow.tsx'
cut(D, "  onOpenRateLimitOptions?: () => void\n")
cut(D, "  onOpenRateLimitOptions,\n")
cut(D, "      onOpenRateLimitOptions={onOpenRateLimitOptions}\n")

print('c4 ok')
