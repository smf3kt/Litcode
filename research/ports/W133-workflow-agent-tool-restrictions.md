# W133 — Workflow `agent({disallowedTools, bashCommandClamp})`

C-8's tool-narrowing item. A workflow script can narrow a child's tool pool and, for shell
work, clamp it to a fixed set of `Bash(...)` command forms. Malformed options refuse the spawn
before a child exists; the clamp is enforced on every reading of a command line and fails
closed when the reading set is incomplete.

## Source position

- `chunk-hedqf2m1.js` [33406] the option key list (`schema`, `model`, `effort`, `isolation`,
  `agentType`, `disallowedTools`, `bashCommandClamp`); [77423,78030) `disallowedTools`
  validation (array of unpadded non-empty strings, dedupe+sort, empty array is no narrowing);
  [78145,79640) `bashCommandClamp` validation (`Bash(<command or prefix>)`, non-empty unpadded
  content, dedupe+sort); [88522,89047) deny merge into the agent definition; [90647,90700) the
  merged deny list adds `REPL` always and, with a clamp, `mcp__*` and `PowerShell`;
  [92900,98900) pool checks: unparseable names, empty/wildcard MCP segments, wildcard outside
  MCP, case mismatch, and no-op warnings; [98500,98700) schema mode refuses when the merged
  denies cover `StructuredOutput`; [99851,100127) shell `toolAliases` refusal;
  [100377,100758) a clamp with no Bash in the resolved pool refuses the spawn.
- `chunk-sfn1dbxq.js` [5444505,5444900) `fTr`: parse the command, take every reading, and
  require each reading to match an allow rule (exact or prefix) in every clamp group;
  [174085,174105) the denial text (unverifiable structure versus an unmatched span and the
  allowed forms); [5439798,5443900) `xX` exact/prefix/wildcard matching and the prefix
  compound-reading refusal.
- `chunk-z6p21rxk.js` [95,205) `Un`/`hpe`: rule grammar, unescaped parens, empty/`*` content,
  escaped-paren unescaping.
- `chunk-3cynezh1.js` [264332,266180) `jxe`/`Bxe`: `prefix:*` rules, wildcard detection, exact
  rules.
- `chunk-r2vtj1kh.js` [13835] `Be = "Bash"`, `Tt = "PowerShell"`.

## Port

- `src/agent-tool-restrictions.ts`:
  - `parseToolRule` ports `Un`/`hpe` (first/last unescaped parens, bare/empty/`*`, escaped
    parens).
  - `normalizeDisallowedTools` and `normalizeBashCommandClamp` port the spawn-time validation
    and dedupe/sort; the clamp is returned as one group.
  - `toolNameDenied` matches exact names, `mcp__<server>` server scopes, `mcp__<server>__<tool>`
    entries and `mcp__*`; `validateDisallowedTools` refuses unparseable, MCP-empty/wildcard and
    case-mismatched entries, and leaves no-op entries inert.
  - `checkBashCommandClamp` reuses `shellReadings` for the source's every-reading invariant;
    an incomplete set is `unverifiable`; exact, `prefix:*` (including `xargs <prefix>`) and
    trailing-wildcard rules are matched; prefix/wildcard rules do not admit a compound reading.
  - `bashCommandClampDenial` ports the denial text.
- `src/agent-registry.ts`: `disallowed_tools` and `bash_command_clamp` launch fields; validation
  before the capacity check; deny filtering after mode/type selection; the implicit `mcp__*`
  deny when a clamp is present; schema-mode refusal when `StructuredOutput` is denied; the
  no-shell-tool clamp refusal; the child config carries the clamp groups.
- `src/session.ts`: `SessionConfig.bashCommandClamp` and its journal schema.
- `src/agent.ts`: the permission gate checks the clamp before the policy decision for
  `run_command`/`run_background`/`bash`/`Bash`; a failure denies with the source text and raises
  the one `PermissionDenied` hook.
- `src/workflow-script.ts`: both options leave the unsupported list, are normalized before the
  journal key and bridge call, and are part of the journal's option chain.
- `src/workflow.ts`: passes `disallowed_tools` and `bash_command_clamp` to `launch`.

## Adaptations

- The source's `Be` ("Bash") names this runtime's shell tools (`run_command`,
  `run_background`, `bash`, `Bash`); a clamp binds to whichever of those survived the deny
  filter. The source's `PowerShell` refusal has no counterpart here.
- `REPL` is always denied in the source; this runtime has no REPL tool.
- The source denies all MCP tools for a clamped agent to keep shell work on the clamped
  surface; this port does the same with an implicit `mcp__*` deny.
- The source's `toolAliases` refusal is not applicable; this runtime has no shell tool alias
  map, so every clamped shell tool goes through the same permission gate.
- Wildcard MCP server spellings and the source's legacy tool alias table are not ported; exact
  `mcp__` names and case diagnostics follow the source.
- Clamp groups are stored in the child session config and re-applied on resume; the source
  keeps them in the permission context.

## Verification

`test/agent-tool-restrictions.test.ts` covers rule parsing, option validation, deny matching
(exact/MCP), the every-reading clamp, compound/opaque refusals, pool removal before the first
model call, the schema-deny refusal, the no-shell refusal, and the child gate denying one
command while admitting another.
`test/workflow-script.test.ts` covers pre-bridge refusal and option pass-through.
`test/workflow.test.ts` covers the path from `workflow_run` through the script to the child
pool.

Results: focused 111/111 (restrictions, workflow-script, workflow, agent-registry,
shell-permissions, permissions), full 2235/2235, tsc 0, build 0, notices 0,
`smoke:workflow-resume` and `smoke:workflow-cli` passed, identity `eff677d0…`.

## Residuals

- `stallMs` remains unported (C-8).
- Named workflows, reattach and automatic effect replay remain unported.
- The source's permission-context layering, `toolAliases`, PowerShell and REPL surfaces are out
  of scope for this runtime.
