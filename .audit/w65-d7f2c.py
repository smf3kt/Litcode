"""W65 wave D step 7f part 2, the block deletions.

d7f2.py's cut_upto wrote the removed span back instead of dropping it, so the
four block deletions it claimed were no-ops and only their imports landed. This
pass performs those four deletions with the corrected helper and takes the one
host the first pass missed (UserTextMessage's <channel> render branch).
"""

B = '/Users/mant1ssa/Projects/cc-base-2188/'


def rd(p):
    return open(B + p, encoding='utf-8').read()


def wr(p, t):
    open(B + p, 'w', encoding='utf-8').write(t)


def cut(p, old, new='', n=1):
    t = rd(p)
    c = t.count(old)
    assert c == n, (p, old[:70], c)
    wr(p, t.replace(old, new))


def drop_between(p, start_sub, keep_sub):
    """Delete from the line holding start_sub up to the line holding keep_sub."""
    t = rd(p)
    assert t.count(start_sub) == 1, (p, 'start', start_sub[:70], t.count(start_sub))
    i = t.index(start_sub)
    i = t.rindex('\n', 0, i) + 1
    k = t.index(keep_sub, i)
    assert t.count(keep_sub) == 1, (p, 'keep', keep_sub[:70], t.count(keep_sub))
    k = t.rindex('\n', 0, k) + 1
    removed = t[i:k]
    sep = '\n' if removed.endswith('\n\n') else ''
    wr(p, t[:i] + sep + t[k:])
    print('dropped', len(removed.split('\n')) - 1, 'lines from', p)


# ------------------------------------------------------------- cli/print.ts
drop_between(
    'cli/print.ts',
    '/**\n * IDE-triggered channel enable. Derives the ChannelEntry from the connection\'s',
    '/**\n * Re-register the channel notification handler after mcp_reconnect /',
)
drop_between(
    'cli/print.ts',
    '/**\n * Re-register the channel notification handler after mcp_reconnect /',
    '/**\n * Emits an error message in the correct format based on outputFormat.',
)

# ------------------------------------- hooks/toolPermission/handlers/interactiveHandler.ts
drop_between(
    'hooks/toolPermission/handlers/interactiveHandler.ts',
    '  // Channel permission relay. Send a',
    '  // Skip hooks if they were already awaited in the coordinator branch above',
)

# --------------------------------------------------------- interactiveHelpers.tsx
drop_between(
    'interactiveHelpers.tsx',
    '  // --dangerously-load-development-channels confirmation. On accept, append',
    '  return onboardingShown',
)

# ------------------------------------------- components/messages/UserTextMessage.tsx
cut(
    'components/messages/UserTextMessage.tsx',
    """  // Inbound channel message (MCP server push).
  if (feature('KAIROS') || feature('KAIROS_CHANNELS')) {
    if (param.text.includes('<channel source="')) {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const { UserChannelMessage } =
        require('./UserChannelMessage.js') as typeof import('./UserChannelMessage.js')
      /* eslint-enable @typescript-eslint/no-require-imports */
      return <UserChannelMessage addMargin={addMargin} param={param} />
    }
  }

""",
)

print('d7f2c ok')
