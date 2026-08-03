# 终端"点状噪点"问题交接（docs/09）

> 用途：给**新对话/新美术 agent** 的交接文档。本仓库 `opco-shigure` 插件骨架已完成并可运行，但**真实终端侧栏渲染仍有点状噪点问题**（白点→灰点），需在新会话专门解决。先读本文，再读 docs/08 与 design/art-v2/README.md。

---

## 1. 现状（新会话起点）

- **插件骨架完整可运行**：135 测试全绿、真实 TUI 冒烟 23/23、计划 `.omo/plans/opco-shigure-tui-skeleton.md` 12/12、`.omo/boulder.json` completed。
- **美术资产**：`src/assets/final.ts` 由生成器 `scripts/build-final-assets.ts` 从 v3 母稿种子 `design/art-v2/shigure-pixel-data.json` **程序化生成**（非手绘），含 v4 清理（孤立亮色像素已清、结构簇连续化）。
- **遗留问题（本文核心，共两个）**：
  1. **终端点状噪点**：真实终端侧栏渲染有大量点状噪点——先前是白点（近白轮廓 #E8E4DF），改为灰轮廓 #8E93A6 后变灰点。根因是美术轮廓像素过密散落 + 渲染器把所有轮廓 token 像素统一映射为单一亮色。
  2. **美术质量未达理想（本轮新增）**：v3→v4 的程序化清理（去孤立像素、hairMend 补洞、语义蒙版结构簇重绘、轮廓色反复调整）在消除终端噪点的同时，**改变了剪影/发丝/细节，让预览图也不够好了**——达不到用户理想状态。新对话必须把"终端干净"与"美术忠实 v3"作为**两个同等目标**一起解决，不能只修其一。

---

## 2. 问题定义与证据

### 现象
- 侧栏宠物的轮廓/散落像素在 1:1 终端尺寸下呈"很多点"；放大预览 PNG 正常（每格 14×28px，散点被淹没）。
- 用户认可的预览图 = `scripts/preview-assets.ts` 深色版，其轮廓用**深色 #17141B**（几乎不可见）；真实终端深色主题曾用**近白 #E8E4DF** → 全部 `b` 像素变白点。

### 根因链
1. **种子噪声**：`shigure-pixel-data.json` 是 v3 母稿 PNG 的最近邻降采样追踪，天然带大量散落像素——原始孤立色像素 regular 61 / compact 35；`b`(outline) 像素遍布头发/脸/身体内部。
2. **渲染器轮廓约定**：`src/renderer.ts` 把 palette 末项（索引 12 `b`，outline token）全部像素 → `opts.outlineColor`（主题切换只换这一色，docs/04 §3.6、docs/05 §5）。
3. **真实终端**：深色主题下 `sidebar.tsx` 曾传近白/灰 outline → 所有 `b` 像素（含内部散点）→ 白点/灰点。
4. 预览图用深轮廓 → 隐藏了问题 → "预览还行、终端全是点"。

### 证据（真实终端原始捕获）
- 捕获文件：`/tmp/shigure2.ansi`（132KB，python pty 200×50，`hi\r` 开会话后 30s 抓原始 ANSI）
- 捕获脚本：`/tmp/cap2.py`（新会话可复用：`/usr/bin/python3 /tmp/cap2.py`）
- 关键计数（旧版灰轮廓 #8E93A6 时）：旧近白 #E8E4DF=0；**新灰 #8E93A6=314 单元格**（轮廓过密）；暖白 #F1E8DF=50；红 #C52F3C=19；蓝眼 #4BA9FF=72；深棕发 #4A2B24=234。
- 结论：**314 个灰轮廓单元格 = 灰点**。任何亮色轮廓都会重现此问题；问题在"轮廓像素密度/分布"，不在颜色。

### 2.5 问题二：美术质量回退（预览不再理想）

**现象**：用户反馈"这几轮改的结果让预览图又不够好，达不到理想状态"。即：v3 母稿数据版虽"像"v3，但种子噪声大；v4 程序化清理（去散点/结构簇重绘/hairMend）在消除噪点时**把剪影与细节一起改掉了**——发丝纹理被抹平、轮廓被收成块、辫子被简化、整体呈"块状/扁平化"，与 v3 母稿的圆润灵动感有差距。

**根因**：
1. 种子本身是最近邻降采样追踪（非干净美术），细节天然丢失/噪声化。
2. 纯程序化清理（clearScatter/writeMasks/denoiseIterative/hairMend）只能"删点/补块"，**无法重新创作**——它消灭噪声的手段（清孤立像素、重绘成连续块）必然简化艺术细节。
3. 轮廓色多轮改动（白→灰→深）也影响观感。

**结论**：**程序化管线 + 纯文本/无视觉 agent 的上限，就是"干净但平庸"**。要达到"终端干净 + 美术理想"两个目标，必须由**有视觉能力的美术 agent** 直接参照 v3 母稿 PNG 重新创作干净帧（见 §5 方案 A）。这是两条问题的共同出口，不是可选项。

---

## 3. 已尝试方案（勿重复）

| 版本 | 做法 | 结果 |
|---|---|---|
| v1 | 纯文字契约手绘（docs/08+docs/07） | 完全不像 v3（头小、无辫子、比例错）——被拒 |
| v2 | agent 自行清理重绘 | 结构改善但仍不像 v3——被拒 |
| v3 | 用母稿 JSON 种子 + 注入蓝眼/修边 | 忠实母稿但种子噪声 → 真实终端白点 |
| v4a | 去噪（清 7/8/9/a 散点 + 语义蒙版结构簇重绘 + 迭代去噪） | 白点降；hairMend 过度填充改变剪影 |
| v4b | hairMend 阈值 3→5 | 剪影保留，孤立像素 61→23（regular）/35→8（compact） |
| v4c | 轮廓 #E8E4DF→#8E93A6 + denoise 加 `b` | 白点→灰点（轮廓仍 314 单元格，过密）——被拒 |
| v4d（当前） | 轮廓临时=#17141B（深色，匹配已批准预览） | **消除全部"点"**；代价：深色制服在深色面板上轮廓弱。临时缓解，待 A/B/C 落地换回 |

---

## 4. 当前代码事实（新会话必须知道）

| 项 | 位置 | 说明 |
|---|---|---|
| 资产 | `src/assets/final.ts` | 生成器产物；导出 ROW_CHARS/decodeRow/makeFrame/patchRows/patchFirst/*_FRAMES/buildFinalSpec/FINAL_MANIFEST/FINAL_ASSETS_READY=true |
| 生成器 | `scripts/build-final-assets.ts` | 输入 JSON 种子；管线：trimEdges→clearTopGap→injectEyes→cleanupTerminal(clearScatter→writeMasks→denoiseIterative→hairMend)→状态派生→validateManifest 断言→写文件。确定性、可重跑（同输入同输出） |
| 渲染器 | `src/renderer.ts` | `renderFrame(frame, palette, {transparentIndex, outlineColor})`；**palette 末项=outline token，其像素 fg=outlineColor**；输出 Run{text,fg?,bg?}（hex 字符串）；半块合并表 docs/04 §3.6 |
| 主题轮廓 | `src/sidebar.tsx` | dark → LIGHT_OUTLINE；light → palette 末项。**当前 LIGHT_OUTLINE=#17141B（v4d 临时缓解）** |
| 校验门 | `src/manifest.ts validateManifest` + `scripts/validate-assets.ts` | 尺寸/索引/边距/帧时长[167,600]/FPS≤6/每(size,state)含 eye_blue+ribbon_red+trim_warm_white+sock_black |
| 语义合同 | `docs/08-art-asset-handoff.md`、`design/art-v2/README.md`、`docs/07 §5/§6/§7` | 图例 `.0123456789ab`↔调色板 0-12；语义蒙版 H/F/E/B/W/U/R/K/T；七状态动作契约 |
| 验证命令 | `npm run validate-assets` / `npm test`(135) / `npm run typecheck` / `npm run build` / `npx tsx scripts/preview-assets.ts` / `python3 .omo/evidence/art-render-png.py` | 全绿是硬门槛 |
| 真实终端复现 | `/tmp/cap2.py` 或直接重启 opencode（`~/.config/opencode/tui.json` 已指向 `dist/tui.js`，改完必须重启才生效） | — |
| 视觉工具 | `multimodal-looker`（用户已启用） | 可让有视觉的 agent 直接看图判断 |

---

## 5. 推荐修复方向（按优先级，新会话选择）

**A. 美术重构（唯一同时解决两个问题的路径，最推荐）**：让**多模态美术 agent（有视觉）**基于 v3 母稿 PNG（`design/art-v2/shigure-v3-master-crop.png` + `shigure-v2-uniform-crop.png` + 参考照片）**重新创作**干净的调色板索引帧——目标是：①外轮廓 1px、内部零散点清零（解决终端噪点）；②剪影/头身比/脸/眼/辫子/白侧板/红结/袜靴**忠实 v3 且保有细节**（解决美术质量）。交付格式照 docs/08 §4（行字符串 + final.ts 结构）；生成器可弃用或仅作参考。**这是唯一能同时达到"终端干净"与"美术理想"的路。**

**B. 边界感知轮廓（渲染层兜底，仅解噪点不解美术）**：改 renderer（或生成器预处理）——只把**外轮廓边界像素**（8 邻域含透明）映射为 outlineColor，内部 `b` 像素归主体色。可消除"轮廓点"，**但不能恢复被清理抹平的剪影/细节**——若走 B，美术质量问题仍存在，只能作为 A 之前的临时兜底。

**C. 降噪 + 剪影重描（仅解噪点，工作量大的替代）**：以 v3 语义蒙版为硬约束手工重描干净帧，同样**无法恢复 v3 的细节质感**；仅当无多模态能力时的折中。

**D. 临时观感（已应用 v4d）**：LIGHT_OUTLINE=#17141B（深轮廓，与已批准预览一致，当前无"点"）。代价：深色制服轮廓弱 + 美术平庸问题仍在。A 落地后按 A 方案换回主题感知轮廓（并删除 sidebar.tsx 中的临时注释）。

**硬验收指标（两个目标都要过）**：
- **终端**：真实终端捕获（/tmp/cap2.py）中，除暖白面板 #F1E8DF 外无任何亮色散点；轮廓单元格数大幅下降（对照：灰轮廓时 314）。
- **美术**：由有视觉的 agent（multimodal-looker 可用）或用户对照 v3 母稿逐项验收：剪影、头身比 2.2-2.4、宽发、椭圆脸、双蓝眼、单侧细辫、白侧板、红长领结、袜靴分层、圆润低重心——逐项 PASS 才算合格（可用 docs/07 §9 清单 + design/art-v2/README 比例表）。
- **技术**：validate-assets PASS、npm test 135 绿、typecheck 0、预览 PNG（深/浅轮廓）与真实终端一致。

---

## 6. 建议新会话第一步

1. 读本文 + `docs/08-art-asset-handoff.md` + `design/art-v2/README.md` + `src/renderer.ts` + `scripts/build-final-assets.ts`
2. 跑 `/tmp/cap2.py` 复现真实终端现状（或直接重启 opencode 看 v4d 深轮廓效果）；同时打开 `.omo/evidence/art-preview-regular.png` 评估当前美术质量
3. 决策：**有多模态美术能力 → 走 A（两问题一起解，唯一路径）**；无 → 先走 B/D 兜底噪点，美术质量另行安排
4. 改完跑全门禁 + 真实终端捕获对比（§5 硬指标：终端无散点 + 美术逐项对照 v3 母稿）

---

## 7. 已知限制（不变，勿当缺陷修）

- OpenCode 1.18.10 TUI 事件总线不投递 `session.next.*` → 运行期"工作"态不可观测（S01-S15 单测覆盖，`docs/08` §11 与 `.omo/evidence/task-8-fallback.txt` 记录）。
- npm 未发布（`private:true`）；加载走 `~/.config/opencode/tui.json` 绝对路径条目。
- 角色素材许可与代码许可需分开确认（docs/05/07、design/art-v2/README 均已注明）。
