import fs from 'node:fs';

const recon = {
  schema: 'W45StreamRecon.v1',
  package: 'W45-21 reconnaissance: the streaming half of the module-to-host call path (not landed)',
  date: '2026-10-15',
  question: "W45-20 carried `Hze`, the value events' call raiser. Its sibling `aGe` raises the streaming calls (`streamOps`: model.complete, audio.speak, session.send, …). What does carrying it cost, and where does the product raise it?",
  finding: '`aGe` is the streaming twin of `Hze`: same wait gate (`N5t`) and same handler collection, but a streaming dispatch (`iwr`), a stream-relaying bottom (`bottom.stream(args, caller)` plus its `check`), and a withheld-result note (`tzt`) that says whether a plugin swallowed the stream. Its callers are the streaming plugin-call dispatcher (`Iye`, chunk-sfn1dbxq.js [2356982,2357180)), which reads the streaming call table off the plugin `$` surface — the same absent surface `Hze` waits on, so this product again gets the seam and no call site yet.',
  coordinates: {
    entry: "`aGe` chunk-sfn1dbxq.js [1843556,1844317) 761 units; `tzt` (the withheld-result texts) and `ezt` (the await-then-stream retry) sit just above it, [1843388,1843556) and [1843388,1843437)",
    seeds: [
      'chunk-sfn1dbxq.js:1843388-1844317 (tzt, ezt, aGe) 929',
      'chunk-2kdsvp3x.js:39971-40188 (has) 217',
      'chunk-nyce03br.js:155938-156519 (iwr) 580',
      'chunk-nyce03br.js:148007-148246 (tRe) 239',
    ],
    caller: '`Iye` chunk-sfn1dbxq.js [2356982,2357180): `let h = e.streamOps[n]; Sme(e, {spelling:n, caller:s, isClock:!1}); let y = h.check?.(r,s); …; return aGe({event:n, args:r, caller:s, ...!sIt() && {bottom:h}})` — the streaming twin of `Ot`.',
  },
  measurement: {
    method: "`.audit/w45-13-closure.mjs` over the four seeds, then a body-level classification: each proposed block's exact source text is searched in src/*.ts, so a body the product already carries under another module's coordinate counts as carried (the walker matches by module+range, which the bundle's repeated names make unreliable).",
    proposed: { blocks: 43, units: 16216 },
    already_carried: {
      blocks: 23,
      units: 4479,
      product_file: 'src/plugin-chain-records.ts (every one of them)',
      names: ['se 163', 'Gt 99', 'oOn 28', 'q 242', 'Apr 155', 'Cpr 41', 'J 386', 'ke 31', 'xe 82', 'Re 34', 'Fe 34', 'We 66', 'M5t 44', 'tCt 44', 'Q 555', 'Qe 14', 'kro 229', 'nt 293', 'jDe 292', 'tt 447 (the same body under the carried record layer)', 'st 343', 'Se 132', 'xpr 90'],
      note: 'the record layer the streaming bodies read (P0/jDe/aJ/M5t/rt and the tier rules) is the same in both halves, so it is imported, not copied again.',
    },
    new_copy: {
      blocks: 20,
      units: 11713,
      false_positives: [
        'chunk-sfn1dbxq.js [2700992,2701040) 48 — the walker read the property name `ran` (`w = "ran"`) as a free name and pulled a top-level `ran`; accounted for, not copied.',
        'chunk-sfn1dbxq.js [2700894,2700909) 15 — `mmr`, pulled in by the same false positive.',
      ],
      bodies: [
        'chunk-nyce03br.js $6 [147445,147805) 360 — the generator-run wrapper',
        'chunk-nyce03br.js wt [147805,148007) 202',
        'chunk-nyce03br.js tRe [148007,148246) 239 — the stream relay: marks `started` and passes each chunk on',
        'chunk-nyce03br.js Ep [148246,148378) 132',
        'chunk-nyce03br.js bp [148378,148449) 71 — the stream state initializer',
        'chunk-nyce03br.js Sp [148449,149176) 727 — the stream reader (`readOn`, carry, away, onChunk)',
        'chunk-nyce03br.js Ts [149176,149508) 332',
        'chunk-nyce03br.js Jx [149508,155211) 5703 — the streaming stage, the twin of `dx` (per-handler budget, cut, abort linking, the yielded trail)',
        'chunk-nyce03br.js vp [155211,155418) 207',
        'chunk-nyce03br.js Ap [155418,155655) 237 — the streaming handler fold, the twin of `fx`',
        'chunk-nyce03br.js Rp [155655,155939) 284 — the streaming seat count/core seat',
        'chunk-nyce03br.js iwr [155939,156519) 580 — the streaming executor, the twin of `aP`',
        'chunk-2kdsvp3x.js et [35397,35875) 478',
        'chunk-2kdsvp3x.js _o [35875,36398) 523 — the streaming record builder, the twin of `rt`',
        'chunk-2kdsvp3x.js ct [39563,39972) 409 — the streaming handler record, the twin of `P0`',
        'chunk-2kdsvp3x.js has [39971,40188) 217 — the streaming handler collector, the twin of `P0` (reads `streamLinks` and `_o`)',
        'chunk-2kdsvp3x.js ft [39309,39328) 19 — the `streamLinks` branch',
        'chunk-sfn1dbxq.js tzt+ezt+aGe [1843388,1844317) 929',
      ],
      sizes: 'about 11,650 units over three modules (11,713 minus the two false positives).',
    },
  },
  seam_shape: [
    '`raiseStreamingHostCall({event, args, caller, bottom, raise?})` returning an async generator, mirroring `raiseHostCall`, with the bottom typed as `{check?, stream(args, caller)}`.',
    'The withheld-result texts are the source\'s (`tzt`: "" / " started, and a plugin withheld its result" / " ran, and a plugin withheld its result") and ride the denial message `${caller.plugin}: $.${event}${tzt[state]}: ${deny}`.',
    'The short circuit and the check mirror the value events\' (W45-20): no handlers and a floor means `bottom.stream(args, caller)` directly, and the floor\'s `check` refusal is `${event}: ${text} (host check)`.',
  ],
  imports_already_carried: '`N5t` (./plugin-chain-classic-raise-source.js), `He`/`Ooe`/`aJ`/`P0`/`Fgo`/`kSe`/`CFe`/`hlt`/`Gt`/`Nl`/`ze`/`fp` (./plugin-chain-source.js, ./plugin-chain-records.js), `tRe`\'s own dependencies, and `sIt` for the dispatcher\'s `!sIt()` clause.',
  next_package: [
    'emit the plan with `.audit/w45-13-closure.mjs` over the four seeds (minus the two false positives) and `--emit-plan research/ports/W45-stream-blocks.plan.json`',
    'generate `src/plugin-chain-stream-call-source.ts` and write the seam `raiseStreamingHostCall` in `src/plugin-chain-stream-call.ts`',
    'regressions: the streaming floor with and without a hooked module, a chunk-by-chunk relay with the withheld-result texts, and the denial message with its state suffix',
    'run the sweep and write the records (evidence JSON, W45-chain-runner section, CURRENT C-12, FEATURES, STATUS, Q-088, coding-standard, .audit, identity rebind)',
  ],
};
fs.writeFileSync('research/ports/W45-stream-recon.json', JSON.stringify(recon, null, 1) + '\n');

const row = `| C-12 | 插件链执行器 + 编辑中继（W45） | **2026-10-15最新**：W45-21 **侦察完成、未落地**——流式一半的「模块→宿主」调用路径（\`aGe\`，是 W45-20 的 \`Hze\` 的孪生：同一 \`N5t\` 等待门、流式派发 \`iwr\`、\`bottom.stream(args, caller)\` + \`check\`、吞流提示 \`tzt\`）。调用者同样是插件 \`$\` 面的流式派发器 \`Iye\`（chunk-sfn1dbxq.js [2356982,2357180)，读 \`e.streamOps[n]\`），故本产品同样只落缝、无调用点。**测清**：闭包提案 43 段 16,216 单位，按**正文**（而非模块+区间——bundle 同名重名使后者不可靠）分类后，**已搬 23 段 4,479 单位**（全在 src/plugin-chain-records.ts：\`se\`/\`Gt\`/\`oOn\`/\`q\`/\`Apr\`/\`Cpr\`/\`J\`/\`ke\`/\`xe\`/\`Re\`/\`Fe\`/\`We\`/\`M5t\`/\`tCt\`/\`Q\`/\`Qe\`/\`kro\`/\`nt\`/\`jDe\`/\`tt\`/\`st\`/\`Se\`/\`xpr\`），**真新缺 20 段 ≈11,650 单位 / 3 模块**（\`Jx\` 5,703＝\`dx\` 的流式孪生、\`iwr\` 580＝\`aP\` 的、\`Sp\` 727 流读取、\`Ap\` 237/\`Rp\` 284 折叠与核心位、\`$6\` 360/\`wt\` 202/\`tRe\` 239 流中继、\`Ts\` 332/\`vp\` 207/\`Ep\` 132/\`bp\` 71、\`_\`o 523＝\`rt\` 的流式孪生、\`ct\` 409＝\`P0\` 的、\`has\` 217 收集器、\`ft\` 19、\`tzt\`+\`ezt\`+\`aGe\` 929），其中 2 段（48+15）是属性名 \`ran\`/\`mmr\` 的假阳性。下一步：按 4 个种子出计划 → 生成 \`src/plugin-chain-stream-call-source.ts\` → 缝 \`raiseStreamingHostCall\` → 3 条回归 → 全套验证与记录。本 tick 无产品改动，身份仍 a3ea88c7…。 | [流式侦察](ports/W45-stream-recon.json)、[链执行器记录](ports/W45-chain-runner.md) |`;
const cf = 'research/CURRENT.md';
const current = fs.readFileSync(cf, 'utf8');
const marker = '| C-12 | 插件链执行器 + 编辑中继（W45） |';
const at = current.indexOf(marker);
if (at < 0) throw new Error('C-12 row not found');
fs.writeFileSync(cf, current.slice(0, at) + row + '\n' + current.slice(at));

const rows = [
  ['2026-10-16T02:02:00Z', 'recon', '流式 raise（`aGe`）的缺口按正文测清：真新缺约 11,650 单位 / 3 模块',
    '`aGe` [1843556,1844317) 761 是 `Hze` 的流式孪生（同 `N5t` 门、`iwr` 派发、`bottom.stream`+`check`、`tzt` 吞流提示）；调用者是流式派发器 `Iye` [2356982,2357180)（`e.streamOps[n]`），同属未搬的插件 `$` 面',
    '.audit/w45-13-closure.mjs（4 个种子）+ 正文级分类（提案 43 段 16,216 单位 → 已搬 23 段 4,479 全在 plugin-chain-records.ts；新 20 段 11,713，含 `ran`/`mmr` 两处属性名假阳性 48+15）',
    '记录 research/ports/W45-stream-recon.json（含 20 段逐名清单与 seam 形状）；本 tick 未改产品'],
  ['2026-10-16T02:10:00Z', 'verification', '无产品改动的证明：身份不变',
    '本 tick 只读源码与写 research/.audit',
    'node scripts/identity.mjs',
    '身份仍 a3ea88c7…（inputs 7593142b / 300，validation ed869d11 / 119，build b8178d5a / 211），与 W45-20 收尾一致'],
];
const tsv = '.audit/w45-runtime.tsv';
const text = fs.readFileSync(tsv, 'utf8');
const added = rows.filter(([t]) => !text.includes(t)).map((r) => r.join('\t')).join('\n');
if (added) fs.writeFileSync(tsv, text.replace(/\n?$/, '\n') + added + '\n');

const todo = '.audit/w45-runtime.todo.md';
fs.writeFileSync(todo, fs.readFileSync(todo, 'utf8').replace(/\n?$/, '\n') + `
## W45-21 reconnaissance acceptance (2026-10-15)

- [x] **Source first.** Read \`aGe\`'s body and its caller before measuring: \`aGe\` [1843556,1844317) with \`tzt\`/\`ezt\` above it, and \`Iye\` [2356982,2357180), the streaming dispatcher that reads \`e.streamOps[n]\` and hands \`aGe\` its \`bottom\`.
- [x] **Measure by body, not by module+range.** The walker proposes 43 blocks / 16,216 units, but the bundle repeats names across modules: every proposed body's exact text was searched in \`src/*.ts\`, which shows 23 blocks / 4,479 units are already carried (all in src/plugin-chain-records.ts) and the real gap is 20 blocks / 11,713 units, two of which are the \`ran\`/\`mmr\` property-name false positives.
- [x] **Name every new body.** The 20 are listed in the recon with their ranges and units, so the next package's copy is a mechanical step (\`Jx\` 5,703 is \`dx\`'s streaming twin, \`iwr\` 580 is \`aP\`'s, \`_\`o/\`ct\`/\`has\` are \`rt\`/\`P0\`'s, plus the stream relay \`\$6\`/\`wt\`/\`tRe\`/\`Sp\`/\`Ts\`/\`vp\`/\`Ep\`/\`bp\` and the fold \`Ap\`/\`Rp\`).
- [x] **No half-package.** The copy, the seam and the regressions are one package; this tick recorded the measurement only, so the next package starts from \`research/ports/W45-stream-recon.json\`.
- [x] **Proved nothing changed.** \`node scripts/identity.mjs\` still reports \`a3ea88c7…\` — this tick wrote only research and audit files.
- [x] **Indexes updated.** W45-stream-recon.json (new), CURRENT C-12, .audit/w45-runtime.tsv, this file.
`);
console.log('recon recorded');
