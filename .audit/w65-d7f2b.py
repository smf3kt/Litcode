"""W65 wave D step 7f part 2, resumed: LogoV2, the settings keys, the startup dialog."""

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


def cut_upto(p, start_sub, keep_sub, new=''):
    t = rd(p)
    assert t.count(start_sub) == 1, (p, 'start', start_sub[:70], t.count(start_sub))
    i = t.index(start_sub)
    i = t.rindex('\n', 0, i) + 1
    k = t.index(keep_sub, i)
    k = t.rindex('\n', 0, k) + 1
    seg = t[i:k]
    seg = (seg.rstrip('\n') + '\n\n') if seg.strip() else ''
    wr(p, t[:i] + new + seg + t[k:])


# ------------------------------------------------------------------ LogoV2.tsx
L = 'components/LogoV2/LogoV2.tsx'
cut(L, "        {ChannelsNoticeModule && <ChannelsNoticeModule.ChannelsNotice />}\n", '', 2)
cut(L, "      {ChannelsNoticeModule && <ChannelsNoticeModule.ChannelsNotice />}\n")

# ------------------------------------------------------- utils/settings/types.ts
cut(
    'utils/settings/types.ts',
    """      // Teams/Enterprise opt-IN for channel notifications. Default OFF.
      // MCP servers that declare the claude/channel capability can push
      // inbound messages into the conversation; for managed orgs this only
      // works when explicitly enabled. Which servers can connect at all is
      // still governed by allowedMcpServers/deniedMcpServers. Not
      // feature-spread: KAIROS_CHANNELS is external:true, and the spread
      // wrecks type inference for allowedChannelPlugins (the .passthrough()
      // catch-all gives {} instead of the array type).
      channelsEnabled: z
        .boolean()
        .optional()
        .describe(
          'Teams/Enterprise opt-in for channel notifications (MCP servers with the ' +
            'claude/channel capability pushing inbound messages). Default off. ' +
            'Set true to allow; users then select servers via --channels.',
        ),
      // Org-level channel plugin allowlist. When set, REPLACES the
      // Anthropic ledger — admin owns the trust decision. Undefined means
      // fall back to the ledger. Plugin-only entry shape (same as the
      // ledger); server-kind entries still need the dev flag.
      allowedChannelPlugins: z
        .array(
          z.object({
            marketplace: z.string(),
            plugin: z.string(),
          }),
        )
        .optional()
        .describe(
          'Teams/Enterprise allowlist of channel plugins. When set, ' +
            'replaces the default Anthropic allowlist — admins decide which ' +
            'plugins may push inbound messages. Undefined falls back to the default. ' +
            'Requires channelsEnabled: true.',
        ),
""",
)

# ------------------------------------------------------- interactiveHelpers.tsx
I = 'interactiveHelpers.tsx'
cut(I, "import { checkGate_CACHED_OR_BLOCKING } from './services/analytics/growthbook.js'\n")
cut(
    I,
    """import {
  type ChannelEntry,
  getAllowedChannels,
  setAllowedChannels,
  setHasDevChannels,
  setSessionTrustAccepted,
  setStatsStore,
} from './bootstrap/state.js'
""",
    """import {
  setSessionTrustAccepted,
  setStatsStore,
} from './bootstrap/state.js'
""",
)
cut(I, "  devChannels?: ChannelEntry[],\n")
cut_upto(
    I,
    '  // --dangerously-load-development-channels confirmation. On accept, append',
    '  return onboardingShown\n}',
)

print('d7f2b ok')
