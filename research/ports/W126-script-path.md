# W126 — Workflow `scriptPath` file loading

W125 accepted an inline `script`. The recovered tool also accepts a
`scriptPath` file and reads it through the hardened loader `Chn`. This package
ports that loader into `workflow_run`; named workflows and journal/resume stay
out.

## Source position

- Tool schema (chunk-a7gk0710): `script`, `args`, `scriptPath`, `resumeFromRunId`
  and `name`, with a refinement requiring one of script/name/scriptPath/runId.
- Loader `Chn` (chunk-hedqf2m1.js offset 19175), with path resolution and the
  refusal text `Qt` (18614) and the reader/permission helper `Oo` (18913).
  The file is opened `O_RDONLY|O_NOFOLLOW`, and the opened descriptor is
  `fstat`ed before any read: `ino === 0` or `nlink > 1` refuses the path,
  a non-file is rejected with `is not a regular file`, and a size above
  `wE` (524288) is rejected. Errors distinguish a missing file
  (`Workflow script file not found: …`) from any other read failure.
  Only after loading is the source parsed with `YS`.

## Port

- `loadWorkflowScriptFile` (src/workflow-script.ts) resolves the path against
  the session workspace, opens with `O_RDONLY|O_NOFOLLOW`, checks
  `ino === 0n`/`nlink > 1n`, `isFile()`, the 524288-byte cap (before and
  after the read), and reads from the descriptor.
- `workflow_run` accepts `scriptPath` beside `script`; the zod refinement
  requires exactly one of the two, and `tasks` cannot be mixed with either.
  The tool description and JSON schema list the new input.
- Refusal text keeps the source's first line and inline-script advice, with the
  product's own tool name.

## Adaptation

- The recovered loader gates the path through the session's tool-permission and
  read-tool checks (`aXn`/`$o`); this runtime relies on the workflow tool's own
  permission decision and therefore allows any readable regular path, while
  keeping the source's link/inode/regular-file/size refusals.
- The recovered resolves relative paths against the process cwd; this runtime
  resolves them against the session workspace, and absolute paths resolve as
  absolute.
- Only `scriptPath` is added. `name` (saved workflows), `resumeFromRunId`,
  journal replay and reattachment remain open under C-8.

## Verification

`workflow-script` pins the regular-file load and run, the symlink and hard-link
refusals, the directory refusal (nlink > 1), the missing-file text, the size
cap, and a tool-level run from a workspace file plus the exactly-one
rejection. Workflow family 43/43, tsc 0, build 0, full 2,204/2,204, chain
768/768, notices 0, source index unchanged, identity `adad009d…`.
