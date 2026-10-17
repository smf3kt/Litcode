# W154 AbovePrompt 键绑定/注册表与去抖（C-2 第十片）

日期：2026-10-18。范围：W151 切分的键绑定与注册表片——`Ze`/`nn`/`hro`/`gpr`/`HG`，以及 WG 去抖所需的默认计时器与外部 store 空操作。`s` 未复制：它就是 `tui-base-components.ts` 已从同一模块复制的主题 Box。

## 来源身份

| 项 | 值 |
| --- | --- |
| 模块 | `chunk-am9mebpw.js`、`chunk-tvdq3hrk.js`、`chunk-k1caxvem.js`、`chunk-1r9zp6s1.js` |
| 块 / 单位 | 6 块 / 1,177 UTF-16 单位 |
| 坐标 | 零基 UTF-16 半开区间 |

| 名称 | 范围 | 单位 | 语义 |
| --- | --- | --- | --- |
| `Ze` | am9mebpw `[777,1015)` | 238 | 单动作绑定：handler 存 ref，每次渲染更新；按 action/context/service 注册，`singleKey:true`，卸载注销 |
| `nn` | am9mebpw `[1015,1357)` | 342 | 处理器表绑定：键集排序串为签名，表键不变则不重注册；卸载逐个注销 |
| `hro` | tvdq3hrk `[7723,7816)` | 93 | 打开列表中焦点项之后的下一个 id，末尾返回 null |
| `gpr` | tvdq3hrk `[15201,15327)` | 126 | 读取 `Ri().getState().focusRequest`；null 直接返回；接受则 `c9(request)`，否则清空请求 |
| `nI`/`Cje`/`T4n` | k1caxvem `[1405,1497)` | 92 | 默认 `setTimeout` 包装、空订阅、`()=>null` 快照（`Rt` 的卸载清理挂点） |
| `HG` | 1r9zp6s1 `[23386,23672)` | 286 | 去抖回调：清旧计时器，延迟末次调用；`cancel` 取消；卸载时清理 |

复用（未复制）：`Lc`（press-button seam，源 chunk-bwyexfny `[3552,3579)`）、`Ri`/`c9`（client-host seam，源 chunk-tvdq3hrk `[2862,2915)`/`[6071,6330)`）、`eE`（markdown-host seam，源 chunk-k1caxvem `[2091,2114) var eE=qt(null),T=eg*2;` —— 产品已持有同一 Context token，若再复制会分裂时钟上下文，故复用而不复制，`T` 在本片未使用）、`s`（`tui-base-components.ts` 第 14/16 行，源 chunk-1r9zp6s1 `[6551,6836)`：`Tt` 276u + 别名 9u）。

`HG` 的 `Rt(p,T4n)` 不是 store 读取：`p` 是 `()=>()=>c.current?.()`，`T4n` 恒返回 null，源借此把“卸载时清计时器”挂到 `useSyncExternalStore` 的退订清理上。hook seam 的 `Rt` 语义与之一致，故正文无需改写。

## 测试

`test/plugin-chain-above-prompt-keybinding.test.ts`（7 项）：

- `useKeybinding` 的注册载荷（action/context/singleKey）、handler 调用与卸载注销；
- 默认 `Global` 与 `isActive:false` 不注册；
- `useKeybindings` 的全部键注册、调用与卸载全注销；
- `nextOpenId` 的中间项、末尾 null、焦点缺失回退首项与空表；
- `consumeFocusRequest` 接受走 `c9`（`focusedId`/`shownId` 置位并清请求）、拒绝只清请求、无请求时 store 快照不变；
- `useDebouncedCallback` 末次胜出、延迟取自时钟上下文、`cancel` 丢弃；
- 卸载取消挂起调用。

## 门禁与身份

聚焦 7/7；全量 2369/2369；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；身份 `96434b80c942432c28c4c378320bd67643f1bc1541d7b168e33f93a353226c7f`（inputs 588 / validation 208 / build 405）。审计件：`.audit/w154-probe.plan.json` 等。

## 下一片

W155 宿主胶水 `QY`/`sa`/`us`；随后 W157（`_Fe`/`RFe` 滚轮加速、设置 schema、滚动派发）与 W156（`NFe` 接线）。
