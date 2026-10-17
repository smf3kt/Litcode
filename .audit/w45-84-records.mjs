// W45-84 record: the pressable Button, the action-key store and seats, the click subscriber, the
// key normalization and the host bindings. Writes the package section, the CURRENT row, the STATUS
// and FEATURES tails, the coding-standard entry, the runtime trail and the acceptance list. Every
// anchor is asserted unique before any write.
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);
const rep = (path, old, next) => {
  const text = read(path);
  const count = text.split(old).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} of ${JSON.stringify(old.slice(0, 70))}`);
  write(path, text.replace(old, next));
};

const W = 'research/ports/W45-chain-runner.md';
write(W, read(W).replace(/\n+$/, '\n') + `
## W45-84 ported the Button and its action keys (2026-10-17)

Twenty-three blocks are copied verbatim (3,496 units) into \`plugin-chain-press-button-source.ts\`:
the action-key comparator \`co\`, the store \`xo\` and the shared \`Yt\`, the binding contexts \`Ds\` and
the component rank \`_s\`, the render-instance context \`ee\`, the seat \`Qt\` and its component form
\`Jt\`, the hotkey seat context \`y3n\`, the blur \`_3n\`, the Button \`Zt\`, the alignment map \`yo\`, the
click subscriber \`wFt\`, the key table \`go\` and normalization \`ko\`, the identity \`Ge\`, the
keybinding service \`Lc\`, the dialog store \`aq\`/\`Ff\`/\`iv\`/\`kj\`, and the default app context
\`Pg\`/\`Zy\`.

The Button owns no press state. Every actionable press is an entry in the shared action-key store;
the seat registers one handler per binding context of its action and the handler dispatches the
winning held entry (highest rank, then latest sequence). Registration is skipped without a
keybinding service and while a dialog is open. The label is the action box render prop: focus and
hover come from the box, and the bracketed/plain, hotkey, held and variant blocks differ only in the
props they add.

The seam supplies the three host bindings. \`u\` is the keybinding-service context; with none mounted
\`Lc\` answers null and the seat registers nothing, the source's own no-service path. \`ix\` answers a
node's focus manager; this build has no node registry, so a host binds one per committed node
(\`bindFocusManager\`) and the unbound path throws. \`KH\` is the focusable action-box token, exposed
the way \`s\`/\`n\` are.

The scanner gained \`ReferenceError\` as a language global because the copied \`Ff\` provider error
reads it.

What was measured (probe log \`.audit/w45-84-probe.txt\`): rank then sequence ordering and the
later-entry winner; \`Ds\` dedupe/order; \`_s\` 2/1/0/0; \`ko\` space, named, ctrl/meta and ignored
wheel; \`Lc\` null and mounted; \`Ff\` source error; \`iv\` last non-user dialog; \`kj\` open gate; two
registrations with \`singleKey\`/\`fallback\`, rank-2 descriptor, unmount removal and no-winner false;
no registration while a dialog is open or without a service; the button root Box, \`KH\` tabIndex -1
and focus ref, the seat first with an action; every label variant; click blur only for a descendant
and the immediate stop; \`ix\` unbound throw; hotkey mount/unbind; the click subscriber's three paths
and the \`Pg\` fallback.

Verified: tsc 0, the copy scans \`unresolved 0\` (67 declared), notices 0, 13 new tests, the chain
family 690/690, full 1,966/1,966, and the recovered-source index at 70 chunks / 1,652 statements /
300,970 units (2.8%). Identity \`b6c1c882…\`.

Next: the Client host (\`Io\`/\`So\`/\`To\`/\`wo\`/\`Ro\`/\`Co\`), and last the site-tree walker \`je\`
with the terminal glue.

`);

rep('research/CURRENT.md',
  '\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-83 ',
  '\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-84 **Button 与动作键**：**23 段 3,496 单位**（`co` 排名+序列比较、`xo`/`Yt` 动作键存储、`Ds`/`_s` 绑定上下文与组件 rank、`ee` 渲染实例上下文、`Qt`/`Jt` 动作键座、`y3n` 热键座、`_3n` 失焦、`Zt` Button、`yo`/`wFt`/`go`/`ko` 点击订阅与键归一、`Ge`、`Lc` 键位服务、`aq`/`Ff`/`iv`/`kj` 对话框、`Pg`/`Zy` 默认 app 上下文）。**宿主接缝**：`u` 键位服务上下文（无 provider 时 `Lc` 返回 null、座不注册，源的无服务路径）；`ix` 焦点管理器按提交节点由宿主绑定（未绑定抛错）；`KH` 动作盒 token。**实测**：`co` rank 先于 seq、同秩取后者；`Ds` 去重保序 `["Pane","Global"]`；`_s` 2/1/0/0；`ko` 空格/具名键/ctrl+meta/忽略滚轮与空键；`Ff` 无 provider 抛源消息；`iv` 取最后一个非用户对话框；`kj` 打开才为 true；`Qt` 每绑定上下文注册一个 handler（singleKey/fallback），rank 2、卸载移除、无 winner 返回 false，对话框打开/无服务 0 注册；Button 根 Box 与 `KH`（tabIndex -1、焦点 ref、有 action 时座在前）、label 全变体、点击 blur+stop、热键座挂载/卸载、点击订阅三路与 `Pg` 兜底。tsc 0；未声明扫描 unresolved 0；新套件 13/13；链家族 690/690；全量 1,966/1,966；索引 70 chunk/300,970 单位（2.8%）；身份 `b6c1c882…`。 | [Press Button 证据](ports/W45-press-button-evidence.json)、[工作包](ports/W45-chain-runner.md) |\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-83 ',
);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W45-84: the pressable Button draws its label through the action box and owns no press state; every actionable press is an entry in the shared action-key store, and the seat registers one keybinding handler per bound context whose rank decides the winner. The seam adds the keybinding service context, a per-node focus manager and the action-box token. Twenty-three source blocks, 3,496 units. 13/13 new tests, 690/690 chain family, 1,966/1,966 full; tsc 0; index 70 chunks / 300,970 units. [W45 record](ports/W45-chain-runner.md).
`);

rep('research/FEATURES.md',
  'drive the hover styling of the interactive sites. ',
  'drive the hover styling of the interactive sites; W45-84 adds the pressable Button and its action keys: the shared rank/sequence action-key store, the per-context keybinding seat, the focusable action box with its label variants, the hotkey seat, the click subscriber and the key normalization. ',
);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W45-84 Button 与动作键：S-1至S-7已对照。S-1（先读源）：量出 23 段/3,496 单位，逐段读动作键集群、「Lc」、对话框四段与默认 app 上下文正文。S-2（不臆造）：存储排序、每上下文注册、对话框门、失焦、点击订阅与键归一全部按源正文保留；无服务/无 provider 走源自身分支。S-3（宿主边界）：「u」键位服务、「ix」按节点焦点管理器、「KH」动作盒均由宿主提供；未绑定的焦点管理器抛错而非伪造 no-op。S-4（可测）：13 条用例先经 \`.audit/w45-84-probe.ts\` 实测再断言（含全局动作键存储的清理与卸载）。S-5/S-6：按钮集群一次收齐，「Pg」/「Zy」与「TIe」按源导入。S-7（记录）：证据 JSON 记录 23 段区间、三个宿主边界与分区进度。验证：tsc 0、未声明扫描 67 unresolved 0、notices 0、新套件 13/13、链家族 690/690、全量 1,966/1,966、索引 70 chunk/300,970 单位、身份 b6c1c882…。
`);

const tsv = read('.audit/w45-runtime.tsv');
const rows = [
  ['2026-10-17T21:05:00Z', 'package', 'W45-84 Button 与动作键（23 段 3,496 单位）',
    'co/xo/Yt/Ds/_s/ee/Qt/Jt/y3n/_3n/Zt/yo/wFt/go/ko/Ge/Lc/aq/Ff/iv/kj/Pg/Zy 成为产品面；plugin-chain-press-button-source.ts 生成副本；新 plugin-chain-press-button.ts 公共 seam、plugin-chain-press-button-host.ts 的 u/ix/KH',
    'chunk-kjfwbh4w.js 15 段 + chunk-ae84tp6z.js 1 段 + chunk-bwyexfny.js 1 段 + chunk-06azbynj.js 2 段 + chunk-8zgs1qmk.js 4 段共 3,496u',
    '13/13 新套件；链家族 690/690；全量 1,966/1,966；1 文件 unresolved 0'],
  ['2026-10-17T21:08:00Z', 'decision', 'W45-84 Button 不持有按压状态，座按绑定上下文注册',
    '① 动作键存储在全局 `Yt`，winner 为 rank 后 seq；② 每绑定上下文一个 handler，对话框打开或无服务时不注册；③ label 由动作盒 render prop 绘制，焦点/悬停来自盒；④ 焦点管理器按节点绑定，未绑定抛错；⑤ 扫描器补 ReferenceError 全局',
    '测试按存储/键助手/服务与对话框/座/Button/订阅六组书写',
    '.audit/w45-84-probe.txt + test/plugin-chain-press-button.test.ts'],
  ['2026-10-17T21:12:00Z', 'finding', 'W45-84 实测动作键、label 与点击路径',
    '① co 同秩取后者；② Ds 去重保序、_s 2/1/0/0；③ ko 命名/修饰/滚轮；④ Qt 两次注册、rank 2、卸载移除、无 winner false、对话框/无服务 0；⑤ Button 根/动作盒/座顺序；⑥ label 七种；⑦ 点击 blur 仅后代并 stop；⑧ ix 未绑定抛错；⑨ 热键挂载/卸载；⑩ 点击订阅三路与 Pg 兜底',
    '十条由 .audit/w45-84-probe.ts 实测后写入证据与测试',
    '.audit/w45-84-probe.txt + test/plugin-chain-press-button.test.ts'],
  ['2026-10-17T21:16:00Z', 'verification', 'W45-84 验收：scan unresolved 0、tsc 0、notices 0、13/13、690/690、1,966/1,966、索引 70 chunk/300,970 单位、身份 b6c1c882…',
    '下一步 Client host（Io/So/To/wo/Ro/Co），随后 je/终端胶水',
    'source-undeclared-scan declared 67，unresolved 0；新套件 13/13；链家族 690/690；全量 1,966/1,966；索引 70 chunks / 1,652 语句 / 300,970 单位（2.8%）'],
];
const added = rows.filter(([stamp]) => !tsv.includes(stamp)).map((row) => row.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md').replace(/\n+$/, '\n');
write('.audit/w45-runtime.todo.md', todo + `
## W45-84 acceptance (2026-10-17)

- [x] **The Button and its action keys are ported.** The store and comparator, the seats, the hotkey context, the blur, the button, the click subscriber, the key normalization, the keybinding service, the dialog store and the default app context are copied.
- [x] **The Button owns no press state.** Actionable presses are entries in the shared store; the seat registers one handler per bound context and dispatches the rank/sequence winner.
- [x] **The host bindings are explicit.** \`u\` answers null without a mounted service (the source no-service path), \`ix\` binds a focus manager per committed node and throws when unbound, and \`KH\` is the action-box token.
- [x] **Every label variant and click path is measured.** Bracketed, focused/hovered, plain, plain+hotkey, held, dim and primary; blur only for a descendant; immediate propagation stopped; the subscriber ignores window activations and inside presses.
- [x] **Sweep.** tsc 0, copy \`declared 67 / unresolved 0\`, notices 0, new suite 13/13, chain family 690/690, full 1,966/1,966, index 70 chunks / 300,970 units, identity \`b6c1c882…\`.
`);

const marks = {
  'research/CURRENT.md': 'W45-84 **Button 与动作键',
  'research/STATUS.md': '\nW45-84:',
  'research/coding-standard.md': '\n2026-10-17 W45-84 ',
  'research/ports/W45-chain-runner.md': '\n## W45-84 ported',
  'research/FEATURES.md': 'W45-84 adds the pressable Button',
  '.audit/w45-runtime.todo.md': '\n## W45-84 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
