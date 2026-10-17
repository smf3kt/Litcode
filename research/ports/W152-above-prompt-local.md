# W152 AbovePrompt 本地状态与会话/应用状态上下文（C-2 第八片）

日期：2026-10-18。范围：AbovePrompt 本地状态七段（`vp`/`IV`/`q1`/`tK`/`cK`/`Ine`/`Z1`）及其所需的会话上下文与 AppState 读取层。`_Fe`/`RFe` 的测量与渲染链因闭包过大转入 W157（见文末）。

## 来源身份

| 产物 | 模块 | SHA-256 | 块 | 单位 |
| --- | --- | --- | ---: | ---: |
| `src/plugin-chain-session-context-source.ts` | `chunk-z6yhgx3x.js`, `chunk-4bw62nzm.js` | `3dca9fb5…`（z6yhgx3x） | 4 | 1,880 |
| `src/plugin-chain-app-state-source.ts` | `chunk-7n39kxwj.js` | 见账本 | 2 | 225 |
| `src/plugin-chain-above-prompt-local-source.ts` | `chunk-24k7d6mw.js`, `chunk-sxm1dh4y.js`, `chunk-4bw62nzm.js`, `chunk-sfn1dbxq.js` | `1d064454…`（24k7d6mw） | 15 | 1,717 |
| 合计 | | | 21 | 3,822 |

精确模块摘要以各 `-source-blocks.json` 账本为准；坐标均为零基 UTF-16 半开区间。

### 会话上下文（4 块 1,880 单位）

- `chunk-z6yhgx3x.js [817,2504)` 1,687u：`l`/`d`/`P` 三上下文与 no-op 退订 `j`（[817,867) 50u）、`$3n` SessionProvider（[867,1334) 467u）、`U3n` HostProjectProvider（[1334,1678) 344u）、`is` useHost（151u）、`sv` useProject（178u）、`hC` 原始会话读取（35u）、`$r` useSession（206u）、`v` useStore（256u）。
- `chunk-4bw62nzm.js [52926,52959)` 33u `an` 错误名、`[52959,53053)` 94u `GP`（project 为 null 时抛 `NoProjectDirectoryError`）、`[53128,53194)` 66u `So`。

语义：`useSession` 返回会话对象本身；`useProject` 读取 SessionProvider 写入 project 上下文的快照 `{subscribe,get:()=>So(session)}`，`get()` 在 project 为 null 时抛错；`useStore` 以 `Rt(subscribe,getSnapshot)` 订阅外部 store 并可套 selector。

### AppState 读取（2 块 225 单位）

- `chunk-7n39kxwj.js [768,810)` 42u：`sx`/`l4n`/`c4n` 三个上下文 token。
- `[1239,1422)` 183u：`t` 读取 AppState 上下文（缺失时抛 `useAppState/useSetAppState cannot be called outside of an <AppStateProvider />`）与 `V` 的 selector 形式（经 `Re` 订阅 `getSnapshot`）。

### AbovePrompt 本地状态（15 块 1,717 单位）

| 名称 | 语义 | 来源范围 |
| --- | --- | --- |
| `vp` | 当前会话的草稿 store hook（`oI($r())`） | 24k7d6mw `[299367,299397)` 30u |
| `IV` | 草稿文本，长度 >1 时返回 `[longer input]` | `[299493,299598)` 105u |
| `KCt` | 长输入标记 | `[299468,299493)` 25u |
| `Z1` | settledBudget store（`set` 清为 undefined） | `[450435,450470)` 35u |
| `Pne` | 按键文本→绑定表，任一字符缺失即返回 `[]` | `[450686,450848)` 162u |
| `tK` | 渲染前按键处理器注册（`Ey`） | `[450848,450963)` 115u |
| `cK` | 非空索引达到偏移时释放 | `[453589,453644)` 55u |
| `Ine` | 草稿文本变化时释放 | `[453648,453782)` 134u |
| `AFe` | 被查看任务的 agent id | `[447122,447223)` 101u |
| `q1` | `{}` 或 `{agentId}` 的 memo | `[447223,447294)` 71u |
| `Att` | local_agent / in_process_teammate 任务摘要 | sfn1dbxq `[1699480,1699936)` 456u |
| `p`/`a`/`oI` | 草稿初值、按会话 root 弱键的 store 注册表、查找 | sxm1dh4y `[709,865)` 156u、`[865,887)` 22u、`[887,917)` 30u |
| `lt` | 弱键 store 注册表类 | 4bw62nzm `[56759,56979)` 220u |

复用（不复制）：hook seam（`P`/`R`/`Z`/`Rt`）、`Ge`/`bs`、`Ey`（client-host-source）、`TIe`（press-dispatch）、`gs`（registry-stores-source）、`k0`（W150）。

## 测试

`test/plugin-chain-session-context.test.ts`（7）、`test/plugin-chain-app-state.test.ts`（4）、`test/plugin-chain-above-prompt-local.test.ts`（13），共 24 项：

- Provider 元素链（session→host→project）、project 快照与 null project 的 `NoProjectDirectoryError`、provider 外的 useSession/useHost 错误、useProject selector、useStore 订阅与清理；
- AppState 三 token 互异、整体读取、selector、provider 外抛错；
- 草稿 store 按 root 去重与初值、`useSessionDraftStore`、`IV` 的 0/1/多字符分支、`AFe`/`Att` 两种任务映射、`q1` 的 `{agentId}`/`{}`、settledBudget 清零、`Pne` 的 NFKC+小写与全有或全无、`tK` 注册/不激活/卸载、`cK` 三种索引、`Ine` 订阅与值变化释放。

生成顺序注意：`lt` 类必须排在 `var a=new lt(...)` 之前，否则模块初始化触发 TDZ（`Cannot access 'lt' before initialization`）；计划里已把 `lt` 块置首。

## 门禁与身份

聚焦 24/24；全量 2354/2354；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；身份 `97360dc73e9aadc92b004d6f2cf466085304c3c8e791344929986d4534602a79`（inputs 582 / validation 206 / build 401）。审计件：`.audit/w152-probe.plan.json`、`.audit/w152a-probe.plan.json`、`.audit/w152-session.plan.json`、`.audit/w152-appstate.plan.json`、`.audit/w152-*.txt`。

## 转入 W157：`_Fe`/`RFe`

`_Fe`（`AZ` 计数）与 `RFe`（渲染宿主）的闭包已测量但不在本包移植：

- `AZ [126611,126843)` 232u 依赖 `QO`、`uq`、`gbt [126204,126611)` 407u、`pbt [124336,126011)` 1,675u 及约 25 个滚轮常量；
- `gbt` 的 `hs` 设置 hook 链为 `chunk-js2bhabe.js [1114,1499)` 385u → `chunk-bk5ct2gw.js` 的设置 schema（`gf` 单块 5,548u）；
- `RFe` 另需 `xwt [476926,477331)` 405u、`fse/PY` 等滚动站点派发。

该闭包超过单包规模，W157 以“滚轮加速/设置链/滚动派发/渲染宿主”四步继续；`NFe` 接线（W156）排在其后。
