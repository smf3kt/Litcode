// W53-01 record: a capture's session association is recoverable across a crash.
import fs from 'node:fs';
import crypto from 'node:crypto';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

const note = `# W53 — capture and its session association form one recoverable unit

## Source position

The checkpoint store and its session journal are this runtime's construction. W04 records that the
recovered durable checkpoint transaction was never established, so this is a local extension. It
follows the recovered observe-and-prove policy (\`zPo\`, chunk-sfn1dbxq.js [1801370,1802540), UTF-8
bytes): recovery acts only on facts it can prove and retains everything else.

## Window

\`captureCheckpoint\` publishes objects and then the manifest atomically; \`checkpointConversation\`
then appends \`{kind:"checkpoint", name, digest, boundary}\` to the session journal. A crash after the
manifest and before that append left a checkpoint no session reached, because the next
\`automaticCheckpoint\` had to use a fresh name and an explicit name stayed occupied until the user
picked another. The reverse ordering was already safe: an association can never point at a missing
manifest.

## Behavior

1. Before capture, \`checkpointConversation\` atomically writes
   \`<store>/.assoc-<uuid>.json\` naming the session, checkpoint, boundary and creator pid.
2. Capture publishes the manifest. On a capture error the intent is cleared; a crash leaves it.
3. The journal append follows; success clears the intent. A failed append keeps it.
4. Every resumed \`Session.open\` scans this session's intents under the session lock:
   - a validated manifest with no matching event appends the missing event and clears the intent;
   - an intent whose manifest was never published is cleared;
   - an intent already represented by the same name and digest is cleared;
   - a foreign session, an unreadable intent or a digest mismatch stays for inspection.

The append reuses the recorded boundary, so deduplication and rewind see exactly the association
the crashed process intended.

## Verification

Rewind 7/7 with two new cases: one drives the recovery rules (missing manifest, foreign session,
invalid file, idempotent reopen) and one kills a real child process with SIGKILL from inside
\`Session.append\` after capture, then asserts the next open restores the event and clears the
intent. Checkpoints 21/21, full 2,088/2,088, chain 767/767, tsc 0, build 0, notices 0, checkpoint
crash smoke eight cutpoints in source and compiled modes, source index unchanged, identity
\`df90fb56…\`.
`;
write('research/ports/W53-checkpoint-association.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W53-01 makes checkpoint capture and its session association one recoverable unit. The capture path
writes a durable \`.assoc-<uuid>.json\` intent before publishing the manifest and clears it after the
journal append. A resumed \`Session.open\` scans this session's intents under the session lock and
appends a missing checkpoint event from the validated manifest; an intent whose manifest was never
published, or one already represented by the same name and digest, is cleared, while foreign,
unreadable or digest-mismatched files stay for inspection. Rewind 7/7 adds a real SIGKILL between
capture and append; checkpoints 21/21, full 2,088/2,088, chain 767/767, both checkpoint crash smoke
modes pass; identity \`df90fb56…\`. [W53 record](ports/W53-checkpoint-association.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W53-01 checkpoint 捕获关联：S-1（先读源）：恢复源未建立持久 checkpoint 事务（W04），本包为本地扩展，观察时核对沿用 recovered zPo。S-2（不臆造）：manifest 先于关联发布，关联永不指向缺失 manifest；intent 只在可证明时清除。S-3（边界）：仅处理本会话 intent；外来会话、不可读与摘要不符一律保留；恢复在会话锁下进行且不阻断打开。S-4（可测）：新增恢复规则用例与真实 SIGKILL 用例。S-5/S-6：无新增依赖。S-7（记录）：端口记录与证据 JSON、W04 附录。验证：tsc 0、rewind 7/7、checkpoints 21/21、全量 2,088/2,088、链 767/767、checkpoint crash smoke 两模式、身份 df90fb56…。
`);

const featureOld = 'capture-association crash windows, power-loss/GC and original equivalence remain gaps';
const featureNew = 'a durable association intent restores a crash between capture and its journal event on the next open, while power-loss/GC and original equivalence remain gaps';
const featureText = read('research/FEATURES.md');
if (featureText.split(featureOld).length - 1 !== 1) throw new Error('FEATURES checkpoint gap sentence count changed');
write('research/FEATURES.md', featureText.replace(featureOld, featureNew));

const rowOld = '；捕获关联崩溃窗口、断电/GC 仍待处理 | Git worktree/cwd relocation；Checkpoint/rewind |';
const rowNew = '；捕获关联崩溃窗口已完成（W53-01：capture 前写入持久关联 intent，崩溃后下次打开会话在会话锁下补写 checkpoint 事件；无 manifest 的 intent 清除，外来/不可读/摘要不符保留）；断电/GC 仍待处理 | Git worktree/cwd relocation；Checkpoint/rewind |';
const current = read('research/CURRENT.md');
if (current.split(rowOld).length - 1 !== 3) throw new Error('CURRENT C-4 row count changed');
write('research/CURRENT.md', current.split(rowOld).join(rowNew));

write('research/ports/W04-crash-recovery.md', read('research/ports/W04-crash-recovery.md').replace(/\n+$/, '\n') + `

## W53-01 capture association (2026-10-17)

Capture now writes a durable association intent before publishing the manifest, and a resumed
\`Session.open\` appends the missing checkpoint event under the session lock. The intent is cleared
once the event is durable; intents with no published manifest are cleared, while foreign,
unreadable or digest-mismatched files stay for inspection. [W53 record](W53-checkpoint-association.md).
`);

const tsv = [
  ['2026-10-17T10:12:00Z', 'package', 'W53-01 checkpoint 捕获关联崩溃窗口',
    'capture 前原子写入 .assoc intent；append 成功后清除；Session.open 在会话锁下校验 manifest 并补写 checkpoint 事件',
    '本地扩展（W04：恢复源未建立持久事务）；观察时核对沿用 zPo',
    'rewind 7/7；checkpoints 21/21；全量 2,088/2,088；链 767/767；两模式 crash smoke 通过'],
  ['2026-10-17T10:15:00Z', 'decision', 'W53-01 只在可证明时动作',
    '① manifest 先发布，关联后写入，反向缺失不可能；② 无 manifest 的 intent 清除（capture 未提交）；③ 同名同摘要视为已完成；④ 外来会话/不可读/摘要不符保留；⑤ 恢复失败不阻断会话打开；⑥ 真实 SIGKILL 在 append 前验证补写',
    '残余：append 同步失败后 intent 需等到下次打开才被关联；intent 无到期清理（归入 GC）',
    '.audit/w53-01-test.txt'],
  ['2026-10-17T10:18:00Z', 'verification', 'W53-01 验收：rewind 7/7、checkpoints 21/21、2,088/2,088、767/767、两模式 crash smoke、身份 df90fb56…',
    '真实子进程 SIGKILL：manifest 1、intent 1；重新打开后事件 1、intent 0、preview 可解析',
    'tsc 0；build 0；notices 0；索引 75 chunks / 323,525 单位不变；smoke exit 0'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w53-runtime.tsv', tsv + '\n');

write('.audit/w53-runtime.todo.md', `# W53 runtime trail

## W53-01 acceptance (2026-10-17)

- [x] **Intent precedes capture.** \`checkpointConversation\` writes a durable association intent
  before \`captureCheckpoint\` runs.
- [x] **Success clears it.** The intent is removed after the journal append is durable.
- [x] **Capture failure clears it.** A synchronous capture error leaves no intent behind.
- [x] **Reopen completes the window.** A resumed session appends the missing event from the
  validated manifest under the session lock.
- [x] **Unprovable intents stay.** Foreign sessions, unreadable files and digest mismatches are
  retained; a missing manifest and an already-present identical association are cleared.
- [x] **Real crash verified.** A child process SIGKILLed from inside the checkpoint append leaves
  manifest + intent; the next open restores the event.
- [x] **Gates.** tsc 0, rewind 7/7, checkpoints 21/21, full 2,088/2,088, chain 767/767, crash smoke
  both modes, notices 0, build 0, index unchanged, identity \`df90fb56…\`.
- [ ] Remaining C-4 item: power-loss/GC.
`);

const evidence = {
  schema: 'W53CheckpointAssociationEvidence.v1',
  package: 'W53-01 — checkpoint capture and session association recover together',
  date: '2026-10-17',
  question: 'Can a crash between publishing a checkpoint manifest and recording its session association lose or strand the checkpoint?',
  answer: 'No. The intent is durable before capture, so the next session open appends the missing event from the validated manifest; a manifest that was never published is cleared instead of leaving a blocked name.',
  sourcePosition: {
    kind: 'local extension; recovered durable checkpoint transaction not established',
    evidence: 'W04 records the local rewrite; zPo (chunk-sfn1dbxq.js [1801370,1802540), UTF-8 bytes) supplies the observe-and-prove policy.',
  },
  behavior: {
    intent: '<store>/.assoc-<uuid>.json {version, id, session, name, boundary, pid, created_at}, atomic write before capture',
    success: 'journal append durably writes the checkpoint event, then the intent is cleared',
    captureFailure: 'the intent is cleared; a crash leaves it for recovery',
    reopen: 'under the session lock, a validated manifest with no matching event appends the recorded boundary and clears the intent',
    cleared: 'missing manifest; existing association with the same name and digest',
    retained: 'foreign session, unreadable intent, manifest digest mismatch',
  },
  changes: [
    { file: 'src/checkpoints.ts', change: 'association schema/io, manifest digest validation, recovery scan', sha256: sha(read('src/checkpoints.ts')) },
    { file: 'src/rewind.ts', change: 'intent around capture and journal append', sha256: sha(read('src/rewind.ts')) },
    { file: 'src/session.ts', change: 'resumed open completes pending associations', sha256: sha(read('src/session.ts')) },
    { file: 'test/rewind.test.ts', change: 'recovery rules and real SIGKILL crash case', sha256: sha(read('test/rewind.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-4 rows record the completed window', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'checkpoint row records the association intent', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W53-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W53-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
    { file: 'research/ports/W04-crash-recovery.md', change: 'W53-01 addendum', sha256: sha(read('research/ports/W04-crash-recovery.md')) },
  ],
  tests: {
    file: 'test/rewind.test.ts',
    added: [
      'association recovery clears unprovable intents, keeps foreign evidence and is idempotent',
      'a real crash between capture and association is completed on the next open',
    ],
    result: '7/7 pass; checkpoints 21/21',
  },
  gates: {
    tsc: 'exit 0',
    rewind: '7/7',
    checkpoints: '21/21',
    build: 'exit 0',
    full: '2,088/2,088',
    chain: '767/767',
    notices: 'exit 0',
    crashSmoke: 'exit 0 (source and compiled, eight cutpoints)',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: 'df90fb5663e8f8b1eeb48e4458579bf23c59c83f2e7a2a497e3d78534ba32f57',
  },
  residuals: [
    'A synchronous append failure leaves the intent until the next open; the current process does not retry it.',
    'Intents have no expiry; an intent for a session that is never reopened stays until that session opens.',
    'A manifest lost after publication would make its intent be cleared as unpublished; the object files remain.',
  ],
  recoveredEntrypointsExecuted: false,
  next: 'C-4 continues with power-loss/GC.',
};
write('research/ports/W53-checkpoint-association-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW53-01 makes checkpoint capture',
  'research/coding-standard.md': '\n2026-10-17 W53-01 ',
  'research/FEATURES.md': 'a durable association intent restores a crash',
  'research/ports/W53-checkpoint-association.md': '# W53 — capture and its session association',
  'research/ports/W04-crash-recovery.md': '\n## W53-01 capture association',
  '.audit/w53-runtime.todo.md': '\n## W53-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
