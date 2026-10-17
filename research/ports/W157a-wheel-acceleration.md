# W157a 滚轮加速曲线（C-2 第十二片，W157 第一步）

日期：2026-10-18。范围：`_Fe`/`RFe` 闭包中不依赖平台探测与设置读取的纯滚轮步进层——`pbt`/`fbt`/`VNo`/`tgt` 与常量。`AZ`/`gbt`/`_Fe`/`hs` 留作 W157 后续步骤。

## 来源身份

| 项 | 值 |
| --- | --- |
| 模块 | `chunk-z7whhrje.js`、`chunk-24k7d6mw.js` |
| 块 / 单位 | 7 块 / 2,245 UTF-16 单位 |
| 坐标 | 零基 UTF-16 半开区间 |

| 名称 | 范围 | 单位 | 语义 |
| --- | --- | --- | --- |
| `tgt` | z7whhrje `[9007,9133)` | 126 | JediTerm 滚轮状态工厂（时间、方向、手势、pendingArrowBoost） |
| `VNo` | z7whhrje `[9266,9339)` | 73 | 取走并清零 pendingArrowBoost |
| `gLr` | z7whhrje `[9540,9565)` | 25 | JediTerm 绕行窗口 200ms（同语句含未使用的 `de`/`pe`） |
| 常量 | 24k7d6mw `[124024,124140)` | 116 | `QAe`=40、`JSt`=3、`XSt`=200、`obt`=1500、`ZSt`/`ebt`/`tbt`/`zAe`/`nbt`/`YAe`/`rbt`/`sbt`/`ibt`/`abt` 等窗口/洪泛参数 |
| 常量 | 24k7d6mw `[124299,124336)` | 37 | `dbt`=0.35、`cbt`=0.008、`ubt`=0.4、`mbt`=4 |
| `pbt` | 24k7d6mw `[124336,126011)` | 1,675 | 一次滚轮事件：方向翻转、洪泛、窗口曲线/衰减曲线、JediTerm 触控板分支，返回滚动行数 |
| `fbt` | 24k7d6mw `[126011,126204)` | 193 | 状态工厂：`{time,mult,dir,useDecayCurve,frac,base,pendingFlip,wheelMode,burstCount,jbBypass,jediTerm,wheelFlood,accelEnabled}` |

## 行为（由复制正文实测）

- 默认窗口曲线：每事件 `mult += 0.3`，行数 `floor(mult)`；首事件 1 行，`mult` 达 2.2 后 2 行。
- 反向首事件返回 0 并置 `pendingFlip`；同向恢复的首事件把 `mult` 重置为 1，下一事件起再加速。
- `wheelFlood`：行数 `max(1, floor(base*JSt))`，base=2 时为 6。
- 衰减曲线：`mult` 按 `1.4^间隔/步` 增长并携带 `frac`；实测 2 → 8 → 15。
- JediTerm 触控板：`frac += 0.35*mult`，`mult` 每事件 +0.008（上限 4），累计跨 1 输出一行。

## 后续步骤（W157）

- 平台探测 `uq`（chunk-z7whhrje `[2670,2712)`，经 `S.of(B().host).get()`）与 `mLr`（`jbBugConfirmed` 环境探测，`[9339,9540)`）。
- 设置读取 `hs`（chunk-js2bhabe `[1114,1499)` 385u，源优先级 + legacy 回退；依赖 `Lo()`/`w_()`/`fe()`/`lse`/`ce()`/`wR` 等）。
- `gbt`（407u）、`AZ`（232u）、`_Fe`（78u）与滚动派发 `xwt`、渲染宿主 `RFe`。

## 门禁与身份

聚焦 7/7；全量 2381/2381；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；身份 `ab3d43d6b7697f5d24055f1e77c799b85043ab4e7ed08781b80a4cc39bf8224a`（inputs 595 / validation 210 / build 410）。审计件：`.audit/w157a-probe.ts`、`.audit/w157a-probe2.ts`。
