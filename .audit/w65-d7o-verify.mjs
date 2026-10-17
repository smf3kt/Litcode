import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "34b8444"
const digest = text => createHash("sha256").update(text).digest("hex")

// This wave ports nothing. feature('UDS_INBOX') is false, so the cross-session
// peer-messaging lane folds to its off arm at every site that asks for it, and
// the module whose only consumer those arms were leaves with them: the three
// things the gated requires resolve — tools/ListPeersTool/, utils/udsMessaging.ts
// and the utils/peerRegistry.ts that utils/peerAddress.ts' own header names — are
// absent from the build, so each arm was already unreachable.
function rg(pattern) {
  try {
    return execFileSync("rg", [
      "-n", "--glob", "!node_modules", "--glob", "!*.w*bak", "--glob", "!*.json", "--glob", "!*.md",
      "-e", pattern, root,
    ], {encoding: "utf8"}).trim()
  } catch (e) {
    assert.equal(e.status, 1, `rg failed: ${e.message}`)
    return ""
  }
}

const read = p => fs.readFileSync(`${root}/${p}`, "utf8")

// 1. The lane's whole vocabulary, and the four paths it lived in.
assert.equal(
  rg("UDS_INBOX|ListPeers|peerAddress|parseAddress|udsMessaging|startUdsMessaging|CLAUDE_CODE_MESSAGING_SOCKET|messagingSocketPath|messaging_socket_path|messaging-socket-path"),
  "",
  "a live reference to the removed peer-messaging surface remains",
)
for (const p of [
  "utils/peerAddress.ts",
  "tools/ListPeersTool",
  "utils/udsMessaging.ts",
  "utils/peerRegistry.ts",
]) {
  assert.equal(fs.existsSync(`${root}/${p}`), false, `${p} is gone`)
}

// 2. Every gated site took the arm the false flag produced, and the siblings
//    that shared those expressions stay.
const tools = read("tools.ts")
assert.doesNotMatch(tools, /ListPeersTool/)
assert.match(
  tools,
  /    getSendMessageTool\(\),\n    \.\.\.\(isAgentSwarmsEnabled\(\)\n      \? \[getTeamCreateTool\(\), getTeamDeleteTool\(\)\]\n      : \[\]\),\n/,
)

const smt = read("tools/SendMessageTool/SendMessageTool.ts")
assert.doesNotMatch(smt, /UDS_INBOX|parseAddress|from 'bun:bundle'/)
assert.match(smt, /        'Recipient: teammate name, or "\*" for broadcast to all teammates',\n/)
assert.match(
  smt,
  /      if \(input\.to\.includes\('@'\)\) \{\n        return \{\n          result: false,\n          message:\n            'to must be a bare teammate name or "\*" — there is only one team per session',\n          errorCode: 9,\n        \}\n      \}\n/,
)
assert.match(
  smt,
  /      if \(typeof input\.message === 'string'\) \{\n        if \(!input\.summary \|\| input\.summary\.trim\(\)\.length === 0\) \{\n/,
)

const prompt = read("tools/SendMessageTool/prompt.ts")
assert.doesNotMatch(prompt, /udsRow|udsSection|ListPeers|ross-session/)
assert.match(prompt, /^export const DESCRIPTION = 'Send a message to another agent'\n/)
assert.match(prompt, /Broadcast to all teammates — expensive \(linear in team size\)/)
assert.match(prompt, /## Protocol responses \(legacy\)/)

const systemInit = read("utils/messages/systemInit.ts")
assert.doesNotMatch(systemInit, /UDS_INBOX|messaging_socket_path|bun:bundle/)
assert.match(systemInit, /^import \{ randomUUID \} from 'crypto'\n/)
assert.match(systemInit, /  initMessage\.fast_mode_state = getFastModeState\(inputs\.model, inputs\.fastMode\)\n/)

const concurrent = read("utils/concurrentSessions.ts")
assert.doesNotMatch(concurrent, /UDS_INBOX|messagingSocketPath/)
assert.match(
  concurrent,
  / \* Update this session's name in its PID registry file\. Best-effort:\n \* silently no-op if name is falsy, the file doesn't exist \(session not\n \* registered\), or read\/write fails\.\n/,
)
assert.match(concurrent, /        \.\.\.\(feature\('BG_SESSIONS'\)\n/)

const user = read("components/messages/UserTextMessage.tsx")
assert.doesNotMatch(user, /UDS_INBOX|CROSS_SESSION_MESSAGE_TAG/)
assert.match(user, /  \/\/ User prompts>\n  return \(\n/)

const main = read("main.tsx")
assert.doesNotMatch(main, /messagingSocketPath|messaging-socket-path|UDS_INBOX|startUdsMessaging/)
assert.match(
  main,
  /      let effectiveReplayUserMessages = !!options\.replayUserMessages\n\n      if \(getIsNonInteractiveSession\(\)\) \{\n/,
)
assert.match(main, /        worktreePRNumber,\n      \)\n/)
assert.match(main, /      \/\/ Parallelize setup\(\) with commands\+agents loading\. Gated on\n/)

const setup = read("setup.ts")
assert.doesNotMatch(setup, /UDS_INBOX|messagingSocketPath|startUdsMessaging/)
assert.match(setup, /  worktreePRNumber\?: number,\n\): Promise<void> \{\n/)
assert.match(setup, /  \/\/ Teammate snapshot — SIMPLE-only gate \(no escape hatch, swarm not used in bare\)\n/)
assert.match(setup, /  \/\/ the await points above meant getCommands\(\) raced ahead and memoized an\n/)

// 3. The gate.
const tscText = fs.readFileSync(new URL("w65-d7o-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

const digests = {}
for (const f of [
  "utils/peerAddress.ts",
  "tools.ts",
  "tools/SendMessageTool/SendMessageTool.ts",
  "tools/SendMessageTool/prompt.ts",
  "utils/messages/systemInit.ts",
  "utils/concurrentSessions.ts",
  "components/messages/UserTextMessage.tsx",
  "main.tsx",
  "setup.ts",
]) {
  digests[f] = digest(execFileSync("git", ["-C", root, "show", `${before}:${f}`], {encoding: "utf8"}))
}

fs.writeFileSync(
  new URL("w65-d7o-source-evidence.json", import.meta.url),
  JSON.stringify(
    {
      before,
      kind: "UDS_INBOX peer-messaging lane removal (no ported bodies; one module deleted with its last consumer)",
      surface:
        "the cross-session send surface: the ListPeers tool slot in tools.ts, SendMessageTool's uds:/bridge: recipient row, its two cross-session validation branches and its peer-grammar check, the prompt's uds row and Cross-session section, the init message's hidden messaging_socket_path, the PID registry's messagingSocketPath field, main.tsx' --messaging-socket-path option with its setup() plumbing and stream-json replay promotion, setup()'s emptied UDS server gate, and the transcript renderer's stranded cross-session comment",
      decisiveFact:
        "every one of these sites is gated by feature('UDS_INBOX'), which shims/bun-bundle.ts returns false for; the modules the gated requires name — tools/ListPeersTool/ListPeersTool.js, ../udsMessaging.js and the peerRegistry.ts utils/peerAddress.ts is split out to avoid — are absent from the build, so each gated arm already resolved to nothing and each doc row already rendered as empty",
      evidence: [
        {
          file: "utils/peerAddress.ts",
          change:
            "removed whole (19 lines): parseAddress's two consumers were the cross-session branches in SendMessageTool; with them folded the module had no importer",
          sourceSha256: digests["utils/peerAddress.ts"],
          portSha256: null,
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "tools.ts",
          change:
            "the ListPeersTool require ternary deleted (its module directory does not exist) together with its entry in the tool pool; getSendMessageTool's own slot and the swarm gate beside it are untouched",
          sourceSha256: digests["tools.ts"],
          portSha256: digest(tools),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "tools/SendMessageTool/SendMessageTool.ts",
          change:
            "the input schema's recipient describe folds to its off string, both cross-session validation branches go, the peer-grammar empty-target check goes with the module it parsed, and the now-unused bun:bundle import is dropped; the teammate/broadcast path is byte-identical",
          sourceSha256: digests["tools/SendMessageTool/SendMessageTool.ts"],
          portSha256: digest(smt),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "tools/SendMessageTool/prompt.ts",
          change:
            "the uds row and the Cross-session section fold to the empty strings their own ternary produced, the two interpolations go, and the feature import is dropped; the protocol-response section is untouched",
          sourceSha256: digests["tools/SendMessageTool/prompt.ts"],
          portSha256: digest(prompt),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/messages/systemInit.ts",
          change:
            "the hidden messaging_socket_path field — a require of an absent module — is deleted with the ant-only comment above it and the feature import",
          sourceSha256: digests["utils/messages/systemInit.ts"],
          portSha256: digest(systemInit),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "utils/concurrentSessions.ts",
          change:
            "the PID file's messagingSocketPath spread goes (the env var it read is never set anywhere in the build); updatePidFile's doc comment loses the ListPeers clause but keeps its best-effort contract",
          sourceSha256: digests["utils/concurrentSessions.ts"],
          portSha256: digest(concurrent),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "components/messages/UserTextMessage.tsx",
          change:
            "the stranded cross-session comment (its branch was removed in an earlier wave) is deleted; the fork-boilerplate comment above it and the UserPromptMessage arm below are untouched",
          sourceSha256: digests["components/messages/UserTextMessage.tsx"],
          portSha256: digest(user),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "main.tsx",
          change:
            "the messagingSocketPath local and its setup() argument go, the replay promotion folds to options.replayUserMessages alone, the --messaging-socket-path option is deleted, and the setup() parallelization comment loses its startUdsMessaging rationale",
          sourceSha256: digests["main.tsx"],
          portSha256: digest(main),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "setup.ts",
          change:
            "the messagingSocketPath parameter goes and the UDS server gate it widened is removed — an if whose body was already empty, since the startUdsMessaging call left in an earlier wave; the comment above the surviving skills/plugins rationale is reworded",
          sourceSha256: digests["setup.ts"],
          portSha256: digest(setup),
          coordinateUnit: "utf16-half-open",
        },
      ],
      removed: [
        "tools.ts' ListPeersTool slot: the require ternary and the tool-pool entry",
        "SendMessageTool's cross-session surface: the recipient describe arm, both feature-gated validateInput branches, the peer-grammar empty-target check, and the feature import",
        "the prompt's uds row and Cross-session section (both already empty strings)",
        "utils/messages/systemInit.ts' messaging_socket_path field and its require('../udsMessaging.js')",
        "utils/concurrentSessions.ts' messagingSocketPath field and the ListPeers clause in updatePidFile's comment",
        "main.tsx' --messaging-socket-path option, its messagingSocketPath local, its setup() argument, and the stream-json replay promotion it drove",
        "setup.ts' messagingSocketPath parameter and the emptied UDS server gate",
        "components/messages/UserTextMessage.tsx' stranded cross-session comment",
        "utils/peerAddress.ts — parseAddress's last consumer was the branch pair above",
      ],
      adaptations: [
        {
          site: "tools/SendMessageTool/SendMessageTool.ts validateInput",
          change:
            "the peer-grammar empty-target check (const addr = parseAddress(input.to); if (addr.scheme === 'uds' && addr.target.trim().length === 0) …) is deleted although it was not feature-gated",
          reason:
            "parseAddress's scheme is decided by the address string alone, but the only shapes that reach the 'uds' arm are 'uds:<target>' and a bare '/'-prefixed socket path — the grammar the deleted prompt rows were the only documentation of. Every `to` the retained tool documents (a teammate name or '*') takes the 'other' arm, so the check's only remaining effect would be a bespoke error for input the product no longer advertises. The empty-name check directly above it and teammate resolution still reject malformed recipients; keeping the module alive for this one branch would retain the lane it belongs to.",
        },
      ],
      kept: [
        "SendMessageTool's teammate and broadcast path in full: the schema, the summary requirement, the structured-message rules, the shutdown_response recipient check, and the '@' format rejection",
        "the prompt's teammate table, its protocol-response section and the broadcast cost warning",
        "utils/concurrentSessions.ts' PID registry as a whole (writePidFile, updatePidFile, onSessionSwitch) and the BG_SESSIONS fields beside the removed spread",
        "setup.ts' teammate-snapshot gate and its SIMPLE-mode rationale, and main.tsx' setup()/getCommands() parallelism with its worktree rationale",
        "hooks/useInboxPoller.ts, screens/REPL.tsx' useInboxPoller call and the teammates/mailbox surface — that lane is gated by isAgentSwarmsEnabled(), not by UDS_INBOX",
      ],
      tsc: {
        command: "node_modules/.bin/tsc --noEmit --pretty false",
        cwd: root,
        exitCode: 0,
        diagnostics: 0,
        logSha256: digest(tscText),
      },
      validation:
        "Absence sweep over the lane's full vocabulary (the flag, the tool name, both module names, the peer parser, the socket env var and the option in both spellings) plus an existence check on the four paths it lived in; each folded site asserted as the arm the false flag produced with its surviving sibling expression asserted beside it (getSendMessageTool's pool slot, the '@' rejection, the structured-message rules, the BG_SESSIONS spread, the teammate-snapshot gate, options.replayUserMessages); the three dropped bun:bundle imports asserted gone; tsc clean",
      remaining:
        "the model-call seams (which must not be removed wholesale — API-key auth is the retained path), utils/fastMode.ts' remaining gates, the ~33 in-place CLI blocks, the cli/transports/ package, the dependency-pruning pass, and the stale utils/filePersistence/ directory name (it now holds one environment-kind reader)",
      notes: [
        "the first cut attempt left one tsc error (TS2304 parseAddress at SendMessageTool.ts:591): the peer-grammar check was the third consumer of the module and the only one not wrapped in the flag. The script was extended with that cut, the nine touched paths restored from HEAD, and the whole step re-run from the restored tree, so the script reproduces the final state in one pass.",
        "the module's absence was the fold's justification, not an assumption: tools/ListPeersTool/, utils/udsMessaging.ts and utils/peerRegistry.ts were each checked for on disk before the requires were called dead",
      ],
    },
    null,
    2,
  ) + "\n",
)
console.log("PASS peer-messaging lane gone; ListPeers slot, uds rows and socket plumbing folded; parseAddress deleted with its last consumer")
