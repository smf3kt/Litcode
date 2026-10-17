# W153 AbovePrompt 焦点环与滚动钳制（C-2 第九片）

日期：2026-10-18。范围：W151 切分的焦点/滚动片——`A9r`/`Xq`/`sZo`/`iZo`/`ZD`/`PYe` 及其请求构造闭包 `Lqt`/`Nqt`/`GQt`/`fse`。

## 来源身份

| 项 | 值 |
| --- | --- |
| 模块 | `chunk-sfn1dbxq.js`、`chunk-bwyexfny.js`、`chunk-6ejn7q9s.js` |
| 块 / 单位 | 10 块 / 3,840 UTF-16 单位 |
| 坐标 | 零基 UTF-16 半开区间 |

| 名称 | 范围 | 单位 | 语义 |
| --- | --- | ---: | --- |
| `A9r` | sfn1dbxq `[475702,475813)` | 111 | 滚动窗口钳制：底边超出时把 top 夹到 `[0,bottom-rows]`，top 小于 offset 时保留 top |
| `Xq` | `[476169,476191)` | 22 | `"above-prompt"` 请求 id |
| `fse` | `[476538,476681)` | 143 | hookable 派发底：`aP` + 站点 `Ooe` + origin `aJ` + promise bottom |
| `Lqt` | `[2334533,2335070)` | 537 | `ui.focus` 请求：先走 `N5t` 前置钩子，再走 `P0` 处理器表，无处理器时直接 `IY`，结果记日志 |
| `Nqt` | `[2335070,2335123)` | 53 | `focusSiteDraws` 绘制清除信号 |
| `sZo` | `[2336000,2336062)` | 62 | 处理器表包装：非保留键一律包成 `()=>act(value)` |
| `GQt` | `[2336062,2336073)` | 11 | 排队上限 64 |
| `iZo` | `[2336190,2338444)` | 2,254 | 焦点环：注册焦点站点、请求期间排队 act（≤64）、forget/卸载中止、持有且空时自动聚焦 |
| `ZD` | bwyexfny `[3579,3835)` | 256 | 挂载期间注册键绑定上下文 |
| `PYe` | 6ejn7q9s `[108086,108477)` | 391 | 元素树→Button/Input/Select 焦点座位；字符串、engine 与其他节点跳过，Select 不再下钻 |

复用（未复制）：hook seam（`R`/`le`/`en`/`P`/`Z`/`w`）、W150 `Ihe`、按键服务 `Lc`、派发 `Ohe`、滚动焦点 seam 的 `Uet`/`IY`/`_z`、lodash map 别名 `Di`（源 `oo=Di`）、前置钩子 `N5t`、记录处理器 `P0`、`Ge`、`aP`/`Ooe`、`aJ`、宿主 `it`/`t`。

宿主注册表已由 `plugin-chain-registry-source.ts` 提供 `focusSites: new Map` 与 `focusSiteDraws`（`Oe()` 信号），因此本包不需要改宿主 seam；`Uet()`/`Nqt()` 直接读同一注册表。

## 测试

`test/plugin-chain-above-prompt-focus.test.ts`（8 项）：

- `clampScrollTop` 六种窗口组合；
- `Xq`/`GQt` 字面量；
- `focusablesOf` 的 Button/Input/Select 字段与跳过规则（Select 不下钻）；
- `actHandlers` 的包装、保留键与 `act(value)` 参数；
- `useActiveContext` 的注册/清理（清理走 `unregisterActiveContext`，非返回值）与 inactive/无服务分支；
- `useFocusRing` 的站点注册（`Uet().get(_z('Comp','req'))`）、空闲 act 立即执行、commit 的人为移动拒绝、forget/卸载清理；
- `focusSiteDrawStore().emit` 可用。

未单测：`Lqt`/`fse` 的 host-call 异步链（复用既有 seam，测试注入点不足）；其行为由来源正文与复用 seam 保证，后续 NFe 接线时随组件链回归。

## 门禁与身份

聚焦 8/8；全量 2362/2362；`tsc --noEmit` 0；build 0；notices 0；身份 `774e46e1f7dcee268718b2f9e1187df6086bcb0a48261bcd659ff98b6b5789d8`（inputs 585 / validation 207 / build 403）。
