# W112 — updatedMCPToolOutput

## Source position

The PostToolUse output schema carries both `updatedToolOutput` ("Replaces the
tool output before it is sent to the model") and `updatedMCPToolOutput`
("Replaces the output for MCP tools only. Prefer updatedToolOutput, which works
for all tools") (chunk-n3ykh62m.js offset 394888 and 395073). The result
consumer (chunk-sfn1dbxq.js offset 2233204) drops either rewrite when the tool is
the account memory server (`aL`), always applies `updatedToolOutput`, and
applies `updatedMCPToolOutput` only when its MCP-tool predicate `Sh` matches
(offset 2233390); the MCP field is yielded after the general one, so it wins for
an MCP tool when both are present.

## Port

`HookResult` gains `updatedMCPToolOutput`, parsed only from PostToolUse.
The batch consumer replaces the result with `updatedMCPToolOutput` when the
tool name is in the `mcp__` namespace and the field is present, otherwise with
`updatedToolOutput`, so an MCP tool prefers the MCP field and a non-MCP tool
ignores it. The classic raise path already merges both fields.

## Adaptation

This product identifies MCP tools by their `mcp__` namespace
(agent.ts:286) rather than an mcpInfo record, so that prefix is the predicate.
The account memory server guard has no analogue: this runtime has no account
memory MCP server.

## Verification

`hooks` asserts both fields parse independently, the MCP field stays absent
from the general result, and another event cannot set it.
`agent-lifecycle` asserts an `mcp__` tool is rewritten and a non-MCP tool is
not. Focused 102/102, tsc 0, build 0, full 2,151/2,151, chain 767/767, notices
0, identity `ecd38624…`.
