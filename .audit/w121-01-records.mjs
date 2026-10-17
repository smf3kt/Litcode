// W121-01 record: skill inline effect journal.
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

const note = `# W121 — Skill inline effect journal

## Source position

The recovered inline executor never spawns an authored span itself. \`xxr\`
(chunk-sfn1dbxq.js offset 3370821) validates every span that \`Gtr\` extracted
(offset 434915), the executor gives each span a synthetic tool-use id
(\`toolUseId:\` offset 3369204) and runs it through the tool runtime
(\`await y.call({command:ke})\` offset 3370268) behind the tool's permission
check. The tool layer therefore journals a started call before the effect and
its result after it; a crash between the two leaves a started call whose
outcome is unknown.

## Port

\`SkillEffectJournal\` (src/skill-effects.ts) carries that ordering in an
append-only JSONL file per workspace and owner:
\`.agent/skill-effects/<owner>.jsonl\`. \`start\` fsyncs
\`{v,id,skill,index,digest,phase:"started",at}\` before the spawn; \`finish\`
appends \`finished\` or \`failed\`; a start with no terminal record is unresolved.
The digest is the SHA-256 of the expanded command, and the command text is never
written. \`expandedBody\` reports every unresolved span before the skill runs
again with the local recovery sentence already used for interrupted tool calls,
and acknowledges it with a terminal \`unknown\` record only after the run
returns. A failed rerun rethrows the warning together with the failure and keeps
the record unresolved. A torn trailing line (the crash artifact this journal
exists for) is discarded; a complete malformed line fails closed; a journal
larger than 4 MiB fails closed.

## Adaptation

- The source's durability is the tool-call journal keyed by the synthetic
  tool-use id. Local inline spans have no model tool id, so a dedicated journal
  file replaces that pair rather than inventing synthetic \`tool_start\` and
  \`tool_result\` events that model transaction recovery would read.
- The owner is the runtime owner (\`session.id\`, or \`initial\`/\`reload\` during
  tool rebuilds). A child runtime created without an owner shares
  \`initial.jsonl\`, so an interrupted child span can warn a later session that
  runs the same skill name in the same workspace; the warning is conservative.
- The source's \`promptShellHandOff\` path for denied spans has no local surface
  and is unchanged.
- Recovery is per span: a skill re-invocation always runs its body again. The
  journal only reports the earlier effect whose outcome is unknown.

## Verification

\`skill-effects\` pins pairing, per-skill filtering, acknowledgement, torn-tail
handling, malformed-line failure, owner validation and the size bound.
\`skill-runtime\` pins the started/finished pairs with no stored command, the
failed terminal record, the one-time recovery prefix, and that a failed rerun
keeps the warning. Focused 35/35, extended 86/86, tsc 0, build 0, full
2,184/2,184, chain 768/768, identity \`04147ee3…\`.
`;
write('research/ports/W121-skill-effect-journal.md', note);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W121-01 gives skill inline shell spans an independent durable effect journal. Each span is
identified by the skill, the authored span index and the SHA-256 of the expanded command; a
\`started\` record is fsynced before the spawn and a \`finished\` or \`failed\` record follows it.
A start without a terminal record means the process died after the effect began: the next run of
that skill reports it once with the local interrupted-effect sentence and acknowledges it with an
\`unknown\` record only after the rerun returns, so a failed rerun keeps the warning. Torn trailing
appends are discarded; complete malformed records and journals over 4 MiB fail closed. The
recovered source reaches the same ordering through a synthetic tool-use id and the tool runtime;
local spans have no model tool id, so they use \`.agent/skill-effects/<owner>.jsonl\` instead.
Focused 35/35, extended 86/86, tsc 0, build 0, full 2,184/2,184, chain 768/768, identity
\`04147ee3…\`. [W121 record](ports/W121-skill-effect-journal.md).
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W121-01 技能内联shell效果日志：S-1（先读源）：内联执行器 xxr 3370821、Gtr 434915、合成toolUseId 3369204、y.call({command}) 3370268（chunk-sfn1dbxq.js）；源经工具运行时使每个span在效果前有started、事后有result。S-2（不臆造）：start在spawn前fsync、finish在返回后、无终态的start即未决；恢复语句复用本地中断工具调用的既有文本；仅在重跑成功返回后写unknown确认，失败重跑保留告警。S-3（边界）：本地span无模型tool id，使用独立JSONL而非合成tool事件；owner为运行时owner，子运行时共享initial；源promptShellHandOff无本地对应；重跑仍执行body，仅报告未知旧效果；命令只存SHA-256。S-4（可测）：skill-effects 4条、skill-runtime新增3条。S-5/S-6：无依赖变化。S-7：端口记录与证据JSON。验证：聚焦35/35、扩展86/86、tsc 0、build 0、全量2,184/2,184、链768/768、notices 0、索引不变、身份04147ee3…。
`);

replaceOnce('research/FEATURES.md',
  'source precedence, dynamic discovery and effect-journal crash recovery remain gaps.',
  'source precedence and dynamic discovery remain gaps; W121 journals every inline shell span before its effect and reports an interrupted span once on the next run.');
replaceOnce('research/FEATURES.md',
  'Full original shell syntax and effect-journal/crash recovery remain gaps.',
  'Full original shell syntax remains a gap; W121 journals each inline span before its effect and reports an interrupted span once on the next run.');

replaceAll('research/CURRENT.md',
  '；来源优先级、动态发现、效果日志崩溃恢复；',
  '；W121交付内联shell效果日志（spawn前fsync started、结束写finished/failed、崩溃后下次运行一次性报告并确认unknown，仅存skill/序号/SHA-256，损坏或超4MiB失败关闭）；来源优先级、动态发现；', 3);

const tsv = [
  ['2026-10-17T13:40:00Z', 'package', 'W121-01 技能内联shell效果日志',
    'xxr 3370821、Gtr 434915、合成toolUseId 3369204、y.call 3370268（chunk-sfn1dbxq.js）',
    'started在spawn前fsync；finished/failed随后；未决start下次运行一次性报告；仅存skill/序号/SHA-256',
    'skill-effects 4/4；skill-runtime新增3；聚焦35/35；扩展86/86；tsc 0；build 0；全量2,184/2,184；链768/768'],
  ['2026-10-17T13:42:00Z', 'decision', 'W121-01 本地适配',
    '源经合成toolUseId+工具运行时取得start/result对；本地span无模型tool id',
    '独立JSONL取代合成tool事件；owner共享initial的保守告警；失败重跑保留告警；损坏/超限失败关闭',
    '.audit/w121-01-full.txt'],
  ['2026-10-17T13:44:00Z', 'verification', 'W121-01 验收：聚焦35/35、扩展86/86、tsc 0、build 0、2,184/2,184、768/768',
    '开始/终态配对；命令不入日志；崩溃未决报告一次；失败重跑仍报告',
    'notices 0；索引 75 chunks / 323,525 单位不变；identity 04147ee3…'],
].map((row) => row.join('\t')).join('\n');
write('.audit/w121-runtime.tsv', tsv + '\n');

write('.audit/w121-runtime.todo.md', `# W121 runtime trail

## W121-01 acceptance (2026-10-17)

- [x] **Source read.** The inline handoff validates each extracted span, gives
  it a synthetic tool-use id and runs it through the tool runtime, so a crash
  leaves a started call with no result.
- [x] **Port.** The append-only per-owner journal with fsynced starts and
  terminal records, digest-only identity, recovery reporting and acknowledgement.
- [x] **Bounds.** Dedicated file instead of synthetic tool events; per-span
  recovery; failed reruns keep the warning; torn tail discarded; malformed
  records and 4 MiB overrun fail closed; child runtimes share \`initial\`.
- [x] **Gates.** focused 35/35, extended 86/86, tsc 0, build 0, full
  2,184/2,184, chain 768/768, notices 0, source index unchanged, identity
  \`04147ee3…\`.
- [ ] Remaining C-10: source precedence and dynamic discovery.
`);

const evidence = {
  schema: 'W121SkillEffectJournalEvidence.v1',
  package: 'W121-01 — Skill inline effect journal',
  date: '2026-10-17',
  question: 'How does this runtime make an interrupted skill inline shell effect recoverable?',
  answer: 'Each expanded span is journaled by skill, span index and SHA-256 in an append-only per-owner file under .agent/skill-effects. A started record is fsynced before the spawn and a finished or failed record follows it. A start without a terminal record means the process died after the effect began; the next run of that skill reports it once with the local interrupted-effect sentence and acknowledges it with an unknown record only after the rerun returns. Torn trailing appends are discarded, complete malformed records and journals over 4 MiB fail closed.',
  sourcePosition: {
    unit: 'UTF-16 code units',
    module: 'extracted-v2/modules/chunk-sfn1dbxq.js',
    offsets: [3369204, 3370268, 3370821, 434915],
  },
  behavior: {
    startedBeforeSpawn: true,
    terminalAfterReturn: true,
    commandTextStored: false,
    commandDigest: 'sha256',
    recoveryReportedOnce: true,
    acknowledgeOnlyAfterSuccess: true,
    failedRerunKeepsWarning: true,
    tornTailDiscarded: true,
    malformedRecordFailsClosed: true,
    journalLimitBytes: 4194304,
  },
  adaptations: [
    'The source reaches durability through a synthetic tool-use id and the tool runtime; local inline spans have no model tool id, so a dedicated journal file replaces the tool-call pair.',
    'The owner is the runtime owner; a child runtime created without an owner shares initial.jsonl, so an interrupted child span can conservatively warn a later session in the same workspace.',
    'The source promptShellHandOff path for denied spans has no local surface and is unchanged.',
    'A skill re-invocation always runs its body again; the journal only reports the earlier unknown effect.',
  ],
  changes: [
    { file: 'src/skill-effects.ts', change: 'append-only effect journal', sha256: sha(read('src/skill-effects.ts')) },
    { file: 'src/skill-runtime.ts', change: 'journal the spans and report interrupted effects', sha256: sha(read('src/skill-runtime.ts')) },
    { file: 'src/runtime.ts', change: 'construct the per-owner journal at both skill call sites', sha256: sha(read('src/runtime.ts')) },
    { file: 'test/skill-effects.test.ts', change: 'journal pairing, recovery and bounds tests', sha256: sha(read('test/skill-effects.test.ts')) },
    { file: 'test/skill-runtime.test.ts', change: 'inline journal and recovery tests', sha256: sha(read('test/skill-runtime.test.ts')) },
    { file: 'research/CURRENT.md', change: 'three C-10 rows record W121', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'Skills rows record W121', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W121-01 entry', sha256: sha(read('research/STATUS.md')) },
    { file: 'research/coding-standard.md', change: 'W121-01 S-1..S-7 entry', sha256: sha(read('research/coding-standard.md')) },
  ],
  gates: {
    tsc: 'exit 0',
    focused: '35/35 (skill-effects, skill-runtime)',
    extended: '86/86',
    build: 'exit 0',
    full: '2,184/2,184',
    chain: '768/768',
    notices: 'exit 0',
    sourceIndex: '75 chunks, 323,525 units (unchanged)',
    identity: '04147ee35348cf2faa2764504a790bbaac486305cd8f71ce7fea8b8870f85145',
  },
  residuals: ['C-10 source precedence and dynamic discovery remain open.'],
  recoveredEntrypointsExecuted: false,
  next: 'C-10 continues with source precedence and dynamic discovery.',
};
write('research/ports/W121-skill-effect-journal-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  'research/STATUS.md': '\nW121-01 gives skill inline shell spans',
  'research/coding-standard.md': '\n2026-10-17 W121-01 ',
  'research/FEATURES.md': 'W121 journals every inline shell span',
  'research/ports/W121-skill-effect-journal.md': '# W121 — Skill inline effect journal',
  '.audit/w121-runtime.todo.md': '\n## W121-01 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
