# W167 键位提示与提示条（C-2 diff 第七片）

日期：2026-10-18。范围：diff 对话框小件中的键位查找、键位提示组件与提示条——复制 **8 块 2,109 UTF-16 单位**，并补 React 宿主符号。前置：[W166](W166-chord-chrome.md)。

## 来源身份

| 模块 | sha256 |
| --- | --- |
| `chunk-6ccen3s8.js` | `4c2e21990fe16d3840515bf681f2efd149ba0b54f282aaaab23c991bfc2c609d` |
| `chunk-z3f0m1q8.js` | `f035b4067fe457f5a4584fe03292045e6d53134136827d2236d1e1540cc87d1f` |
| `chunk-nh8hd3rr.js` | `5194b7a0a1b3c5beeae642f9b337330dabb12d436085c4aa52a1cf5ff81d1794` |
| `chunk-fz2251t0.js` | `5b8789988815996ef934fa9d83ec0813f8ebec48dd7ec67d24d8c110fd8f5eff` |

| 名称 | 范围 | 单位 | 正文 SHA-256 | 语义 |
| --- | --- | --- | --- | --- |
| `je`/`de`/`E1` | `[9546,10191)` | 645 | `120a0e9d…` | 键记录显示文本；和弦记录以空格连接 |
| `A9t` | `[35212,35388)` | 176 | `809807cc…` | 动作+上下文取和弦；被后项遮蔽为 null，未绑定为 undefined |
| `Ke` | `[35924,36074)` | 150 | `c8dc2159…` | 后续绑定是否重复同上下文同和弦 |
| `V` | `[36598,36731)` | 133 | `67bed0cf…` | 和弦数组相等 |
| `eLe` | `[37204,37333)` | 129 | `944d82bf…` | 单键记录相等（alt/meta 别名） |
| `ma` | `[771,1001)` | 230 | `65e8a5b9…` | 动作的显示文本、fallback 与一次回退事件 |
| `pt` | `[800,1044)` | 244 | `7e800219…` | 键位提示组件，经 `z` 渲染 |
| `y`/`C`/`Se` | `[867,1269)` | 402 | `fc99a790…` | 提示条：非空子项以暗色中点连接 |

## 行为

- `ma(action, context, fallback)`：无服务时返回 fallback 并报 `no_context`；有服务但动作未绑定时报 `action_not_found`；两者都经 `vot` 只报一次。`A9t` 取最后一个未被同上下文同和弦后项遮蔽的绑定；被遮蔽的动作返回 `null` → `""`。
- `E1` 逐键套 `je`（ctrl/alt/shift/meta/cmd 修饰，`de` 映射 Esc/Enter/方向键等），记录间以空格连接。
- `pt` 把 `ma` 的结果交给 `z`（W166）：空串时 `z` 渲染 null。
- `Se`：`Children.toArray` 展平后过滤非空字符串；每项包进 fragment，首项外前缀暗色 `" · "`（`dimColor`）；全部为空返回 null。
- 公开接口：`keyDisplay`（`ma`）、`KeyHint`（`pt`）、`HintStrip`（`Se`）、`SOURCE_BODIES`。

## 复用与改写记录

- **复用**：`Lc`（`plugin-chain-press-button.ts`）、`recordKeybindingFallback`（`plugin-chain-above-prompt-host.ts`）、`z`（`diff-dialog-chrome-source.ts`）。
- **宿主适配（已记录）**：`plugin-chain-react-hooks.ts` 新增来源符号 `fragment`（`X`/`Zc`）、`earlyReturn`（`bn`）、`Children`（`xy`）、`isValidElement`（`em`）；`Tc`/`Xe` 的子项展平合并到同一 `flattenChildren`。宿主渲染器没有 fragment 节点，复制体返回的 fragment 元素在本运行时的元素树中作为数据类型保留，测试按元素树断言。
- **仍缺**：`Mr`（依赖 `ui` 旋转指示器与 `ia`/`HIe`/`bg`/`Wo`/`mr` 动画与配色子系统）。

## 测试

`test/diff-dialog-keyhint.test.ts` 8 例：绑定动作显示和弦（含多修饰键）；后续同上下文同和弦绑定遮蔽先前动作；未绑定动作回退并只报一次 `action_not_found`；无服务报 `no_context`；`KeyHint` 返回 `z` 元素与 props；提示条过滤空项并用暗色中点连接（含 fragment 结构与 key）；全空返回 null；fragment/earlyReturn/Children/isValidElement 语义。

## 门禁与身份

聚焦 8/8；全量 2509/2509；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；未声明扫描 declared 39 / unresolved 0；身份 `fd02b3a0f79180ec5fc2fffdd6f5b9fc4c7bfee40bd5f09dbff145dc464b791f`（inputs 638 / validation 223 / build 440）。
