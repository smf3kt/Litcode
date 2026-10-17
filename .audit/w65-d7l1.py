#!/usr/bin/env python3
"""W65 wave D step 7l part 1: the replBridge* / Remote Control leftovers.

Nothing here is a port. Every site below is the residue of a surface whose
implementation module is absent from this build (useReplBridge, the bridge
dialog, initReplBridge, the CCR ingress): the AppState field family, the
config keys those modules owned, the Remote Control config setting that only
fed the bridge, and the bootstrap state the ant-only bridge set.
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


# --- state/AppStateStore.ts: the two remote-viewer fields and the twelve
# bridge fields. No reader survives anywhere in the tree; every value here was
# written by useReplBridge / the bridge dialog, neither of which exists.

cut_between(
    "state/AppStateStore.ts",
    "  // Remote session URL for --remote mode (shown in footer indicator)\n",
    "  replBridgeInitialName: string | undefined\n",
)

cut_between(
    "state/AppStateStore.ts",
    "    remoteConnectionStatus: 'connecting',\n",
    "    replBridgeInitialName: undefined,\n",
)

# --- main.tsx: the initialState seeds for those fields, the one config read
# that fed replBridgeEnabled, the migration of a key this build no longer has,
# and the migration's import.

cut("main.tsx", "import { migrateReplBridgeEnabledToRemoteControlAtStartup } from './migrations/migrateReplBridgeEnabledToRemoteControlAtStartup.js'\n")
cut("main.tsx", "    migrateReplBridgeEnabledToRemoteControlAtStartup()\n")
cut("main.tsx", "  getRemoteControlAtStartup,\n")
cut("main.tsx", "      const fullRemoteControl = getRemoteControlAtStartup()\n\n")
cut_between(
    "main.tsx",
    "        remoteConnectionStatus: 'connecting',\n",
    "        replBridgeInitialName: undefined,\n",
)
os.remove(os.path.join(ROOT, "migrations/migrateReplBridgeEnabledToRemoteControlAtStartup.ts"))

# --- utils/config.ts: three config-key groups with no reader, the Remote
# Control setting itself and the resolver that defaulted it to false.

cut("utils/config.ts", "  // Remote callout tracking - shown once before first bridge enable\n  remoteDialogSeen?: boolean\n\n")
cut_between(
    "utils/config.ts",
    "  // Cross-process backoff for initReplBridge's oauth_expired_unrefreshable skip.\n",
    "  bridgeOauthDeadFailCount?: number\n\n",
)
cut("utils/config.ts", "  // Run Remote Control at startup (requires BRIDGE_MODE)\n  // undefined = use default (see getRemoteControlAtStartup() for precedence)\n  remoteControlAtStartup?: boolean\n\n")
cut("utils/config.ts", "  'remoteControlAtStartup',\n  'remoteDialogSeen',\n")
cut_between(
    "utils/config.ts",
    "/**\n * Returns the effective value of remoteControlAtStartup. Precedence:\n",
    "export function getRemoteControlAtStartup(): boolean {\n  const explicit = getGlobalConfig().remoteControlAtStartup\n  if (explicit !== undefined) return explicit\n  return false\n}\n\n",
)

# --- tools/ConfigTool: the setting row lived behind feature('BRIDGE_MODE'),
# so isSupported() already rejected it; the tool's two AppState sync blocks
# wrote bridge fields that no longer exist.

cut("tools/ConfigTool/supportedSettings.ts", "import { getRemoteControlAtStartup } from '../../utils/config.js'\n")
cut_between(
    "tools/ConfigTool/supportedSettings.ts",
    "  ...(feature('BRIDGE_MODE')\n",
    "          formatOnRead: () => getRemoteControlAtStartup(),\n        },\n      }\n    : {}),\n",
)
cut("tools/ConfigTool/ConfigTool.ts", "  getRemoteControlAtStartup,\n")
cut_between(
    "tools/ConfigTool/ConfigTool.ts",
    "    // Handle \"default\" — unset the config key so it falls back to the\n",
    "    let finalValue: unknown = value\n",
    "    let finalValue: unknown = value\n",
)
cut_between(
    "tools/ConfigTool/ConfigTool.ts",
    "      // Sync remoteControlAtStartup to AppState so the bridge reacts\n",
    "            replBridgeOutboundOnly: false,\n          }\n        })\n      }\n\n",
)

# --- components/Settings/Config.tsx: the two AppState snapshot/restore pairs
# existed only so the dialog could revert a bridge toggle, and the change
# label can no longer differ from its initial value.

cut("components/Settings/Config.tsx", "  getRemoteControlAtStartup,\n")
cut("components/Settings/Config.tsx", "      replBridgeEnabled: s.replBridgeEnabled,\n      replBridgeOutboundOnly: s.replBridgeOutboundOnly,\n")
cut("components/Settings/Config.tsx", "      replBridgeEnabled: ia.replBridgeEnabled,\n      replBridgeOutboundOnly: ia.replBridgeOutboundOnly,\n")
cut_between(
    "components/Settings/Config.tsx",
    "    if (\n      globalConfig.remoteControlAtStartup !==\n",
    "      formattedChanges.push(remoteLabel)\n    }\n",
)

# --- hooks/useMergedTools.ts: two locals already stubbed to false, kept only
# as memo dependencies.

cut("hooks/useMergedTools.ts", "  let replBridgeEnabled = false\n  let replBridgeOutboundOnly = false\n")
cut("hooks/useMergedTools.ts", "    replBridgeEnabled,\n    replBridgeOutboundOnly,\n")

# --- bootstrap/state.ts: the ant-only bridge flag with its accessor (no
# readers) and the direct-connect URL whose setter has no callers.

cut("bootstrap/state.ts", "  replBridgeActive?: boolean\n")
cut_between(
    "bootstrap/state.ts",
    "    ...(process.env.USER_TYPE === 'ant'\n",
    "      : {}),\n",
)
cut("bootstrap/state.ts", "  // Direct connect server URL (for display in header)\n  directConnectServerUrl: string | undefined\n")
cut("bootstrap/state.ts", "    // Direct connect server URL\n    directConnectServerUrl: undefined,\n")
cut("bootstrap/state.ts", "export function getDirectConnectServerUrl(): string | undefined {\n  return STATE.directConnectServerUrl\n}\n\nexport function setDirectConnectServerUrl(url: string): void {\n  STATE.directConnectServerUrl = url\n}\n\n")
cut("bootstrap/state.ts", "// W59 adapt: recovered chunk-4bw62nzm.js:3034-3035,7612-7613; existing state owns the value.\nexport function isReplBridgeActive(): boolean {\n  return STATE.replBridgeActive\n}\n\n")

# --- utils/logoV2Utils.ts: the header suffix read a value nothing could set,
# so the URL branch is the constant null arm; displayPath had no other use.

cut("utils/logoV2Utils.ts", "import { getDirectConnectServerUrl, getSessionId } from '../bootstrap/state.js'", "import { getSessionId } from '../bootstrap/state.js'")
cut_between(
    "utils/logoV2Utils.ts",
    "  const serverUrl = getDirectConnectServerUrl()\n",
    "    : displayPath\n",
    "  const cwd = process.env.DEMO_VERSION\n    ? '/code/claude'\n    : getDisplayPath(getCwd())\n",
)

# --- Four comments that named removed modules or a removed code path.

cut(
    "ink/root.ts",
    "  // Without it, the first render fires synchronously before async startup work\n  // (e.g. useReplBridge notification state) settles, and the subsequent Static\n  // write overwrites scrollback instead of appending below the logo.\n",
    "  // Without it, the first render fires synchronously before async startup work\n  // settles, and the subsequent Static write overwrites scrollback instead of\n  // appending below the logo.\n",
)
cut(
    "utils/toolSchemaCache.ts",
    "// (which would create a cycle via plans→settings→file→growthbook→config→\n// bridgeEnabled→auth).\n",
    "// (which would create a cycle via plans→settings→file→growthbook→config→auth).\n",
)
cut(
    "utils/messages/systemInit.ts",
    " * Called from two paths that must produce identical shapes:\n *   - QueryEngine (spawn-bridge / print-mode / SDK) — yielded as the first\n *     stream message per query turn\n *   - useReplBridge (REPL Remote Control) — sent via writeSdkMessages() on\n *     bridge connect, since REPL uses query() directly and never hits the\n *     QueryEngine SDKMessage layer\n",
    " * Called from QueryEngine (spawn-bridge / print-mode / SDK), yielded as the\n * first stream message per query turn.\n",
)
cut(
    "services/api/emptyUsage.ts",
    " * Zero-initialized usage object. Extracted from logging.ts so that\n * bridge/replBridge.ts can import it without transitively pulling in\n * api/errors.ts → utils/messages.ts → BashTool.tsx → the world.\n",
    " * Zero-initialized usage object. Extracted from logging.ts so importers avoid\n * transitively pulling in api/errors.ts → utils/messages.ts → BashTool.tsx →\n * the world.\n",
)

print("7l part 1 applied")
