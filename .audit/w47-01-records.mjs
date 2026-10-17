// W47-01 record: the MCP lifecycle row is a closed decision, not a pending port. The four items in
// the C-3 row already have verified coordinates and dispositions in remaining-dispositions.md; this
// package reconciles CURRENT and FEATURES with that record and adds the decision evidence.
import fs from 'node:fs';
import crypto from 'node:crypto';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, text) => fs.writeFileSync(path, text);

const oldRow = '| C-3 | MCP 生命周期 | 自动下一轮重 dial 调度（原文默认关闭）、`subscriptions/listen` parked refetch 流、流断开期间的更新只到 stale-known、图像输出与完整像素解码 | MCP transports/catalogs；MCP resource subscriptions |';
const newRow = '| C-3 | MCP 生命周期 | 已结案（决定记录，非待移植）：① 自动下一轮重 dial 原文默认关闭，本运行时以有界快速/慢速重试 + 显式重连 + stdio 下次使用重拨取代；② subscriptions/listen parked refetch 绑定本运行时不实现的 listen 流，替换后刷新与 dirty-at-use 已覆盖；③ 断流期间丢失的更新在原文同样不可恢复，本运行时按 stale-known 报告，恢复走事件 ID GET 流；④ 完整像素解码需 Bun.Image 编解码器，本项目保留尺寸/体积上限与超限标注。依据 remaining-dispositions.md 第 1/2/5/7 节 | MCP transports/catalogs；MCP resource subscriptions；[决定](ports/remaining-dispositions.md) |';
const current = read('research/CURRENT.md');
const rows = current.split(oldRow).length - 1;
if (rows === 3) write('research/CURRENT.md', current.split(oldRow).join(newRow));
else if (!current.includes('已结案（决定记录，非待移植）')) throw new Error(`CURRENT holds ${rows} of the C-3 row`);

const oldGap = 'Automatic next-turn redial scheduling (recovered default off) and the subscriptions/listen parked-refetch stream remain gaps; ports/W05-tasks.md; ports/W05-persistence.md.';
const newGap = 'Automatic next-turn redial scheduling (recovered default off) and the subscriptions/listen parked-refetch stream are decided rather than pending: bounded recovery plus explicit reconnect supersedes the former, the latter is bound to a transport this runtime does not implement and its guarantee is covered by refresh-on-replacement and dirty-at-use, lost updates stay stale-known with the event-id GET resume path, and full pixel decoding keeps the size/byte caps and over-target annotation; ports/remaining-dispositions.md items 1/2/5/7.';
const features = read('research/FEATURES.md');
const gaps = features.split(oldGap).length - 1;
if (gaps !== 1) throw new Error(`FEATURES holds ${gaps} of the MCP gap sentence`);
write('research/FEATURES.md', features.replace(oldGap, newGap));

write('research/STATUS.md', read('research/STATUS.md').replace(/\n+$/, '\n') + `
W47-01 closes the MCP lifecycle row as a decision rather than a port. The four listed items already had verified coordinates and dispositions: next-turn background redial is off by default upstream and is superseded by this runtime's bounded recovery, explicit reconnect and stdio next-use re-dial; the parked refetch is driven by a \`subscriptions/listen\` stream this runtime does not implement, and refresh-on-replacement plus dirty-at-use cover the guarantee; an update lost while the stream is down is unrecoverable upstream too, so it is reported stale-known with the event-id GET resume path; full pixel decoding needs the Bun.Image codec this project does not carry, so the size/byte caps and over-target annotation stay. CURRENT and FEATURES now cite [remaining-dispositions.md](ports/remaining-dispositions.md) items 1/2/5/7 instead of listing the items as gaps. No behavior changed and no recovered entrypoint ran.
`);

write('research/coding-standard.md', read('research/coding-standard.md').replace(/\n+$/, '\n') + `
2026-10-17 W47-01 MCP 生命周期结案：S-1（先读源）：四项均引用 remaining-dispositions.md 中已核验的坐标与运行时等价机制，未新增未读源声明。S-2（不臆造）：原文默认关闭的重拨调度、绑定未实现 listen 流的 parked refetch、协议无重放依据的丢失更新、需 Bun.Image 的像素解码，均以决定记录结案而非近似实现。S-3/S-4：无产品行为变更，无需新测试。S-5/S-6：无新增依赖。S-7（记录）：CURRENT 三处重复行与 FEATURES 行改为引用决定记录；本包不执行恢复入口点。
`);

const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const evidence = {
  schema: 'W47McpDispositionsEvidence.v1',
  package: 'W47-01 — MCP lifecycle row closed as a decision',
  date: '2026-10-17',
  question: 'Are the four MCP lifecycle items in C-3 pending ports, or already-decided dispositions?',
  answer: 'Already decided with verified coordinates. The items were still listed as gaps in CURRENT and FEATURES; this package reconciles both with remaining-dispositions.md and records no behavior change.',
  items: [
    {
      item: 'automatic next-turn background redial (source default off)',
      disposition: 'superseded',
      runtimeEquivalent: 'bounded fast/slow retry (src/mcp-retry.ts), explicit /mcp-reconnect, stdio next-use re-dial under features.mcpRecovery (ports/W05-stdio-redial.md)',
      evidence: 'remaining-dispositions.md item 1; chunk-rx2nah4x.js [388228,388266) and [388374,388505)',
    },
    {
      item: 'subscriptions/listen parked refetch stream',
      disposition: 'no transport basis',
      runtimeEquivalent: 'refresh-on-replacement plus dirty-at-use and the immediate tools/list_changed refetch (ports/W05-list-changed-refetch.md)',
      evidence: 'remaining-dispositions.md item 2; chunk-sb190ksj.js [47894,48515) and [50368,50405); chunk-2rxk8n7w.js [5632,5983)',
    },
    {
      item: 'updates lost while the stream is down reported stale-known',
      disposition: 'no protocol or source basis for replay',
      runtimeEquivalent: 'event-id GET resume (ports/W05-get-resume.md), journaled acknowledgement restore (ports/W05-persistence.md), re-read on the next resources/read',
      evidence: 'remaining-dispositions.md item 7; chunk-2rxk8n7w.js [6059,6126)',
    },
    {
      item: 'image output and full pixel decoding',
      disposition: 'no portable codec',
      runtimeEquivalent: '2000x2000 / base64 5242880 / raw 3932160 caps with the over-target annotation (ports/W05-image-limits.md)',
      evidence: 'remaining-dispositions.md item 5',
    },
  ],
  changes: [
    { file: 'research/CURRENT.md', change: 'three identical C-3 rows replaced with the decided row and the disposition link', sha256: sha(read('research/CURRENT.md')) },
    { file: 'research/FEATURES.md', change: 'the MCP transports/catalogs row stops calling the two items gaps and names the decisions', sha256: sha(read('research/FEATURES.md')) },
    { file: 'research/STATUS.md', change: 'W47-01 entry', sha256: sha(read('research/STATUS.md')) },
  ],
  noBehaviorChange: true,
  recoveredEntrypointsExecuted: false,
  next: 'C-4 (recovery and crash boundaries) is the next row; C-1 remains blocked on the user-owned A-1 decision.',
};
write('research/ports/W47-mcp-dispositions-evidence.json', JSON.stringify(evidence, null, 1) + '\n');
console.log('record ok');
