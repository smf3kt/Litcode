import assert from "node:assert/strict"
import fs from "node:fs"
import {execFileSync} from "node:child_process"
import {createHash} from "node:crypto"

const root = "/Users/mant1ssa/Projects/cc-base-2188"
const before = "ce11027"
const digest = text => createHash("sha256").update(text).digest("hex")
const show = p => execFileSync("git", ["-C", root, "show", `${before}:${p}`], {encoding: "utf8"})
const read = p => fs.readFileSync(`${root}/${p}`, "utf8")

// Wave D step 7d removed the leftovers the analytics removal stranded. Three of
// the four files keep live exports, so the checks are per-file: what went, what
// stayed, and that every surviving body is the source's.
const userSrc = show("utils/user.ts")
const userNow = read("utils/user.ts")
for (const gone of ["CoreUserData", "GitHubActionsMetadata", "initUser", "resetUserCache", "getCoreUserData", "getUserForGrowthBook", "getEmailAsync", "cachedEmail"]) {
  assert.doesNotMatch(userNow, new RegExp(gone), `utils/user.ts still declares ${gone}`)
  assert.match(userSrc, new RegExp(gone), `${gone} was not in the base revision`)
}
// the one export with a live caller survives word for word
assert.match(userNow, /export const getGitEmail = memoize/)
const emailBody = "  const result = await execa('git config --get user.email', {"
assert.ok(userSrc.includes(emailBody) && userNow.includes(emailBody))
assert.equal((userNow.match(/^export /gm) ?? []).length, 1, "utils/user.ts should export exactly one symbol")

const gitSrc = show("utils/git.ts")
const gitNow = read("utils/git.ts")
for (const gone of ["getRepoRemoteHash", "normalizeGitRemoteUrl", "isLocalHost", "createHash"]) {
  assert.doesNotMatch(gitNow, new RegExp(gone), `utils/git.ts still declares ${gone}`)
  assert.match(gitSrc, new RegExp(gone), `${gone} was not in the base revision`)
}
// the neighbours stay
assert.match(gitNow, /export const getRemoteUrl = async \(\): Promise<string \| null> => \{/)
assert.match(gitNow, /export const getIsHeadOnRemote = async \(\): Promise<boolean> => \{/)

const platSrc = show("utils/platform.ts")
const platNow = read("utils/platform.ts")
// \\b on readFile: getPlatform and getWslVersion keep getFsImplementation().readFileSync
for (const gone of ["LinuxDistroInfo", "getLinuxDistroInfo", "detectVcs", "VCS_MARKERS", "osRelease", "readdir", "readFile\\b"]) {
  assert.doesNotMatch(platNow, new RegExp(gone), `utils/platform.ts still declares ${gone}`)
  assert.match(platSrc, new RegExp(gone), `${gone} was not in the base revision`)
}
assert.match(platNow, /export const getPlatform = memoize\(\(\): Platform => \{/)
assert.match(platNow, /export const getWslVersion = memoize\(\(\): string \| undefined => \{/)
assert.match(platNow, /export const SUPPORTED_PLATFORMS: Platform\[\] = \['macos', 'wsl'\]/)

const mainNow = read("main.tsx")
assert.doesNotMatch(mainNow, /initUser|resetUserCache|refreshGrowthBookAfterAuthChange/)
assert.doesNotMatch(mainNow, /utils\/user\.js/)
assert.doesNotMatch(mainNow, /if \(onboardingShown\) \{\n\s+\/\/ Clear user data cache/)
// the sibling prefetch and the /login skip in the same function stay
assert.match(mainNow, /  void getUserContext\(\)\n/)
assert.match(mainNow, /if \(onboardingShown && prompt\?\.trim\(\)\.toLowerCase\(\) === '\/login'\) \{/)

// The residual sweep, as resolution edges so the cut's citation comments cannot
// self-match.
const gone = "initUser|resetUserCache|getCoreUserData|getUserForGrowthBook|getRepoRemoteHash|normalizeGitRemoteUrl|getLinuxDistroInfo|detectVcs|cachedEmail"
try {
  const hits = execFileSync("rg", [
    "-n", "--glob", "!node_modules", "--glob", "!*.w*bak", "--glob", "!*.json", "--glob", "!*.md",
    "-e", `from ['"][^'"]*[^a-z](${gone})`, "-e", `\\b(${gone})\\s*\\(`, root,
  ], {encoding: "utf8"}).trim()
  assert.equal(hits, "", `a live reference remains:\n${hits}`)
} catch (e) {
  assert.equal(e.status, 1, `rg failed: ${e.message}`)
}

const tscText = fs.readFileSync(new URL("w65-d7d-tsc.txt", import.meta.url), "utf8")
assert.equal(tscText, "", "tsc log is empty on success")

fs.writeFileSync(
  new URL("w65-d7d-source-evidence.json", import.meta.url),
  JSON.stringify({
    before,
    kind: "reader-less leftovers removed; every surviving export is the source's",
    evidence: [
      {
        file: "utils/user.ts",
        change: "reduced to getGitEmail, the one export with a live caller (utils/exampleCommands.ts)",
        sourceSha256: digest(userSrc),
        portSha256: digest(userNow),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "utils/git.ts",
        change: "getRepoRemoteHash, normalizeGitRemoteUrl and the isLocalHost helper only the normalizer used removed; the crypto import went with them",
        sourceSha256: digest(gitSrc),
        portSha256: digest(gitNow),
        coordinateUnit: "utf16-half-open",
      },
      {
        file: "utils/platform.ts",
        change: "getLinuxDistroInfo, its type, VCS_MARKERS and detectVcs removed; the fs and os imports went with them",
        sourceSha256: digest(platSrc),
        portSha256: digest(platNow),
        coordinateUnit: "utf16-half-open",
      },
    ],
    behaviourChange:
      "main.tsx no longer spawns `git config --get user.email` as a startup prefetch, and no longer resets the user cache after login; both existed only to fill the analytics user record.",
    callSiteLeft:
      "refreshGrowthBookAfterAuthChange now has no caller. main.tsx's block was removed rather than kept as a no-op call, so the export is caller-less like the override trio in the same module. Step 7e should decide it together with initializeGrowthBook's two remaining warm-up calls (interactiveHelpers.tsx, cli/print.ts) — and note that deleting it drops the guard-brace count its fixture pins from 6 to 5.",
    tsc: {
      command: "node_modules/.bin/tsc --noEmit --pretty false",
      cwd: root,
      exitCode: 0,
      diagnostics: 0,
      logSha256: digest(tscText),
    },
    validation:
      "Per-file absence sweeps paired with a base-revision presence check for each removed name; the surviving exports asserted by declaration; the one surviving body checked word-for-word; main.tsx's neighbours in the same function asserted still present; the residual sweep run as import edges and calls; tsc log empty",
  }, null, 2) + "\n",
)
console.log("PASS user record chain gone; three orphaned exports gone; no live reference; tsc log empty")
