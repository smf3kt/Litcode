#!/usr/bin/env python3
"""W65 wave D step 7m part 1: the bridge-origin command gate and its writers.

Two QueuedCommand fields (`skipSlashCommands`, `bridgeOrigin`) had no producer
anywhere in the tree: every queue entry is built by handlePromptSubmit from
local input or by REPL/print's own enqueue, and neither sets them. The bridge
inbound path that did is absent, so both are permanently falsy and everything
guarded on them folds. `createBridgeStatusMessage` likewise had no caller, and
`remoteControlSpawnMode`, `updateSessionBridgeId` and `sessionSource` had no
readers.
"""

import io
import os

ROOT = "/Users/mant1ssa/Projects/cc-base-2188"


def read(p):
    with io.open(os.path.join(ROOT, p), encoding="utf-8") as f:
        return f.read()


def write(p, s):
    with io.open(os.path.join(ROOT, p), "w", encoding="utf-8", newline="") as f:
        f.write(s)


def cut(path, old, new="", n=1):
    s = read(path)
    got = s.count(old)
    assert got == n, f"{path}: expected {n}, found {got}: {old[:120]!r}"
    write(path, s.replace(old, new, n))


def cut_between(path, start, end, new=""):
    s = read(path)
    i = s.find(start)
    assert i >= 0, f"{path}: start not found: {start[:120]!r}"
    assert s.count(start) == 1, f"{path}: start not unique: {start[:120]!r}"
    j = s.find(end, i)
    assert j >= 0, f"{path}: end not found after start: {end[:120]!r}"
    assert s.count(end) == 1, f"{path}: end not unique: {end[:120]!r}"
    write(path, s[:i] + new + s[j + len(end):])


# --- types/textInputTypes.ts: the two QueuedCommand fields the bridge's
# inbound path was the only writer of.

cut_between(
    "types/textInputTypes.ts",
    "  /**\n   * When true, the input is treated as plain text even if it starts with `/`.\n",
    "  bridgeOrigin?: boolean\n",
)

# --- utils/processUserInput/processUserInput.ts: the same two options, the
# override block that only `bridgeOrigin` could enter, and the now-constant
# `effectiveSkipSlash` its gates.

cut("utils/processUserInput/processUserInput.ts", "  skipSlashCommands,\n  bridgeOrigin,\n")
cut("utils/processUserInput/processUserInput.ts", "  isBridgeSafeCommand,\n")
cut_between(
    "utils/processUserInput/processUserInput.ts",
    "  /**\n   * When true, input starting with `/` is treated as plain text.\n",
    "  bridgeOrigin?: boolean\n",
)
cut("utils/processUserInput/processUserInput.ts", "    skipSlashCommands,\n    bridgeOrigin,\n")
cut("utils/processUserInput/processUserInput.ts", "  skipSlashCommands?: boolean,\n  bridgeOrigin?: boolean,\n")
cut_between(
    "utils/processUserInput/processUserInput.ts",
    "  // Bridge-safe slash command override: mobile/web clients set bridgeOrigin\n",
    "    // Unknown /foo or unparseable — fall through to plain text, same as\n    // pre-#19134. A mobile user typing \"/shrug\" shouldn't see \"Unknown skill\".\n  }\n\n",
)
cut(
    "utils/processUserInput/processUserInput.ts",
    "    (mode !== 'prompt' || effectiveSkipSlash || !inputString.startsWith('/'))",
    "    (mode !== 'prompt' || !inputString.startsWith('/'))",
)
cut(
    "utils/processUserInput/processUserInput.ts",
    "  // Slash commands\n  // Skip for remote bridge messages — input from CCR clients is plain text\n  if (\n    inputString !== null &&\n    !effectiveSkipSlash &&\n    inputString.startsWith('/')\n  ) {",
    "  // Slash commands\n  if (inputString !== null && inputString.startsWith('/')) {",
)

# --- utils/handlePromptSubmit.ts: the same option threaded through four
# layers, two gates written as `!skipSlashCommands &&`, and the two reads of
# the QueuedCommand fields.

cut_between(
    "utils/handlePromptSubmit.ts",
    "  /**\n   * When true, input starting with `/` is treated as plain text.\n",
    "  skipSlashCommands?: boolean\n",
)
cut("utils/handlePromptSubmit.ts", "    uuid,\n    skipSlashCommands,\n  } = params\n", "    uuid,\n  } = params\n")
cut(
    "utils/handlePromptSubmit.ts",
    "  // Handle exit commands by triggering the exit command instead of direct process.exit\n  // Skip for remote bridge messages — \"exit\" typed on iOS shouldn't kill the local session\n  if (\n    !skipSlashCommands &&\n    ['exit', 'quit', ':q', ':q!', ':wq', ':wq!'].includes(input.trim())\n  ) {",
    "  // Handle exit commands by triggering the exit command instead of direct process.exit\n  if (['exit', 'quit', ':q', ':q!', ':wq', ':wq!'].includes(input.trim())) {",
)
cut(
    "utils/handlePromptSubmit.ts",
    "  // Handle local-jsx immediate commands (e.g., /config, /doctor)\n  // Skip for remote bridge messages — slash commands from CCR clients are plain text\n  if (!skipSlashCommands && finalInput.trim().startsWith('/')) {",
    "  // Handle local-jsx immediate commands (e.g., /config, /doctor)\n  if (finalInput.trim().startsWith('/')) {",
)
cut(
    "utils/handlePromptSubmit.ts",
    "      pastedContents: hasImages ? pastedContents : undefined,\n      skipSlashCommands,\n      uuid,\n",
    "      pastedContents: hasImages ? pastedContents : undefined,\n      uuid,\n",
)
cut(
    "utils/handlePromptSubmit.ts",
    "    pastedContents: hasImages ? pastedContents : undefined,\n    skipSlashCommands,\n    uuid,\n  }\n",
    "    pastedContents: hasImages ? pastedContents : undefined,\n    uuid,\n  }\n",
)
cut("utils/handlePromptSubmit.ts", "          skipSlashCommands: cmd.skipSlashCommands,\n          bridgeOrigin: cmd.bridgeOrigin,\n")

# --- utils/messageQueueManager.ts: the third `!skipSlashCommands` gate.

cut_between(
    "utils/messageQueueManager.ts",
    " * Commands with `skipSlashCommands` (e.g. bridge/CCR messages) are NOT treated\n * as slash commands — their text is meant for the model.\n */\nexport function isSlashCommand(cmd: QueuedCommand): boolean {\n",
    "    !cmd.skipSlashCommands\n  )\n}\n",
    "export function isSlashCommand(cmd: QueuedCommand): boolean {\n  return typeof cmd.value === 'string' && cmd.value.trim().startsWith('/')\n}\n",
)

# --- commands.ts: the bridge allowlist and its predicate. Its one caller was
# the override block deleted above.

cut_between(
    "commands.ts",
    "/**\n * Builtin commands of type 'local' that ARE safe to execute when received\n",
    "  return BRIDGE_SAFE_COMMANDS.has(cmd)\n}\n",
)

# --- utils/concurrentSessions.ts: the bridge-session pid write. No caller,
# and nothing reads the key it wrote.

cut_between(
    "utils/concurrentSessions.ts",
    "/**\n * Record this session's Remote Control session ID so peer enumeration can\n",
    "  await updatePidFile({ bridgeSessionId })\n}\n",
)

# --- utils/config.ts: the spawn mode only the absent `claude remote-control`
# launcher read.

cut("utils/config.ts", "  /** Spawn mode for `claude remote-control` multi-session. Set by first-run dialog or `w` toggle. */\n  remoteControlSpawnMode?: 'same-dir' | 'worktree'\n")

# --- bootstrap/state.ts: the session-source tag nothing read.

cut("bootstrap/state.ts", "  sessionSource: string | undefined\n")
cut("bootstrap/state.ts", "    sessionSource: undefined,\n")
cut("bootstrap/state.ts", "export function getSessionSource(): string | undefined {\n  return STATE.sessionSource\n}\n\nexport function setSessionSource(source: string): void {\n  STATE.sessionSource = source\n}\n\n")

# --- main.tsx: its single writer.

cut("main.tsx", "  setSessionSource,\n")
cut(
    "main.tsx",
    "  // Tag sessions created via `claude remote-control` so the backend can identify them\n  if (process.env.CLAUDE_CODE_ENVIRONMENT_KIND === 'bridge') {\n    setSessionSource('remote-control')\n  }\n\n",
)

# --- utils/messages.ts + types/message.ts + SystemTextMessage.tsx: the
# bridge status message had a constructor, a type and a renderer but no
# producer anywhere in the tree.

cut(
    "utils/messages.ts",
    "export function createBridgeStatusMessage(\n  url: string,\n  upgradeNudge?: string,\n): SystemBridgeStatusMessage {\n  return {\n    type: 'system',\n    subtype: 'bridge_status',\n    content: `/remote-control is active. Code in CLI or at ${url}`,\n    url,\n    upgradeNudge,\n    isMeta: false,\n    timestamp: new Date().toISOString(),\n    uuid: randomUUID(),\n  }\n}\n\n",
)
cut("utils/messages.ts", "  SystemBridgeStatusMessage,\n")
cut("types/message.ts", '"bridge_status" | ')
cut("types/message.ts", "export type SystemBridgeStatusMessage = SystemMessage & { subtype: 'bridge_status' }\n")
cut("components/messages/SystemTextMessage.tsx", "  SystemBridgeStatusMessage,\n")
cut(
    "components/messages/SystemTextMessage.tsx",
    "  if (message.subtype === 'bridge_status') {\n    return <BridgeStatusMessage message={message} addMargin={addMargin} />\n  }\n\n",
)
cut_between(
    "components/messages/SystemTextMessage.tsx",
    "function BridgeStatusMessage({\n",
    "        {message.upgradeNudge && <Text dimColor>⎿ {message.upgradeNudge}</Text>}\n      </Box>\n    </Box>\n  )\n}\n",
)
# The removed component was the last one in the file; leave one trailing newline.
_s = read("components/messages/SystemTextMessage.tsx")
assert _s.endswith("}\n\n"), "expected the trimmed file to end with a blank line"
write("components/messages/SystemTextMessage.tsx", _s[:-1])

print("7m part 1 applied")
