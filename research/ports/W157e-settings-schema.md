# W157e 设置配置状态与写入队列（C-2 第十六片，W157 第五步）

日期：2026-10-18。范围：`gf` 设置配置管理器状态与 `Hh` 每键写入队列。配置文件读取/解析、schema 校验与 freshness watcher 属设置子系统，本包只携带它们调用的状态记录与队列；随后 W156 `NFe` 接线。

## 来源身份

| 项 | 值 |
| --- | --- |
| 模块 | `chunk-bk5ct2gw.js`、`chunk-qpxbyxy2.js` |
| 块 / 单位 | 2 块 / 5,968 UTF-16 单位 |
| 坐标 | 零基 UTF-16 半开区间 |

| 名称 | 范围 | 单位 | 语义 |
| --- | --- | --- | --- |
| `gf` | bk5ct2gw `[549808,555356)` | 5,548 | 配置缓存/mtime、enable 门、每文件写入计数、freshness 标志、解析错误去重、boot 窗口、生成 ID 与测试配置面 |
| `n`/`Hh` | qpxbyxy2 `[849,1269)` | 420 | 每键 promise 链队列，最多五轮 drain |

## 行为（由复制正文实测）

- `readCache` 命中/未命中计数，`takeCacheStats` 返回后清零；`installDiskRead`/`writeThrough` 触发 `installed`；`writeThrough`/`advanceFreshnessCursor` 递增 `writeGeneration` 并清 `lastReadFileStats`。
- `enable(opener)` 首次调用缓存 opener 的 promise；`markEnableSettled` 后无错误则 resolve，有 `enableError` 则以其 reject；`resetEnableGate` 复位门与 watcher 默认值。
- `reloadThroughStorageOnce` 仅在 `oweReloadThroughStorage` 置位时调用一次并缓存 promise，之后返回同一 promise。
- `beginPendingWrite`/`endPendingWrite` 按文件计数；未 begin 的 end 返回 0（源的 `?? 1` 回退）。
- `bootPhaseStillOpen(ms)` 超过 `now()-bootAnchorMs` 即关闭且不可重开；`claimParseErrorLog` 按 key 去重，`clearParseErrorDedup` 清空。
- `remoteControlMachineIdOnceFrom` 首次计算后缓存；生成 user/machine/summon ID 可设置与清除；测试配置可整体覆盖/删除字段。
- `Hh.run` 按 key 串行，链结算后删除 key；`settle` 等全部在飞任务，`drain` 最多五轮以吸收运行中新增的任务，`clearForTest` 清空。

## 复用与宿主绑定（改写记录）

- **复用**：`Oe`（`plugin-chain-registry-stores-source`，W45-56 变更信号）。
- **宿主绑定**：`now` 由构造参数传入，seam 懒实例用 `Date.now`；`testGlobalConfig`/`testProjectConfig` 在源单例中由 legacy 表 `wR`/`bue` 播种，本产品未携带这两张表，seam 默认以 `{}` 起，持有真实表的调用方经工厂传入。
- **未改写正文**；生成文件把两段原文放在同一模块，`Hh` 的闭包常量 `n=5` 一并复制。

## 测试

`test/plugin-chain-settings-schema.test.ts` 16 例：缓存计数与重置、写入/安装触发信号与代际、enable 门成功/失败与单次 opener、欠账 reload 一次、写入计数、boot 窗口、解析去重、机器 ID 缓存、生成 ID 与测试配置、reset 默认值、freshness 标志与重订阅、外部刷新一次、每键串行与清理、drain 吸收新任务、clearForTest、懒单例。

## 门禁与身份

聚焦 16/16；全量 2431/2431；`tsc --noEmit` 0；`npm run build` 0；`npm run notices` 0；依赖扫描 2 块 5,968 单位 unresolved 0；身份 `f8831570601e349176ed5f4ae5e1db48c83753d7f4195be2d83b48a4f803a65a`（inputs 609 / validation 214 / build 420）。
