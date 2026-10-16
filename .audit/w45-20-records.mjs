import fs from 'node:fs';

const identity = {
  sha256: 'a3ea88c74061fae8ea1d8a8b95132d284d8365da3b50825d680f8925709b983c',
  inputs: { sha256: '7593142b680fa784a64bab2b5d198e963cef40eb4db9cd58b579ade43a387a5a', files: 300 },
  validation: { sha256: 'ed869d1128851af7ea73c034c8355ba46778df3efa861c2e73b2f4e61094b4ee', files: 119 },
  build: { sha256: 'b8178d5a4dcf8b230c80c4d3d8e99252c8c3881fe6c14ab34c58fd2151af919f', files: 211 },
};

const evidence = {
  schema: 'W45HostCallEvidence.v1',
  package: 'W45-20 — the module-to-host call path (the value events\' raise)',
  date: '2026-10-15',
  question: "Q-088's last item: where does the source raise the value events (`ui.*`, `env.*`, `state.*`), and what does a faithful port cost?",
  answer: 'From the plugin-call dispatcher through `Hze`, the module-to-host call raiser — not from the classic sites and not from the engine\'s own status or log writes.',
  coordinates: {
    modules: [
      'chunk-sfn1dbxq.js sha256 4c74137eb23221981404d0ca87b765912f83344851d5c132b21857e5685b03da (Cme 177, Hze 797)',
      'chunk-nyce03br.js sha256 6a5164eba0f55eaa3a7122eaefb51a98b369a2422284bf6062b22cf91fab855f (ESe/AFe 25, $$n 10, U$n 27, tIt 505)',
      'chunk-ax7r0qj7.js sha256 8e782f9b216f270b08ab23c9d3724965dccfdaa6053e78d89103b7fc1926c67e (m/a/l/g 393, Yc/hf 110)',
      'chunk-n3ykh62m.js sha256 2a0e605d3c585ce776af544c82755ec30f932e568cdef58b2d9a5b1f53725eac (ls 14, YPn 33, TDe 64)',
    ],
    blocks: 11,
    units: 2155,
    plan: 'research/ports/W45-host-call-blocks.plan.json',
    product: 'src/plugin-chain-host-call-source.ts (generated) + src/plugin-chain-host-call.ts (seam)',
    entry: 'chunk-sfn1dbxq.js [1842591,1843388) — `async function Hze({event, args, caller, bottom, raise})`',
  },
  caller_sites: [
    "`Ot` (chunk-kwp08k6x.js [38986,39121)) — the plugin `$` object's dispatcher: `tho(n)` names route to `Hze`, the rest to `ga`/`ht`.",
    "the twin dispatcher in the chain module (chunk-sfn1dbxq.js [2356634,2356788))",
    '`$.prompt.read` (chunk-sfn1dbxq.js [2341631)) — the "plugins that call $.prompt.read" call, with the empty-box answer as its floor',
    '`interface.call` for a two-segment name (chunk-sfn1dbxq.js [2356634))',
  ],
  measurements: [
    'Short circuit: `if (y.length === 0 && s) return YPn(b, () => s.run(n, r))` — a name no module hooks runs the floor directly, with the caller\'s own object and without the table entry\'s `check`. Measured and asserted.',
    'The copier is change-detecting, not a deep copy: `tIt` rebuilds only where it repaired something (`let s = n.some(([a, f], m) => a !== r[m]?.[0] || f !== r[m]?.[1]); p = s ? i : e`). Measured: a well-formed object comes back as the same reference; an object holding a lone surrogate comes back as a new object on the path to the change with its untouched siblings still shared; the caller\'s object is untouched.',
    "`Z$n` is true only for a dotted name whose first segment is no catalog group, so `ui.log` and `prompt.read` are not it (`Bt` holds `ui`, `prompt`, …) while `interface.call` is. The args-is-no-object refusal is reachable only for such a name and only with a module hooked (the short circuit precedes it). Measured and asserted.",
    'The three texts are the source\'s own: `${caller.plugin}: $.${event}: ${deny}` for a denied answer, `${event}: ${text} (host check)` for the floor\'s refusal, and `${caller.plugin}: $.${event}: its input is no object, which the hooks on it (${names}) take as e; pass one` for the argument refusal. The error class is the product\'s `HooksError` (`He`).',
    "No product raise point: every `Hze` caller is the plugin-call dispatcher, and this product has no `$` object, so nothing funnels. The engine's own writes go elsewhere in the source — a status line through `Vyt` (chunk-sfn1dbxq.js [494176,494224)) to the bound session, a plugin log line through `mce` (already carried at src/plugin-chain-records.ts:149) — so raising at either would fire on engine-authored text, which the source never does.",
  ],
  landed: [
    'The raise path is copied (11 blocks / 2,155 units / 4 modules) and exposed as `raiseHostCall({event, args, caller, bottom, raise})` plus `hostCallCopied(event)`, with the caller and bottom contracts typed in the seam.',
    'The `TDe` placeholder is retired: `src/plugin-chain-host.ts` no longer carries a pass-through, and the two generated callers (./plugin-chain-entry.ts, ./plugin-chain-source.ts) import the copied `TDe`, so the four `_yt` names (config.describe, command.describe, tool.describe, agent.offer) now run their answer through the copier — a real behaviour change, asserted.',
    '`iD` gained an export from the sites copy (plan updated and the file regenerated) rather than being copied a second time.',
    'Not re-exported from the host: re-exporting `TDe` closed a cycle (host → host-call-source → host) whose evaluation order left the host\'s own consts uninitialized (`ReferenceError: Cannot access \'rQt\' before initialization`). The dependency now runs one way.',
  ],
  verification: {
    identity,
    check: 'pass', build: 'pass', notices: 'pass',
    copy_verifier: 'passed true, 22 plans (the new pair added to scripts/verify-chain-copies.mjs)',
    undeclared_scan: 'src/plugin-chain-host-call-source.ts unresolved 0; src/plugin-chain-sites-source.ts unresolved 0',
    focused: 'test/plugin-chain-host-call.test.ts 3/3; related chain files + plugin-hooks-module 71/71',
    full: '1320/1320',
    compiled: '.audit/w45-20-compiled.mjs prints W45HostCallCompiled.v1 against dist/; the five W45 drivers and the eight earlier ones all exit 0',
    cli: 'node scripts/smoke-package.mjs — packaged CLI, offline install, installed launcher and startup fixtures pass, zero upstream requests',
  },
  limitations: [
    'No product code raises a value event yet: the seam is reached only by tests until this product grows the plugin-call surface the source dispatches from.',
    '`ls` is a second `AsyncLocalStorage` instance beside the runner copy\'s `Ve` (the dispatch pause), as it is a separate module in the source; nothing in this product passes a scope holder yet, so `YPn` runs its callback directly.',
    'The two floors the source ships for `ui.status` and `ui.log` are not wired: `ui.status`\'s floor is `LWt` → `Vyt` (a session-bound plugin-status registry this product has not carried) and `ui.log`\'s floor needs `Pzo`/`$2e`/`Yb` whose recorder this product has no consumer for. `mce`, the sink underneath `ui.log`\'s floor, is carried.',
  ],
};
fs.writeFileSync('research/ports/W45-host-call-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

const section = `
## W45-20 landed: the module-to-host call path, and the placeholder it retires

Source-first reading: every caller of \`Hze\` in the bundle is the plugin-call dispatcher — \`Ot\` at
chunk-kwp08k6x.js [38986,39121) (the \`$.\` method funnel) and its twin at chunk-sfn1dbxq.js
[2356634,2356788), plus \`$.prompt.read\` [2341631) and \`interface.call\` for a two-segment name. The
engine's own status line does not pass through it (it goes through \`Vyt\` [494176,494224) to the bound
session) and neither does a plugin log line (it goes through \`mce\`, already carried). That is why this
package does **not** raise at the product's status line or log sink: those write engine text, and the
source raises \`Hze\` only for a plugin's method call.

What landed: the raise path — \`Cme\`, \`Hze\`, the copier \`tIt\`/\`U$n\` (with its two budgets and the
lone-surrogate pair \`Yc\`/\`hf\`), the async-local store \`ls\`/\`YPn\` and \`TDe\` — as 11 blocks /
2,155 UTF-16 units over four modules, generated into src/plugin-chain-host-call-source.ts, with
src/plugin-chain-host-call.ts as the typed seam (\`raiseHostCall\`, \`hostCallCopied\`).

Two corrections the measurements forced, both recorded in the file comments and the regressions:

- **The copier is change-detecting, not a deep copy.** \`tIt\` rebuilds only the subtree it repaired
  (\`s = n.some(...); p = s ? i : e\`), so a well-formed argument reaches the floor as the *same* object
  and only a lone surrogate materializes a new one, on the path to the change, with untouched siblings
  still shared. The recon's "a hooked answer object must not be the object the sink receives" was wrong
  on this ground.
- **The copier and the table's \`check\` run on the dispatch path only.** A name no module hooks
  short-circuits to the floor with the caller's own object, so neither can be observed there; the
  argument refusal (\`Z$n\`) is likewise reachable only with a module hooked, and only for a name whose
  first segment is no catalog group (\`interface.call\`, not \`ui.log\`).

The placeholder retirement is a real behaviour change: src/plugin-chain-host.ts used to hand the answer
through for the four \`_yt\` names; now those names copy their answer, as \`ga\` does in the source. The
re-export route was rejected after measuring it: host → host-call-source → host is a cycle whose
evaluation order leaves the host's consts uninitialized, so the two generated callers import \`TDe\` from
the copy instead.

Verified: check/build/notices pass, 22 copy plans regenerate byte-identically, the new copy scans
0 undeclared, the new regression file is 3/3, the related chain files are 71/71, full 1320/1320, the
thirteenth compiled driver prints \`W45HostCallCompiled.v1\` against \`dist/\` beside the twelve earlier
ones, and \`scripts/smoke-package.mjs\` passes the packaged CLI, offline install and launcher checks with
zero upstream requests. Identity \`a3ea88c7…\`.
`;
const runner = 'research/ports/W45-chain-runner.md';
fs.writeFileSync(runner, fs.readFileSync(runner, 'utf8').replace(/\n?$/, '\n') + section);

const currentRow = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-15最新**：W45-20 **已落地**——值事件的 raise 路径搬完。源侧读证：\`Hze\`（chunk-sfn1dbxq.js [1842591,1843388) 797 单位）的每个调用者都是「插件调用派发器」（\`Ot\` chunk-kwp08k6x.js [38986,39121) 与其孪生 [2356634,2356788)，加 \`$.prompt.read\` [2341631) 与 \`interface.call\` 的两段名分支）；引擎自己的状态行走 \`Vyt\` [494176,494224) 到会话、插件日志行走 \`mce\`（已搬），都**不**经 \`Hze\`——故本包不在产品的状态行/日志汇 raise（那会对着引擎文本开火）。落地：11 段 2,155 单位 / 4 模块（\`Cme\` 177、\`Hze\` 797、copier \`tIt\` 505/\`U$n\` 27/两常量 35、well-formed 393、\`Yc\`/\`hf\` 110、\`ls\` 14、\`YPn\` 33、\`TDe\` 64）生成 \`src/plugin-chain-host-call-source.ts\`，缝为 \`src/plugin-chain-host-call.ts\`（\`raiseHostCall\`/\`hostCallCopied\` + caller/bottom 类型）。两处实测纠偏：copier **只重建被修好的子树**（well-formed 参数仍是同一对象引用，孤立代理项才materialize 新对象且未变更的兄弟仍共享），且 copier 与表项 \`check\` **只在派发路径**跑（无 handler 时短路直奔 floor，参数非对象拒绝也只在有 handler 且首段非目录组时可达，如 \`interface.call\`）。占位退场：host 的 \`TDe\` 原样返回改为两个生成调用点从拷贝导入，\`_yt\` 四名（config.describe/command.describe/tool.describe/agent.offer）现在真复制答案；从 host 再导出会成环（实测 \`Cannot access 'rQt' before initialization\`），故依赖单向。\`iD\` 由 sites 拷贝新增导出而未二次搬运。验证：check/build/notices 过、22 计划逐字节可重生成、新拷贝 unresolved 0、聚焦 3/3、相关 71/71、全量 1320/1320、第十三个编译驱动 \`W45HostCallCompiled.v1\` 全绿、\`smoke-package\` 过（零上游请求）。身份 a3ea88c7…。\`raiseHostCall\` 暂无产品调用点（本产品无 \`$\` 面），已按源的门控记录。\`ui.status\`/\`ui.log\` 两条 floor 未接（\`LWt\`→\`Vyt\` 的会话态注册表、\`ui.log\` floor 的 \`Pzo\`/\`$2e\`/\`Yb\` 记录器），\`mce\` 已在。 | [W45 证据](ports/W45-host-call-evidence.json)、[链执行器记录](ports/W45-chain-runner.md) |
`;
const currentFile = 'research/CURRENT.md';
const current = fs.readFileSync(currentFile, 'utf8');
const marker = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(marker);
if (at < 0) throw new Error('C-12 row not found');
fs.writeFileSync(currentFile, current.slice(0, at) + currentRow + current.slice(at));

const featuresFile = 'research/FEATURES.md';
let features = fs.readFileSync(featuresFile, 'utf8');
const gapsTail = 'and the `ui.`/`env.`/`state.` value events, which are not classic events and still have no raise at all |';
if (!features.includes(gapsTail)) throw new Error('FEATURES gaps tail not found');
features = features.replace(gapsTail,
  'and the `ui.`/`env.`/`state.` value events, which are not classic events: their raise path is now carried (W45-20, `Hze` as `raiseHostCall`) but has no product caller until the plugin-call surface it dispatches from exists, and the source\'s own floors for `ui.status`/`ui.log` stay unwired |');
const bodyMarker = 'Q-088 narrows to the `ui.`/`env.`/`state.` value events, which are not classic events and still have no raise at all.';
if (features.includes(bodyMarker)) {
  features = features.replace(bodyMarker,
    'Q-088 narrows to the `ui.`/`env.`/`state.` value events, which are not classic events and still have no raise at all. W45-20 then landed that raise path: `Hze` (chunk-sfn1dbxq.js [1842591,1843388) 797 units) is copied with its copier and its async-local store (11 blocks / 2,155 UTF-16 units over four modules, src/plugin-chain-host-call-source.ts) behind the typed seam src/plugin-chain-host-call.ts (`raiseHostCall`, `hostCallCopied`). The source-first reading decided what the package does **not** do: every `Hze` caller is the plugin-call dispatcher (`Ot` chunk-kwp08k6x.js [38986,39121), its twin chunk-sfn1dbxq.js [2356634,2356788), `$.prompt.read` [2341631), `interface.call`), while the engine\'s own status line goes through `Vyt` [494176,494224) and a plugin log line through `mce`, so raising at the product\'s status line or log sink would fire on engine-authored text that the source never raises for. Two measurements corrected the recon: the copier rebuilds only what it repairs (a well-formed argument reaches the floor as the same object), and both the copier and the table entry\'s `check` run on the dispatch path only (a call no module hooks short-circuits to the floor). The `TDe` placeholder at src/plugin-chain-host.ts is retired — the four `_yt` names now copy their answer as `ga` does — and the two generated callers import `TDe` from the copy, because re-exporting it from the host closed a cycle whose order left the host\'s consts uninitialized. check/build/notices pass, 22 copy plans regenerate byte-identically, the new copy scans 0 undeclared, focused 3/3, related 71/71, full 1,320/1,320, the thirteenth compiled driver `.audit/w45-20-compiled.mjs` prints `W45HostCallCompiled.v1` against `dist/`, ports/W45-host-call-evidence.json.');
}
fs.writeFileSync(featuresFile, features);

const statusFile = 'research/STATUS.md';
fs.writeFileSync(statusFile, fs.readFileSync(statusFile, 'utf8').replace(/\n?$/, '\n') +
  '\nW45-20: the module-to-host call path (the `ui.*`/`env.*`/`state.*` value events\' raise) is copied — 11 blocks / 2,155 UTF-16 units over four modules into src/plugin-chain-host-call-source.ts, behind `raiseHostCall`/`hostCallCopied` in src/plugin-chain-host-call.ts. Every `Hze` caller in the source is the plugin-call dispatcher, and the engine\'s own status and log writes take other paths, so the package adds no product raise point; the `TDe` placeholder is retired and the four `_yt` names now copy their answer. Verified: 22 copy plans regenerate byte-identically, full 1,320/1,320, compiled driver `W45HostCallCompiled.v1` green, packaged-CLI smoke passes with zero upstream requests. Identity `a3ea88c7…`; see [W45 host-call evidence](ports/W45-host-call-evidence.json).\n');
console.log('records written');
