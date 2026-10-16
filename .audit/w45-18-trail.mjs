import fs from 'node:fs';

const rows = [
  ['2026-10-15T23:10:00Z', 'source', '权限两侧站点先读源：PermissionRequest 的输入与它的消费者',
    '`dze` [3063858,3064190) 的输入是 `{hook_event_name:"PermissionRequest", tool_name, tool_input, permission_suggestions}`（无 `tool_use_id`），消费者 `sxr` [3317869,3319984) 读 `z.permissionRequestResult`：无该字段跳过、allow 取 `updatedInput??r`、deny 取 `message||"Permission denied by hook"`',
    'chunk-sfn1dbxq.js [3063858,3064190)、[3317869,3319984)；schema `aK` chunk-r2vtj1kh.js [192753,192908)',
    'src/agent.ts 在原生 `PermissionRequest` 钩子之后 raise，答案并入同一条审批路径'],
  ['2026-10-15T23:14:00Z', 'measurement', 'PermissionDenied 的唯一调用者门在自动模式分类器：本包初稿的每-deny-raise 是自造',
    '`if(tn.decisionReason?.type==="classifier"&&tn.decisionReason.classifier==="auto-mode"){for await(let Cr of I9r(...)) if(Cr.retry) gr=!0}` 且源自己的分类 `mze` 把规则拒绝/用户拒答记为 `permission-rule`/`user-rejected`',
    '.audit/w45-18-slice.mjs；chunk-sfn1dbxq.js [2288685,2289127)、[1006956,1007251)、[3063491,3063858)',
    '撤掉两处 deny 上的 raise 调用；事件名与输入形状改记在 src/agent.ts 拒绝路径旁；回归锁死处理器调用数 0'],
  ['2026-10-15T23:18:00Z', 'measurement', '顺带校出 W45-16 漏发的 `duration_ms`',
    '源描述「Tool execution time in milliseconds. Excludes permission-prompt and hook time.」声明在两个 post 事件上；实测睡眠 12ms 的工具读出 13',
    '.audit/w45-18-probe.mts；chunk-r2vtj1kh.js [193030,193147)；`Okn`/`P9r` chunk-sfn1dbxq.js [3062119,3062552)/[3062552,3062957)',
    'src/agent.ts 只包工具自身调用计时（`try/finally` 于 `execute`/`executeBlocks`），随 hook input 发送'],
  ['2026-10-15T23:22:00Z', 'measurement', '审批路径四条臂实测先于断言',
    'allow → 提问 0 次且工具原样跑；allow+`updatedInput` → 跑在改写上；deny+message → 原文成为错误文本；deny 无 message → 源消费者兜底 `"Permission denied by hook"`；无模块挂钩时基线提问 1 次',
    '.audit/w45-18-probe.mts；test/plugin-chain-permission.test.ts',
    '断言以提问次数与工具结果文本为观测量，未用内部状态'],
  ['2026-10-15T23:40:00Z', 'verification', 'W45-18 在来源、套件与编译产物上复核',
    '两个事件有真实消费者（权限路径）且答案语义可观测；拒绝侧以「不 raise」为断言',
    'test/plugin-chain-permission.test.ts 3/3；.audit/w45-18-compiled.mjs',
    'check/build/notices 通过；21 计划不变且逐字节一致；专项 24/24；全量 1317/1317；十二驱动 exit 0；W45PermissionCompiled.v1；身份 82806551…'],
];
const file = '.audit/w45-runtime.tsv';
const text = fs.readFileSync(file, 'utf8');
const added = rows.filter(([at]) => !text.includes(at)).map((row) => row.join('\t')).join('\n');
if (added) fs.writeFileSync(file, text.replace(/\n?$/, '\n') + added + '\n');
console.log('rows added', added ? added.split('\n').length : 0);
