# W157d 窗格滚动宿主与 `ui.scroll` 派发（C-2 第十五片，W157 第四步）

日期：2026-10-18。范围：`RFe` 窗格滚动宿主与 `xwt` 的 `ui.scroll` 派发。伴随函数 `wFe`/`j1`/`kFe`/`vFe`/`xFe`/`W1`/`PFe` 已由 W145/W146 逐字复制，本包按既有来源导入复用。`gf` 设置 schema 与 W156 `NFe` 接线留作后续。

## 来源身份

| 项 | 值 |
| --- | --- |
| 模块 | `chunk-24k7d6mw.js`、`chunk-sfn1dbxq.js` |
| 块 / 单位 | 2 块 / 2,402 UTF-16 单位 |
| 坐标 | 零基 UTF-16 半开区间 |

| 名称 | 范围 | 单位 | 语义 |
| --- | --- | --- | --- |
| `RFe` | 24k7d6mw `[444994,446991)` | 1,997 | 窗格偏移状态、跟尾、钳制、注册滚动站点、经由 `xwt` 提升人事移动 |
| `xwt` | sfn1dbxq `[476926,477331)` | 405 | 经典预门 → `ui.scroll` 处理器 → 站点自身 commit，并写结果日志 |

## 行为（由复制正文实测）

- `RFe` 用 `fd(0)` 持有偏移、`fd(false)` 持有跟尾；`maxOffset` 变化时把偏移钳回。`commit(offset, origin)`：plugin 来源直接走 `no()`（钳制并清跟尾）；person 来源在位移时清跟尾并落值；跟尾期间同一目标的重放不重复写入。返回 true 表示窗口未变。
- `scrollBy(delta)`：目标为 `min(maxOffset, floor(current + delta))`；若已有一次派发在飞，则把增量与 pointer 暂存，待 promise `finally` 后重放。
- 站点以 `component:requestId` 注册到 `ahe()`，字段含 `offset()`（跟尾时直接给 `maxOffset`）、`keyRows(plugin, key)`（经 `kFe` 遍历 `content.current`）、`commit` 与 `followEnd`；卸载删除站点。
- 返回值 `xFe({offset, bodyRows, contentRows, maxOffset, scrollBy}, {placed, place, raised})`；`place` 接受一个以当前偏移为入参的函数，`raised` 为每次 `po` 探测到偏移变化的计数。
- `xwt`：`N5t({event:"ui.scroll", e:input, origin:hookOrigin}, signal)` 非空则等待后重入；否则取 `P0("ui.scroll", hookOrigin)`，无处理器直接走 `PY(input)`，有处理器经 `fse` 折叠且底线仍是 `PY`。日志格式 `ui.scroll <component> <requestId> (<origin.kind>) by <by> to <offset>: moved|denied (<reason>)`。
- `PY` 的三种拒绝：无站点 `no such site`；他人插件站点 `not this plugin's site`；站点 commit 为假 `the window moved meanwhile`。

## 复用与改写记录

- **复用**：`wFe`/`j1`/`kFe`/`xFe`/`W1`/`PFe`（W146 `plugin-chain-above-prompt-parts-source`，范围见证据 JSON）、`vFe`（`plugin-chain-above-prompt-source`）、`fd`（W150 source）、`PY`/`_z`/`ahe`（W45-71 scroll-focus seam）、`N5t`/`P0`/`fse`/`Ohe`/`t`。生成文件仅新增两段正文，未重复复制伴随函数。
- **改写**：无正文改写；`RFe` 的 `N()` 尾随 memo 空操作在范围内一并保留，故生成的 import 含 `N`。
- **宿主绑定**：本包无新增宿主绑定。`RFe` 的 `content` 由调用方传入，`xwt` 的手处理器与预门走既有 seam。

## 测试

`test/plugin-chain-pane-scroll.test.ts` 11 例：无站点拒绝与日志、站点 commit 通过/拒绝/他人插件站点、宿主注册与钳制/跟尾/卸载删除、站点 `keyRows` 读取窗格内容、`scrollBy` 派发与钳制及日志、`PFe` 偏移合并、六个滚动键、滚轮指针换算、`kFe` 嵌套行求和与文本节点跳过。

## 门禁与身份

聚焦 11/11；全量 2415/2415；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；依赖扫描 2 块 2,402 单位 unresolved 0；身份 `f888449094e3ecdc9cfc49fd9f0f4e45e9bd4a0abc9707543f4498d23c0ede49`（inputs 606 / validation 213 / build 418）。
