import fs from 'node:fs';

const file = 'research/question.md';
const text = fs.readFileSync(file, 'utf8');
if (text.includes('W45-17 收窄')) {
  console.log('already present');
  process.exit(0);
}
const anchor = '本条**未完**：`classic.PostToolBatch`、`classic.PermissionRequest`、`classic.PermissionDenied` 三名有 raise 可用但无产品调用点；`ui.*`/`env.*`/`state.*` 值事件不是经典事件，仍完全没有 raise。';
const index = text.indexOf(anchor);
if (index < 0) throw new Error('Q-088 anchor not found');
const addition = [
  '',
  '',
  '**W45-17 收窄**：`classic.PostToolBatch` 的产品调用点已落地，本包**无新搬运**（W45-16 已含整条 raise）：源自己的批站点是 `Hkn`（chunk-sfn1dbxq.js [3062957,3063491)），hook input 为 `{hook_event_name:"PostToolBatch", tool_calls}`，批内条目取自其调用者（chunk-5b2hxy2e.js [123669,124114)）构造的 `{tool_name, tool_input, tool_use_id, tool_response}`；与单个事件不同，批输入不带 `_X` 工具别名展开。同一条调用者给出规则与原句：回合已由工具结果终结时，批 block **只记录不施加**（`if(N.blockingError||N.preventContinuation) t("[end-turn] PostToolBatch block discarded …")`）。src/agent.ts 在原生 `PostToolBatch` 钩子旁 raise，上下文走该钩子自己的 `Hook context:` 消息。本条**未完**：`classic.PermissionRequest` 与 `classic.PermissionDenied` 由源的权限层（`dze`/`I9r`）raise、按 `permissionRequestResult`/`retry` 消费，本产品仍无调用点；`ui.*`/`env.*`/`state.*` 值事件仍完全没有 raise。',
].join('\n');
fs.writeFileSync(file, text.slice(0, index) + anchor + addition + text.slice(index + anchor.length));
console.log('question.md updated');
