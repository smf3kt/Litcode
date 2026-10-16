// W45-23 records: the copy-gap scan's defect and fix, the three gaps it found, the Q-091 entry, the
// indexes and the audit trail. Anchored inserts assert their target first.
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, s) => fs.writeFileSync(p, s);

const evidence = {
  schema: 'W45ScanEvidence.v1',
  package: 'W45-23 — the copy-gap scan is scope-aware, and the three gaps it had been hiding',
  date: '2026-10-15',
  question: 'scripts/source-undeclared-scan.mjs reported `unresolved 0` for a copy that referenced an undeclared `a8`. What else had its semantics been hiding?',
  answer: 'A declaration counted for the whole file, because the scan added every declaration at any depth to one set. Minified bodies reuse short names as parameters and loop bindings everywhere, so one local satisfied references in every other function. Made scope-aware, the scan found three real gaps: `a8` and `ep`/`z3e` in the streaming copy and `x` in the runner copy.',
  defect: {
    symptom: '.audit/w45-22-compiled.mjs threw `ReferenceError: a8 is not defined` on the streaming copy while `node scripts/source-undeclared-scan.mjs src/plugin-chain-stream-source.ts` reported `unresolved 0`.',
    cause: 'Pass 1 of the old scan recorded `VariableDeclarator` ids, function names, every function parameter and `Property.value` patterns into a single file-wide `declared` set, at any depth. A `let a8` inside one copied function therefore satisfied a free `a8` in another.',
    classification: 'S-7 (the copy has to be checkable before it is trusted): the guard was treated as sound because it was green, not because its semantics were tested.',
  },
  scope_rules: [
    '`var` and function declarations bind to their enclosing function (or the module), wherever they appear, so they are hoisted into that scope before its body is walked.',
    '`let`/`const`/`class` bind to their block; `catch` parameters, `for`/`for-in`/`for-of` bindings and class bodies get their own scope; a class expression name lives only inside its body.',
    'Parameters bind to their function. A reference resolves outward from where it sits, and an unresolved name is reported with the line of the file as it is on disk.',
    'The `// @ts-nocheck` pragma is neutralised in place rather than removed: stripping the line shifted every reported line by one against the file a reader opens.',
  ],
  found: [
    '`a8` in src/plugin-chain-stream-source.ts — the clock/stage `plugin: e.isCore===!0?a8:e.name`; `var a8="engine"` is a runner-copy declaration, now imported (W45-22 fixed this one, W45-23 found the other two).',
    '`ep` (44 units, the "failed closed: its .catch answered" effect text) and `z3e` (13 units, the 1000ms catch grace) in src/plugin-chain-stream-source.ts — both live in runner ranges, both reachable only through the stage\'s `.catch` path, which no test had driven.',
    '`x` in src/plugin-chain-source.ts — the `fromCharCode` chunker `WMt` falls back to when `Buffer` is absent (the browser branch, dead in this product). Copied from the same module as its only caller: a new block chunk-ax7r0qj7.js [1645,1850) in the runner plan, exported as `x`.',
  ],
  false_positives_fixed: [
    'Class declarations and expressions were not bound at all, so `He`, `Gde`, `Ye`, `Hht` and `bN` (all copied error/base classes) read as free names. Both node types now bind their name and introduce their own body scope.',
  ],
  landed: [
    'scripts/source-undeclared-scan.mjs rewritten with a scope chain (module / function / block), hoisting, and per-reference resolution; its output shape is unchanged (`file`, `declared N  imports …`, `unresolved N`, then `  name  (line N)`).',
    'test/source-undeclared-scan.test.ts: 11 fixtures over two tests, including the W45-22 shape (a local in one function, a free name in another) that the previous semantics passed, plus the class, block, hoisting, shadowing, property-position and dead-branch cases.',
    'The three gaps closed by plan edits (runner exports `x`, `ep`, `z3e`; a new runner block for `x`; the streaming copy imports `ep`/`z3e`), with both files regenerated. No body was copied twice: `x` came from the module its only caller lives in, and `ep`/`z3e` were already in the runner copy.',
  ],
  verification: {
    identity: {
      sha256: 'fead754135a821e2454e746e87833893e547bbb66ac905428a1c45f49e73b813',
      inputs: { sha256: '1382d80be804231177db4026984476a10c1fc9fc05d37dde05af7e88694675fc', files: 305 },
      validation: { sha256: 'c3b3bf208ac42e82d5467987e6a68ef97387ac92078c8f10f4f4472f07097850', files: 121 },
      build: { sha256: '4833ef1ed392ffe30a853cc171691bff41fcd6a1bb4624bd278ef632570d0fcc', files: 214 },
    },
    check: 'pass',
    build: 'pass',
    notices: 'pass',
    copy_verifier: 'passed true, 24 plans, byte-identical',
    scan_all_copies: 'every generated copy (src/*-blocks.json, 24 files) reports unresolved 0',
    scan_regressions: 'test/source-undeclared-scan.test.ts 2/2 (11 fixtures); chain files together 69/69',
    full: '1325/1325',
    compiled: 'all fourteen dist drivers exit 0',
    smoke: 'scripts/smoke-package.mjs passed, upstreamRequests 0, 222 files',
  },
  limitations: [
    'Parsing is JavaScript only (acorn): the scan is meant for the generated copies, whose bodies are plain JS behind `// @ts-nocheck`, not for hand-written TypeScript.',
    'A function declaration inside a block is bound to the enclosing function scope (sloppy-mode hoisting), which is wider than ESM block scoping; a name used outside its block could therefore read as bound. No copied body relies on that, and the class case was the one that mattered here.',
    'The scan proves a name resolves, not that it resolves to the same body the source bound (the same-name trap is Q-089; body identity is what the block ledgers and the byte-identity verifier cover).',
  ],
  next_package: [
    'the `ui.status` floor (`LWt` → `Vyt`, the session-bound plugin-status registry) and the `ui.log` floor (`Pzo`/`$2e`/`Yb`; `mce` is already carried)',
    "Q-086's 15 registry-reading cores and their 34 sites",
    'a streaming provider through the loader path (a plugin file whose module declares `streamLinks`)',
  ],
};
write('research/ports/W45-scan-evidence.json', JSON.stringify(evidence, null, 1) + '\n');

// CURRENT: the package row above the W45-22 one.
const current = read('research/CURRENT.md');
const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-15最新**：W45-23 **拷贝缺口检查器改为作用域感知，并关掉它一直藏着的三个真缺口**。缺陷：\`source-undeclared-scan.mjs\` 把**任意深度**的声明都算进同一个集合，压缩正文里到处复用的短名（参数、循环变量、局部）于是互相顶替——W45-22 的 \`a8\` 因此漏报（编译驱动先抛 \`ReferenceError\`）。重写为作用域链（模块/函数/块）+ 提升 + 逐引用解析（\`var\`/函数声明提到函数作用域，\`let\`/\`const\`/\`class\` 留在块，参数属函数，class 表达式名只活在自身），并修两类误报：class 声明/表达式原先完全不绑定（\`He\`/\`Gde\`/\`Ye\`/\`Hht\`/\`bN\` 被当成自由名），以及 \`// @ts-nocheck\` 整行删除导致行号整体偏移 1。**改后全量扫描 24 份拷贝，找出并关掉三处真缺口**：流式副本的 \`ep\`（\"failed closed: its .catch answered\"，44 单位）与 \`z3e\`（1000ms catch 宽限，13 单位）——皆在 runner 副本内、仅 \`.catch\` 路径可达，此前无测试驱动；runner 副本的 \`x\`（\`WMt\` 在无 \`Buffer\` 时的 \`fromCharCode\` 回退，205 单位）——与其唯一调用者同模块，按新块 chunk-ax7r0qj7.js [1645,1850) 搬入并导出。回归：\`test/source-undeclared-scan.test.ts\` 11 个夹具（含旧语义必过的 \`a8\` 形状、class、块作用域、提升、遮蔽、属性位、死分支）。验收：check/build/notices、24 计划逐字节一致、24 份拷贝未声明 0、聚焦 2/2、链测试 69/69、全量 **1325/1325**、十四个编译驱动 exit 0、打包冒烟 0 上游请求；身份 \`fead7541…\`。 | [扫描证据](ports/W45-scan-evidence.json)、[流式证据](ports/W45-stream-call-evidence.json)、[工作包](ports/W45-chain-runner.md) |`;
const anchor = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(anchor);
if (at < 0) throw new Error('C-12 row not found');
write('research/CURRENT.md', current.slice(0, at) + row + '\n' + current.slice(at));

// FEATURES: the Lifecycle hooks row's last cell gains the gap closure.
const features = read('research/FEATURES.md');
const lines = features.split('\n');
const featureLine = lines.findIndex((l) => l.startsWith('| Lifecycle hooks | Partial |'));
if (featureLine < 0) throw new Error('Lifecycle hooks row not found');
const rowText = lines[featureLine];
const lastPipe = rowText.lastIndexOf('|');
lines[featureLine] = rowText.slice(0, lastPipe).replace(/\s+$/, '') +
  ', and the copy-gap scan that guards those copies is now scope-aware (W45-23): it resolves every reference against the scope chain instead of a file-wide name set, which closed three latent gaps (`a8`, `ep`/`z3e` in the streaming copy and `x` in the runner copy, all reachable only on paths no test had driven) |';
write('research/FEATURES.md', lines.join('\n'));

// question.md: Q-091, appended at the end of the file's question list.
const question = read('research/question.md');
const q091 = `
### Q-091 拷贝缺口检查器把嵌套局部声明计为已声明（W45-22 的 \`a8\` 漏报）

W45-22 的流式副本引用 \`a8\` 而没有任何块声明它，\`node scripts/source-undeclared-scan.mjs src/plugin-chain-stream-source.ts\` 却报 \`unresolved 0\`；\`.audit/w45-22-compiled.mjs\` 首次运行即抛 \`ReferenceError: a8 is not defined\`。原因在检查器自身：它把**任意深度**的 \`VariableDeclarator\`、函数名、**每个函数参数**与 \`Property.value\` 都并进一个文件级 \`declared\` 集合，压缩正文里短名到处复用，于是某函数内的 \`let a8\` 顶替了另一函数里的自由 \`a8\`。检查器是绿的，语义从未被测过。

处置：重写为作用域链（模块/函数/块）＋提升＋逐引用解析，并修两处同时存在的误报——class 声明/表达式原先完全不绑定（\`He\`/\`Gde\`/\`Ye\`/\`Hht\`/\`bN\` 被读成自由名），以及删除 \`// @ts-nocheck\` 整行导致报告行号相对磁盘文件偏移 1（改为原位注释掉）。改后重扫 24 份拷贝，找出三处真缺口并关掉：流式副本 \`ep\`/\`z3e\`（仅在阶段 \`.catch\` 路径可达）、runner 副本 \`x\`（\`WMt\` 无 \`Buffer\` 分支）。回归 \`test/source-undeclared-scan.test.ts\` 11 夹具，其中 \`a8\` 形状是**旧语义必过**的那条。分类 S-7。
`;
write('research/question.md', question.replace(/\n?$/, '\n') + q091);

// STATUS: the package paragraph above the W45-22 one.
const status = read('research/STATUS.md');
const statusAt = status.indexOf('W45-22: the streaming half');
if (statusAt < 0) throw new Error('STATUS W45-22 paragraph not found');
const statusLineStart = status.lastIndexOf('\n', statusAt) + 1;
const statusEntry = `W45-23: the copy-gap scan (scripts/source-undeclared-scan.mjs) is scope-aware. It used to count every declaration at any depth as file-wide, so a local inside one copied function satisfied a free name in another — which is how W45-22 shipped an undeclared \`a8\` behind a green scan. Resolving references against a scope chain surfaced three real gaps (\`a8\`, \`ep\`/\`z3e\` in the streaming copy, \`x\` in the runner copy), each closed by plan edits rather than by copying a body twice, and two false-positive classes (class declarations, an off-by-one from stripping the pragma line). Evidence: \`research/ports/W45-scan-evidence.json\`, and
[工作包](ports/W45-chain-runner.md).

`;
write('research/STATUS.md', status.slice(0, statusLineStart) + statusEntry + status.slice(statusLineStart));

// coding-standard: the dated review line above the W45-22 one.
const standard = read('research/coding-standard.md');
const standardAt = standard.indexOf('2026-10-15 W45-22 ');
if (standardAt < 0) throw new Error('coding-standard W45-22 line not found');
const standardEntry = `2026-10-15 W45-23 拷贝缺口检查器改造复查：S-1至S-7已对照。S-7 在本包指向**检查工具自身**：一个绿的检查器不等于正确的检查器——旧 \`source-undeclared-scan.mjs\` 把任意深度的声明并成一个文件级集合，压缩正文的短名互顶，\`a8\` 因此漏报而无人察觉；因此本包的回归第一条就写成「旧语义必过」的形状（一个函数里的局部、另一个函数里的自由名），并要求报告行号与磁盘文件一致（\`@ts-nocheck\` 由删除改为原位注释掉）。改造过程自身也暴露这类误报：class 声明/表达式原先完全不绑定（\`He\`/\`Gde\`/\`Ye\`/\`Hht\`/\`bN\` 读成自由名），修好后才看清三处**真**缺口——\`ep\`/\`z3e\`（仅 \`.catch\` 路径可达，无测试驱动）与 \`x\`（无 \`Buffer\` 的浏览器分支）。三处都按既有纪律关闭：\`x\` 与其唯一调用者同模块（新块 [1645,1850)）、\`ep\`/\`z3e\` 扩大既有副本导出，不重复搬正文。验收：check/build/notices、24 计划逐字节一致、24 份拷贝未声明 0、聚焦 2/2、链测试 69/69、全量 1325/1325、十四个编译驱动、打包冒烟 0 上游请求。\n`;
write('research/coding-standard.md', standard.slice(0, standardAt) + standardEntry + standard.slice(standardAt));

// runner.md: the package section.
const runner = read('research/ports/W45-chain-runner.md');
write('research/ports/W45-chain-runner.md', runner.replace(/\n?$/, '\n') + `
## W45-23 made the copy-gap scan scope-aware, and closed what it had hidden (2026-10-15)

The scan that guards every generated copy reported \`unresolved 0\` for a file that referenced an
undeclared \`a8\`. Its pass 1 collected declarations from every depth into one set, and minified bodies
reuse short names as parameters and loop bindings everywhere, so one function's local covered another
function's free name. References now resolve against a scope chain (module, function, block): \`var\` and
function declarations hoist into their function, \`let\`/\`const\`/\`class\` stay in their block, parameters
belong to their function, and a class expression's name lives only inside its body. The pragma line is
neutralised in place so reported lines match the file on disk.

Two false-positive classes had to be fixed on the way (class declarations were not bound at all, so the
copied error classes \`He\`/\`Gde\`/\`Ye\`/\`Hht\`/\`bN\` read as free names), and with those out of the way three
real gaps remained:

- \`a8\` in the streaming copy: the stage's \`plugin: e.isCore === !0 ? a8 : e.name\` reads the runner
  copy's \`var a8 = "engine"\`.
- \`ep\` (44 units) and \`z3e\` (13 units) in the streaming copy: the "failed closed: its .catch answered"
  effect text and the catch grace, both declared in runner ranges and reachable only through the
  stage's \`.catch\` path.
- \`x\` in the runner copy: the \`fromCharCode\` chunker \`WMt\` falls back to when \`Buffer\` is absent, copied
  as a new block from the module its only caller lives in (chunk-ax7r0qj7.js [1645,1850)).

Each was closed by plan edits and regeneration, with no body copied twice. Verified: check/build/notices,
24 plans byte-identical, every one of the 24 copies \`unresolved 0\`, the new regression file 2/2 over 11
fixtures (the first being the shape the old semantics passed), chain files 69/69, full 1325/1325, all
fourteen compiled drivers, and the packaged smoke with zero upstream requests. Identity \`fead7541…\`.
`);

const rows = [
  ['2026-10-16T04:05:00Z', 'defect', '拷贝缺口检查器语义错误：嵌套局部声明被当成文件级声明（`a8` 漏报）→ 改作用域感知',
    'scripts/source-undeclared-scan.mjs 把任意深度的 VariableDeclarator/函数名/参数/Property.value 并进一个 declared 集合；压缩短名互顶使 `a8`、`ep`/`z3e`、`x` 三处真缺口全绿',
    '重写为作用域链 + 提升 + 逐引用解析；修 class 未绑定与 pragma 删行导致的行号偏移；24 份拷贝重扫，三缺口按计划编辑关闭（新增 chunk-ax7r0qj7.js [1645,1850) 块、runner 导出 x/ep/z3e、流式副本改 import）',
    '记录 research/ports/W45-scan-evidence.json；新增 test/source-undeclared-scan.test.ts（11 夹具，含旧语义必过的 a8 形状）'],
  ['2026-10-16T04:14:00Z', 'verification', 'W45-23 验收：24 份拷贝未声明 0、1325/1325、打包 0 上游请求',
    '检查器与三处缺口的修复',
    'check/build/notices；verify-chain-copies passed true（24 plans）；24 份拷贝 unresolved 0；聚焦 2/2 与链测试 69/69；全量 1325/1325；十四个编译驱动 exit 0；smoke-package（222 files, upstreamRequests 0）',
    '身份 fead7541…（inputs 1382d80b / 305，validation c3b3bf20 / 121，build 4833ef1e / 214）'],
];
const tsv = read('.audit/w45-runtime.tsv');
const added = rows.filter(([t]) => !tsv.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) write('.audit/w45-runtime.tsv', tsv.replace(/\n?$/, '\n') + added + '\n');

const todo = read('.audit/w45-runtime.todo.md');
write('.audit/w45-runtime.todo.md', todo.replace(/\n?$/, '\n') + `
## W45-23 acceptance (2026-10-15)

- [x] **The defect is in the guard, not the copy.** Reproduced first: the compiled driver failed on \`a8\` while the scan was green, and the scan's own pass 1 is what let a local in one function cover another function.
- [x] **Scope rules stated and implemented.** \`var\`/function hoist to their function, \`let\`/\`const\`/\`class\` stay in their block, parameters belong to their function, class expression names are local to their body, and the pragma line is neutralised so line numbers match the file.
- [x] **The regression would have failed before.** The first fixture is the W45-22 shape (a local in one function, a free name in another) that the previous semantics reported as clean; five more cover hoisting, block scope, shadowing, property positions, classes and the dead-branch shape.
- [x] **False positives removed before trusting the findings.** Class declarations and expressions are bound; without that, five copied error classes read as free names.
- [x] **Every finding classified.** Three real gaps, closed by plan edits (a new block for \`x\` from its own module, exports for \`ep\`/\`z3e\`), and none by copying a body twice.
- [x] **Sweep.** check/build/notices, 24 byte-identical plans, 24 copies \`unresolved 0\`, focused 2/2, chain 69/69, full 1325/1325, fourteen compiled drivers, packaged smoke with zero upstream requests.
`);
console.log('records written');
