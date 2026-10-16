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


# ================= cli/print.ts =================
P = 'cli/print.ts'
cut(P, "import type { ReplBridgeHandle } from 'src/bridge/replBridge.js'\n")
cut(P, "import { getRemoteSessionUrl } from 'src/constants/product.js'\n")
cut(P, "import { buildBridgeConnectUrl } from 'src/bridge/bridgeStatusUtil.js'\n")
cut(P, "import { extractInboundMessageFields } from 'src/bridge/inboundMessages.js'\n")
cut(P, "import { resolveAndPrepend } from 'src/bridge/inboundAttachments.js'\n")

cut_range(
    P,
    "  // Bridge handle for remote-control (SDK control message).\n",
    "  // Helper to apply MCP server changes - used by both mcp_set_servers control message\n",
    "  // Helper to apply MCP server changes - used by both mcp_set_servers control message\n",
)

cut(P, """          if (structuredIO instanceof RemoteIO && command.mode === 'prompt') {
            logEvent('tengu_bridge_message_received', {
              is_repl: false,
            })
          }

""")

cut(P, """              // Forward messages to bridge incrementally (mid-turn) so
              // claude.ai sees progress and the connection stays alive
              // while blocked on permission requests.
              forwardMessagesToBridge()

""")

cut(P, """          // Forward messages to bridge after each turn
          forwardMessagesToBridge()
          bridgeHandle?.sendResult()

""")

cut_range(
    P,
    "        } else if (message.request.subtype === 'remote_control') {\n",
    "        } else {\n          // Unknown control request subtype",
    "        } else {\n          // Unknown control request subtype",
)

cut(P, """      enqueue({
        mode: 'prompt' as const,
        // file_attachments rides the protobuf catchall from the web composer.
        // Same-ref no-op when absent (no 'file_attachments' key).
        value: await resolveAndPrepend(message, message.message.content),
""", """      enqueue({
        mode: 'prompt' as const,
        value: message.message.content,
""")

cut(P, """    // See gh-23085: isBridgeEnabled() at Commander-definition time poisoned
    // the settings cache before setEligibility(true) ran.
""", """    // See gh-23085: a settings read at Commander-definition time poisoned the
    // settings cache before setEligibility(true) ran.
""")

t = rd(P)
for bad in ['bridgeHandle', 'forwardMessagesToBridge', 'bridgeStatusUtil', 'ReplBridgeHandle',
            'resolveAndPrepend', 'extractInboundMessageFields', 'getRemoteSessionUrl',
            'remote_control', 'tengu_bridge']:
    assert bad not in t, (bad, 'print.ts 残留')

print('e5b ok')
