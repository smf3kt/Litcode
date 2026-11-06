// W127-01 record: unattended memory consolidation disposition.
import fs from 'node:fs';
import crypto from 'node:crypto';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

function replaceAll(path, from, to, expected) {
  const text = read(path);
  const count = text.split(from).length - 1;
  if (count !== expected) throw new Error(`${path}: expected ${expected} occurrences of ${JSON.stringify(from)}, found ${count}`);
  write(path, text.split(from).join(to));
}

const note = `# W127 — Unattended memory consolidation: substitution disposition

C-9's first clause was the original unattended consolidation pass ("auto
dream"). This package reads the trigger, state and settlement code and records
why it is not ported as-is, plus the product behaviour that carries the same
user-facing function.

## Recovered evidence

- Entry and gates (chunk-kxgzv2t8.js offset 11 onward): the runner fires from
  session start only when the feature flag is on and
  \`he()\` holds: no remote session (\`vr\`, chunk-qr9z1wer.js 1185), not an SDK
  entrypoint (\`rj\`, chunk-tadwrn0a.js 4842), memory enabled (\`Ou\`,
  chunk-bk5ct2gw.js 541750), and not the incompatible mode \`D9\`
  (chunk-2bcyxj9q.js 72290).
- Thresholds: \`minHours 24\`, \`minSessions 5\`, and a 600000 ms scan throttle.
  The pass skips when a permission rule would refuse memory writes and reports
  the refusal.
- State (chunk-2dvx15ja.js): \`I7e\` reads the last-consolidated timestamp from
  the memory items record or the directory mtime; \`M1o\` acquires a lock file
  holding the PID, treats a lock younger than the stale window as held by a
  live process, and \`qgt\` rolls the mtime back on failure; \`D1o\` lists
  sessions touched since that timestamp from the session store.
- The pass (chunk-kxgzv2t8.js): a forked background query with
  \`querySource: "auto_dream"\`, a memory-write permission context, a memory
  prompt covering personal and team directories, message streaming into a
  bounded turn list (30 turns), tracking of memory files written, and
  \`deferCappedRunWrites\`/\`settleDreamItems\` settlement when the items record
  was capped. Completion or failure updates a task-registry entry and triggers
  a notification.

## Decision

Not ported as-is. A faithful trigger needs four layers this runtime does not
have: a cross-session transcript store to enumerate "sessions touched since",
the memory items record with capped-run and settlement semantics, a
cross-session lock/state record, and a forked background query with its own
permission and task-registry lifecycle. Firing the pass without them would
either find no sessions or write memories with no item settlement.

The user-facing function is already carried in-conversation:
\`AUTO_MEMORY_INSTRUCTIONS\` (src/auto-memory.ts) tells the model to perform
memory maintenance in the current conversation, merge duplicates,
reconcile against instruction files, and never store transient or secret
material, and explicitly states that maintenance happens without a separate
extraction model call. The startup context loads the catalog and bodies under
the same permission policy.

Residual under C-9 stays: marketplace/publish/full component semantics and
plugin source-vs-builtin conflicts with auto-discovery.

## Verification

Documentation-only package: no source or test change. The last measured gates
are W126's — workflow family 43/43, tsc 0, build 0, full 2,204/2,204, chain
768/768, notices 0 — and the content identity is unchanged at \`adad009d…\`.
`;
write('research/ports/W127-auto-dream-disposition.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W127-01 dispositions the unattended memory consolidation pass. The recovered trigger needs a
cross-session transcript store, the memory items record with capped-run settlement, a
cross-session lock/state file and a forked background query with its own permission and task
lifecycle; this runtime has none of those layers, so the trigger is not ported. The user-facing
function is carried by in-conversation maintenance, which \`AUTO_MEMORY_INSTRUCTIONS\` already
requires and which performs memory upkeep without a separate extraction call. Marketplace,
publish and plugin conflict/auto-discovery clauses remain open under C-9. Documentation-only
package; identity \`adad009d…\`. [W127 record](ports/W127-auto-dream-disposition.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W127-01 无人值守记忆整合处置：S-1（先读源）：入口与门控 chunk-kxgzv2t8.js 11起、vr 1185（chunk-qr9z1wer.js）、rj 4842（chunk-tadwrn0a.js）、Ou 541750（chunk-bk5ct2gw.js）、D9 72290、B2 124067（chunk-2bcyxj9q.js）、I7e/M1o/qgt/D1o 1500-4300（chunk-2dvx15ja.js）。S-2（不臆造）：24小时/5会话/600000ms节流、PID锁与回滚、items记录/延迟写入结算、forked查询。S-3（边界）：四层依赖（会话转录枚举、items记录、跨会话锁、带权限与任务生命周期的forked查询）本运行时均无；按替代处置，当前对话内维护承担用户面功能（AUTO_MEMORY_INSTRUCTIONS明确无独立抽取调用）。S-4：文档包无行为变更、无新增测试。S-5/S-6：无依赖与接口变化。S-7：端口记录与证据JSON。验证：沿用W126闸门（全量2,204/2,204），身份adad009d…不变。
`);

replaceAll('research/CURRENT.md',
  '原文无人值守整合运行未移植（本运行时没有后台 agent pass）',
  '原文无人值守整合运行W127记为按替代处置（触发需会话转录枚举、记忆条目记录/延迟写入结算、跨会话锁与独立权限上下文的forked查询，本运行时无这些层次；用户面功能由当前对话内维护承担，AUTO_MEMORY_INSTRUCTIONS明确要求当前对话维护、无独立抽取调用）',
  3);

const tsv = [
  ['2026-10-17T17:50:00Z', 'package', 'W127-01 无人值守记忆整合处置',
    'chunk-kxgzv2t8.js 11起；vr 1185、rj 4842、Ou 541750、D9 72290、B2 124067；chunk-2dvx15ja.js 1500-4300',
    '24h/5会话/10分钟节流、PID锁/回滚、items结算、forked查询；本运行时无四层依赖',
    '替代处置：当前对话内维护；文档包无代码变更'],
  ['2026-10-17T17:55:00Z', 'verification', 'W127-01 验收：CURRENT×3、STATUS与标准条目、端口记录与证据JSON',
    '沿用W126闸门：全量2,204/2,204、链768/768、notices 0',
    'identity adad009d…不变；索引未变'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w127-runtime.tsv', tsv + '\n');

write('.audit/w127-runtime.todo.md', `# W127 runtime trail

## W127-01 acceptance (2026-10-17)

- [x] **Trigger read.** Feature gate, remote/SDK/memory-mode gates, 24h and
  5-session thresholds, 10-minute throttle, permission-write refusal.
- [x] **State read.** Last-consolidated timestamp, PID lock with stale window
  and rollback, sessions-touched listing.
- [x] **Pass read.** Forked background query, 30-turn bound, file tracking,
  capped-run write deferral and item settlement.
- [x] **Disposition.** Not ported as-is; in-conversation maintenance carries
  the user-facing function and is already the product contract.
- [x] **Gates.** No code change; W126's measured gates stand and the identity
  is unchanged.
- [ ] Remaining C-9: marketplace/publish/full component semantics, plugin
  source-vs-builtin conflicts and auto-discovery.
`);

const evidence = {
  schema: 'W127AutoDreamDispositionEvidence.v1',
  package: 'W127-01 — Unattended memory consolidation disposition',
  date: '2026-10-17',
  question: 'Can the recovered unattended memory consolidation pass be ported into this local runtime?',
  answer: 'Not faithfully. Its trigger needs a cross-session transcript store, the memory items record with capped-run and settlement semantics, a cross-session lock/state file, and a forked background query with its own permission and task lifecycle; none of those layers exist here. The user-facing function is already carried by in-conversation maintenance, which the product instructions require.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    modules: {
      'extracted-v2/modules/chunk-kxgzv2t8.js': [11, 51],
      'extracted-v2/modules/chunk-qr9z1wer.js': [1185],
      'extracted-v2/modules/chunk-tadwrn0a.js': [4842],
      'extracted-v2/modules/chunk-bk5ct2gw.js': [541750],
      'extracted-v2/modules/chunk-2bcyxj9q.js': [72290, 124067],
      'extracted-v2/modules/chunk-2dvx15ja.js': [1579, 1845, 2429, 3579],
    },
    implementation: { 'src/auto-memory.ts': { ranges: 'AUTO_MEMORY_INSTRUCTIONS, loadAutoMemoryContext' } },
  },
  behavior: {
    thresholds: { minHours: 24, minSessions: 5, throttleMs: 600000 },
    remoteSessionGate: true,
    sdkEntrypointGate: true,
    memoryEnabledGate: true,
    permissionWriteRefusal: true,
    pidLockWithRollback: true,
    sessionsTouchedSince: true,
    forkedBackgroundQuery: true,
    cappedWriteSettlement: true,
    ported: false,
    inConversationMaintenance: true,
  },
  adaptations: [
    'Unattended consolidation is replaced by in-conversation memory maintenance; the startup context and memory tools remain.',
    'The trigger, lock, items-record settlement and forked query are not ported because their storage and lifecycle layers are absent.',
  ],
  changes: [
    { file: 'research/CURRENT.md', change: 'three C-9 rows record W127', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/STATUS.md', change: 'W127-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W127-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    codeChange: 'none (documentation only)',
    lastMeasured: 'W126: workflow family 43/43, tsc 0, build 0, full 2,204/2,204, chain 768/768, notices 0',
    identity: 'adad009d1eaf9d37bbdb15437a080d84baf0155a1deea979e3d5faefb0719e08',
  },
  residuals: [
    'C-9: marketplace/publish/full component semantics remain out.',
    'C-9: plugin source-vs-builtin conflicts and auto-discovery remain out.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-9 continues with plugin source conflicts/auto-discovery, or the next ready C-area cluster from CURRENT.',
};
write('research/ports/W127-auto-dream-disposition-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW127-01 dispositions the unattended memory consolidation pass',
  'research/coding-standard.md': '\n2026-10-17 W127-01 ',
  'research/CURRENT.md': { mark: 'W127记为按替代处置', count: 3 },
  'research/ports/W127-auto-dream-disposition.md': '# W127 — Unattended memory consolidation: substitution disposition',
  '.audit/w127-runtime.todo.md': '\n## W127-01 acceptance',
};
for (const [path, expected] of Object.entries(marks)) {
  const { mark, count } = typeof expected === 'string' ? { mark: expected, count: 1 } : expected;
  const found = read(path).split(mark).length - 1;
  if (found !== count) throw new Error(`${path} holds ${found} entries for ${JSON.stringify(mark)}, expected ${count}`);
}
console.log('record ok');
