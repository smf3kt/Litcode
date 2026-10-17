// W112-01 record: updatedMCPToolOutput.
import fs from 'node:fs';
import crypto from 'node:crypto';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

function replaceOnce(path, from, to) {
  const text = read(path);
  if (text.split(from).length - 1 !== 1) throw new Error(`${path}: expected one occurrence of ${JSON.stringify(from)}`);
  write(path, text.replace(from, to));
}

function replaceAll(path, from, to, expected) {
  const text = read(path);
  const count = text.split(from).length - 1;
  if (count !== expected) throw new Error(`${path}: expected ${expected} occurrences of ${JSON.stringify(from)}, found ${count}`);
  write(path, text.split(from).join(to));
}

const note = `# W112 — updatedMCPToolOutput

## Source position

The PostToolUse output schema carries both \`updatedToolOutput\` ("Replaces the
tool output before it is sent to the model") and \`updatedMCPToolOutput\`
("Replaces the output for MCP tools only. Prefer updatedToolOutput, which works
for all tools") (chunk-n3ykh62m.js offset 394888 and 395073). The result
consumer (chunk-sfn1dbxq.js offset 2233204) drops either rewrite when the tool is
the account memory server (\`aL\`), always applies \`updatedToolOutput\`, and
applies \`updatedMCPToolOutput\` only when its MCP-tool predicate \`Sh\` matches
(offset 2233390); the MCP field is yielded after the general one, so it wins for
an MCP tool when both are present.

## Port

\`HookResult\` gains \`updatedMCPToolOutput\`, parsed only from PostToolUse.
The batch consumer replaces the result with \`updatedMCPToolOutput\` when the
tool name is in the \`mcp__\` namespace and the field is present, otherwise with
\`updatedToolOutput\`, so an MCP tool prefers the MCP field and a non-MCP tool
ignores it. The classic raise path already merges both fields.

## Adaptation

This product identifies MCP tools by their \`mcp__\` namespace
(agent.ts:286) rather than an mcpInfo record, so that prefix is the predicate.
The account memory server guard has no analogue: this runtime has no account
memory MCP server.

## Verification

\`hooks\` asserts both fields parse independently, the MCP field stays absent
from the general result, and another event cannot set it.
\`agent-lifecycle\` asserts an \`mcp__\` tool is rewritten and a non-MCP tool is
not. Focused 102/102, tsc 0, build 0, full 2,151/2,151, chain 767/767, notices
0, identity \`ecd38624…\`.
`;
write('research/ports/W112-updated-mcp-output.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W112-01 consumes PostToolUse \`updatedMCPToolOutput\`. The MCP-only rewrite
applies to \`mcp__\` tools and wins over \`updatedToolOutput\` there; other tools
ignore it. The account memory server guard has no local analogue. Focused
102/102, tsc 0, build 0, full 2,151/2,151, chain 767/767, identity
\`ecd38624…\`.
[W112 record](ports/W112-updated-mcp-output.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W112-01 updatedMCPToolOutput：S-1（先读源）：输出 schema 394888/395073（chunk-n3ykh62m.js）、消费 2233204、MCP 判定 2233390、账户记忆守卫 aL（chunk-sfn1dbxq.js）。S-2（不臆造）：仅 PostToolUse 解析；仅 mcp__ 工具应用且优先于 updatedToolOutput；账户记忆守卫无本地对应。S-3（边界）：本产品以 mcp__ 前缀作 MCP 判定（mcpInfo 不存在）；无账户记忆 MCP 服务器。S-4（可测）：hooks 断言字段独立解析与他事件忽略；agent-lifecycle 断言 MCP 工具被改写、非 MCP 不变。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON。验证：聚焦 102/102、tsc 0、build 0、全量 2,151/2,151、链 767/767、notices 0、索引不变、身份 ecd38624…。
`);

replaceOnce('research/FEATURES.md',
  'W111 registers SessionStart `watchPaths` with the config watcher for startup and every later start |',
  'W111 registers SessionStart `watchPaths` with the config watcher for startup and every later start; W112 applies the PostToolUse `updatedMCPToolOutput` rewrite to `mcp__` tools only |');

replaceAll('research/CURRENT.md',
  '；W111消费SessionStart的watchPaths（startup经initialWatchPaths、后续启动取返回值注册到配置监视器）；完整消费者与脚本语义仍待处理',
  '；W111消费SessionStart的watchPaths（startup经initialWatchPaths、后续启动取返回值注册到配置监视器）；W112消费PostToolUse的updatedMCPToolOutput（仅mcp__工具，优先于updatedToolOutput）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-17T21:40:00Z', 'package', 'W112-01 updatedMCPToolOutput',
    'schema 394888/395073（chunk-n3ykh62m.js）、消费 2233204、MCP 判定 2233390（chunk-sfn1dbxq.js）',
    '仅PostToolUse；仅mcp__工具；MCP字段优先；账户记忆守卫无对应',
    'hooks/agent-lifecycle 102/102；tsc 0；build 0；全量 2,151/2,151；链 767/767'],
  ['2026-10-17T21:42:00Z', 'decision', 'W112-01 本地适配',
    '源用Sh判定MCP并守卫账户记忆服务器；本产品用mcp__前缀且无该服务器',
    '非MCP工具忽略updatedMCPToolOutput',
    '.audit/w112-01-full.txt'],
  ['2026-10-17T21:44:00Z', 'verification', 'W112-01 验收：聚焦 102/102、tsc 0、build 0、2,151/2,151、767/767',
    'MCP工具输出被替换；非MCP保持原输出',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity ecd38624…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w112-runtime.tsv', tsv + '\n');

write('.audit/w112-runtime.todo.md', `# W112 runtime trail

## W112-01 acceptance (2026-10-17)

- [x] **Source read.** Both output fields, the consumer's guard and MCP
  predicate, and the yield order that makes the MCP field win.
- [x] **Port.** Field parse, mcp__ gate, MCP-first replacement.
- [x] **Bounds.** Only PostToolUse sets it; non-MCP tools ignore it; the
  account memory server guard has no local analogue.
- [x] **Gates.** focused 102/102, tsc 0, build 0, full 2,151/2,151, chain
  767/767, notices 0, source index unchanged, identity \`ecd38624…\`.
- [ ] Remaining C-6: the rest of the script semantics.
`);

const evidence = {
  schema: 'W112UpdatedMcpOutputEvidence.v1',
  package: 'W112-01 — PostToolUse updatedMCPToolOutput',
  date: '2026-10-17',
  question: 'How does the PostToolUse updatedMCPToolOutput output differ from updatedToolOutput?',
  answer: 'Both replace the tool output before it reaches the model. The MCP field applies only to MCP tools and is applied after the general field, so it wins there; the account memory server is exempt from either rewrite.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    schema: { module: 'extracted-v2/modules/chunk-n3ykh62m.js', offsets: [394888, 395073] },
    consumer: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offset: 2233204 },
    mcpPredicate: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offset: 2233390 },
  },
  behavior: {
    event: 'PostToolUse',
    fields: ['updatedToolOutput', 'updatedMCPToolOutput'],
    mcpOnly: true,
    mcpWinsWhenBoth: true,
    accountMemoryGuard: true,
  },
  adaptations: [
    'MCP tools are identified by the mcp__ namespace because this product has no mcpInfo record.',
    'The account memory server guard has no analogue in this runtime.',
  ],
  changes: [
    { file: 'src/hooks.ts', change: 'field parse', sha256: sha(read('src/hooks.ts')) },
    { file: 'src/agent.ts', change: 'mcp__ gate and MCP-first replacement', sha256: sha(read('src/agent.ts')) },
    { file: 'test/hooks.test.ts', change: 'parse and ignore assertions', sha256: sha(read('test/hooks.test.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'MCP and non-MCP rewrite assertions', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W112', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W112', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W112-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W112-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '102/102 (hooks, agent-lifecycle)',
    build: 'exit 0',
    full: '2,151/2,151',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'ecd386244a0fe8eab8ed1cf16384a553871c3fff888b7afceb3303ad60d6652e',
  },
  residuals: [
    'The remaining C-6 script semantics are unconsumed.',
    'The account memory server guard is not representable locally.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with the remaining script semantics.',
};
write('research/ports/W112-updated-mcp-output-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW112-01 consumes PostToolUse',
  'research/coding-standard.md': '\n2026-10-17 W112-01 ',
  'research/FEATURES.md': 'W112 applies the PostToolUse',
  'research/ports/W112-updated-mcp-output.md': '# W112 — updatedMCPToolOutput',
  '.audit/w112-runtime.todo.md': '\n## W112-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
