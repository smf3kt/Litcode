// W45-85 record: the Client host, its acquisition, terminal mount, input path and error boundary.
// Writes the package section, the CURRENT row, the STATUS and FEATURES tails, the coding-standard
// entry, the runtime trail and the acceptance list. Every anchor is asserted unique before any write.
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
## W45-85 ported the Client host (2026-10-17)

Nine blocks are copied verbatim (3,896 units) into \`plugin-chain-client-host-source.ts\`: the error
boundary \`Vo\`/\`XD\`, the hosted client's input binding \`wo\`, the terminal mount \`To\`, the clock
adapter \`Ro\`, the loading snapshot \`bo\`, the inert client \`Co\`, the acquisition hook \`So\`, the
Client host \`Io\`, and the keybinding pre-dispatch hook \`Ey\` from chunk-am9mebpw.js.

The host is an acquisition boundary, not a renderer. \`So\` asks the registry for one client per
element — keyed by plugin, component, request id (\`requestId\\0client\\0key\`), surface, element key,
module and props, with \`Ro\` adapting the clock — and releases it on unmount. \`Io\` subscribes to the
snapshot and mounts \`To\` under \`XD\`, with the layout box as the fallback. \`To\` forwards props,
redraw, layout, resize, pointer and key events to the instance and draws only what
\`host.rebuild(snapshot.tree)\` returns; a failed snapshot draws its truncating text. \`wo\` shares the
host focus store with the pane layer: a pane taking focus clears the client, and the pre-dispatch key
handler only consumes keys for the focused client, dropping focus first on escape and ctrl+c/d.
\`XD\` resets on a new \`resetKey\` and reports a throw once.

The seam supplies the host bindings: the focus store \`Kje\`/\`$pn\`/\`W1o\`, the pane store \`Ri\` with the
copied \`c9\`, the client registry \`G1o\` (default: the inert \`Co\` shape), the telemetry helpers (the
copied \`Qrt\`/\`kAt\`/\`ot\`/\`VV\`, a null \`i5t\` sink), the layout context \`Zy\` with the copied \`m4n\`,
and the component base \`iZr\` with no-op capture/log sinks. \`Ey\` extends the keybinding service with
\`registerPreDispatch\`.

What was measured (probe log \`.audit/w45-85-probe.txt\`): the clock early/due/cleanup and the
interval fallback; the frozen snapshot and inert client; the acquire request, release and defaults;
the \`Io\` boundary/fallback/mount tree; the mount's box, effects, rebuilt tree, pointer mapping and
focus, failed text and the loading no-handler shape; the \`wo\` focus clear and its key paths; the
\`Ey\` bind/unbind/active gate; the \`XD\` states, statics, telemetry attach, frozen replacement and
\`onError\`; the focus setters, \`c9\` paths, \`kAt\` descriptors, \`Qrt\`, \`i5t\`, \`m4n\` and the inert
registry default.

Verified: tsc 0, the copy scans \`unresolved 0\` (67 declared), notices 0, 20 new tests, the chain
family 710/710, full 1,986/1,986, and the recovered-source index at 71 chunks / 1,662 statements /
304,866 units (2.8%). Identity \`dee1094f…\`.

Next: the site-tree walker \`je\` with the terminal glue, taken last when every component it names is
carried.

`);

rep('research/CURRENT.md',
  '\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-84 **Button',
  '\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-85 **Client 宿主（插件客户端岛）**：**9 段 3,896 单位**（错误边界 `Vo`/`XD`、宿主输入绑定 `wo`、终端挂载 `To`、时钟适配 `Ro`、加载快照 `bo`、惰性客户端 `Co`、获取钩子 `So`、宿主组件 `Io`、键位预派发钩子 `Ey`）。**语义**：`So` 按 `插件/组件/请求id(requestId\\0client\\0key)/surface/key/module/props` 向注册表获取客户端并在卸载时释放；`Io` 订阅快照，把 `To` 挂在 `XD` 下、布局盒作 fallback；`To` 只转发事件并画 `host.rebuild(tree)`，失败快照画截断文本；`wo` 与面板层共享焦点存储（面板获焦即清客户端，escape/ctrl+c/d 先丢焦点），仅获焦且接受按键的客户端消费按键；`XD` 新 key 复位、单次上报。**宿主接缝** `plugin-chain-client-host.ts`：焦点存储 `Kje`/`$pn`/`W1o`、面板存储 `Ri`（`c9` 正文照搬）、客户端注册表 `G1o`（默认返回与 `Co` 同形的惰性实例）、遥测 `Qrt`/`kAt`/`ot`/`VV` 照搬而 `i5t` 无 sink 返回 null、布局上下文 `Zy` 与照搬的 `m4n`、组件基类 `iZr`。`Ey` 需要键位服务新增 `registerPreDispatch`。**实测**：时钟早/到/清理与 interval 兜底；`bo`/`Co` 冻结形状；获取请求/释放/默认 AbovePrompt+detached；`Io` 边界/fallback/挂载树；`To` 盒子/效果/重建树/指针映射与焦点/失败文本/加载态无 handler；`wo` 焦点清除与按键四路；`Ey` 绑/解绑/失活；`XD` 状态/静态/遥测附着/冻结替换/onError；焦点 setter、`c9` 三路、`kAt`、`Qrt`、`i5t`、`m4n` 与惰性注册表。tsc 0；未声明扫描 unresolved 0；新套件 20/20；链家族 710/710；全量 1,986/1,986；索引 71 chunk/304,866 单位（2.8%）；身份 `dee1094f…`。 | [Client 证据](ports/W45-client-host-evidence.json)、[工作包](ports/W45-chain-runner.md) |\n| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-17最新**：W45-84 **Button',
);

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W45-85: the Client host acquires one plugin client per element, subscribes to its snapshot and mounts the terminal view under an error boundary; the mount forwards props, layout, pointer and key events and draws only the rebuilt tree. Focus is a host store shared with the pane layer, so pressing a client clears the pane focus and the key path reaches only the focused client. Nine source blocks, 3,896 units. 20/20 new tests, 710/710 chain family, 1,986/1,986 full; tsc 0; index 71 chunks / 304,866 units. [W45 record](ports/W45-chain-runner.md).
`);

rep('research/FEATURES.md',
  'the click subscriber and the key normalization. ',
  'the click subscriber and the key normalization; W45-85 adds the Client host: per-element client acquisition and release, the terminal mount that forwards layout, pointer and key events, the shared focus path, the clock adapter and the error boundary around the drawn tree. ',
);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W45-85 Client 宿主：S-1至S-7已对照。S-1（先读源）：量出 9 段/3,896 单位，逐段读获取钩子、挂载、输入绑定、边界与预派发正文，确认「Ce」/「eg」复用 react-surface、「kc」/「Ys」复用 code-host、「eE」复用 markdown-host。S-2（不臆造）：获取/释放、挂载转发、焦点清除、按键四路与边界状态全部按源正文保留。S-3（宿主边界）：焦点与面板存储、客户端注册表、遥测 sink、布局上下文与组件基类均为宿主绑定；「c9」/「Qrt」/「kAt」/「ot」/「VV」/「m4n」照搬源正文。S-4（可测）：20 条用例先经 .audit/w45-85-probe.ts 实测再断言。S-5/S-6：宿主集群一次收齐，「Ey」依赖的「registerPreDispatch」以可选成员扩展键位服务。S-7（记录）：证据 JSON 记录 9 段区间、六个宿主边界与分区进度。验证：tsc 0、未声明扫描 67 unresolved 0、notices 0、新套件 20/20、链家族 710/710、全量 1,986/1,986、索引 71 chunk/304,866 单位、身份 dee1094f…。
`);

const tsv = read('.audit/w45-runtime.tsv');
const rows = [
  ['2026-10-17T21:50:00Z', 'package', 'W45-85 Client 宿主（9 段 3,896 单位）',
    'XD/wo/To/Ro/bo/Co/So/Io/Ey 成为产品面；plugin-chain-client-host-source.ts 生成副本；新 plugin-chain-client.ts 公共 seam、plugin-chain-client-host.ts 的焦点/面板/注册表/遥测/布局/基类绑定',
    'chunk-kjfwbh4w.js 8 段 + chunk-am9mebpw.js 1 段共 3,896u',
    '20/20 新套件；链家族 710/710；全量 1,986/1,986；1 文件 unresolved 0'],
  ['2026-10-17T21:54:00Z', 'decision', 'W45-85 获取即边界，焦点是宿主共享存储',
    '① 注册表 G1o 默认返回与 Co 同形惰性实例，真实客户端由宿主替换；② So 获取/释放按元素；③ 焦点存储 Kje 与面板 Ri 为宿主状态，c9 正文照搬；④ 遥测 i5t 无 sink 返回 null，Qrt/kAt/ot/VV 照搬；⑤ Ey 以可选 registerPreDispatch 扩展键位服务',
    '测试按时钟/冻结形状/获取/Io/To/输入/预派发/边界/宿主绑定分组',
    '.audit/w45-85-probe.txt + test/plugin-chain-client.test.ts'],
  ['2026-10-17T21:58:00Z', 'finding', 'W45-85 实测挂载、指针与焦点路径',
    '① 时钟早/到/清理与 interval 兜底；② 获取请求字段与释放；③ Io 边界/fallback/挂载；④ To 盒子/效果顺序/重建树/指针映射/失败文本/加载态；⑤ wo 焦点清除与按键四路；⑥ Ey 绑/解绑/失活；⑦ XD 状态/静态/遥测/冻结替换；⑧ 焦点 setter、c9、kAt、Qrt、i5t、m4n、惰性注册表',
    '八条由 .audit/w45-85-probe.ts 实测后写入证据与测试',
    '.audit/w45-85-probe.txt + test/plugin-chain-client.test.ts'],
  ['2026-10-17T22:02:00Z', 'verification', 'W45-85 验收：scan unresolved 0、tsc 0、notices 0、20/20、710/710、1,986/1,986、索引 71 chunk/304,866 单位、身份 dee1094f…',
    '下一步 site-tree walker je 与终端胶水（分区 4 最后一件）',
    'source-undeclared-scan declared 67，unresolved 0；新套件 20/20；链家族 710/710；全量 1,986/1,986；索引 71 chunks / 1,662 语句 / 304,866 单位（2.8%）'],
];
const added = rows.filter(([stamp]) => !tsv.includes(stamp)).map((row) => row.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md').replace(/\n+$/, '\n');
write('.audit/w45-runtime.todo.md', todo + `
## W45-85 acceptance (2026-10-17)

- [x] **The Client host is ported.** The acquisition hook, the terminal mount, the input binding, the clock adapter, the loading and inert shapes, the host component, the error boundary and the pre-dispatch hook are copied.
- [x] **Acquisition owns the lifecycle.** One client per element keyed by plugin/component/request/surface/key/module, released on unmount; the component defaults to AbovePrompt and the request id to detached.
- [x] **The mount only forwards.** Props, redraw, layout, resize, pointer and key events go to the instance; the drawn tree comes from the host rebuild and a failure draws its text.
- [x] **Focus is shared.** Pressing a client clears the pane focus, a pane taking focus clears the client, and the key path consumes only for the focused client (escape and ctrl+c/d drop focus first).
- [x] **Sweep.** tsc 0, copy \`declared 67 / unresolved 0\`, notices 0, new suite 20/20, chain family 710/710, full 1,986/1,986, index 71 chunks / 304,866 units, identity \`dee1094f…\`.
`);

const marks = {
  'research/CURRENT.md': 'W45-85 **Client 宿主',
  'research/STATUS.md': '\nW45-85:',
  'research/coding-standard.md': '\n2026-10-17 W45-85 ',
  'research/ports/W45-chain-runner.md': '\n## W45-85 ported',
  'research/FEATURES.md': 'W45-85 adds the Client host',
  '.audit/w45-runtime.todo.md': '\n## W45-85 acceptance',
};
for (const [path, mark] of Object.entries(marks)) {
  const count = read(path).split(mark).length - 1;
  if (count !== 1) throw new Error(`${path} holds ${count} entries for ${JSON.stringify(mark)}`);
}
console.log('record ok');
