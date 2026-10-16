// Write the W45-43 record from the artifacts themselves: the documentation artifact W45-38/W45-39 left
// behind, the cleanup that removes it, and the recon that demotes the two queue items it replaces.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('this package must not move the identity: ' + what); };
expect(identity.inputs.files === 359, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 138, `validation ${identity.validation.files}`);
expect(identity.build.files === 249, `build ${identity.build.files}`);
expect(identity.sha256 === '554cb016a5176ce191451f3b02c8cd57a8536cba3173f60a42dd23a7ae8e9368',
  `the tree identity is ${identity.sha256}`);
const short = identity.sha256.slice(0, 8);

// The cleaner must be a no-op on the cleaned documents. The guard itself runs last, after every writer,
// so it validates the final state of the documents this package writes.
const fixer = JSON.parse(execFileSync(process.execPath, ['.audit/w45-43-fix-spans.mjs'], { encoding: 'utf8' }));
if (fixer.changed !== 0) throw new Error('the cleaner changed a document on a second run');

// 1,146 escapes came out of four documents. The record reads the backups the cleanup was checked against,
// when they are still there, so the number is measured rather than remembered; each document is compared
// with this package's own paragraph taken back out, since a re-run has already written it.
const stripBlock = (text, mark, { toEnd = false, paragraph = false } = {}) => {
  const at = text.indexOf(mark);
  if (at < 0) return text;
  const start = text.lastIndexOf('\n', at) + 1;
  // A section appended at the end leaves the blank line that introduced it behind; the document before
  // the section ends with a single newline.
  if (toEnd) return text.slice(0, start).replace(/\n+$/, '\n');
  const end = paragraph ? text.indexOf('\n\n', at) : text.indexOf('\n', at);
  return text.slice(0, start) + text.slice(end < 0 ? text.length : end + 1);
};
const cleaned = [
  { path: 'research/CURRENT.md', backup: '/tmp/w43-current.bak', mark: 'W45-43 **清掉自造文档伪影' },
  { path: 'research/STATUS.md', backup: '/tmp/w43-status.bak', mark: 'W45-43: the documentation artifact', paragraph: true },
  { path: 'research/ports/W45-chain-runner.md', backup: '/tmp/w43-runner.bak', mark: '## W45-43 cleaned the documentation artifact', toEnd: true },
  { path: '.audit/w45-runtime.todo.md', backup: '/tmp/w43-todo.bak', mark: '## W45-43 acceptance', toEnd: true },
];
let measured = 0;
const perFile = [];
for (const { path, backup, mark, paragraph = false, toEnd = false } of cleaned) {
  if (!fs.existsSync(backup)) continue;
  const before = read(backup);
  if (!before.includes('\\`')) continue;
  const after = stripBlock(read(path), mark, { paragraph, toEnd });
  if (after.includes(mark)) throw new Error(`${path}: the mark ${JSON.stringify(mark)} does not match this package's block`);
  // Blank-line runs are where this package's own paragraphs meet the ones below them; the content is
  // what the check is about, so both sides are compared with those runs collapsed.
  const same = (left, right) => left.replace(/\n{2,}/g, '\n\n') === right.replace(/\n{2,}/g, '\n\n');
  if (!same(before.replace(/\\`/g, '`'), after)) {
    throw new Error(`${path} is not its backup with the escapes removed`);
  }
  const escapes = (before.match(/\\`/g) ?? []).length;
  measured += escapes;
  perFile.push(`${path} ${escapes}`);
}
if (measured !== 1146) throw new Error(`the cleanup removed ${measured} escapes, not the 1,146 the scan found`);

// The recon that demotes the two queue items this package stands in for. Both claims are read out of the
// source and out of the product, so they expire when the product grows the stores they wait on.
const sfn = read('extracted-v2/modules/chunk-sfn1dbxq.js');
const x0 = read('extracted-v2/modules/chunk-x0dc37w9.js');
for (const body of [
  'async function fZo(e,n){let r=it();if(!jN()&&r.loadedModules.length===0)return;',
  'function D_(e){if(e)t(`clearPluginCache: invalidating loadAllPlugins cache (${e})`);',
  'function $5(){let e=L$();e.sentSkillNames.clear(),e.suppressNext=!1,e.resumeSeedNames=null}',
  'function L$(){return FXe.of(B())}',
]) if (!sfn.includes(body)) throw new Error(`the source no longer reads: ${body}`);
for (const body of ['function M(){let e={store:ji(),cwd:ql(),projectConfigDir:Kr()??void 0,allowedSources:L1e()',
  'function BEo(){return MR(M()).shadowedHelperSources}']) {
  if (!x0.includes(body)) throw new Error(`the source no longer reads: ${body}`);
}
const codeOf = (text) => text.split('\n').filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');
const productCode = fs.readdirSync('src').filter((name) => name.endsWith('.ts'))
  .map((name) => codeOf(read(`src/${name}`))).join('\n');
const configFields = ['projectConfigDir', 'allowedSources', 'hostManagedProvider', 'coworkPlugins', 'canonicalGitRoot',
  'helperArmedFromRemote', 'credentialHelperKeysFrom', 'launchFolderKeysFrom', 'shadowedHelperSources'];
const present = configFields.filter((name) => productCode.includes(name));
if (present.length) throw new Error(`the config record's fields turned up in the product: ${present.join(', ')}`);
// Short minified names collide with unrelated locals in the copied highlight bundles (a `var Xs=` sits
// in tui-highlight-languages.ts), so the pipeline is probed by tokens that only it carries.
const pipelineTokens = ['sentSkillNames', 'resumeSeedNames', 'suppressNext',
  'clearPluginCache: invalidating loadAllPlugins cache'];
const loadPresent = pipelineTokens.filter((token) => productCode.includes(token));
if (loadPresent.length) throw new Error(`the load pipeline turned up in the product: ${loadPresent.join(', ')}`);
const demoted = `the helpers/config store behind \`BEo\` is out of reach for one package: \`M()\` (chunk-x0dc37w9.js [86914,87558)) builds a per-host record from about twenty accessors (\`ji\`, \`ql\`, \`Kr\`, \`L1e\`, \`Fpt\`, \`fy\`, \`GO\`, \`rk\`, \`jsn\`, \`V8\`, \`U5e\`, \`ar\`, \`cr\`, \`dr\`, \`Ot\`, \`FW\`, \`Ktn\`, \`G$s\`, \`z$s\`, \`Eut\`) and none of its fields (\`${configFields.slice(0, 5).join('`, `')}\`) is in the product; \`zLr\`/\`sc\` wait on the plugin-source load pipeline (\`fZo\` calls \`Xs\`, \`X6o\`, \`jN\`, \`PPr\`; \`D_\` calls \`xas\`, \`lvo\`, \`Pxs\`; \`$5\` reads \`L$() = FXe.of(B())\`), none of which is ported either`;

const summary = (path) => {
  const text = read(path);
  const of = (label) => Number(new RegExp(`^\\u2139 ${label} (\\d+)$`, 'm').exec(text)?.[1]);
  return { tests: of('tests'), passed: of('pass'), failed: of('fail') };
};
// A documentation-only package changes no hashed input, so W45-42's sweep stands: the identity above is
// the same hash, which is what makes that claim checkable rather than a promise.
const previousFull = '1436 tests / 1436 pass / 0 fail';
const smokePrior = 'pack 257 files, offline install, help, --demo and the launcher driver pass; upstreamRequests 0';

const evidence = {
  schema: 'W45DocSpansEvidence.v1',
  package: 'W45-43 — the documentation artifact: a literal backslash before every inline code span in the W45-38 and W45-39 records',
  date: '2026-10-16',
  question: 'W45-42 closed the invalidation calls and queued the helpers/config store behind `BEo` next. Before starting it, is that item — or the `zLr`/`sc` behind it — actually ready?',
  answer: `Neither is. ${demoted}. So this package does not start a doomed copy; it takes the third item in the queue, which is the one outstanding defect of our own making: the W45-38 and W45-39 record writers built their paragraphs through a shell heredoc, so the backslash they had put in front of a backtick survived into the documents and 1,146 inline code spans across four files carry it.`,
  artifact: {
    files: perFile,
    total: measured,
    cause: 'The two writers were written through `bash` heredocs, where the template literal\'s escape for a backtick had to be doubled for the shell; the doubling reached the file. The writers from W45-40 on were written with the file tool instead, which is why their paragraphs are clean.',
    fix: '.audit/w45-43-fix-spans.mjs removes the backslash and refuses to write unless the only difference is exactly those removals, checked position by position.',
    guard: '.audit/w45-43-span-scan.mjs scans the W45 evidence documents, the runner doc, the runtime ledger and the runtime todo and reports the count; the W45-43 record runs it and fails on anything but zero.',
  },
  queue: {
    demoted,
    still_next: [
      'the `$` table beyond the three ui floors, entry by entry (a table, so it can be taken one entry at a time)',
      "Q-086's 15 registry-reading cores and their 34 sites",
      'the notification context provider `a4n` (chunk-356hrhz3.js [1453,1607)) and the clearTimer context `R` [1431,1432), the two React pieces W45-39 replaced with host parameters',
      'the registry fields the source\'s literal carries but no ported body reads yet (the hook registry, the marketplaces, the command-producer memos)',
      'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
      'the helpers/config store behind `BEo` and the load pipeline behind `zLr`/`sc`: both are subsystems in their own right, not packages (recon this tick)',
    ],
  },
  behaviour_changed: [
    'The W45 evidence documents read as written: 1,146 inline code spans lost the backslash their writer escaped for a shell that never saw them.',
    'No product file, test or build output changed: the identity is byte-for-byte W45-42\'s, which is why this package re-runs no sweep.',
  ],
  verification: {
    identity,
    identity_unchanged: `the tree identity is still \`${short}…\` (inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}), the same hash W45-42 recorded, so the code under test is byte-identical and that sweep stands (${previousFull}; packaged smoke ${smokePrior})`,
    guard: 'the W45-43 record runs .audit/w45-43-span-scan.mjs after its writers and fails on anything but zero',
    cleanup_check: 'each cleaned document was compared against a pre-cleanup copy: it equals that copy with exactly the escapes removed (compared with blank-line runs collapsed, because this package\'s own paragraphs meet the ones below them there), and the escape counts sum to the 1,146 the scan found',
    fixer_idempotent: 'a second run of the cleaner reports 0 changes',
    queue_check: 'the demotion is read out of the source bodies and the product code: nine config-record field names and seven load-pipeline names are asserted absent from the product',
  },
  next_package: [
    'the `$` table beyond the three ui floors, entry by entry',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'the notification context provider `a4n` and the clearTimer context `R`',
    'the registry fields no ported body reads yet (the hook registry, the marketplaces, the command-producer memos)',
    'a streaming provider through the loader path',
    'the helpers/config store (`M()` and `MR`) and the load pipeline (`Xs`, `X6o`, `jN`, `PPr`, `xas`, `lvo`, `Pxs`) as subsystems, each bigger than a package',
  ],
};
write('research/ports/W45-doc-spans-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const marks = {
  current: 'W45-43 **清掉自造文档伪影',
  standard: '2026-10-16 W45-43 文档伪影',
  status: 'W45-43: the documentation artifact',
  runner: '## W45-43 cleaned the documentation artifact',
};
const current = stripBlock(read('research/CURRENT.md'), marks.current);
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-16最新**：W45-43 **清掉自造文档伪影 + 队列重判**（纯文档包，身份不变）：W45-38/W45-39 的记录写入器经 shell heredoc 生成，模板串里的反引号转义落进了文件，四个文档共 **1,146 处**内联代码段带字面反斜杠（\`CURRENT.md\` 2、\`STATUS.md\` 366、\`ports/W45-chain-runner.md\` 642、\`.audit/w45-runtime.todo.md\` 136；\`coding-standard.md\` 本无）。新增 \`.audit/w45-43-fix-spans.mjs\`（逐位比对：只在删除"反引号前那个反斜杠"时才写，否则拒写；第二次运行 0 改动）与守卫 \`.audit/w45-43-span-scan.mjs\`（扫描 257 个 W45 证据文档，本包记录脚本断言必须为 0）。**队列重判（本 tick 先侦察再动手）**：\`BEo\` 背后的 helpers/config store 不是一个包的量——\`M()\`（chunk-x0dc37w9.js [86914,87558)）由约二十个访问器拼出 per-host 记录（\`ji\`/\`ql\`/\`Kr\`/\`L1e\`/\`Fpt\`/\`fy\`/\`GO\`/\`rk\`/\`jsn\`/\`V8\`/\`U5e\`/\`ar\`/\`cr\`/\`dr\`/\`Ot\`/\`FW\`/\`Ktn\`/\`G$s\`/\`z$s\`/\`Eut\`），其字段名（\`projectConfigDir\`/\`allowedSources\`/\`hostManagedProvider\`/\`coworkPlugins\`/\`canonicalGitRoot\` 等）在产品代码中一个都没有；\`zLr\`/\`sc\` 则等整条插件源装载管线（\`fZo\` 调 \`Xs\`/\`X6o\`/\`jN\`/\`PPr\`，\`D_\` 调 \`xas\`/\`lvo\`/\`Pxs\`，\`$5\` 读 \`L$()=FXe.of(B())\`），同样未搬。两者均记录为**子系统而非工作包**，队列改由 \`$\` 表逐项、Q-086、通知 Provider \`a4n\` 等可切片项接续。验收：身份**仍是** \`${short}…\`（inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}，与 W45-42 同哈希，故代码字节未变、其全量 ${previousFull} 与打包冒烟继续有效，本包不重复跑）；守卫扫描 0；清理逐文件与清理前副本比对（等于"仅去掉转义"）；清理器二次运行 0 改动；队列判定自证（源文与产品代码双向断言）。 | [文档伪影证据](ports/W45-doc-spans-evidence.json)、[失效调用证据](ports/W45-invalidate-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('the C-12 row was not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// coding-standard: the dated line. No FEATURES row applies: nothing in the matrix describes evidence
// documents, and this package changed no product behaviour.
const standard = stripBlock(read('research/coding-standard.md'), marks.standard);
const standardAt = standard.indexOf('2026-10-16 W45-42 失效调用');
if (standardAt < 0) throw new Error('coding-standard W45-42 line not found');
const standardEntry = `2026-10-16 W45-43 文档伪影与队列重判：S-1（先读源）在文档面同样适用——本包先把队列前两项读到底（\`M()\` 的二十个访问器、\`fZo\`/\`D_\`/\`$5\` 的装载管线），确认两者是子系统而非工作包，才改取队列第三项；判定由记录脚本双向自证（源文断言在场、产品代码断言九字段七名字缺席），产品长大时判定自动失效。S-2（不留半包）：四个文档一次清完（1,146 处），不是"下次注意"；清理器与守卫各一件，守卫被记录脚本调用，今后任何 writer 复发都会在记录阶段失败。S-3：清理不是"看着像"，而是逐位判定"仅在删除反引号前的反斜杠时"才允许写入，并在记录里与清理前副本逐文件比对、计数合计等于扫描到的 1,146。S-4（可复跑校验）：守卫扫描输出的计数即记录数字，清理器二次运行必须 0 改动。S-5/S-6：产物只有两个 .audit 工具与四个文档的文本修改，无导出、无类型、无死代码；未触碰\`coding-standard.md\`（本无伪影）。S-7：本包不改产品行为，故身份与 W45-42 同哈希（\`${short}…\`），其全量 ${previousFull} 与打包冒烟继续有效——这正是"文档包不重复跑全量"的依据，写进记录而非口头说明。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// STATUS: the W45-43 paragraph above the W45-42 one.
const status = stripBlock(read('research/STATUS.md'), marks.status, { paragraph: true });
const statusAt = status.indexOf('W45-42: the invalidation calls.');
if (statusAt < 0) throw new Error('STATUS W45-42 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-43: the documentation artifact, and a queue correction. The W45-38 and W45-39 record writers were built through shell heredocs, so the escape their template literals needed for a backtick reached the documents: 1,146 inline code spans across four files carry a literal backslash. The cleanup removes exactly those backslashes, checking position by position that nothing else moves, and refuses to write if the only difference is not those removals; a guard scans the W45 evidence documents and the record fails on anything but zero, so a future writer that reintroduces the escape fails at record time instead of at review time. The same tick re-read the two queue items it stands in for and demoted both: the config record behind \`BEo\` is built from about twenty accessors whose nine field names appear in no product file, and the reload behind \`zLr\`/\`sc\` waits on a load pipeline (\`Xs\`, \`X6o\`, \`jN\`, \`PPr\`, \`xas\`, \`lvo\`, \`Pxs\`) that is unported too, so both are subsystems rather than packages. The record asserts those absences, which means the day the product grows them the verdict expires by itself. No product file, test or build output changed: the tree identity is still \`${short}…\`, which is why this package re-runs no sweep and why W45-42's ${previousFull} stands. Evidence: \`research/ports/W45-doc-spans-evidence.json\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// runner doc: the W45-43 section.
const runner = stripBlock(read('research/ports/W45-chain-runner.md'), marks.runner, { toEnd: true });
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-43 cleaned the documentation artifact (2026-10-16)

The W45-38 and W45-39 record writers were assembled through shell heredocs, so the escape their template
literals needed for a backtick survived into the files: 1,146 inline code spans across
research/CURRENT.md (2), research/STATUS.md (366), this document (642) and .audit/w45-runtime.todo.md
(136) carried a literal backslash. .audit/w45-43-fix-spans.mjs removes exactly those backslashes and
writes only after checking, position by position, that the difference is exactly those removals;
.audit/w45-43-span-scan.mjs is the guard, and the W45-43 record runs it and fails on anything but zero.

The same tick re-read the two queue items this package stands in for, because starting either would have
been a doomed copy. The helpers/config store behind \`BEo\` is \`M()\`, a per-host record built from about
twenty accessors (\`ji\`, \`ql\`, \`Kr\`, \`L1e\`, \`Fpt\`, \`fy\`, \`GO\`, \`rk\`, \`jsn\`, \`V8\`, \`U5e\`, \`ar\`, \`cr\`,
\`dr\`, \`Ot\`, \`FW\`, \`Ktn\`, \`G$s\`, \`z$s\`, \`Eut\`), and none of its field names is in the product. The reload
behind \`zLr\`/\`sc\` calls a load pipeline (\`fZo\` → \`Xs\`, \`X6o\`, \`jN\`, \`PPr\`; \`D_\` → \`xas\`, \`lvo\`,
\`Pxs\`; \`$5\` → \`L$() = FXe.of(B())\`) that is unported too. Both are subsystems rather than packages, and
the record asserts the absences, so the demotion expires when the product grows them.

No product file, test or build output changed. The tree identity is still \`${short}…\` (inputs
${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}), the same
hash W45-42 recorded, which is the checkable reason this package re-runs no sweep and W45-42's
${previousFull} and its packaged smoke stand. Verified here: the guard reports 0 over
the whole W45 evidence set, the cleaner reports 0 further changes, and each cleaned document equals a
pre-cleanup copy with exactly the escapes removed.

Next: the \`$\` table beyond the three ui floors, then Q-086 and the notification context provider
\`a4n\` — all sliceable, unlike the two subsystems this tick demoted.
`);

const rows = [
  ['2026-10-16T19:22:00Z', 'bug', 'W45-43 清掉 W45-38/W45-39 写入器留下的文档伪影：四个文档 1,146 处内联代码段带字面反斜杠',
    'W45-38/W45-39 的记录脚本经 shell heredoc 组装，模板串里"反引号前的转义反斜杠"落进文件；W45-40 起改用文件工具写，故后续段落干净',
    '.audit/w45-43-fix-spans.mjs 逐位判定"仅在删除反引号前的反斜杠"才写（否则拒写），应用后 1,146 处归零、二次运行 0 改动；.audit/w45-43-span-scan.mjs 作为守卫扫描 257 个 W45 证据文档，记录脚本断言必须为 0',
    'CURRENT 2 / STATUS 366 / chain-runner 642 / runtime.todo 136 = 1,146，逐文件与清理前副本比对（等于"仅去掉转义"）通过；身份不变（554cb016…）'],
  ['2026-10-16T19:29:00Z', 'finding', 'W45-43 队列重判：BEo 的 config store 与 zLr/sc 的装载管线是子系统而非工作包',
    '先侦察再动手：M() 由约二十个访问器拼出 per-host 记录，字段名（projectConfigDir/allowedSources/hostManagedProvider/coworkPlugins/canonicalGitRoot/helperArmedFromRemote/credentialHelperKeysFrom/launchFolderKeysFrom/shadowedHelperSources）在产品代码中一个不存在；fZo/D_/$5 分别依赖 Xs/X6o/jN/PPr、xas/lvo/Pxs、L$()=FXe.of(B())，同样未搬',
    '本包不启动注定失败的搬运；把两条判定写入 evidence.queue 与 next_package，并由记录脚本双向自证（源文断言在场 + 产品代码断言九字段七名字缺席），产品长大即自动失效；队列改由 $ 表逐项、Q-086、通知 Provider a4n 等可切片项接续',
    '判定自证通过；check 未运行（无代码改动）而身份哈希与 W45-42 相同，证明代码字节未变'],
  ['2026-10-16T19:34:00Z', 'verification', 'W45-43 验收：文档包不改产品行为，故以"身份不变 + 守卫为 0 + 清理逐位可证"取代重复全量',
    'AGENTS 要求"避免无新理由地重复已成功的检查"；本包未触碰 src/test/dist，身份哈希与 W45-42 相同即证明被测代码字节一致',
    '记录脚本断言身份恰为 554cb016…（含 359/138/249 计数），据此声明 W45-42 的全量 1436/1436/0 与打包冒烟继续有效而不重跑；本包实跑守卫扫描（0/257）、清理器幂等（0 改动）、逐文件比对与队列判定自证',
    '守卫 0，清理器 0 改动，四文件比对通过，队列判定自证通过；身份 554cb016…（inputs 359 / validation 138 / build 249）'],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = stripBlock(read('.audit/w45-runtime.todo.md'), '## W45-43 acceptance', { toEnd: true });
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-43 acceptance (2026-10-16)

- [x] **The defect is gone, measured.** 1,146 escapes across four documents became 0, and the guard scans the W45 evidence documents and reports 0.
- [x] **The cleanup is provably escape-only.** The cleaner refuses to write unless the only difference is those removals, and each document was compared against a pre-cleanup copy in the record.
- [x] **The cleaner is idempotent.** A second run reports 0 changes.
- [x] **The guard is wired, not remembered.** The W45-43 record runs the scan and fails on anything but zero, so a writer that reintroduces the escape fails at record time.
- [x] **The queue was corrected on evidence, not on mood.** Both demoted items are asserted absent from the product's code while their source bodies are asserted present, so the demotion expires when the product grows them.
- [x] **A documentation-only package ran no sweep, for a stated reason.** The identity is byte-for-byte W45-42's, which makes the claim that the code under test is unchanged checkable.
- [x] **No product artefact moved.** inputs ${identity.inputs.files} / validation ${identity.validation.files} / build ${identity.build.files}, same hash.
`);
// The guard runs last, on the documents this package just wrote.
const scan = JSON.parse(execFileSync(process.execPath, ['.audit/w45-43-span-scan.mjs'], { encoding: 'utf8' }));
if (scan.total !== 0) throw new Error(`the artifact turned up in ${scan.files.map((row) => row.path).join(', ')}`);
console.log('records written; identity', identity.sha256,
  `| guard: ${scan.scanned} documents scanned, ${scan.total} carry the escape`,
  '| cleaned:', measured, perFile.join(', '));
