import fs from 'node:fs';

const file = 'research/coding-standard.md';
const text = fs.readFileSync(file, 'utf8');
if (text.includes('W45-17 批量事件')) {
  console.log('already present');
  process.exit(0);
}
const line = [
  '2026-10-15 W45-17 `classic.PostToolBatch` 调用点复查：S-1至S-7已对照。',
  '先按 S-7 读源自己的站点再动手：批站点 `Hkn`（chunk-sfn1dbxq.js [3062957,3063491)）的 hook input 与批内条目、以及其调用者的终局规则与原句（chunk-5b2hxy2e.js [123669,124114)）都先读出来，才决定本包**无新搬运**——W45-16 已含整条 raise，缺的只是调用点与规则，故记录为「无新增复制」而不是再抄一份近似的运行器。',
  '规则照抄不释义：丢弃线使用源自己的句子与源自己的兜底链（`blockingError?.blockingError ?? stopReason ?? "preventContinuation"`），因此 `{block}` 答案记出 `preventContinuation`；把兜底改成自造默认会掩盖源的语义，S-2 在此再验。',
  '单个事件带 `_X` 工具别名展开、批事件不带——这一差异由对照 `Okn`/`P9r`/`I9r`/`dze` 读出后才写进 hook input，避免把单事件的形状套到批上。',
  '实测先于断言（S-1）：hook input 键集、门在两态下的开合、一批两次调用按序到达、上下文消息、以及 block 不终止回合且尾因为源兜底值。',
  '事件名收在一处（`CLASSIC_POST_TOOL_USE`/`CLASSIC_POST_TOOL_USE_FAILURE`/`CLASSIC_POST_TOOL_BATCH`），工具路径不再散落字符串字面量。',
  '聚焦3/3（含两条经 `Agent` 的整批路径）、全量1314/1314、`verify-chain-copies` 21 份计划不变且逐字节一致、编译驱动 `W45PostToolBatchCompiled.v1` 在 `dist/` 通过（十一驱动全 exit 0）。',
  '见[工作包](ports/W45-chain-runner.md#w45-17-landed-classicposttoolbatch-on-the-batch-boundary-2026-10-15)。',
].join('');
const index = text.indexOf('2026-10-15 W45-16');
if (index < 0) throw new Error('W45-16 review line not found');
fs.writeFileSync(file, text.slice(0, index) + line + '\n' + text.slice(index));
console.log('coding-standard updated');
