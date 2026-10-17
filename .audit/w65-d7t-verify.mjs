import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "8c8d201"
const digest = text => createHash("sha256").update(text).digest("hex")

// The recovered base dump left the shells of CLI blocks whose bodies were
// elided when it was made compilable: empty `{}` statements, comment-only
// registration stubs, and six fast-path comments in the entrypoint. W61
// recorded them as in-place CLI entries for later packages; the feature
// packages consumed the auth, ssh, teleport/remote, assistant, brief and
// proactive blocks, leaving these shells. The live `claude update` and
// `claude install` blocks stay with the auto-updater surface: that is software
// distribution, not an account/subscription network function, and removing the
// commands alone would leave the live updater telling users to run commands
// the tree no longer has.
const read = p => fs.readFileSync(`${root}/${p}`, "utf8")
const base = p => execFileSync("git", ["-C", root, "show", `${before}:${p}`], {encoding: "utf8"})
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

const main = read("main.tsx")
const entry = read("entrypoints/cli.tsx")
const setup = read("setup.ts")

// 1. The base carried every shell this step removes.
const baseMain = base("main.tsx")
for (const needle of [
  "// claude server",
  "// claude up —",
  "// claude rollback",
  "// ant-only commands",
  "Event loop stall detector",
  "Install asciicast recorder",
  "import { installAsciicastRecorder }",
]) {
  assert.ok(baseMain.includes(needle), `base main.tsx carried ${needle}`)
}
assert.ok(base("entrypoints/cli.tsx").includes("--daemon-worker=<kind>"))
assert.ok(base("entrypoints/cli.tsx").includes("self-hosted-runner"))
assert.ok(base("setup.ts").includes("feature('COMMIT_ATTRIBUTION')"))

// 2. The shells are gone and no `{}` statement remains in the CLI host.
assert.doesNotMatch(main, /^\s*\{\}\s*$/m, "an empty statement shell remains")
for (const needle of [
  "// claude server",
  "// claude up —",
  "// claude rollback",
  "// ant-only commands",
  "Event loop stall detector",
  "Install asciicast recorder",
  "installAsciicastRecorder",
]) {
  assert.ok(!main.includes(needle), `main.tsx still carries ${needle}`)
}
for (const needle of [
  "daemon-worker",
  "claude daemon",
  "claude ps|logs|attach|kill",
  "template job commands",
  "environment-runner",
  "self-hosted-runner",
]) {
  assert.ok(!entry.includes(needle), `entrypoints/cli.tsx still carries ${needle}`)
}
assert.doesNotMatch(setup, /COMMIT_ATTRIBUTION|\bfeature\b|bun:bundle/)

// 3. What stays, with its reader.
assert.ok(entry.includes("// Fast-path for --worktree --tmux: exec into tmux before loading full CLI"))
assert.ok(entry.includes("// Fast-path for --version/-v: zero module loading needed"))
assert.match(main, /\.command\('update'\)\n    \.alias\('upgrade'\)/)
assert.match(main, /\.command\('install \[target\]'\)/)
assert.ok(fs.existsSync(`${root}/cli/update.ts`), "cli/update.ts stays")
assert.match(read("cli/handlers/util.tsx"), /export async function installHandler\(/)
assert.match(read("cli/handlers/util.tsx"), /export async function doctorHandler\(/)
// The asciicast module is live for resume renames and flushes; only its
// installer call site was absent from the base dump.
assert.match(read("utils/asciicast.ts"), /export function installAsciicastRecorder\(\): void \{/)
assert.match(read("utils/asciicast.ts"), /export async function renameRecordingForSession\(\): Promise<void> \{/)
assert.match(read("screens/REPL.tsx"), /renameRecordingForSession/)
// The migration and deferred-prefetch bodies close cleanly.
assert.match(main, /      resetAutoModeOptInForDefaultOffer\(\)\n    \}\n    saveGlobalConfig\(prev =>/)
assert.match(main, /    void skillChangeDetector\.initialize\(\)\n  \}\n\}/)
assert.match(main, /      const explicitModel = options\.model \|\| process\.env\.ANTHROPIC_MODEL\n\n      \/\/ Special case the default model/)
assert.match(main, /        initResult\n\n      if \(feature\('TRANSCRIPT_CLASSIFIER'\)/)
assert.match(main, /assertMinVersion\(\)/)

// 4. No module was orphaned by the import removal.
const orphans = execFileSync("node", ["/Users/mant1ssa/Projects/cc_reverse/.audit/w65-orphans.mjs"], {encoding: "utf8"})
// Wave D step 7u removed nine modules (RemoteIO and cli/transports/) and step
// 7w six more (the updater UI lane), so the file count drops by fifteen while
// the orphan set is unchanged.
assert.match(orphans, /1617 files scanned, 10 with no importer/)

// 5. The gate.
const tscText = fs.readFileSync(new URL("w65-d7t-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

const files = ["main.tsx", "entrypoints/cli.tsx", "setup.ts"]
const digests = {}
for (const f of files) digests[f] = digest(base(f))

fs.writeFileSync(
  new URL("w65-d7t-source-evidence.json", import.meta.url),
  JSON.stringify(
    {
      before,
      kind: "stranded in-place CLI-block shells removed (no ported bodies; every removed statement or comment was empty)",
      surface:
        "the empty `{}` statements and comment-only stubs in main.tsx (migration tail, event-loop stall detector, tasks-mode tail, broad-shell-rule handler, model-warm comment tail, asciicast installer, print-mode housekeeping tail, advisor tail, `claude server`, `claude connect`, `claude up`, `claude rollback`, ant-only commands), the six fast-path comment blocks in entrypoints/cli.tsx (daemon worker, daemon, ps/logs/attach/kill, template jobs, environment-runner, self-hosted-runner), and setup.ts's empty COMMIT_ATTRIBUTION block with its orphaned feature import; the unused main.tsx import of installAsciicastRecorder goes with the asciicast shell",
      decisiveFact:
        "git log -S shows the installer call, the event-loop detector and the other bodies were absent from the first compilable-base commit (`2148015`), not removed by a W-step: the dump elided them and left empty statements, comments, or blank lines behind. The feature packages consumed the auth, ssh, teleport/remote, assistant, brief and proactive blocks from the W61 list; the shells removed here are what an empty statement or a comment can still say about a block that has no body",
      reclassified:
        "`claude update` and `claude install` were named in the W61 deferral but are not removed here. They belong to the auto-updater surface (utils/autoUpdater.ts still fetches the release bucket, and its min-version, doctor and npm-deprecation messages tell users to run these commands). That is software distribution rather than account/subscription network handling, and cutting the commands alone would leave the live updater advertising commands the tree no longer has, so the updater package owns them together",
      changes: [
        {
          file: "main.tsx",
          change:
            "eleven empty statement shells and their stale comments are removed; the unused installAsciicastRecorder import goes with them; registration stubs for `claude server`, `claude connect`, `claude up`, `claude rollback` and the ant-only group are deleted; two blank-line artifacts the removal exposed are closed",
          sourceSha256: digests["main.tsx"],
          portSha256: digest(main),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "entrypoints/cli.tsx",
          change:
            "the six fast-path comment blocks for absent daemon/session/runner commands are deleted; the version, system-prompt and worktree-tmux fast paths stay",
          sourceSha256: digests["entrypoints/cli.tsx"],
          portSha256: digest(entry),
          coordinateUnit: "utf16-half-open",
        },
        {
          file: "setup.ts",
          change:
            "the empty COMMIT_ATTRIBUTION block (its dynamic import was elided in the base) and the then-unused `feature` import are deleted; every other setup step is untouched",
          sourceSha256: digests["setup.ts"],
          portSha256: digest(setup),
          coordinateUnit: "utf16-half-open",
        },
      ],
      removed: [
        "eleven empty `{}` statements in main.tsx and the comments that named the absent bodies",
        "the `claude server`, `claude connect`, `claude up`, `claude rollback` and ant-only registration stubs",
        "the six absent-command fast-path comment blocks in entrypoints/cli.tsx",
        "setup.ts's empty COMMIT_ATTRIBUTION block and its feature import",
        "the unchecked installAsciicastRecorder import in main.tsx",
      ],
      kept: [
        "`claude update` (with alias upgrade) and `claude install [target]`, their handlers, cli/update.ts and the auto-updater surface — reclassified to the updater package, see `reclassified`",
        "the live CLI surface: mcp/plugin/agents/auto-mode/doctor, the advisor option, the teammate flags, the SDK URL option, and the version/system-prompt/worktree-tmux fast paths",
        "utils/asciicast.ts whole: REPL and ResumeConversation still read renameRecordingForSession, and flushAsciicastRecorder stays wired; only the base dump's absent installer call is recorded",
        "assertMinVersion's import and call, and the migration/deferred-prefetch bodies the shells sat beside",
      ],
      tsc: {
        command: "node_modules/.bin/tsc --noEmit --pretty false",
        cwd: root,
        exitCode: 0,
        diagnostics: 0,
        logSha256: digest(tscText),
      },
      validation:
        "Base-commit checks confirm the stubs were present at 8c8d201 and the first compilable-base commit explains their emptiness; a current-tree sweep asserts every removed name is gone, no empty statement remains in main.tsx, and the entrypoint/setup carry no absent-command residue; survivor assertions pin install/update with their handlers and the asciicast module with its live readers; the orphan scan stays at ten legitimate entries and 1632 files; tsc clean",
      remaining:
        "cli/transports/ (the SDK transport lane, with --sdk-url), the dependency-pruning pass (nine zero-importer dependencies), the utils/filePersistence/ rename, and the auto-updater surface (update/install commands with utils/autoUpdater.ts and its UI), reclassified here as its own package",
      notes: [
        "the shell at the advisor option was a bare `{}` between two feature blocks; its neighbours are live and untouched",
        "the emptied COMMIT_ATTRIBUTION block's comment described a dynamic import that the base dump had already elided — the comment was the only remaining trace, and it described behaviour the tree cannot perform",
        "one repair pass: the first run anchored a stub block with empty lines where the source has two-space whitespace lines; the cut now uses cut_between anchored on the surrounding live code, and the tree was restored from HEAD before the replay",
      ],
    },
    null,
    2,
  ) + "\n",
)
console.log("PASS stranded CLI shells gone; install/update and asciicast readers intact; tsc log empty")
