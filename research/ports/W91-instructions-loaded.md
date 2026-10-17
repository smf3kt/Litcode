# W91 — per-file InstructionsLoaded payloads

## Source position

`kTn` (chunk-sfn1dbxq.js offset 2935767) builds
`{file_path, memory_type, load_reason, globs, trigger_file_path,
parent_file_path}`; the schema fixes `memory_type` to User/Project/Local/
Managed and `load_reason` to session_start/nested_traversal/path_glob_match/
include/compact (chunk-r2vtj1kh.js offset 202907). The eager loop
(chunk-sfn1dbxq.js offset 672482) raises once per loaded file with the eager
reason from `KZn` (`session_start` at startup, [672828,672967)) and `include`
for an imported file. The path-access site (offset 3671285) raises with
`trigger_file_path` set to the accessed path and the reason
`globs ? "path_glob_match" : parent ? "include" : "nested_traversal"`.

## Port

The config loader now records each instruction file's importing parent and a
conditional rule's patterns, and `loadPathInstructions` records the parent of
an import. The session carries only those identity fields
(`instructionSources`, no content). `startSession` raises one
`InstructionsLoaded` per loaded file with its path, `memory_type`,
`load_reason`, optional `globs` and `parent_file_path`. Path access raises
per loaded file with `trigger_file_path`, `nested_traversal` for an ancestor
file and `include` for an import; a selected conditional rule raises
`path_glob_match` with its patterns and an imported rule file raises
`include`.

## Adaptation

The source's instruction tiers are User/Project/Local/Managed; this runtime
loads one project instruction set (ancestor walk plus `.harness/rules`), so
every raise reports `Project`. The product raises the eager reason
`session_start` on every `startSession`; the source's later eager reasons
(compaction, directory_added) are not tracked. The source gates the raise on a
configured hook (`tar()`); the product calls the hook unconditionally and the
hook runner is the no-op when none is configured.

## Verification

`agent-lifecycle` 34/34: an eager file receives `file_path`,
`memory_type: "Project"`, `load_reason: "session_start"` and no parent; a
path read raises ancestor (`nested_traversal`, trigger path), import
(`include`, parent path), selected rule (`path_glob_match`, globs, trigger
path) and rule import (`include`, parent path) in order. tsc 0; build 0; full
2,120/2,120; chain 767/767; notices 0; source index unchanged; identity
`87bbcc5c…`.
