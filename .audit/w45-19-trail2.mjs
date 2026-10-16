import fs from 'node:fs';

const rows = [
  ['2026-10-16T00:30:00Z', 'correction', '两处按名字抓错了正文，靠读正文纠正',
    '`Z$n` 调 `Bt.has(...)`，而 v1 抓的 chunk-yjc18bey.js [1726,1869) 是 `Promise.race` 计时器、没有 `.has`；真身是 `Z$n` 同模块的 chunk-m4qpskd4.js [47631,47716) 85 单位（`new Set(J3e.filter(...))`，目录点名的前缀集）。`YPn` 调 `ls.run`，而 v1 抓的 chunk-bk5ct2gw.js [482789,482826) 只有一个字符串返回；真身是 `YPn` 同模块的 chunk-n3ykh62m.js [232741,232755) 14 单位（`var ls=new jD`，`jD` 是该模块从 `async_hooks` 导入的 `AsyncLocalStorage`）',
    '.audit/w45-import-map.mjs 定向 + 逐条读正文；research/ports/W45-host-call-recon.json 的 `corrections`（schema v2）',
    '教训入 coding-standard：名字解析只是候选，正文的调用形状才是否决权；产品已有一个 `AsyncLocalStorage` 实例（`Ve`），第二个实例按源的同名用法搬'],
  ['2026-10-16T00:34:00Z', 'measurement', '第二遍实测：真正常缺的是约 1,970 单位 / 3 模块，且本包退掉一个占位',
    '新增拷贝 `Cme` 177、`Hze` 797、`tIt` 505、well-formed 语句 393、`Yc`/`hf` 110、`ls` 14、`YPn` 33、`TDe` 64、`U$n` 27、预算常量 35；`zd`/`$be`/`Ooe`/`Aws`/`fo`/`zt`/`$A`/`J3e`/`Bt`/`Gt`/`Z$n`/`mlt`/`aP`/`P0`/`N5t`/`aJ`/`He`/`L`/`se` 本产品已有，`$2e` 不必搬。`U$n` 不需改写：正文就是 `Yc(e)?e:hf(e)`，而 `l`/`g` 在运行时自带 `isWellFormed`/`toWellFormed` 时绑原生方法、否则走自带正则兜底',
    'chunk-nyce03br.js（`tIt`/`U$n`/三常量）、chunk-ax7r0qj7.js（well-formed 语句 393 单位含 `m`/`a` 与 `l`/`g` 的原生绑定）、chunk-sfn1dbxq.js（`Cme`/`Hze`）',
    '`Hze` 把 `TDe` 放在全部 12 个 `Cme` 名字的路径上（`let _e = z ? TDe(he) : he`），故 `tIt` 随本包搬入、src/plugin-chain-host.ts:332 的「原样返回」占位撤掉'],
];

const file = '.audit/w45-runtime.tsv';
const text = fs.readFileSync(file, 'utf8');
const added = rows.filter(([at]) => !text.includes(at)).map((row) => row.join('\t')).join('\n');
if (added) fs.writeFileSync(file, text.replace(/\n?$/, '\n') + added + '\n');
console.log('rows added', added ? added.split('\n').length : 0);
