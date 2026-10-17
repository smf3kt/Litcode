// W93-01 record: SessionEnd reason enum.
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

const note = `# W93 — SessionEnd reason enum

## Source position

The SessionEnd schema fixes \`reason\` to \`["clear", "resume", "logout",
"prompt_input_exit", "other"]\` (\`GK\`, chunk-r2vtj1kh.js
[204799,204858)). The builder raises \`{hook_event_name: "SessionEnd", reason}\`
and uses the reason as the matcher query (chunk-sfn1dbxq.js offset 2943888).
The source ends a session with \`clear\` for /clear and \`resume\` when a
resumed transcript takes over (chunk-24k7d6mw.js offset 348193), and with
\`prompt_input_exit\` when prompt input ends.

## Port

\`endSession\` maps this runtime's own close causes onto that enum before the
raise: \`clear\`, \`resume\`, \`logout\` and \`prompt_input_exit\` pass through;
\`session_switch\` becomes \`resume\`; \`exit\` becomes \`prompt_input_exit\`; and
\`fork\`, \`config_changed\`, \`config_reload\`, \`cwd_changed\`, \`rewind\`,
\`interrupt\` and \`other\` become \`other\`.

## Correction

The product previously passed its internal reason text (\`fork\`,
\`config_changed\`, \`session_switch\`, \`config_reload\`, \`cwd_changed\`,
\`rewind\`, \`interrupt\`, \`exit\`) straight to the hook. Those values are not
in the recovered enum and broke reason matchers; the interactive test now
expects \`other\` where it previously observed \`fork\`.

## Verification

\`agent-lifecycle\` 35/35: six close causes produce the mapped reasons in
order. \`interactive\` 8/8: /clear, /fork and /exit produce
\`clear\`, \`other\`, \`prompt_input_exit\`. tsc 0; build 0; full 2,122/2,122;
chain 767/767; notices 0; source index unchanged; identity \`11df4f85…\`.
`;
write('research/ports/W93-session-end-reasons.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W93-01 maps SessionEnd close causes onto the recovered reason enum
(\`clear\`, \`resume\`, \`logout\`, \`prompt_input_exit\`, \`other\`). The product's
internal causes no longer reach the hook: \`session_switch\` is \`resume\`,
\`exit\` is \`prompt_input_exit\`, and the remaining close causes are \`other\`.
\`agent-lifecycle\` 35/35, \`interactive\` 8/8, tsc 0, build 0, full
2,122/2,122, chain 767/767, identity \`11df4f85…\`.
[W93 record](ports/W93-session-end-reasons.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-18 W93-01 SessionEnd 原因枚举：S-1（先读源）：读取 chunk-r2vtj1kh.js 的 GK [204799,204858) 与 chunk-sfn1dbxq.js 2943888 的构造与匹配查询，以及 chunk-24k7d6mw.js 348193 的 resume 调用。S-2（不臆造）：reason 仅 clear/resume/logout/prompt_input_exit/other；内部关闭原因在 raise 前映射。S-3（边界）：session_switch→resume，exit→prompt_input_exit，其余→other；内部原因仍保留在事件日志。S-4（可测）：新增六种关闭原因映射用例；interactive 期望 fork→other。S-5/S-6：无依赖变化。S-7（记录）：端口记录与证据 JSON，纠正记录在端口内。验证：agent-lifecycle 35/35、interactive 8/8、tsc 0、build 0、全量 2,122/2,122、链 767/767、身份 11df4f85…。
`);

replaceOnce('research/FEATURES.md',
  'removes the invented Notification raise for internal runtime event prompts |',
  'removes the invented Notification raise for internal runtime event prompts; W93 maps every SessionEnd close cause onto the recovered `clear`/`resume`/`logout`/`prompt_input_exit`/`other` enum before the raise |');

replaceAll('research/CURRENT.md',
  '完整消费者与脚本语义仍待处理',
  'W93完成SessionEnd原因枚举（clear/resume/logout/prompt_input_exit/other；内部关闭原因在raise前映射）；完整消费者与脚本语义仍待处理', 3);

const tsv = [
  ['2026-10-18T04:15:00Z', 'package', 'W93-01 SessionEnd 原因枚举',
    'GK [204799,204858)、构造 2943888、resume 调用 348193；endSession 映射',
    'session_switch→resume；exit→prompt_input_exit；fork/配置/rewind/interrupt→other',
    'agent-lifecycle 35/35；interactive 8/8；tsc 0；build 0；全量 2,122/2,122；链 767/767'],
  ['2026-10-18T04:17:00Z', 'decision', 'W93-01 纠正',
    '内部原因（fork/config_changed/session_switch/config_reload/cwd_changed/rewind/interrupt/exit）不在源枚举内，改为 raise 前映射',
    '残余：完整消费者',
    '.audit/w93-01-full.txt'],
  ['2026-10-18T04:20:00Z', 'verification', 'W93-01 验收：agent-lifecycle 35/35、interactive 8/8、tsc 0、build 0、2,122/2,122、767/767',
    '六种关闭原因按序产出映射值；/clear、/fork、/exit 产出 clear、other、prompt_input_exit',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 11df4f85…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w93-runtime.tsv', tsv + '\n');

write('.audit/w93-runtime.todo.md', `# W93 runtime trail

## W93-01 acceptance (2026-10-18)

- [x] **Source read.** \`GK\`, the SessionEnd builder and the \`resume\` call site.
- [x] **Port.** Close-cause mapping onto the recovered enum before the raise.
- [x] **Correction.** Internal reasons no longer reach the hook.
- [x] **Gates.** agent-lifecycle 35/35, interactive 8/8, tsc 0, build 0, full
  2,122/2,122, chain 767/767, notices 0, source index unchanged, identity
  \`11df4f85…\`.
- [ ] Remaining C-6: full consumers.
`);

const evidence = {
  schema: 'W93SessionEndReasonsEvidence.v1',
  package: 'W93-01 — SessionEnd reason enum',
  date: '2026-10-18',
  question: 'Which SessionEnd reasons does the recovered build accept, and how do the product close causes map?',
  answer: 'Only clear, resume, logout, prompt_input_exit and other. endSession now maps session_switch to resume, exit to prompt_input_exit and every other internal close cause to other before raising.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    reasonEnum: { module: 'extracted-v2/modules/chunk-r2vtj1kh.js', symbol: 'GK', range: [204799, 204858],
      values: ['clear', 'resume', 'logout', 'prompt_input_exit', 'other'] },
    builder: { module: 'extracted-v2/modules/chunk-sfn1dbxq.js', offset: 2943888, matcherQuery: 'reason' },
    resumeSite: { module: 'extracted-v2/modules/chunk-24k7d6mw.js', offset: 348193 },
  },
  behavior: {
    passthrough: ['clear', 'resume', 'logout', 'prompt_input_exit', 'other'],
    sessionSwitch: 'resume',
    exit: 'prompt_input_exit',
    otherInternal: ['fork', 'config_changed', 'config_reload', 'cwd_changed', 'rewind', 'interrupt'],
  },
  correction: {
    previous: 'internal reason text (fork, config_changed, session_switch, config_reload, cwd_changed, rewind, interrupt, exit) reached the hook',
    basis: 'the recovered schema enumerates five reasons and matches on reason',
    updatedTests: ['test/agent-lifecycle.test.ts', 'test/interactive.test.ts'],
  },
  changes: [
    { file: 'src/agent.ts', change: 'endSession reason mapping', sha256: sha(read('src/agent.ts')) },
    { file: 'test/agent-lifecycle.test.ts', change: 'mapping test', sha256: sha(read('test/agent-lifecycle.test.ts')) },
    { file: 'test/interactive.test.ts', change: 'fork expectation now other', sha256: sha(read('test/interactive.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-6 rows record W93', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Lifecycle hooks row records W93', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W93-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W93-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    lifecycle: '35/35',
    interactive: '8/8',
    build: 'exit 0',
    full: '2,122/2,122',
    chain: '767/767',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '11df4f85c722405785ab83a6f523f9308420d94fb86b8fbe836b2383b07db5f8',
  },
  residuals: [
    'Stop/SubagentStop background_tasks and session_crons remain unwired because the agent has no runtime registry handle.',
    'Full hook consumers remain C-6 work.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-6 continues with full consumers.',
};
write('research/ports/W93-session-end-reasons-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW93-01 maps SessionEnd close causes',
  'research/coding-standard.md': '\n2026-10-18 W93-01 ',
  'research/FEATURES.md': 'W93 maps every SessionEnd close cause',
  'research/ports/W93-session-end-reasons.md': '# W93 — SessionEnd reason enum',
  '.audit/w93-runtime.todo.md': '\n## W93-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
