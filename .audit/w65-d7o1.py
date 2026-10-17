#!/usr/bin/env python3
"""W65 wave D step 7o: the UDS_INBOX peer-messaging lane.

feature('UDS_INBOX') is false, so every gated site folds to its off arm:
the ListPeers tool slot, SendMessageTool's uds:/bridge: recipient rows and
its two cross-session validation branches, the init message's hidden
messaging_socket_path, the PID file's messagingSocketPath field, main.tsx's
--messaging-socket-path option and replay-flag promotion, and setup()'s
now-empty UDS server gate. parseAddress's only consumer was that pair of
branches, so utils/peerAddress.ts goes with them.
"""

import pathlib

ROOT = pathlib.Path("/Users/mant1ssa/Projects/cc-base-2188")


def read(p):
    return (ROOT / p).read_text()


def write(p, s):
    (ROOT / p).write_text(s)


def cut(path, old, new="", n=1):
    s = read(path)
    c = s.count(old)
    assert c == n, f"{path}: expected {n} occurrence(s), found {c}: {old[:100]!r}"
    write(path, s.replace(old, new))


def cut_between(path, start, end, new=""):
    s = read(path)
    assert s.count(start) == 1, f"{path}: start anchor not unique: {start[:100]!r}"
    assert s.count(end) == 1, f"{path}: end anchor not unique: {end[:100]!r}"
    i = s.index(start)
    j = s.index(end, i)
    write(path, s[:i] + new + s[j + len(end):])


# --- tools.ts: the ListPeers tool slot (module directory absent from the build)
cut(
    "tools.ts",
    "const ListPeersTool = feature('UDS_INBOX')\n"
    "  ? require('./tools/ListPeersTool/ListPeersTool.js').ListPeersTool\n"
    "  : null\n",
)
cut("tools.ts", "    ...(ListPeersTool ? [ListPeersTool] : []),\n")

# --- SendMessageTool: recipient doc row, the two cross-session branches
SMT = "tools/SendMessageTool/SendMessageTool.ts"
cut(SMT, "import { parseAddress } from '../../utils/peerAddress.js'\n")
cut(
    SMT,
    "        feature('UDS_INBOX')\n"
    "          ? 'Recipient: teammate name, \"*\" for broadcast, \"uds:<socket-path>\" for a local peer, or \"bridge:<session-id>\" for a Remote Control peer'\n"
    "          : 'Recipient: teammate name, or \"*\" for broadcast to all teammates',\n",
    "        'Recipient: teammate name, or \"*\" for broadcast to all teammates',\n",
)
cut(
    SMT,
    "      if (\n"
    "        feature('UDS_INBOX') &&\n"
    "        parseAddress(input.to).scheme === 'uds' &&\n"
    "        typeof input.message === 'string'\n"
    "      ) {\n"
    "        // UDS cross-session send: summary isn't rendered (UI.tsx returns null\n"
    "        // for string messages), so don't require it. Structured messages fall\n"
    "        // through to the rejection below.\n"
    "        return { result: true }\n"
    "      }\n",
)
cut(
    SMT,
    "      if (feature('UDS_INBOX') && parseAddress(input.to).scheme !== 'other') {\n"
    "        return {\n"
    "          result: false,\n"
    "          message:\n"
    "            'structured messages cannot be sent cross-session — only plain text',\n"
    "          errorCode: 9,\n"
    "        }\n"
    "      }\n\n",
)
# The peer-address grammar check in validateInput is not feature-gated, but its
# only trigger is a `uds:`/`/` recipient, which the tool's own prompt no longer
# documents once the uds rows go; the empty-name check above and teammate
# resolution cover every documented `to`.
cut(
    SMT,
    "      const addr = parseAddress(input.to)\n"
    "      if (\n"
    "        addr.scheme === 'uds' &&\n"
    "        addr.target.trim().length === 0\n"
    "      ) {\n"
    "        return {\n"
    "          result: false,\n"
    "          message: 'address target must not be empty',\n"
    "          errorCode: 9,\n"
    "        }\n"
    "      }\n",
)
cut(SMT, "import { feature } from 'bun:bundle'\n")

# --- SendMessageTool prompt: the uds row and the Cross-session section
cut("tools/SendMessageTool/prompt.ts", "|${udsRow}\n", "|\n")
cut("tools/SendMessageTool/prompt.ts", "${udsSection}\n", "\n")
cut_between(
    "tools/SendMessageTool/prompt.ts",
    "  const udsRow = feature('UDS_INBOX')\n",
    "  return `\n",
    "  return `\n",
)
cut("tools/SendMessageTool/prompt.ts", "import { feature } from 'bun:bundle'\n\n")

# --- init message: the ant-only hidden socket path (require target absent)
cut(
    "utils/messages/systemInit.ts",
    "  // Hidden from public SDK types — ant-only UDS messaging socket path\n"
    "  if (feature('UDS_INBOX')) {\n"
    "    /* eslint-disable @typescript-eslint/no-require-imports */\n"
    "    ;(initMessage as Record<string, unknown>).messaging_socket_path =\n"
    "      require('../udsMessaging.js').getUdsMessagingSocketPath()\n"
    "    /* eslint-enable @typescript-eslint/no-require-imports */\n"
    "  }\n",
)
cut("utils/messages/systemInit.ts", "import { feature } from 'bun:bundle'\n")

# --- PID registry: the socket path field and the ListPeers comment
cut(
    "utils/concurrentSessions.ts",
    "        ...(feature('UDS_INBOX')\n"
    "          ? { messagingSocketPath: process.env.CLAUDE_CODE_MESSAGING_SOCKET }\n"
    "          : {}),\n",
)
cut(
    "utils/concurrentSessions.ts",
    " * Update this session's name in its PID registry file so ListPeers\n"
    " * can surface it. Best-effort: silently no-op if name is falsy, the\n"
    " * file doesn't exist (session not registered), or read/write fails.\n",
    " * Update this session's name in its PID registry file. Best-effort:\n"
    " * silently no-op if name is falsy, the file doesn't exist (session not\n"
    " * registered), or read/write fails.\n",
)

# --- transcript rendering: the stranded cross-session comment
cut_between(
    "components/messages/UserTextMessage.tsx",
    "  // Cross-session UDS message (from another Claude session's SendMessage).\n",
    "  // User prompts>\n  return (\n",
    "  // User prompts>\n  return (\n",
)

# --- main.tsx: the socket option, its plumbing and the replay promotion
MAIN = "main.tsx"
cut(
    MAIN,
    "      const messagingSocketPath = feature('UDS_INBOX')\n"
    "        ? (options as { messagingSocketPath?: string }).messagingSocketPath\n"
    "        : undefined\n",
)
cut(MAIN, "        messagingSocketPath,\n")
cut(
    MAIN,
    "      // Parallelize setup() with commands+agents loading. setup()'s ~28ms is\n"
    "      // mostly startUdsMessaging (socket bind, ~20ms) — not disk-bound, so it\n"
    "      // doesn't contend with getCommands' file reads. Gated on !worktreeEnabled\n"
    "      // since --worktree makes setup() process.chdir() (setup.ts:203), and\n"
    "      // commands/agents need the post-chdir cwd.\n",
    "      // Parallelize setup() with commands+agents loading. Gated on\n"
    "      // !worktreeEnabled since --worktree makes setup() process.chdir()\n"
    "      // (setup.ts:203), and commands/agents need the post-chdir cwd.\n",
)
cut(
    MAIN,
    "      // Replay user messages into stream-json only when the socket was\n"
    "      // explicitly requested. The auto-generated socket is passive — it\n"
    "      // lets tools inject if they want to, but turning it on by default\n"
    "      // shouldn't reshape stream-json for SDK consumers who never touch it.\n"
    "      // Callers who inject and also want those injections visible in the\n"
    "      // stream pass --messaging-socket-path explicitly (or --replay-user-messages).\n"
    "      let effectiveReplayUserMessages = !!options.replayUserMessages\n"
    "      if (feature('UDS_INBOX')) {\n"
    "        if (!effectiveReplayUserMessages && outputFormat === 'stream-json') {\n"
    "          effectiveReplayUserMessages = !!(\n"
    "            options as { messagingSocketPath?: string }\n"
    "          ).messagingSocketPath\n"
    "        }\n"
    "      }\n",
    "      let effectiveReplayUserMessages = !!options.replayUserMessages\n",
)
cut(
    MAIN,
    "  if (feature('UDS_INBOX')) {\n"
    "    program.addOption(\n"
    "      new Option(\n"
    "        '--messaging-socket-path <path>',\n"
    "        'Unix domain socket path for the UDS messaging server (defaults to a tmp path)',\n"
    "      ),\n"
    "    )\n"
    "  }\n\n",
)

# --- setup(): the parameter and the emptied UDS server gate
SETUP = "setup.ts"
cut(
    SETUP,
    "  // --bare / SIMPLE: skip UDS messaging server and teammate snapshot.\n"
    "  // Scripted calls don't receive injected messages and don't use swarm teammates.\n"
    "  // Explicit --messaging-socket-path is the escape hatch (per #23222 gate pattern).\n"
    "  if (!isBareMode() || messagingSocketPath !== undefined) {\n"
    "    // Start UDS messaging server (Mac/Linux only).\n"
    "    // Enabled by default for ants — creates a socket in tmpdir if no\n"
    "    // --messaging-socket-path is passed. Awaited so the server is bound\n"
    "    // and $CLAUDE_CODE_MESSAGING_SOCKET is exported before any hook\n"
    "    // (SessionStart in particular) can spawn and snapshot process.env.\n"
    "  }\n\n",
)
cut(SETUP, "  messagingSocketPath?: string,\n")
cut(
    SETUP,
    "  // the await points above (startUdsMessaging, ~20ms) meant getCommands()\n"
    "  // raced ahead and memoized an empty bundledSkills list.\n",
    "  // the await points above meant getCommands() raced ahead and memoized an\n"
    "  // empty bundledSkills list.\n",
)

# --- the peer address parser: last consumer removed above
p = ROOT / "utils/peerAddress.ts"
assert p.exists() and not (ROOT / "utils/peerRegistry.ts").exists()
p.unlink()

print("7o cut applied")
