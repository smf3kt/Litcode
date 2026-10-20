# W224 `/reload-skills`

Status: implemented locally on `work/w43-choice-preview`. No push, no upstream calls.

## Request

Part of the loop that ports the TUI surfaces behind the composer's slash commands. `/reload-skills`
is `Pick up skills added or changed on disk during this session`: a plain `local` command
(`supportsNonInteractive: true`, `thinClientDispatch: "post-text"`, no `immediate`, no argument
hint) and the last bounded local command in the input-bar scan.

## What was there

The command did not exist. The state it drives did: `src/skill-catalog.ts` already carries
`reloadSkills(config)`, the in-place rescan the `SessionStart` hook output uses, and the composer's
command list is built once from `tuiCommandsWithSkills(config.skills)`.

## Recovered source

| Module | SHA-256 / offset | Contents |
| --- | --- | --- |
| `chunk-hyft8yrm.js` | sha256 `fad372982d5516747b598e25e44c70b79d2fe1cbebaa85282cdd65e17fc5cfcb`, `v` [13938,14479) | the command body, exported as `call` |
| `chunk-sfn1dbxq.js` | sha256 `4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da`, `ITo` 1640128 | the registration |
| ↳ | `bM` 1675968 | `VT`, `Nhr`, `Fhr`, `Hz` |
| ↳ | `qT` 1676798, `Hz` 3393591, `$5` 3689254, `i1` 2478788, `gL` 431968 | the skill list, the directory-cache drop, the sent-name reset, the change emitter, the sync invalidation |
| `chunk-3ph567jx.js` | sha256 `281868632c24f04e8dca6677ab734f29299f78b6933693a9148d7dbaf698a11b`, `Nhr` 3862, `Fhr` 3898 | `it().commands = void 0` and `it().skills = it().skillsV5 = void 0` |
| `chunk-3qabb19b.js` | sha256 `ceb8c8490f39408310286cc14cacb1998192c8c34a80724882f988431f1bf5f2`, `F` 673 | the count-where |
| `chunk-ax7r0qj7.js` | sha256 `8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e`, `I` 798 | the pluralizer |
| `chunk-4bw62nzm.js` | sha256 `1a8788672a623975dc4a807604528e46b128f16b5ec159495c0ec2370f805713`, `cr` 79796 | the project root |
| `chunk-nqc6v990.js` | sha256 `261b35d99a3bb5aed676678c983f7c903da023ab3ad0c4117a3474d6b51e0738`, `Tr` 3899 | the safe-mode check |

The body (zero-based UTF-16 units):

```js
var v = async (g, t) => {
  let m = cr(), i = JOn(t.getMcp().commands), s = (o) => tre(o, i),
      n = s(await qT(m, t.storageV5)), d = new Set(n.map(o => o.name));
  gL(), bM(), $5();
  let e = s(await qT(m, t.storageV5)), c = new Set(e.map(o => o.name));
  i1.emit();
  let r = F(e, o => !d.has(o.name)), l = F(n, o => !c.has(o.name)), a = [];
  if (r > 0) a.push(`${r} added`);
  if (l > 0) a.push(`${l} removed`);
  let p = a.length > 0 ? a.join(", ") : "no changes",
      f = Tr() ? " (custom skills are disabled in safe mode)" : "";
  return { type: "text", value: `Reloaded skills: ${e.length} ${I(e.length, "skill")} available (${p})${f}` };
};
```

A correction to the scoping note: `chunk-hyft8yrm.js` does not re-export the body from
`chunk-4bw62nzm.js`; it defines `v` itself in its last 541 units and exports it as `call`. The
helper imports resolve to `chunk-4bw62nzm.js` (`cr`), `chunk-xrjhyksm.js` (`tre`/`JOn`),
`chunk-ax7r0qj7.js` (`I`), `chunk-3qabb19b.js` (`F`), `chunk-nqc6v990.js` (`Tr`) and
`chunk-sfn1dbxq.js` (`gL`/`bM`/`qT`/`$5`/`i1`).

The three-statement invalidation, expanded: `gL()` drops the cloud skill-sync state; `bM()` is
`VT()`, `Nhr()`, `Fhr()`, `Hz()` — the command table, the skill table and its V5 copy, and the
skill-directory cache with the parsed-markdown map; `$5()` clears the names already sent to the
model. The re-read then goes through `qT`, a lazily-filled cache over the skill list.

## Port

- `src/reload-skills.ts`: `skillReloadCounts` (`F` over both snapshots), `skillReloadDiff` (the
  two arms and `no changes`), `reloadSkillsMessage` (`I` + the sentence), and the
  `RELOAD_SKILLS_NO_CHANGES` constant. `pluralize` is imported from `diff-dialog-primitives.js`,
  the same import `scroll-speed.ts` uses for the same source function.
- `src/interactive.ts`: the `/reload-skills` branch — snapshot names, `reloadSkills(config)`, snapshot
  again, hand the composer its rebuilt rows, print the report. `COMMAND_HELP` gains the line, and a
  piped session prints the same report (`supportsNonInteractive: true`).
- `src/tui-autocomplete.ts`, `README.md`: the command row with the recovered description, in the
  `action` lane beside `/reload`.
- `src/terminal.ts` / `src/tui.ts`: `setCommands`, the local counterpart of the shared command
  table being voided. The composer captured its list at construction, so a rescan replaces it and
  the next draft re-suggests.

## Adaptations and what stays out

- **`i1.emit()` has no local subscriber.** The recovered emitter wakes whoever renders skill state.
  Locally the same effect is carried by the two writes the command already makes: `reloadSkills`
  re-renders the system prompt's skill section, and `setCommands` replaces the composer's rows. No
  generation counter is invented for it.
- **`gL()` is out.** The cloud skill-sync invalidation has nothing to invalidate on a host with no
  sync.
- **The safe-mode suffix is out.** `Tr()` reads `CLAUDE_CODE_SAFE_MODE` or `--safe-mode`; this host
  has neither, so the parenthesised reason never applies and the sentence ends at the diff.
- **`JOn`/`tre` collapse.** The MCP prompt commands and the synced-skill merge feed the recovered
  command list; this host's list is `TUI_COMMANDS` plus the session's user-invocable skills, and it
  has no synced-skill source.
- **`qT`'s cache is the catalog.** The recovered read is a lazily-filled cache over the storage-V5
  skill list; locally the catalog is `config.skills`, and `reloadSkills` replaces its contents in
  place so the model-facing skill tool keeps its reference.
- **A legacy configuration with no skill tool** reports `0 skills available (no changes)`, because
  `reloadSkills` leaves an undefined catalog alone. The recovered command has no such arm.

## Verification

- `test/reload-skills.test.ts` (6 tests): the counts in both directions, a rename as one addition
  plus one removal, a duplicate entry counted per occurrence as `F` does, the four diff phrases, the
  report's count and pluralization, and the absence of a safe-mode arm.
- Full suite 2903/2903 (118 suites), `npm run check` and `npm run build` clean.
- Compiled probe `.audit/w224-reload-skills.mjs` passes 6 checks over the real CLI: an unchanged
  catalog reports `Reloaded skills: 1 skill available (no changes)`; a skill written to
  `.harness/skills/beta` after startup is *not* in the composer's suggestions, then the rescan
  reports `2 skills available (1 added)` and the same draft shows the `beta` row with its
  description; deleting a skill on disk reports `1 skill available (1 removed)`; `/help` lists the
  command.
