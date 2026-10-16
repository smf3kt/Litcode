import fs from 'node:fs';

// Q-088: the value events' raise now exists; the narrowed remainder is the call surface it waits on.
const q = 'research/question.md';
let question = fs.readFileSync(q, 'utf8');
const anchor = '见 `research/ports/W45-host-call-recon.json`（schema v2，含 `corrections`）。';
if (!question.includes(anchor)) throw new Error('Q-088 anchor not found');
const addition = fs.readFileSync('.audit/w45-20-q088.md', 'utf8').trimEnd();
question = question.replace(anchor, anchor + '\n\n' + addition);
fs.writeFileSync(q, question);

// The coding standard's review line for this package, above the previous newest.
const cs = 'research/coding-standard.md';
let standard = fs.readFileSync(cs, 'utf8');
const line = '2026-10-15 W45-20 `Hze` 模块→宿主调用路径复查：S-1至S-7已对照。先按 S-7 读源自己的调用者再决定 raise 点：源的每个 `Hze` 调用者都是插件调用派发器（`Ot` chunk-kwp08k6x.js [38986,39121) 与孪生 [2356634,2356788)、`$.prompt.read` [2341631)、`interface.call`），引擎自己的状态行经 `Vyt` 到会话、插件日志经 `mce`，故把状态行/日志汇当 raise 点是自造（同 W45-18 的 PermissionDenied 判定），改按源门控记录并由缝承载。**两条由实测推翻草案的规则**：①copier `tIt` 只重建被修好的子树（`s = n.some(...); p = s ? i : e`）——well-formed 参数到 floor 仍是同一对象引用，孤代理项才在变更路径上 materialize 新对象且未变更兄弟仍共享；②copier 与表项 `check` 只在派发路径跑——无 handler 时 `if (y.length === 0 && s) return YPn(b, () => s.run(n, r))` 短路直奔 floor（不复制、不 check），参数非对象拒绝也只在有 handler 且 `Z$n` 为真（首段非目录组，如 `interface.call`；`ui.log` 因 `ui` 是目录组而不适用）时可达。**再导出会成环**：`Hze` 读 host 的 `Z$n`，host 若再导出拷贝的 `TDe` 则 host→拷贝→host，实测 `ReferenceError: Cannot access \'rQt\' before initialization`，故两个生成调用点直接从拷贝导入 `TDe`，依赖保持单向；S-6 检查补「跨模块再导出必须先确认求值顺序」。`iD` 由既存 sites 拷贝新增导出（计划改动+重生成），未二次搬运；三个回归 3/3、相关 71/71、全量 1320/1320、22 计划逐字节可重生成、第十三编译驱动绿、`smoke-package` 零上游请求。';
const firstLineEnd = standard.indexOf('\n');
standard = standard.slice(0, firstLineEnd + 1) + line + '\n' + standard.slice(firstLineEnd + 1);
fs.writeFileSync(cs, standard);

// The trail rows for the package.
const rows = [
  ['2026-10-16T00:52:00Z', 'source', 'raise 点由调用者定：`Hze` 只有插件调用派发器在调',
    '源的每个 `Hze` 调用者都是派发器（`Ot` chunk-kwp08k6x.js [38986,39121)、孪生 [2356634,2356788)、`$.prompt.read` [2341631)、`interface.call`），引擎自己的状态行经 `Vyt` [494176,494224)、插件日志经 `mce`；故本包不在产品状态行/日志汇 raise（会对引擎文本开火），改由缝承载并记录「调用点等 `$` 面」',
    '.audit/w45-import-map.mjs chunk-sfn1dbxq.js（`LVe` 来自 chunk-tvdq3hrk.js；`Izo`/`Pzo`/`$2e`/`Vyt`/`LWt`/`Yb` 均模块本地）；逐条读正文',
    'RECONN 的「在状态行与日志汇两处 raise」被此项取代'],
  ['2026-10-16T01:05:00Z', 'measurement', '两条规则由实测推翻草案：copier 只重建被修好的子树；copier 与 check 只在派发路径跑',
    '`.audit/w45-20-probe.mts`：well-formed 对象 `TDe(good) === good`（同引用），含孤代理项的对象返回变更路径上的新对象且未变更兄弟仍共享、调用方对象未被改；无 handler 时 `Hze` 短路直奔 floor（不复制、不 check），参数非对象拒绝只在有 handler 且 `Z$n` 为真时可达（`ui.log` 不适用，`ui` 是目录组）',
    '.audit/w45-20-probe.mts；src/plugin-chain-host-call.ts 的注释与 test/plugin-chain-host-call.test.ts',
    '侦察阶段记的「hooked 答案不得是 sink 收到的对象」按此作废'],
  ['2026-10-16T01:20:00Z', 'package', 'W45-20 落地：11 段 2,155 单位 / 4 模块 + 缝 + 占位退场',
    '生成 src/plugin-chain-host-call-source.ts（`Cme`/`Hze`/`tIt`/`U$n`/两常量/well-formed/`Yc`/`hf`/`ls`/`YPn`/`TDe`），缝 src/plugin-chain-host-call.ts（`raiseHostCall`/`hostCallCopied` + caller/bottom 类型）；`iD` 由 sites 拷贝新增导出；host 的 `TDe` 占位删除、两个生成调用点改从拷贝导入（re-export 实测成环 `Cannot access \'rQt\' before initialization`），`_yt` 四名现在真复制答案',
    'research/ports/W45-host-call-blocks.plan.json、src/plugin-chain-host-call-source-blocks.json、scripts/verify-chain-copies.mjs（新增第 22 对）',
    '产品行为变化一处：ga 对 _yt 四名的答案是拷贝而非原对象'],
  ['2026-10-16T01:34:00Z', 'verification', 'W45-20 在来源、套件、编译产物与打包 CLI 上复核',
    'check/build/notices 过；22 计划逐字节可重生成；新拷贝与 sites 拷贝 unresolved 0；聚焦 3/3、相关 71/71、全量 1320/1320；第十三编译驱动 `W45HostCallCompiled.v1` 与既有十二个全绿；`scripts/smoke-package.mjs` 过（packaged CLI/offline install/launcher/startup，零上游请求）',
    'node scripts/identity.mjs → a3ea88c7…（inputs 7593142b / 300，validation ed869d11 / 119，build b8178d5a / 211）',
    '身份由 82806551… 变为 a3ea88c7…，已同步到证据、CURRENT、FEATURES、STATUS、coding-standard、Q-088 与 trail'],
];
const tsv = '.audit/w45-runtime.tsv';
const text = fs.readFileSync(tsv, 'utf8');
const added = rows.filter(([at]) => !text.includes(at)).map((row) => row.join('\t')).join('\n');
if (added) fs.writeFileSync(tsv, text.replace(/\n?$/, '\n') + added + '\n');

const todo = '.audit/w45-runtime.todo.md';
fs.writeFileSync(todo, fs.readFileSync(todo, 'utf8').replace(/\n?$/, '\n') + `
## W45-20 package acceptance (2026-10-15)

- [x] **Source first.** Read every caller of \`Hze\` before deciding where this product raises: \`Ot\` (chunk-kwp08k6x.js [38986,39121)), its twin (chunk-sfn1dbxq.js [2356634,2356788)), \`$.prompt.read\` [2341631) and the \`interface.call\` branch, plus the engine's own paths (\`Vyt\` [494176,494224) for a status line, \`mce\` for a plugin log line) — which is why no product raise point was added.
- [x] **Skill/tool selection.** The repo's S-7 reconnaissance, the closure walker and the copy generator match this recovered-text task; \`how\`/\`architect\` stay skipped with the recorded reason and no MCP tool fits (no binary, capture or network observation).
- [x] **Measure before asserting.** \`.audit/w45-20-probe.mts\` measured the copier's change-detection and the short circuit before the assertions were written, and both corrected the draft: the copier rebuilds only what it repairs, and neither the copier nor the table entry's \`check\` runs on a call no module hooks.
- [x] **Port the bodies, not a paraphrase.** 11 blocks / 2,155 UTF-16 units over four modules regenerate byte-identically from the plan; \`iD\` is exported from the existing sites copy rather than copied twice.
- [x] **Retire the placeholder.** The host's pass-through \`TDe\` is gone and the four \`_yt\` names copy their answer; re-exporting from the host was measured into a cycle (\`Cannot access 'rQt' before initialization\`) and rejected, so the two generated callers import from the copy.
- [x] **0-3 necessary regressions.** \`test/plugin-chain-host-call.test.ts\` 3/3: the floor with and without a hooked module plus the two source texts, the copier's repair/sharing rule with its \`check\` and argument refusals, and the entry path's copy for the four names.
- [x] **Verify on the real artifact.** 22 plans regenerate byte-identically, focused 3/3, related 71/71, full 1,320/1,320, \`.audit/w45-20-compiled.mjs\` prints \`W45HostCallCompiled.v1\` against \`dist/\` beside the twelve earlier drivers, and the packaged-CLI smoke passes with zero upstream requests.
- [x] **Bind identity and update the indexes.** Identity \`a3ea88c7…\` (inputs 7593142b / 300, validation ed869d11 / 119, build b8178d5a / 211); W45-host-call-evidence.json, W45-chain-runner.md, CURRENT C-12, FEATURES, STATUS, question.md (Q-088 narrowed), coding-standard, .audit.
`);
console.log('records batch two written');
