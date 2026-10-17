# W157b 终端环境探测（C-2 第十三片，W157 第二步）

日期：2026-10-18。范围：滚轮路径的 `uq` 平台探测及其环境依赖——`fLr` 洪泛探测、`ie` 基数选择、`jg` xterm.js 判定、`Fse` JetBrains 终端名表，以及按宿主键缓存的单例 `S`。`hs` 设置读取、`gbt`/`AZ`/`_Fe`、`mLr` 留作 W157 后续步骤。

## 来源身份

| 项 | 值 |
| --- | --- |
| 模块 | `chunk-z7whhrje.js`、`chunk-yvnhkg35.js`、`chunk-mvsmkx6d.js` |
| 块 / 单位 | 3 块 / 1,711 UTF-16 单位 |
| 坐标 | 零基 UTF-16 半开区间 |

| 名称 | 范围 | 单位 | 语义 |
| --- | --- | --- | --- |
| `E`/`S`/`uq`/`fLr`/`oe`/`v4n`/`ie`/`s$t` | z7whhrje `[1978,3336)` | 1,358 | 探测结果缓存、按宿主键的单例、读取器、Cursor/VS Code 洪泛判定、版本解析、基数选择、失效器 |
| `Fse` | yvnhkg35 `[6703,6878)` | 175 | JetBrains 系终端名表 |
| `U1t`/`jg` | mvsmkx6d `[6611,6789)` | 178 | DA 回应名读取与 xterm.js 判定 |

## 行为（由复制正文实测）

- 默认：无 attacher、无 DA 回应、无相关环境变量 → 窗口曲线、base 1、非洪泛、非 JediTerm、`platform` 恒为 `darwin`、`xtversion` 为 `(no reply)`。
- xterm.js 的 DA 回应同时命中 `fLr`（`xtversion.startsWith("xterm.js")`）→ **wheelFlood=true**；因此走窗口曲线，base 由 `v4n` 得 1。`useAdaptiveDrain` 仍为 true。
- `CURSOR_TRACE_ID` 定义即洪泛；`VSCODE_GIT_ASKPASS_MAIN` 含 `cursor` 亦同。
- `TERM_PROGRAM=vscode` 只在版本 `[1.9.2×10⁶, 1.10.5×10⁶)` 内判洪泛；不在窗口内时 `jg` 仍由 `TERM_PROGRAM` 判为 xterm.js → 衰减曲线、base 3。
- `TERMINAL_EMULATOR=JetBrains-JediTerm` → jediTerm、base 2；叠加 `WT_SESSION` 时 `useDecayCurve=true`。
- attacher caps 优先于环境探测：`wheelFlood`/`terminal`/`wtSession`/`isVscodeTerm` 分别覆盖对应字段。
- `CLAUDE_CODE_SCROLL_SPEED`：正数覆盖 base（上限 20），非法/≤0 回落；源码缓存守卫**不含**该值，故仅改速度不会使缓存失效，需 `s$t` 失效或换宿主键。
- 缓存守卫只比较 `xtversion`/`wheelFlood`/`jediTerm`/`wtSession`/`xtermJs`；同宿主的这些输入不变时返回同一对象，`AZ` 的 `uq()!==T.current` 身份比较依赖这一点。

## 复用与宿主绑定（改写记录）

- **复用**：`q`（chunk-4bw62nzm `[10003,10147)` 144u）已在 `plugin-chain-local-store-source`；`Nx`（chunk-5dxmnnh1 `[814,1981)`）已在 `tui-text-style`；`a` 按 W44 先例用宿主 `process.env`。
- **`B()`**：源码 `n()` 取会话；产品无会话存储，宿主提供稳定键对象，`S` 的 WeakMap 语义不变（键恒定时 `uq()` 恒等）。
- **`Su()`**：attacher caps 属附着面；未绑定返回 `undefined`，与源码无 attacher 分支一致。
- **`DT()`**：源码 `v.of(B().host)` 的 `f` 记录类带 capability/imageFiles 惰性 getter，其 `d()` 默认能力构造器（`T`/`_`/`E`/`b`/`y`/`g`/`x`、`we`/`ny`/`Zb`）属终端能力默认值子系统，未在本包；探测只读 `xtversionName`，故由宿主提供记录，能力 getter 留在原子系统。

## 测试

`test/plugin-chain-terminal-environment.test.ts` 11 例：默认值、xterm.js DA 回应（洪泛/窗口曲线）、Cursor 洪泛、VS Code 版本窗口四档、VS Code 终端的 xterm.js 判定、JetBrains base 2、JediTerm+WT 衰减曲线、attacher caps 四种覆盖、滚动速度边界（5/2.5/50/0/-1/非法）、缓存身份与输入变化失效、按宿主键隔离并在回绑后复用。

## 门禁与身份

聚焦 11/11；全量 2392/2392；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；身份 `8ae9bc13b12cc6aa4d930de64a97f9044949540ce3cac87f665a2c3ebacad61a`（inputs 599 / validation 211 / build 413）。
