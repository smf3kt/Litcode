# W67 — the OS-managed policy directory

## Source position

The recovered file tier is `Lko` (chunk-3cynezh1.js, UTF-16 [388831,389776), 945 units): it reads
`managed-settings.json` in the managed directory and then every entry of `managed-settings.d`
accepted by `X$s` ([388659,388726), 67 units = regular file or symlink, name ends `.json`, name
does not start with a dot), sorted by name, and folds each document through `Nd`
([387659,388542), 883 units), whose merge line is `e.merged=MB(e.merged,r,Y3)` at 388440. The
directory is `My` ([360332,360539), 207 units): macOS `/Library/Application Support/ClaudeCode`,
Windows `C:\Program Files\ClaudeCode`, otherwise `/etc/claude-code`; the base file is `m_`
([387272,387326), 54 units) and the drop-in directory is `eC()` joined with `managed-settings.d`
(`Ad`, cached, [359965,360332)). `Eut` ([387326,387659), 333 units) adds the WSL inheritance arm.

## Port

`src/config.ts` now imports the already-ported source seams — `managedSettingsDir()` and the
source's own merge customizer `mergeSettings` — and adds `loadManagedSettingsDirectory`:

- no explicit `managedSettingsFile`: read `<dir>/managed-settings.json`, then
  `<dir>/managed-settings.d/*.json` as regular files or symlinks, non-hidden, sorted by name;
- merge with `mergeSettings`, the source's `MB(..., Y3)` (arrays concatenate and dedupe,
  `fallbackModel` replaces, the marketplace and managed-MCP maps take a one-level override);
- project each document onto the four policy keys this runtime carries (`allowShell`,
  `permissions`, `features`, `mcpClient`); other keys are dropped and reported once by name;
- a missing directory or file is absence; an unreadable, non-JSON or non-object document is
  reported and contributes nothing; a merged document the policy schema rejects yields no policy;
- the report (`managedSettingsReport`) names the source, directory, documents read in merge order,
  ignored keys and errors.

The explicit-file path is unchanged and remains strict: unknown keys and schema errors throw.
Managed fields still replace authored fields after every settings layer, so the policy precedence
recorded in W45 is preserved.

## Deliberate omissions

- Remote/account policy is excluded by the user's local-only directive.
- The plist/registry tiers, WSL inheritance (`Eut`), policy-helper flag protocol, substitutions
  (`onlySubstitutes`/`Nd` floor records), document-link bookkeeping and the `loadState` enum are
  not ported; the product reads the local file tier only.
- JSON is parsed strictly (no comments), matching the product's existing settings reader.
- The source's full settings schema accepts many more keys; this runtime reports and drops the
  ones it has no policy for instead of pretending to enforce them.

## Verification

`config` 69/69 including two new cases (base + sorted drop-ins with symlink, hidden/non-JSON/
directory exclusions and report; missing directory plus a broken document that contributes
nothing). Settings chain suites 15/15; tsc 0; build 0; full 2,092/2,092; chain 767/767; notices 0;
source index unchanged; identity `f8c89d5a…` (the first measurement, `b1c74f0c…`, predated the rebuild that included the added module comment; `f8c89d5a…` is the committed build identity).
