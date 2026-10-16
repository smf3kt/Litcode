"""W65 wave D step 7f, part 1: the channel modules and the state they kept.

Channel notifications are the claude.ai connector push surface: an MCP server
sends `notifications/claude/channel`, the process wraps it in a <channel> tag
and enqueues it. Everything here sat behind `feature('KAIROS') ||
feature('KAIROS_CHANNELS')` (both false) and required claude.ai OAuth, a
GrowthBook ledger and managed-org policy. That is the account/network surface
the port excludes, so the modules and their state go first and the hosts in
part 2 lose their last references.
"""

import os
import shutil

B = '/Users/mant1ssa/Projects/cc-base-2188/'
Q = '/Users/mant1ssa/Projects/cc_reverse/.audit/w65-d7f-baks/'


def rd(p):
    return open(B + p, encoding='utf-8').read()


def wr(p, t):
    open(B + p, 'w', encoding='utf-8').write(t)


def cut(p, old, new=''):
    t = rd(p)
    n = t.count(old)
    assert n == 1, (p, old[:80], n)
    wr(p, t.replace(old, new))


def cut_span(p, start_sub, end_sub, new=''):
    """Delete from the line holding start_sub through the line holding end_sub."""
    t = rd(p)
    assert t.count(start_sub) == 1, (p, 'start', start_sub[:80], t.count(start_sub))
    i = t.index(start_sub)
    i = t.rindex('\n', 0, i) + 1
    j = t.index(end_sub, i)
    assert t.count(end_sub) == 1, (p, 'end', end_sub[:80], t.count(end_sub))
    j = t.index('\n', j) + 1
    wr(p, t[:i] + new + t[j:])


# ---- 1. quarantine the inline-source-map backups -------------------------
for d, base in [
    ('services/mcp/', 'channelAllowlist.ts'),
    ('services/mcp/', 'channelNotification.ts'),
    ('services/mcp/', 'channelPermissions.ts'),
    ('components/messages/', 'UserChannelMessage.tsx'),
    ('components/LogoV2/', 'ChannelsNotice.tsx'),
    ('components/', 'DevChannelsDialog.tsx'),
]:
    baks = [f for f in os.listdir(B + d) if f.startswith(base + '.w')]
    for f in baks:
        src = B + d + f
        dst = Q + d + f
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src, dst)
        assert open(src, 'rb').read() == open(dst, 'rb').read(), src
        print('quarantined', d + f)

# ---- 2. the six modules ---------------------------------------------------
for rel in [
    'services/mcp/channelAllowlist.ts',
    'services/mcp/channelNotification.ts',
    'services/mcp/channelPermissions.ts',
    'components/messages/UserChannelMessage.tsx',
    'components/LogoV2/ChannelsNotice.tsx',
    'components/DevChannelsDialog.tsx',
]:
    os.remove(B + rel)

# ---- 3. the two constants that only those modules read --------------------
cut('constants/xml.ts', "export const CHANNEL_TAG = 'channel'\n")
cut(
    'constants/figures.ts',
    "export const CHANNEL_ARROW = '\\u2190' // ← - inbound channel message indicator\n",
)

# ---- 4. bootstrap/state.ts: the session allowlist -------------------------
cut('bootstrap/state.ts', """// dev: true on entries that came via --dangerously-load-development-channels.
// The allowlist gate checks this per-entry (not the session-wide
// hasDevChannels bit) so passing both flags doesn't let the dev dialog's
// acceptance leak allowlist-bypass to the --channels entries.
export type ChannelEntry =
  | { kind: 'plugin'; name: string; marketplace: string; dev?: boolean }
  | { kind: 'server'; name: string; dev?: boolean }

""")
cut('bootstrap/state.ts', """  // Channel server allowlist from --channels flag (servers whose channel
  // notifications should register this session). Parsed once in main.tsx —
  // the tag decides trust model: 'plugin' → marketplace verification +
  // allowlist, 'server' → allowlist always fails (schema is plugin-only).
  // Either kind needs entry.dev to bypass allowlist.
  allowedChannels: ChannelEntry[]
  // True if any entry in allowedChannels came from
  // --dangerously-load-development-channels (so ChannelsNotice can name the
  // right flag in policy-blocked messages)
  hasDevChannels: boolean
""")
cut('bootstrap/state.ts', """    // Channel server allowlist from --channels flag
    allowedChannels: [],
    hasDevChannels: false,
""")
cut('bootstrap/state.ts', """export function getAllowedChannels(): ChannelEntry[] {
  return STATE.allowedChannels
}

export function setAllowedChannels(entries: ChannelEntry[]): void {
  STATE.allowedChannels = entries
}

""")
cut_span(
    'bootstrap/state.ts',
    'export function getHasDevChannels(): boolean {',
    '  STATE.hasDevChannels = value\n}',
    '',
)

# ---- 5. AppStateStore: the relay callbacks --------------------------------
cut('state/AppStateStore.ts', "import type { ChannelPermissionCallbacks } from '../services/mcp/channelPermissions.js'\n")
cut('state/AppStateStore.ts', """  // Channel permission callbacks — permission prompts over Telegram/iMessage/etc.
  // Races against local UI + bridge + hooks + classifier via claim() in
  // interactiveHandler.ts. Constructed once in useManageMCPConnections.
  channelPermissionCallbacks?: ChannelPermissionCallbacks
""")

# ---- 6. growthbook: its last caller was the channels warm-up --------------
cut_span(
    'services/analytics/growthbook.ts',
    """/**
 * Check a boolean entitlement gate with fallback-to-blocking semantics.""",
    '  return getFeatureValueInternal(gate, false, true)\n}',
    '',
)

print('d7f1 ok')
