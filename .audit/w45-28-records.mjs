// W45-28 records: the bar's stored state (its key, schema and read), the indexes and the audit
// trail. The identity is read from scripts/identity.mjs rather than transcribed, so the record can
// only carry the tree's real digests.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const identity = JSON.parse(execFileSync(process.execPath, ['scripts/identity.mjs'], { encoding: 'utf8' }));
const expect = (cond, what) => { if (!cond) throw new Error('identity does not match the package: ' + what); };
expect(identity.inputs.files === 316, `inputs ${identity.inputs.files}`);
expect(identity.validation.files === 126, `validation ${identity.validation.files}`);
expect(identity.build.files === 221, `build ${identity.build.files}`);
const short = identity.sha256.slice(0, 8);
const files = 229;
const full = '1341 tests / 1339 pass / 2 fail: test/lsp.test.ts 15/16 (the waitFor at line 319) and test/mcp-progress.test.ts 7/8 (initialize timed out after 90ms). Both reproduce at the committed HEAD baseline (detached worktree at dca9c20), neither file nor src/lsp.ts / src/mcp.ts differs from HEAD, and a bare node spawn measures 150-170ms at the host\'s current load 15-29, above these tests\' own 90-150ms budgets';
const smoke = 'pack 229 files, offline install, help, --demo and the launcher driver pass; the startup driver\'s cancellation() 100ms case fails standalone too (starter PID marker missing: 8-deadline-100.pid) with scripts/smoke-magpie-startup.mjs and bin/litcode-magpie.mjs 0-diff vs HEAD, a bare node spawn costing 150-170ms at the host\'s load; upstreamRequests 0';

const evidence = {
  schema: 'W45NotifyStoreEvidence.v1',
  package: 'W45-28 — the notification bar\'s stored state: its key, its schema and the read that parses it back',
  date: '2026-10-15',
  question: 'The bar\'s ledger is kept in the plugin-state store, and W45-27 stopped at the store. What owns the key, what validates the stored value, what does a read of it do, and can the schema be ported without rewriting it against the product\'s zod?',
  answer: 'Four small bodies own it, plus the schema\'s own memoized accessor and a six-name zod binding. `a8` is "engine", `Ope` the `{plugin,key}` pair, `Pye` the `plugin\\x00key` builder, `TWt` the schema of the ledger (a lazy-memoized accessor: the `var` holds the accessor, and calling it builds the schema once), and `SEt` reads the store and falls back to the empty frozen ledger when the value is absent or does not parse. The schema body is copied verbatim; only its six builder names are bound, each to the zod API its declaration in the extracted bundle shows.',
  ported: [
    { module: 'chunk-fdwn5gdv.js', range: [615, 965], units: 350, names: ['p', 'RTr'], note: 'the bundle\'s lazy-memo registry: `lazy(fn)` returns an accessor that builds once, tracks a resetter and reports through `built`/`releaseBuiltSince`/`reset` — what `TWt` holds' },
    { module: 'chunk-nyce03br.js', range: [111504, 111520], units: 16, names: ['a8'], note: 'the plugin the bar\'s state belongs to, "engine"' },
    { module: 'chunk-sfn1dbxq.js', range: [1691490, 1691527], units: 37, names: ['Ope'], note: 'the {plugin,key} pair: engine / bar-toasts' },
    { module: 'chunk-n3ykh62m.js', range: [275562, 275644], units: 82, names: ['Pye'], note: 'the state-key builder, `${plugin}\\x00${key}` and its id form' },
    { module: 'chunk-sfn1dbxq.js', range: [1691527, 1691764], units: 237, names: ['TWt'], note: 'the schema: toasts (key, plugin, text, isManaged, leftMs, wasShown, lentMs, untoldMs, all readonly) and at/slot (slot optional)' },
    { module: 'chunk-n3ykh62m.js', range: [273997, 274025], units: 28, names: ['s_'], note: 'the host registry\'s plugin-state store' },
    { module: 'chunk-sfn1dbxq.js', range: [1692468, 1692581], units: 113, names: ['SEt'], note: 'the read: parse what the store holds for the key, else the empty ledger' },
  ],
  the_six_names: {
    note: 'the schema body names six minified builders; each is bound in src/plugin-chain-notify-schema.ts to the product\'s own zod, with the extracted declaration that identifies it.',
    p: 'not bound — copied: chunk-fdwn5gdv.js [615,965) is the batch\'s own lazy-memo accessor, so `TWt` is a `var` holding the accessor and `SEt` calls it. Binding it to `z.lazy` fails immediately (`TWt is not a function`).',
    u: 'chunk-9cmjz7j9.js [84440,…) `new Zxe({type:"object",shape:e…})` — z.object',
    o: 'chunk-9cmjz7j9.js [79809,…) beside ZodString — z.string',
    v: 'chunk-9cmjz7j9.js [82318,…) beside ZodNumberFormat — z.number',
    A: 'chunk-9cmjz7j9.js [83595,…) `Dn(xAo,e,t)`, used as `A(u({…}).readonly())` — z.array',
    H: 'settled by the round-trip rather than by the neighbourhood: `lLs` writes `isManaged: sOn(plugin)` and `wasShown: !1`, and `SEt` parses them back, so a non-boolean would make every read fall back. Bound to z.boolean and driven by `the ledger the append path writes parses`.',
  },
  host_change: 'The registry gains `pluginState` (chunk-3ph567jx.js [2322,…) initializes it beside `uiLogSink`/`pendingUiLog`, which W45-24 added from the same literal): `s_()` reads `it().pluginState`. The seam binds it (`bindPluginState`) and reports it (`currentPluginState`); no store bound is the source\'s own `s_()` dereference and throws, which the regression pins.',
  measured: [
    'The state key is `engine\\x00bar-toasts`: `a8` "engine" through `Pye(Ope)` in its two-part form.',
    '`TWt()` is the memoized accessor: it returns the same schema on every call.',
    'A conforming ledger parses back equal, `slot` included; a ledger without `slot` parses as itself (the member is optional); an undeclared member is dropped rather than carried.',
    'Refusals: a toast missing a field, a number where a string belongs, a string where a number belongs, a non-array `toasts`, `undefined` and `null`.',
    'The append shape `lLs` writes parses — the round-trip the store depends on, and the evidence that binds `H` to the boolean.',
    'The read: the store\'s value parses; a value that does not parse gives the empty frozen ledger (the same object every read); an absent key gives the same; with no store bound it throws.',
  ],
  caught_by_the_tooling: [
    'Binding `p` to `z.lazy` was wrong and failed loudly (`TWt is not a function`), which is what sent the read of `RTr.lazy` — the memo accessor, not zod\'s lazy.',
    'The memo block\'s first range ended one unit short of its closing brace; the copy then had a whole-file brace delta of 1 and the scope-aware scan refused the file. The range is [615,965), the point the block\'s own braces close.',
  ],
  verification: {
    identity,
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    scan: 'src/plugin-chain-notify-store-source.ts: unresolved 0',
    chain_verifier: 'passed true, 28 plans',
    regressions: 'test/plugin-chain-notify-store.test.ts 4/4; ui + toast + notify + notify-store together 14/14',
    full,
    compiled: 'all fifteen dist drivers exit 0; the shared driver prints W45NotifyStoreCompiled.v1',
    smoke,
  },
  next_package: [
    'the three pre-existing timing budgets that fail on a loaded host: test/lsp.test.ts "timeouts cancel requests…" (a 3s waitFor behind a 150ms request timeout), test/mcp-progress.test.ts "the idle deadline never moves past the total deadline" (a 90ms total deadline covering a node spawn) and scripts/smoke-magpie-startup.mjs\'s 100ms startup deadline — all reproduce at HEAD, and the fix is a budget that survives a loaded host, not a looser assertion',
    'the bar\'s write half: `xYr` [1692719,1692909) and `lLs` [1694273,1694442), with the state writer `o5t` (chunk-n3ykh62m.js [275644,275983)) and what it calls (`ls.exit`, `OFe`, `Y`, `vb`, `jde`)',
    'the `TK` driver at chunk-24k7d6mw.js [478823,…), which owns the clock the ledger tick is driven by',
    'the host toast method\'s stacked path: `EEe` (chunk-24k7d6mw.js [173176,…)) with `bu()`/`wee` and the `toast stacked` notice',
    'the rest of the `$` table beyond the three ui floors, entry by entry',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
  ],
};
write('research/ports/W45-notify-store-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

// CURRENT: the W45-28 row above the W45-27 one.
const current = read('research/CURRENT.md');
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-15最新**：W45-28 **搬完通知栏的存储态**（键 + schema + 读回，7 段 863 单位）。键：\`a8\`="engine"、\`Ope\`={plugin,key}、\`Pye\` → \`engine\\x00bar-toasts\`；schema：\`TWt\` 是 bundle 自己的**懒记忆存取器**（\`p\`/\`RTr\` 一并逐字搬运，chunk-fdwn5gdv.js [615,965)），**不是** \`z.lazy\`（先按 z.lazy 绑定时 \`TWt is not a function\` 当场失败，改回源体）；六个 minified 构建名只在 \`src/plugin-chain-notify-schema.ts\` 逐一绑定到产品 zod，每个都附提取件里的声明作证（\`u\`=z.object、\`o\`=z.string、\`v\`=z.number、\`A\`=z.array；\`H\`=\`z.boolean\` 由**写读往返**定案）。读：\`SEt\` 解析存储值，缺失或不合 schema 时回退 **冻结空台账**（同一对象）。宿主登记表新增 \`pluginState\`（源字面量 chunk-3ph567jx.js [2322,…) 与 W45-24 加的 \`uiLogSink\` 同处），seam 提供 \`bindPluginState\`/\`currentPluginState\`/\`readStoredLedger\`/\`parseStoredLedger\`/\`barStateKey\`。**实测**：合法台账原样解析（含 slot）、缺 slot 可解析、未声明成员被丢弃、六类拒绝值、\`lLs\` 的追加形状可解析（往返）、坏值/缺键都回退空台账、未绑定 store 时按源语义抛出。工具链抓到两处：错误的 \`p\` 绑定被运行时拒；记忆块首次区间少一单位导致整文件花括号差 1，被作用域感知扫描拒。验收：check/build/notices、扫描 0、**28 计划**一致、聚焦 4/4 与相关 14/14、全量 **${full}**（两条均在本包前就存在：已在 detached worktree \`dca9c20\` 复核复现，宿主负载 15-29，裸 \`node\` 启动实测 150-170ms，超过这两个用例自带的 90-150ms 预算）、十五个编译驱动（\`W45NotifyStoreCompiled.v1\`）、打包冒烟 ${files} 文件 0 上游请求（其中 startup 驱动的 100ms 用例在宿主负载下同样复现，脚本与 launcher 对 HEAD 均 0 diff）；身份 \`${short}…\`。 | [存储态证据](ports/W45-notify-store-evidence.json)、[台账核心证据](ports/W45-notify-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('C-12 row not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the interactive row gains the stored state.
const features = read('research/FEATURES.md');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Interactive terminal/headless I/O | Partial |'));
if (featureLine < 0) throw new Error('interactive row not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = rowText.slice(0, lastPipe).replace(/\s+$/, '') +
  '. W45-28 added the bar\'s stored state: the `engine\\x00bar-toasts` key, the schema of the stored ledger (its six zod builders bound to the product\'s zod, with the append path\'s booleans round-tripped) and the read that falls back to the empty ledger' +
  ' |';
write('research/FEATURES.md', lines.join('\n'));

// coding-standard: the dated review line.
const standard = read('research/coding-standard.md');
const standardAt = standard.indexOf('2026-10-15 W45-27 ');
if (standardAt < 0) throw new Error('coding-standard W45-27 line not found');
const standardEntry = `2026-10-15 W45-28 通知栏存储态：S-1至S-7已对照。S-1（先读源）：schema \`TWt\` 逐字搬运，只把六个 minified 构建名绑到产品 zod——每名先读提取件里的声明（\`p\` 读到 \`RTr.lazy\` 是记忆存取器，遂改为逐字搬运而非绑定；\`u\`/\`o\`/\`v\`/\`A\` 各有声明为证；\`H\` 由写读往返实测定案，不靠邻域猜）。S-3（不留半包）：回归覆盖键形、schema 的可接受/可丢弃/六类拒绝、\`lLs\` 追加形状的往返、坏值与缺键的两种回退、未绑定 store 时按源语义抛出。S-4（可复跑校验）：本包起记录脚本直接从 \`scripts/identity.mjs\` 读身份并对文件计数断言，不再手抄摘要，且扫描抓出记忆块区间少一单位（整文件花括号差 1）并已修正。S-7：写半边（\`xYr\`/\`lLs\`/\`o5t\`）与 \`TK\` 驱动无源码可搬入本包范围，已连区间记入下一包。验收：check/build/notices、扫描 unresolved 0、28 计划一致、全量 1341/1339（两条失败已在本包之前的 HEAD 基线上复现，见证据文件 verification.full）、十五个编译驱动、打包冒烟 ${files} 文件 0 上游请求（startup 驱动 100ms 用例为宿主负载所致，脚本 0 diff）。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// STATUS: the W45-28 paragraph above the W45-27 one.
const status = read('research/STATUS.md');
const statusAt = status.indexOf('W45-27: the notification bar');
if (statusAt < 0) throw new Error('STATUS W45-27 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-28: the notification bar's stored state. Seven blocks (863 units) carry the key it is kept under (\\\`a8\\\` "engine", \\\`Ope\\\`, \\\`Pye\\\` → \\\`engine\\x00bar-toasts\\\`), the schema of the stored ledger (\\\`TWt\\\`, whose own lazy-memo accessor \\\`p\\\`/\\\`RTr\\\` is copied verbatim — binding it to \\\`z.lazy\\\` fails at once) and the read (\\\`SEt\\\`), which parses what the store holds and falls back to the frozen empty ledger. The schema's six minified builders are bound to the product's zod in one documented module, each with the extracted declaration that identifies it; the boolean is settled by the append path's round-trip. The registry gains \\\`pluginState\\\` from the source's own literal. The write half and the \\\`TK\\\` driver are the next package. Evidence: \\\`research/ports/W45-notify-store-evidence.json\\\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// runner doc: the W45-28 section.
const runner = read('research/ports/W45-chain-runner.md');
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-28 ported the notification bar's stored state (2026-10-15)

W45-27 took the bar's ledger core and stopped at the store; this package takes the other side of that
boundary. Seven blocks (863 units) across four modules carry it: the key the ledger is kept under
(\\\`a8\\\` "engine", \\\`Ope\\\`, \\\`Pye\\\` → \\\`engine\\x00bar-toasts\\\`), the schema of the stored ledger (\\\`TWt\\\`), the
registry field the store is reached through (\\\`s_\\\` → \\\`it().pluginState\\\`, the source's own literal), and
the read (\\\`SEt\\\`) that parses the store's value and falls back to the frozen empty ledger.

Two findings shaped the port. \\\`TWt\\\` is not the schema but a \\\`var\\\` holding the bundle's lazy-memo
accessor, so its \\\`p\\\`/\\\`RTr\\\` are copied verbatim rather than bound — binding \\\`p\\\` to \\\`z.lazy\\\` fails
immediately (\\\`TWt is not a function\\\`). And the schema's other five builders are bound name by name to
the product's zod, each with the extracted declaration that identifies it; the boolean is settled by the
pair that must round-trip, and the regression drives that round-trip rather than leaning on the
neighbourhood reading.

Verified: check/build/notices, 28 byte-identical plans, the new copy \\\`unresolved 0\\\`, 4/4 new
regressions, ui + toast + notify + notify-store 14/14, full ${full}, fifteen compiled drivers (the shared
driver now prints \\\`W45NotifyStoreCompiled.v1\\\`), and the packaged smoke with zero upstream requests.
Identity \\\`${short}…\\\` (read from scripts/identity.mjs by the record script itself).

The sweep's two failures and the packaged smoke's startup case are not this package's. All three reproduce
on the committed baseline: a detached worktree at \\\`dca9c20\\\` runs test/lsp.test.ts 15/16 and
test/mcp-progress.test.ts 7/8, and the files they live in, plus the launcher the smoke spawns, are 0-diff
against HEAD. The host is at load 15-29 from other users, where a bare \\\`node -e ''\\\` costs 150-170ms,
above the 90ms, 150ms and 100ms budgets those cases assert against. They are queued as their own package.
`);

const rows = [
  ['2026-10-16T07:24:00Z', 'package', 'W45-28 搬完通知栏存储态（键 + TWt schema + SEt 读回，7 段 863 单位）',
    'W45-27 停在 store 边界；这一段是键、schema 与读，写半边留待下一包',
    'chunk-fdwn5gdv.js [615,965) 记忆存取器、chunk-nyce03br.js [111504,111520) a8、chunk-sfn1dbxq.js [1691490,1691527) Ope / [1691527,1691764) TWt / [1692468,1692581) SEt、chunk-n3ykh62m.js [275562,275644) Pye / [273997,274025) s_',
    'zod 六名逐一绑定并附声明作证（p 改为逐字搬运）；宿主登记表加 pluginState；回归 test/plugin-chain-notify-store.test.ts 4/4'],
  ['2026-10-16T07:38:00Z', 'verification', 'W45-28 验收：扫描 unresolved 0、1341/1339（两条失败先于本包，已在 HEAD 复现）、打包 0 上游请求',
    '通知栏存储态搬运',
    `check/build/notices；扫描 unresolved 0；verify-chain-copies passed true（28 plans）；聚焦 4/4 与相关 14/14；全量 ${full}；十五个编译驱动 exit 0（输出 W45NotifyStoreCompiled.v1）；smoke-package（${files} files, upstreamRequests 0；startup 驱动 100ms 用例在宿主负载下复现，脚本与 launcher 对 HEAD 0 diff）`,
    `身份 ${short}…（inputs ${identity.inputs.sha256.slice(0, 8)} / ${identity.inputs.files}，validation ${identity.validation.sha256.slice(0, 8)} / ${identity.validation.files}，build ${identity.build.sha256.slice(0, 8)} / ${identity.build.files}）`],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md');
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-28 acceptance (2026-10-15)

- [x] **The schema body is copied, not rewritten.** Only its six minified builder names are bound, each with the extracted declaration that identifies it; \\\`p\\\` turned out to be the bundle's memo accessor and is copied whole.
- [x] **The boolean is settled by a round-trip.** \\\`lLs\\\` writes \\\`isManaged\\\`/\\\`wasShown\\\` and \\\`SEt\\\` parses them back; the regression drives that pair instead of reading the neighbourhood.
- [x] **The registry change is the source's own.** \\\`pluginState\\\` sits in the literal W45-24 already drew two fields from.
- [x] **The record script reads the identity.** It runs scripts/identity.mjs and asserts the file counts, so no digest is transcribed by hand.
- [x] **Sweep.** check/build/notices, scan \\\`unresolved 0\\\`, 28 byte-identical plans, 4/4 new regressions, full 1341/1339, fifteen compiled drivers, packaged smoke (229 files, zero upstream requests).
- [x] **The two failures are attributed, not smoothed over.** Both reproduce at the committed HEAD baseline, so they are queued as their own package: test/lsp.test.ts (a 3s \\\`waitFor\\\` behind a 150ms request timeout), test/mcp-progress.test.ts (a 90ms deadline covering a \\\`node\\\` spawn) and scripts/smoke-magpie-startup.mjs's 100ms case, on a host at load 15-29 where a bare spawn costs 150-170ms.
`);
console.log('records written; identity', identity.sha256);
