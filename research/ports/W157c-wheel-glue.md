# W157c 滚轮设置读取与派发（C-2 第十四片，W157 第三步）

日期：2026-10-18。范围：`hs` 设置读取、`mLr` JetBrains 环境检查、`gbt` 状态公告与工厂、`AZ` 状态 hook、`QO` 内部 JediTerm 上下文读取、`CFe` 滚轮派发与 `_Fe` 处理器工厂。`xwt`/`RFe`/`NFe` 留作后续。

## 来源身份

| 项 | 值 |
| --- | --- |
| 模块 | `chunk-js2bhabe.js`、`chunk-z7whhrje.js`、`chunk-24k7d6mw.js`、`chunk-wz8v981w.js` |
| 块 / 单位 | 7 块 / 1,777 UTF-16 单位 |
| 坐标 | 零基 UTF-16 半开区间 |

| 名称 | 范围 | 单位 | 语义 |
| --- | --- | --- | --- |
| `lSe`/`hs` | js2bhabe `[777,1499)` | 722 | 16 个 legacy 键与设置读取（源优先级 → legacy → 默认） |
| `mLr` | z7whhrje `[9339,9540)` | 201 | `INTELLIJ_TERMINAL_COMMAND_BLOCKS[_REWORKED]` 存在即 latch `bugConfirmed` |
| `gbt` | 24k7d6mw `[126204,126611)` | 407 | 公告曲线/基数/平台并调用 `fbt` |
| `AZ` | 24k7d6mw `[126611,126843)` | 232 | 按 `uq()` 身份重建状态、每事件调用 `pbt` |
| `QO` | wz8v981w `[1438,1463)` | 25 | `Ae(Gfe)` 的上下文读取 |
| `CFe` | 24k7d6mw `[444563,444675)` | 112 | 滚轮事件 → `scrollBy(±rows)`、preventDefault、stopPropagation |
| `_Fe` | 24k7d6mw `[444845,444923)` | 78 | `AZ` + `CFe` 组合为滚轮处理器 |

## 行为（由复制正文实测）

- `hs`：从 `Lo()` 末尾向前走；`w_()` 为真时跳过 `projectSettings`；每源经 `fe(source)?.[key]` 取值；未命中且 key ∈ `lSe` 时比较 `ce()[key]` 与默认 `wR[key]`，不同则经 `DOt`（布尔键，解析失败为 false）或 `lbe` 解析并返回 `legacyGlobalConfig`；否则返回 `{value: fallback, source: "default"}`。非法 legacy 值只警告一次，文案为源文本。
- `mLr`：`bugConfirmed` 已置位直接为真；否则任一 `INTELLIJ_TERMINAL_COMMAND_BLOCKS*` 变量**定义**（含空串）即置位并返回真；删除变量后仍为真（latch 在状态上）。
- `gbt`：`hs("wheelScrollAccelerationEnabled", true).value` 作为 `accelEnabled`；日志含曲线名（`decay`/`window (native)`）、base、platform、`TERM_PROGRAM` 与可选 `wheelFlood`/`jediTerm`/`jbBugConfirmed`/`accelDisabled` 标记；随后 `fbt(useDecayCurve, base, wheelFlood, accelEnabled, jediInput)`。
- `AZ`：`uq()` 对象身份变化即清空并重建状态；每次事件前刷新 `state.base = uq().base`；返回 `{rows: pbt(state, dir, time), state}`。
- `CFe`：`deltaY<0` 为 -1，否则 +1；`scrollBy(dir*rows(dir), options(event))` 后 `preventDefault()` 与 `stopPropagation()`。
- 名称陷阱：本包的 `CFe` 是滚轮派发闭包（chunk-24k7d6mw `[444563,444675)`），与 `plugin-chain-source` 的钩子来源记录 `CFe`（chunk-nyce03br `[111520,111567)`）**不是同一实体**，未复用。

## 复用与宿主绑定（改写记录）

- **复用**：`fe`（产品 settings store）、`uq`（W157b seam，按源名导入）、`pbt`/`fbt`（W157a 正文）、`t`（产品日志）。
- **`Lo`/`w_`**：设置源顺序与“项目设置是否等同用户设置”依赖本产品未携带的 `--setting-sources`/设置文件解析面；由宿主绑定，未绑定即拒绝（不猜测优先级）。
- **`ce`/`wR`**：legacy 全局配置属独立子系统；宿主提供当前值与默认值，未绑定返回 `{}`（源的新配置答案）。
- **`yw`**：legacy 每键 schema（`TN`）未移植，`parseLegacySetting` 绑定解析；`ten`/`lbe`/`DOt` 与警告文案按源正文保留。
- **`Gfe`**：源默认上下文含 stdin/EventEmitter/querier，滚轮只读 `internal_jediTermInput`，故 token 只携带该字段并保留源 `displayName`。

## 测试

`test/plugin-chain-wheel-glue.test.ts` 12 例：源顺序从末向前、项目设置跳过/不跳过、默认回退、legacy 值与布尔键解析失败、与默认值相等时穿透、未绑定拒绝、`mLr` latch、`gbt` 公告与禁用标记、`AZ` 状态保持与探测变化重建、`CFe` 有符号滚动与事件抑制、`_Fe` 组合。

## 门禁与身份

聚焦 12/12；全量 2404/2404；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；身份 `e204a1c77c0dcaeb691098e1ff6f8f26fd65d0c3bc00e95d628f11a15a6479bf`（inputs 603 / validation 212 / build 416）。
