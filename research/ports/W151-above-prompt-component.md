# W151 AbovePrompt 组件本体闭包侦察（纯测量）

日期：2026-10-18。范围：`chunk-24k7d6mw.js` 的 `NFe`（AbovePrompt 组件）及其直接引用闭包。本包不改产品代码；产出为精确的引用分区、拼接冲突证据与后续切片计划，供 W152–W156 逐片移植。

## 来源身份

| 项 | 值 |
| --- | --- |
| 模块 | `chunk-24k7d6mw.js` |
| SHA-256 | `1d064454003e46bba8086468918622fd0cad3673bf3ba900031c380b27ed1d31` |
| 符号 | `NFe` |
| 范围 | `[456049,461905)`，5,856 UTF-16 单位 |
| 正文 SHA-256 | `7932cc004bd2c951cd9a8e5bc3b3c082baf2d3ace1c09764e19b331c31b1401d` |
| 坐标单位 | UTF-16 码元，零基，半开区间 |

## 直接引用分区（82 个标识符）

由 `source-undeclared-scan` 对单块生成源扫描得到 82 个未解析名；逐名经 `chunk-24k7d6mw` 的导入表与声明表定位到来源模块与顶层声明范围，再与 108 份产品 seam 的块账本按“模块 + 范围完全覆盖 + seam 导出同名”比对。分区结果：

- **44 个精确范围命中现有 seam**，直接导入，不复制；
- **9 个 React/JSX 钩子绑定**（`e`/`r` 为 `Xe` 别名，`Ae`/`P`/`R`/`Z`/`en`/`le`/`y` 为 hook seam 的 context/effect/ref/memo/state 等），由 `plugin-chain-react-hooks.ts` 提供；
- **5 个手写宿主 seam 复用**：`kc`/`Ys`（`plugin-chain-code-host.ts`，源范围分别为 `chunk-1r9zp6s1.js [25001,25120)` 与 `[28445,28549)`）、`c9`（`plugin-chain-client-host.ts`，源 `chunk-tvdq3hrk.js [6071,6330)`，产品块略宽）、`Kje`/`$pn`（`plugin-chain-client-host.ts`，源 `chunk-3xcmvqfg.js` 的站点焦点存储与 setter，按宿主状态重写并注明）；
- **24 个需要新复制的正文**，共 7,604 单位，分布在 10 个模块。

### 精确命中的 44 个 seam 复用

| seam | 名称 |
| --- | --- |
| `plugin-chain-above-prompt-source.ts` | `pne`, `yne`, `wne`, `vne`, `kne`, `NI`, `G1`, `Tne`, `_ne` |
| `plugin-chain-above-prompt-parts-source.ts` | `wFe`, `j1`, `TFe`, `PFe`, `bne`, `K1`, `w0`, `z1`, `J1`, `Rne` |
| `plugin-chain-above-prompt-input-source.ts` | `Tp` |
| `plugin-chain-above-prompt-seats-source.ts` | `X1`, `eK`, `Ane` |
| `plugin-chain-above-prompt-select-keys-source.ts` | `Ihe`, `fd`, `lK`, `nK`, `uK` |
| `plugin-chain-client-host-source.ts` | `Ey`（源 `chunk-am9mebpw.js [1357,1549)`） |
| `plugin-chain-notify-fold-source.ts` | `Ri`（源 `chunk-tvdq3hrk.js [2862,2915)`）、`Y4t`（源 `chunk-n3ykh62m.js [230179,230215)`） |
| `plugin-chain-hover-source.ts` | `Re`（源 `chunk-5b7mmg84.js [758,1288)`） |
| `plugin-chain-press-button-source.ts` | `wFt`, `y3n`, `kj` |
| `plugin-chain-input-field-source.ts` | `ke`, `cdn` |
| `plugin-chain-select-field-source.ts` | `gdn`, `fdn`, `pdn`, `ldn`, `udn` |
| `plugin-chain-terminal-glue-source.ts` | `hdn`, `VH` |

### 24 个待复制正文

| 模块 | 单位 | 名称 | 范围（UTF-16） |
| --- | ---: | --- | --- |
| `chunk-24k7d6mw.js` | 2,616 | `vp` | `[299367,299397)` 30 |
| | | `IV` | `[299493,299598)` 105 |
| | | `_Fe` | `[444845,444923)` 78 |
| | | `RFe` | `[444994,446987)` 1,993 |
| | | `q1` | `[447223,447294)` 71 |
| | | `Z1` | `[450435,450470)` 35 |
| | | `tK` | `[450848,450963)` 115 |
| | | `cK` | `[453589,453644)` 55 |
| | | `Ine` | `[453648,453782)` 134 |
| `chunk-sfn1dbxq.js` | 2,449 | `A9r` | `[475702,475813)` 111 |
| | | `Xq` | `[476169,476191)` 22 |
| | | `sZo` | `[2336000,2336062)` 62 |
| | | `iZo` | `[2336190,2338444)` 2,254 |
| `chunk-6ejn7q9s.js` | 391 | `PYe` | `[108086,108477)` 391 |
| `chunk-am9mebpw.js` | 580 | `Ze` | `[777,1015)` 238 |
| | | `nn` | `[1015,1357)` 342 |
| `chunk-bwyexfny.js` | 256 | `ZD` | `[3579,3835)` 256 |
| `chunk-ejnyhzsc.js` | 29 | `QY` | `[668,697)` 29 |
| `chunk-pxjy4t8j.js` | 558 | `sa` | `[1298,1856)` 558 |
| `chunk-t8vb436n.js` | 211 | `us` | `[764,975)` 211 |
| `chunk-tvdq3hrk.js` | 219 | `hro` | `[7723,7816)` 93 |
| | | `gpr` | `[15201,15327)` 126 |
| `chunk-1r9zp6s1.js` | 295 | `s` | `[6827,6836)` 9 |
| | | `HG` | `[23386,23672)` 286 |

合计 24 名、7,604 单位；加上 `NFe` 本体 5,856 单位，直接移植面 13,460 单位。

## 闭包探针与拼接冲突

第一轮探针把 `NFe` 与 41 个直接依赖块拼入单文件：42 块、15,668 单位，未解析 21 名。补齐该 21 名后：58 块、19,493 单位，生成成功但 acorn 解析失败：

```
SyntaxError: Identifier 'd' has already been declared (209:15)
```

冲突源为 `chunk-z6yhgx3x.js [817,867)` 的模块级声明簇 `var l=qt(null),d=qt(null),P=qt(null),j=()=>()=>{}`：

- `d` 与 `chunk-76anb6yt.js [664,690)` 的 `function d(n){return r(n)}` 同名；
- `P` 与 hook seam 绑定的 `P`（useEffect）同名；
- `l` 与 `v` 又分别与其它模块的通用短名重合。

结论：**多模块闭包不能拼成单一顶层作用域**。产品按来源模块分组、各自成 seam 的结构是必要的，不能用一个 `NFe` 大文件吞掉整个闭包。该冲突是本包的核心测量结果，后续切片按模块分组，每组独立导入 hook/既有 seam。

## 切片计划

| 包 | 主题 | 模块与单位 | 名称 |
| --- | --- | --- | --- |
| W152 | AbovePrompt 本地状态 | `chunk-24k7d6mw.js` 2,616 | `vp`, `IV`, `q1`, `Z1`, `tK`, `cK`, `Ine`（已落地，[W152](W152-above-prompt-local.md)）；`_Fe`, `RFe` 的闭包超出单包，转入 W157 |
| W153 | 焦点与滚动 | `chunk-sfn1dbxq.js` 2,449 + `chunk-bwyexfny.js` 256 + `chunk-6ejn7q9s.js` 391 | `A9r`, `Xq`, `sZo`, `iZo`, `ZD`, `PYe` |
| W154 | 键绑定与注册表 | `chunk-am9mebpw.js` 580 + `chunk-tvdq3hrk.js` 219 + `chunk-1r9zp6s1.js` 295 | `Ze`, `nn`, `hro`, `gpr`, `s`, `HG` |
| W155 | 宿主胶水 | `chunk-ejnyhzsc.js` 29 + `chunk-pxjy4t8j.js` 558 + `chunk-t8vb436n.js` 211 | `QY`, `sa`, `us` |
| W156 | `NFe` 本体接线 | `chunk-24k7d6mw.js` 5,856 | `NFe` |

每个切片仍须按 S-7 先读源正文再复制，并在自身收尾时重新测量该组的二级闭包（本包只测到直接引用与一次扩展探针，冲突后未继续收敛）。

## 证据与校验

- 扫描：`source-undeclared-scan` 对 `src/plugin-chain-above-prompt-component-source.ts` 报 `declared 96`、82 名未解析（该探针源已删除，不进入产品）。
- 名称映射：`.audit/w151-nfe-map.mjs`（导入表 + 顶层声明范围）。
- seam 账本索引：`.audit/w151-seam-index.mjs`，要求模块相同、账本块范围完全覆盖来源范围、seam 导出同名，三者同时成立才计为复用。
- 冲突复现：`.audit/w151-probe.plan.json` 58 块、`.audit/w151-probe.ts`、`.audit/w151-probe-scan.txt`。
- 机器可读清单：`W151-above-prompt-component-evidence.json`。

本包无产品改动、无测试变更；`research/` 不入库跟踪，记录以 `git add -f` 单独提交。
