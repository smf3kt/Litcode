# W95 — UserPromptExpansion payload

## Source position

`VYr` (chunk-sfn1dbxq.js offset 2947732) builds
`{expansion_type, command_name, command_args, command_source, prompt}`; the
schema fixes `expansion_type` to `slash_command`/`mcp_prompt` and requires
name, args and prompt (chunk-r2vtj1kh.js offset 194968). The one call site
(chunk-htgmc2p1.js offset 38795) raises it from the skill-expansion path with
the typed arguments and the reconstructed command text (`/name args`).

## Port

`Agent.run` takes an optional expansion descriptor and raises
`UserPromptExpansion` only when one is supplied, with the recovered four
fields. The interactive slash-command path supplies the canonical skill name,
the typed arguments and the reconstructed command text for both the executed
and the expanded skill paths.

## Correction

The product previously raised `{prompt, source: "user"}` for every prompt,
not only expansions. That payload lacked every required expansion field and
made the event fire on plain prompts and on `/attach`; the attachments test
that relied on the rewrite now asserts the hook stays silent and the original
task text reaches the model.

## Adaptation

`command_source` stays unset: this runtime's skill catalog does not record the
source the source build reports. A forked skill execution that runs inside the
skill runtime does not carry expansion metadata yet.

## Verification

`agent-lifecycle` 38/38: a plain prompt raises nothing; an expansion carries
the four fields and its `updatedPrompt`/`additionalContext` reach the model
request. `interactive` 8/8: `/greet world` and `/auto z` raise the canonical
command names and command text. `attachments` 2/2 with the corrected
silence assertion. tsc 0; build 0; full 2,124/2,124; chain 767/767; notices 0;
source index unchanged; identity `50e58886…`.
