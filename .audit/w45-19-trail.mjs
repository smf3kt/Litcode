import fs from 'node:fs';

const rows = [
  ['2026-10-15T23:58:00Z', 'source', '值事件的 raise 点找到了：是「模块→宿主」调用路径，不是经典 raise',
    '插件 `$` 的每个方法汇进一个 raiser（`r("ui.status",{text:...})`），宿主侧是 `Hze`（chunk-sfn1dbxq.js [1842591,1843388) 797 单位）：与经典 raise 同形（`P0`/`N5t`/`aP`/`aJ`），多 `bottom` 默认动作、答案读 `{value, deny}`；`bottom` 取自调用表，其 `run` 是一行（`lJt` [2343880,2343964)）',
    'chunk-sfn1dbxq.js [1842414,1843964)；chunk-nyce03br.js（`$` 构造与 `Ooe`/`Aws`/`tIt`）',
    '本产品无 `$` 对象、无调用表、无 `Hze`——这就是 Q-088 剩余项的确切形状'],
  ['2026-10-16T00:04:00Z', 'measurement', '闭包实测与同名冲突解析：按使用方模块的 import 表定向',
    '闭包收敛在约 2,128 单位 / 6 模块（`Hze` 797、`Cme` 177、`Ooe` 89、`Aws` 144、`tIt` 505、`YPn` 33、`TDe` 64、`Gt` 50、`Z$n` 60、`mlt` 29、`ls` 37、`Bt` 143）；`Hze` 触碰的其余名字已搬；`$2e` 属 `lJt` 不需搬',
    '.audit/w45-13-closure.mjs（种 `Hze`）；新工具 .audit/w45-import-map.mjs；.audit/w45-19-resolve.mjs',
    '`TDe` 在 chunk-24k7d6mw.js 有 525 单位冒名者、真身 chunk-n3ykh62m.js 64 单位；`Gt`/`Bt`/`ls`/`tIt` 各有数十个同名——按 import 表解析（Q-089 规则工具化）'],
  ['2026-10-16T00:10:00Z', 'scope', '本 tick 只交侦察，不半搬一条调用路径',
    '拷贝、缝与两处 raise（状态行 `events.status`、日志汇 `uiLogSink`）是一次完整的包；半途接上会让「站点可派发但无派发者」变成「有派发者但答案无处可去」',
    'research/ports/W45-host-call-recon.json；W45-chain-runner.md 的 W45-19 recon 节',
    '改记精确范围与冲突解析结果，下包一条命令起手；本 tick 未改产品行为'],
  ['2026-10-16T00:12:00Z', 'verification', '无产品改动的证明：身份与套件不变',
    '本 tick 只写 research/.audit，`src`/`test`/`scripts` 未动',
    'node scripts/identity.mjs',
    '身份仍 82806551…（inputs e3bd2e99 / 297，validation 53f9298f / 118，build 60a50e5e / 209），与 W45-18 收尾时逐字节一致'],
];
const file = '.audit/w45-runtime.tsv';
const text = fs.readFileSync(file, 'utf8');
const added = rows.filter(([at]) => !text.includes(at)).map((row) => row.join('\t')).join('\n');
if (added) fs.writeFileSync(file, text.replace(/\n?$/, '\n') + added + '\n');
console.log('rows added', added ? added.split('\n').length : 0);
