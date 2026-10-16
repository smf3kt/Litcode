import fs from 'node:fs';

const file = 'research/coding-standard.md';
const text = fs.readFileSync(file, 'utf8');
if (text.includes('2026-10-15 W45-16')) {
  console.log('already present');
  process.exit(0);
}
const line = [
  '2026-10-15 W45-16 通用经典 raise 复查：S-1至S-7已对照。',
  '先按 S-7 找源自己的 raise 再动手：产品的钩子运行器本来就有 `Q_t` 门 [556225,556265)、`Ikt` 派发 [562773,563154)、`h7n` 记录折 [562464,562773)，',
  '连同 `Rkt`/`Pkt`/`cie`/`cU`/`p7n`/`gkt`/`lM`/`Bde`/`fe`/`le` 一并按模块+区间+摘要复制（18 段 2095 单位四模块）。',
  '切面按 S-7 记因：`xkt`/`mkt`/`QY`/`ckt` 只包引擎自己的 `runClassicHooks`（本产品那层是 ./hooks.ts，答案是单个聚合 `HookResult`，且在工具路径上先于链事件跑过），',
  '且 `mkt` 会拖进 lodash `omit`（整条 clone 机制，非本产品依赖），故缝里的 `raiseClassicEvent` 是 `Ikt` 正文把两条外臂做成入参——与 W45-15 对 `m_t` 的处置同一理由，差异仅前门记事的 origin 字段，已写在缝头与包记录。',
  '两处移植（`pn`=`Bun.stripANSI`、`K`/`se` 会话与工作目录）按 S-7 记因。',
  '实测先于断言（S-1）：门在无模块挂事件时关、挂钩后开而 `PreToolUse` 恒关；`fe` 的 payload 覆盖宿主 `K`/`se`、`hook_event_name` 在最后；',
  '`{block}` 折出源自己的 `Rkt` 记录且 `gkt` 同文、`{updatedToolOutput}` 折出空表。',
  'S-3 的扫描再次当闸门：块边界多吃 6 单位时 `source-undeclared-scan` 报出伪名 `async`，改正边界后 `unresolved 0`。',
  '一处行为按实测对齐既有消费者：改写不因 error 跳过（产品原生 post 的同一消费者本就无条件施加），首版误加的条件已去除。',
  '聚焦3/3（含两条经 `Agent` 的工具路径）、全量1311/1311、`verify-chain-copies` 21 份计划逐字节一致、新副本未声明 0、',
  '编译驱动 `W45ClassicRaiseCompiled.v1` 在 `dist/` 通过（十驱动全 exit 0）。',
  '见[工作包](ports/W45-chain-runner.md#w45-16-landed-the-generic-classic-raise-2026-10-15)。',
].join('');
const index = text.indexOf('2026-10-15 W45-15');
if (index < 0) throw new Error('W45-15 review line not found');
fs.writeFileSync(file, text.slice(0, index) + line + '\n' + text.slice(index));
console.log('coding-standard updated');
