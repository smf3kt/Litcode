# W90 — WorktreeCreate and WorktreeRemove payloads

## Source position

The two worktree hooks carry one field each. `CTn` builds
`{...$d(e,se()), hook_event_name: "WorktreeCreate", name: n}`
(chunk-sfn1dbxq.js offset 2952999) and raises it through `b0`.
`Xir` builds `{...$d(e,se()), hook_event_name: "WorktreeRemove", worktree_path: n}`
(offset 2954347). Neither sends the tool name, the tool input or the tool
response.

## Port

The WorktreeCreate gate now sends only the requested `name`; the tool fields
are gone. The WorktreeRemove raise sends only `worktree_path`, computed as the
manager's own deterministic target (`path.join(workspace,
WORKTREE_DIRECTORY, name)`), since this product removes the worktree itself
before raising the hook, exactly as the source raises after its removal.

## Adaptation

In the source the WorktreeCreate hook owns the creation and must return the
worktree path; this product keeps its tool-owned creation and a blocking gate,
so only the payload is ported. The WorktreeRemove hook stays informational:
the source logs failed entries without turning them into a block, and the
product keeps its fire-and-forget raise.

## Verification

`agent-lifecycle` 33/33: the WorktreeCreate hook receives `{name: "worker",
hook_event_name: "WorktreeCreate", ...}` with no `tool_name`/`tool_input`,
and the WorktreeRemove hook receives `{worktree_path:
<workspace>/.harness-worktrees/worker, ...}` with no `tool_name`/
`tool_response`. tsc 0; build 0; full 2,119/2,119; chain 767/767; notices 0;
source index unchanged; identity `8288ec96…`.
