# W230 scoped map — `/permissions` automode writes

Read-only reconnaissance. No product file touched. Everything below is transcribed from the
recovered chunks with exact offsets (zero-based UTF-16 code units).

## Modules

| Module | SHA-256 | Units |
| --- | --- | --- |
| `chunk-fxx7hh8y.js` | `6c02bdbdf6679fafe7e6e589e8f21f18b347d1192564753fc4fed7559557dc78` | `qr` 35685, `wl` 36197, `Xr` 37522, `Ho` 38352, `Jr` 40570 / `Tc` 40700, `ts` 40909 / `Dc` 41040, `os` 41360 / `Fc` 41540, `co` 39900, `Gr` 39960, `jt` 39890, `El` 37340, `We` 37500, `me` 36535, `Yr` 35950, `zr` 36080, the dispatch `oo` 48843 |
| `chunk-fmjcnmvh.js` | `0dfc46c5f3c0822f45053671401c3f2a32bac207794ac05f3bb8fe49908c8d48` | `zve` 55017, `tZe` 55025, `oZe` 60463, `JWt` 59109, `IVr` 59040, `sz` 61347 |
| `chunk-7ah5c51p.js` | `f0cf1631a25068c3f788d8b82dca713bc1c4d88221f9d55bf9c355ddc74a3dd5` | `xu` 615, `Rit` 4449, `xit` 4684, `Pit` 4717, the slot list `w` 1499, `XXt` 660 |

## Constants

```js
zve = 200            // entries per section
tZe = 10000          // characters per entry
xu  = "$defaults"    // the splice marker
w   = ["user_allow_rules_to_replace", "user_soft_deny_rules_to_replace",
       "user_hard_deny_rules_to_replace", "user_environment_to_replace"]
```

## Validation

```js
sz(e)  = e.replace(/[︀-️\u{E0100}-\u{E01EF}]/gu, "")   // strip variation selectors
Rit(e) = any char with code <32 && !==9, or 127..159, or 8232, or 8233
xit(e) = /[\p{Cf}\p{Default_Ignorable_Code_Point}  ⠀￹-￻\u{1D173}-\u{1D17A}]/u
Pit(e) = e.includes("<settings_") || w.some(t => e.includes(`<${t}`) || e.includes(`</${t}`))
           ? "template_token"
         : e.includes("<cc_automode") || e.includes("</cc_automode") ? "region_tag" : null

// oZe(section, entries) -> message | null, checked in this order
entries.length > 200                      -> `${section} has ${n} entries; the maximum is 200.`
per entry, after sz:
  trim() === ""                           -> `${section} contains an empty entry.`
  length > 10000                          -> `${section} contains an entry of ${n} characters; the maximum is 10000.`
  Rit                                     -> `${section} contains an entry with a control character; entries must be single-line text.`
  xit                                     -> `${section} contains an entry with an invisible or bidirectional character; entries must be plainly renderable text.`
  Pit === "template_token"                -> `${section} contains an entry with a literal "<settings_" template token; entries must not contain classifier template tokens.`
  Pit === "region_tag"                    -> `${section} contains an entry with a literal "cc_automode" region tag; entries must not contain classifier region markers.`

// Gr(section, text) throws We("invalid_input", …)
text === "$defaults"                      -> `"$defaults" is reserved — it splices the built-in rules in and cannot be added as a rule.`
text.length > 10000                       -> `the rule is ${n} characters; the maximum is 10000.`
section === "environment" && any line starts "### "
                                          -> `'### ' lines are environment section headers (structure, not entries) and cannot be written here.`
oZe(section, text.split("\n"))            -> its message

// co(section, text) -> message | null   — Gr's result as a string, for live field validation
// wl(text) -> {entries, problem}        — the document reader:
//   entries = El(text.split("\n").map(jt).filter(nonEmpty))
//   problem = entries.length === 0 ? null : oZe("environment", entries)
// zr(text) = wl(text).problem
// El(lines) drops a line that starts "### " when the next line is absent or also starts "### "
```

## The writer

```js
// Ho(section, mutate, options) -> Promise, throws We(code, message)
//   code ∈ {no_user_settings_path, settings_file_invalid, invalid_input, entry_not_found, write_failed}
path = yn("userSettings") || throw We("no_user_settings_path", "Could not resolve the user settings file path.")
{settings, errors} = By(path)
if (settings === null && errors.length > 0)
  throw We("settings_file_invalid", "the settings file has a validation error or cannot be read, so its
    auto mode rules are not in effect; fix it (Claude Code names the problem at startup), then try again.")
await ta("userSettings", (doc) => {
  autoMode is an array
    -> S = "the existing autoMode value in the settings file is an array — fix or remove it, then try again."
  autoMode !== undefined && !sZ().safeParse(autoMode).success
    -> S = "the existing autoMode value in the settings file does not match the expected shape — fix or remove it, then try again."
  existing = Array.isArray(autoMode?.[section]) ? autoMode[section].filter(string) : []
  result = mutate(existing)
  result is a {refuse} object      -> C = result.refuse
  count(x) = x.length - (x.includes("$defaults") ? 1 : 0)
  result !== null && count(result) > 200 && count(result) > count(existing)
                                   -> f = count(existing)          // only when the mutation grows past the cap
  result === null                  -> v = true                     // the row moved
  else write { autoMode: { [section]: result } }
}, undefined, options)
S -> throw We("settings_file_invalid", S)
C -> throw We("invalid_input", C)
f -> throw We("invalid_input", `autoMode.${section} already has ${f} entries; the maximum is 200.`)
v -> throw We("entry_not_found", "That rule changed on disk while the dialog was open — close and reopen
     /permissions, then try again.")
E -> {code, message} = JWt(E, path, "/permissions"); throw We(code, message)
// JWt: "Invalid JSON syntax" in the error -> {settings_file_invalid, `The settings file at ${path} contains
//   invalid JSON — fix or remove it, then re-run ${command}.`}
//      otherwise                        -> {write_failed, `Could not write ${path} — check file permissions
//   and disk space (run with --debug for the underlying error).`}
```

## The four mutators

```js
// Jr(section, text, options)   = Zr("auto_mode_rule_edit", () => Tc(…), No("add"))
// Tc(section, text, options):
d = jt(text); Gr(section, d)
Ho(section, (existing) => {
  section === "environment" && rne()
    -> {refuse: "The environment is edited as a document — use Edit environment on the Auto mode tab."}
  section !== "environment" && existing.length === 0 -> ["$defaults", d]
  else -> [...existing, d]
})

// ts(section, index, original, text, options) = Zr(…, () => Dc(…), No("update"))
// Dc(section, index, original, text, options):
h = jt(text); Gr(section, h)
Ho(section, (v) => {
  original === "$defaults" -> {refuse: `"$defaults" is splice plumbing, not an editable rule.`}
  section === "environment" && original.startsWith("### ")
    -> {refuse: "'### ' lines are environment section headers (structure, not entries) and cannot be edited here."}
  v[index] !== original -> null
  else [...v] with [index] = h
})

// os(section, index, original, options) = Zr(…, () => Fc(…), No("delete"))
// Fc(section, index, original, options):
Ho(section, (a) => {
  original === "$defaults" -> {refuse: `"$defaults" is splice plumbing, not a deletable rule.`}
  section === "environment" && original.startsWith("### ")
    -> {refuse: "'### ' lines are environment section headers (structure, not entries) and cannot be deleted here."}
  a[index] !== original -> null
  else section === "environment" ? El(rest) : rest
})

// Xr(section, enabled, options) = Zr(…, () => Ho(section, (a) => {…}, options), No("toggle"))
Ho(section, (a) => {
  !rne() -> {refuse: "Built-in rules cannot be disabled on internal-template sessions — they are always in effect."}
  section === "environment"
    -> {refuse: "The environment is a single replaceable document — write your own version to replace the
       built-in default, or delete your entries to restore it."}
  h = a.filter(v => v !== "$defaults")
  enabled -> ["$defaults", ...h]
  h.length === 0 -> {refuse: "An empty section cannot hold the off state — add a rule to this section first."}
  else h
})

// qr(draftLines, loadedEntries, options) = Zr(…, () => Ho("environment", (d) => {…}, options), No("add"))
Ho("environment", (d) => {
  d.length !== loadedEntries.length || d.some((v, f) => v !== loadedEntries[f])
    -> {refuse: "The environment changed since this screen loaded — reopen the tab to see the current entries."}
  {entries, problem} = wl(draftLines.join("\n"))
  problem !== null -> {refuse: problem}
  else entries
})
```

`Yr()` is the document editor's initial value: `userSettings.autoMode.environment ?? []`.
`rne()` is the constant-true gate W229 already recorded, so the two `!rne()` / `rne()` arms are dead
in the source as well.
`Zr(name, fn, event)` wraps the write in the telemetry span and calls the event builder on failure;
`No(prefix)` returns `${prefix}_${code|"error"}`. This product emits no telemetry (W229's finding),
so `Zr` collapses to a direct call and `No` is dropped.

## The dispatch

```js
// chunk-fxx7hh8y.js 48843, inside Bn
oo = (value) => {
  if (searchActive) { clearSearch(); dropSearch() }
  if (value === "add-new-rule") { openAdd(); return }
  if (value === "environment-document") { openDocument(); return }
  if (value.startsWith("builtins:")) { openBuiltins(value.slice(9)); return }
  const entry = valueToEntry.get(value); if (entry) openEntry(entry)
}
// visibleOptionCount = Math.min(10, rows.length); isDisabled = searchActive || <the add flow's own flag>
```

The add row's own copy, which W229 left out: `Extra rules for the auto mode classifier. Rules are
plain sentences; new rules are saved to your user settings.`

## Local counterparts

1. **The writer exists, for a different update shape.** `src/permission-settings.ts:128`
   `persistPermissionUpdate(update, paths, managedOnly, owner)` is the local `ta(...)` + write half:
   `permissionSettingsPaths` (`:83`) resolves `userSettings` to `<userDir>/settings.json`, and the
   inner `transform(raw)` returns a patch or `null` for "no change", guarded by a per-file queue. It
   handles `addRules` / `replaceRules` / `removeRules` / `addDirectories` / `setMode`, all writing
   `permissions.<key>`. `Ho` writes `autoMode.<section>`, a sibling of `permissions`, so W230 needs
   either an `autoMode` arm in that transform or a parallel writer reusing `queues`. One semantic
   mismatch to keep straight: `transform`'s `null` means "nothing to change", while `Ho`'s mutator
   returning `null` means "the row moved" (`entry_not_found`). The port has to keep them distinct.
2. **The local `autoMode` schema is wider than `sZ()`.** `src/permissions.ts:13`
   `autoPolicySchema` is `.strict()` over `deny` / `allow` / `soft_deny` / `hard_deny` /
   `environment` / `classifyAllShell`. `Ho`'s shape check must use the local schema, and the extra
   `deny` / `classifyAllShell` keys mean a settings file that `Ho` would reject may still parse here
   — worth an explicit test rather than assuming the two agree.
3. **A failed write becomes a report line.** The recovered shows the refusal inside the dialog and
   `No(prefix)` names a telemetry event; this product emits none, so the ported failure surfaces as a
   panel report string.
4. **The callers are W229's read-only rows.** The builtins card's toggle row, the entry card's
   Edit/Delete rows and the `enter to edit` note are all currently read-only in
   `src/auto-mode-panel.ts`; W230 replaces those rows and their values.

