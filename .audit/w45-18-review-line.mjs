import fs from 'node:fs';

const file = 'research/coding-standard.md';
const text = fs.readFileSync(file, 'utf8');
if (text.includes('W45-18 权限事件')) {
  console.log('already present');
  process.exit(0);
}
const line = [
  '2026-10-15 W45-18 `classic.PermissionRequest`/`classic.PermissionDenied` 调用点复查：S-1至S-7已对照。',
  'S-7 在本包两次生效：先读源自己的站点与消费者（`dze` chunk-sfn1dbxq.js [3063858,3064190) 与消费它的 `sxr` [3317869,3319984)）才写 `PermissionRequest` 的答案折叠；再读 `I9r` 的**唯一调用者**（[2288685,2289127) 442 单位）才发现在每个 deny 上 raise 是自造的——门在自动模式分类器，规则拒绝与用户拒答在源自己的分类 `mze` 里根本不 raise。于是撤掉调用点、把事件名与输入形状记在拒绝路径旁，并用回归锁死。',
  'S-2 再验：deny 的兜底文用源消费者自己的 `V.message||"Permission denied by hook"`，不另起一句更像产品味的文案。',
  '测量先于断言（S-1）：`.audit/w45-18-probe.mts` 先量出输入键集、allow/rewrite/deny 两条臂（以提问次数 0 对基线 1 为观测量）、未映射拒绝（以处理器记录数 0 为观测量）与 `duration_ms`，之后才写断言。',
  '同遍校读补掉 W45-16 缺口：`Okn`/`P9r` 都声明 `duration_ms`（chunk-r2vtj1kh.js [193030,193147)），原站点漏发；现按源描述只量工具自身调用（不含审批与钩子耗时）并发送，注释引原文。',
  '聚焦3/3（含三条经 `Agent` 的审批路径与拒绝路径）、全量1317/1317、`verify-chain-copies` 21 份计划不变且逐字节一致、编译驱动 `W45PermissionCompiled.v1` 在 `dist/` 通过（十二驱动全 exit 0）。',
  '见[工作包](ports/W45-chain-runner.md#w45-18-landed-the-two-permission-side-events-one-raised-and-one-measured-shut-2026-10-15)。',
].join('');
const index = text.indexOf('2026-10-15 W45-17');
if (index < 0) throw new Error('W45-17 review line not found');
fs.writeFileSync(file, text.slice(0, index) + line + '\n' + text.slice(index));
console.log('coding-standard updated');
