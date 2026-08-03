# 美术资产交接合同（docs/08）

> 状态：`opco-shigure` TUI 插件骨架已可运行（真实 TUI 冒烟 23/23）。  
> 本文是**美术 agent 的最终交付合同**：把 docs/05（视觉资产规范）与 docs/07（无多模态视觉交接合同）落实为**能直接接入现有骨架、通过全部机器门禁**的最终像素资产。  
> 优先级：本文 + docs/07 §1（v3 主基准 > v2 次选 > 参考照片）> docs/05 > docs/07 §5-§9。

---

## 1. 文档用途与读者

- 读者：即将接手"七状态最终动画资产"任务的美术 agent（多模态或无多模态均可）。
- 用途：定义**做什么、用什么格式交、过哪几道机器门、交到哪里去、怎么证明合格**——这五件事 docs/05/07 未覆盖（它们写于代码存在之前），本文补齐。
- 代码事实以仓库当前状态为准（`src/manifest-data.ts`、`src/manifest.ts`、`src/placeholder.ts`、`scripts/validate-assets.ts`）。若与 docs/05/07 冲突：**机器门禁与本文的数据契约为硬约束**，视觉描述为软约束。

---

## 2. 任务定义（做什么）

**唯一任务**：为骨架产出**最终七状态像素资产**（2 尺寸 × 7 状态），替换占位帧，使 `SHIGURE_MANIFEST` 变为真实资产且**通过全部机器门禁**。

| 维度 | 规格 |
|---|---|
| 尺寸 | regular **24×24** 逻辑像素；compact **16×16**（**独立重绘，禁止缩放**，docs/05 §4） |
| 状态 | idle / thinking / working / waiting / success / error / retry（七状态齐全） |
| 帧数 | **循环状态（idle/thinking/working/waiting/retry）各 2 帧；一次性（success/error）各 1 帧**（固定，与 `FRAME_COUNTS` 一致，零代码改动） |
| 调色板 | **只用现有 13 项 `SHIGURE_PALETTE`**（索引 0-12 已钉死），**禁止新增颜色**（docs/05 §5：主体调色板不随主题改变） |
| 时长 | 沿用 `FRAME_DURATIONS`（idle 400ms；thinking/working/retry 200ms；waiting 300ms；success/error 300ms），**不修改** |
| loop | success/error = false（一次性，播放一遍停末帧）；其余 true（循环） |

帧内容必须满足：docs/07 §9 人类检查清单（身份锚点）、docs/05 §6 状态动作规格、本文 §7 视觉质量合同。

---

## 3. 执行边界（Must NOT do）

美术 agent **只允许修改 2 个文件**：`src/assets/final.ts`（新建）+ `src/manifest.ts`（§4.3 的开关改动）。

**禁止**：
- 修改运行时模块：`adapter.ts` / `reducer.ts` / `animation.ts` / `renderer.ts` / `registry.ts` / `sidebar.tsx` / `tui.ts` / `config.ts` / `types.ts`
- 修改 `manifest-data.ts`（palette 索引、帧数、时长是**合同本身**，不是美术的改项）
- 修改 docs/、design/、README.md、package.json、tsup/vitest/tsconfig 配置
- 引入 PNG 解码、图片协议、emoji 方块、新构建工具或新依赖
- 新增状态、多角色、换装、皮肤
- 加入 docs/05 §8 禁止效果（漂浮符号/阴影/场景/文字/道具）
- 负责"工作态在 OpenCode 1.18.10 不可运行观测"的运行时限制（与美术无关）
- 发布 npm、初始化 git、提交

**允许**：新建 `scripts/preview-assets.ts`（§8 的视觉 QA 辅助脚本，使用现有 renderer，零新依赖）。

---

## 4. 交付物与集成（方案 A：数据模块 + 开关）

### 4.1 `src/assets/final.ts` 结构（新建）

```ts
// 最终七状态资产（docs/08 合同交付物）。占位生成器保留作姿态参考（placeholder.ts 切换后不再被使用）。
// 导入：类型在 src/types.ts（PixelFrame/AnimationSpec/CharacterManifest/PetSize/PetState）；
//       数据常量在 src/manifest-data.ts（SHIGURE_PALETTE/PALETTE_INDEX/SIZE_DIMENSIONS/FRAME_DURATIONS）。
```

导出内容（名称以下为准，勿自造）：
- `ROW_CHARS = ".0123456789ab"`——行字符串编码图例（见 §4.2）
- `decodeRow(row: string, y: number, width: number, pixels: Uint8Array): void`——把一行字符串写入像素缓冲（非法字符抛错）
- 每 (size, state) 的帧数组，例如 `REGULAR_IDLE_FRAMES: PixelFrame[]`、`COMPACT_ERROR_FRAMES: PixelFrame[]`……命名统一 `{REGULAR|COMPACT}_{STATE}_FRAMES`
- `buildFinalSpec(size, state): AnimationSpec`——用 `FRAME_DURATIONS` + loop 规则组装
- `FINAL_MANIFEST: CharacterManifest`——完整 manifest（id="shigure"、displayName="时雨"、palette 复用 `SHIGURE_PALETTE`、sizes 覆盖 2×7）
- `FINAL_ASSETS_READY = true as const`

像素缓冲生成建议（避免手写 Uint8Array 字面量）：
```ts
function makeFrame(size: PetSize, rows: readonly string[]): PixelFrame {
  const dimension = SIZE_DIMENSIONS[size];
  if (rows.length !== dimension) throw new Error(`row count ${rows.length} != ${dimension}`);
  const pixels = new Uint8Array(dimension * dimension);
  rows.forEach((row, y) => decodeRow(row, y, dimension, pixels));
  return { width: dimension, height: dimension, pixels };
}
```

### 4.2 行字符串编码与图例（索引 ↔ 字符 ↔ 颜色 ↔ docs/07 token）

每行 = 24（regular）/ 16（compact）个字符，每字符一个调色板索引；从上到下逐行填充（行优先）。

| 索引 | 字符 | 十六进制 | docs/07 token | 语义 |
|---|---|---|---|---|
| 0 | `.` | —（透明） | transparent | 透明（不写背景色） |
| 1 | `0` | #2A1D1A | hair_shadow | 发丝最深阴影/轮廓 |
| 2 | `1` | #4A2B24 | hair_base | 深巧克力棕主发色 |
| 3 | `2` | #704739 | hair_light | 棕色反光 |
| 4 | `3` | #FFD0B4 | skin | 柔和肤色 |
| 5 | `4` | #4BA9FF | eye_blue | 明亮蓝眼 |
| 6 | `5` | #153A78 | eye_deep | 眼睛深色层 |
| 7 | `6` | #242634 | uniform | 深炭黑/深海军色制服 |
| 8 | `7` | #F1E8DF | trim_warm_white | 水手领/侧板/鞋口暖白 |
| 9 | `8` | #C52F3C | ribbon_red | 红领结/裙边 |
| 10 | `9` | #141820 | sock_black | 过膝袜 |
| 11 | `a` | #4B2624 | boot_red_brown | 深红棕短靴 |
| 12 | `b` | #17141B | outline | 主体轮廓（主题切换只换此色） |

示例（16×16 compact 第 1 帧，**每行必须精确 16 字符**；示意结构，非最终稿）：
```text
.....111111.....
...1111111111...
..111111111111..
.11333333333311.
.11334433443311.
.11333333333311.
.11117788771111.
.11166666661111.
.11677777777611.
.116788888887611.
.11677777777611.
..116666666611..
...199999991...
...1999..9991...
..1aaa..aaaa1...
...aaa....aaa...
```
（图例对照 §4.2 表：`1`=发、`3`=肤、`4`=蓝眼、`6`=制服、`7`=暖白边、`8`=红领结/裙边、`9`=过膝袜、`a`=短靴、`.`=透明。此示例只是"各识别层必须存在"的示意，允许美术调整像素位置，**不允许删除识别层**。）

### 4.3 `src/manifest.ts` 开关（精确改法）

把现有占位构建重命名为 `PLACEHOLDER_MANIFEST`，并加开关：

```ts
import { FINAL_ASSETS_READY, FINAL_MANIFEST } from "./assets/final";
// 现有占位构建逻辑（makeAnimationSpecs → SHIGURE_MANIFEST）改名为 PLACEHOLDER_MANIFEST，保留不动。
export const ASSETS_ARE_PLACEHOLDER = !FINAL_ASSETS_READY as const;
export const SHIGURE_MANIFEST: CharacterManifest = FINAL_ASSETS_READY ? FINAL_MANIFEST : PLACEHOLDER_MANIFEST;
```

要求：
- 不改 `SHIGURE_PALETTE` / `generatePlaceholderFrames` / `validateManifest`（其余导出保持兼容）
- `ASSETS_ARE_PLACEHOLDER` 语义反转（final 就绪后为 false）——README 与测试引用需同步检查（`src/manifest.test.ts` 若断言 `ASSETS_ARE_PLACEHOLDER === true` 需改为断言 `FINAL_ASSETS_READY` 或 `SHIGURE_MANIFEST` 完整性，见 §9 常见失败）

---

## 5. 精确数据契约（代码锁定）

### 5.1 PixelFrame

```ts
interface PixelFrame { width: 24 | 16; height: 24 | 16; pixels: Uint8Array }
```
- `pixels` 行优先（第 y 行第 x 列 = `pixels[y * width + x]`）
- 每字节 = 调色板索引（0-12）；**索引 0 = 透明**
- 长度必须 = `width * height`（24×24 → 576；16×16 → 256）

### 5.2 调色板（`SHIGURE_PALETTE`，见 §4.2 表，禁止改动）

### 5.3 帧数 / 时长 / loop（`manifest-data.ts`，禁止改动）

| 状态 | 帧数 | 时长(ms) | loop | 有效 FPS |
|---|---|---|---|---|
| idle | 2 | 400 | true | 2.5 |
| thinking | 2 | 200 | true | 5 |
| working | 2 | 200 | true | 5 |
| waiting | 2 | 300 | true | 3.33 |
| retry | 2 | 200 | true | 5 |
| success | 1 | 300 | false | 一次性 |
| error | 1 | 300 | false | 一次性 |

---

## 6. 机器校验门（`validateManifest`，全部必须通过）

运行 `npm run validate-assets`（或 `npx tsx scripts/validate-assets.ts`）。逐条门禁：

1. `palette[0]` 必须为 `"transparent"`
2. 两尺寸 × 七状态全部存在（缺任一 → FAIL）
3. 每状态 `frames.length >= 1`（空帧 → FAIL）
4. `frameDurationMs` 有限且 ∈ **[167, 600]**（下限 = 1000/6，与 ≤6FPS 自洽）
5. 有效 FPS ≤ 6（`1000 / frameDurationMs <= 6`）
6. 帧尺寸精确：regular=24×24、compact=16×16（任何偏差 → FAIL）
7. `pixels.length === width * height`
8. 每个 palette 索引 < `palette.length`（越界 → FAIL，报出像素位置）
9. 每状态 ≥ 1 个非透明像素（全透明 → FAIL）
10. **边距（代码强制，比 docs/07 §3 更严）**：上边（y=0）、左边（x=0）、右边（x=width-1）**必须全透明**；**底部不检查**（允许 0px，docs/07 §3 compact 底部 0px 合法）
11. **token 存在性（比 docs/07 §9 更严：按"尺寸×状态"粒度）**：每个 (size, state) 的帧集合内，**必须至少各出现 1 像素** eyeBlue(5)、ribbonRed(9)、trimWarmWhite(8)、sockBlack(10)

> ⚠️ 门禁 11 的实务含义：**error 状态即使按 docs/07 画"眼睛变窄或闭合"，仍必须在帧内保留 ≥1 个 eye_blue 像素**（例如窄缝高光）；thinking 眼睛上移仍须保留蓝眼像素。这不是冲突，是"看得见的身份锚点"的机器化——请围绕它设计帧。

失败输出示例：`FAIL: asset manifest validation failed` + 逐条 `- regular/thinking/frame 0: top edge is not transparent` 等。修复后重跑直至 `PASS: asset manifest validation passed` 且退出码 0。

---

## 7. 视觉质量合同（人类判断项，机器不查）

以 docs/05 §6 + docs/07 §7 为动作规格，docs/07 §1 优先级为准（v3 主基准 > v2 次选 > 参考照片）。硬性视觉要求：

- **身份锚点**（docs/07 §2，按优先级）：深巧克力棕长发（非纯黑）> 单侧细辫垂胸前 > 亮蓝眼 > 深色水手服+暖白领口/侧板 > 红领结（compact 至少一个高纯度红像素簇）> 深裙/黑过膝袜/深红棕短靴分层
- **基线稳定**：每状态脚底/身体基线稳定；**仅 success 脚底上移 ≤1px**；循环状态 2 帧首尾姿势连续，**无基线跳动、无尺寸呼吸**（docs/05 §7）
- **idle 必须有可见微变化**：第 2 帧仅眨眼/刘海/发尾/辫子 1px 变化，身体与基线不动（docs/07 §7 idle）
- **状态区分度**（docs/05 §6 + docs/03 §9）：thinking=注意力朝内/朝上；waiting=朝用户/屏幕外；retry=重复确认/重新振作节奏——**三者不能长得一样**
- 两尺寸各自可辨识：24×24 看得到双眼/辫子/白边/红结/裙袜鞋分区；16×16 至少看得到蓝眼、白边、红色块、深棕发、两只深色脚块
- **禁止**（docs/05 §8）：漂浮星星/问号/爱心/汗滴、速度线/残影/模糊/光晕、地面阴影/底座/尘土/冲击波、气泡/代码/键盘/UI、角色外独立粒子

---

## 8. 视觉 QA 与证据

### 8.1 机器可执行的自查（必须）

1. `npm run validate-assets` → PASS（exit 0）
2. `npx vitest run src/manifest.test.ts` → 绿
3. 全量 `npm test` → 绿（无回归）

### 8.2 视觉证据（必须产出，交人工确认）

新建 `scripts/preview-assets.ts`（允许，使用现有 renderer，零新依赖）：对 7 状态 × 2 尺寸，用 `renderFrame` 输出**实际终端尺寸**（24×12 / 16×8）的文本预览，**浅色与深色两种 outline** 各一份，落盘：

- `.omo/evidence/art-preview-regular.txt`（24×12 × 7 状态，深色 outline）
- `.omo/evidence/art-preview-compact.txt`（16×8 × 7 状态，深色 outline）
- `.omo/evidence/art-preview-light.txt`（浅色 outline 版）

预览必须**逐格真实渲染**（不是放大图），供人工确认：身份锚点可辨、三态区分、无裁切、浅/深主题下轮廓不融入背景（docs/06 §5 视觉测试）。

### 8.3 两种 agent 模式

- **多模态美术 agent**：以 `design/samples/shigure-concept-a-rounded-v3.png`（主基准）+ `design/samples/shigure-concept-a-uniform-v2.png`（次选，制服结构）+ `design/references/shigure-reference-photo-1.jpg`（外貌参考）为视觉参照，按 docs/07 §1 冲突规则执行。
- **无多模态美术 agent**：完全按本文 §4.2 图例 + docs/07 §6 语义分层示例 + §7 状态描述绘制，不得猜测图片内容。

### 8.4 盲测（不归美术 agent）

thinking/waiting/retry 的**无标签盲测**（docs/05 §6）留给你或后续人工 gate：美术交付后，由真人（或后续人工验收任务）在无标签情况下区分三态。美术 agent 交付时只需满足 §7 区分度描述 + 预览证据。

### 8.5 多模态交付的硬性要求（v2 起强制）

> 背景：v1 交付（纯文字契约、无视觉参照）通过全部机器门禁，但被人工 gate 判为"完全不像概念图"——根因是机器门禁只查技术约束、查不了"像不像"，而文字契约无法复现已批准的视觉。**多模态 agent 交付必须走本节的视觉闭环，否则视为不合格。**

1. **必须先看再画**：用 Read/图像工具打开 `shigure-concept-a-rounded-v3.png`（主基准）、`shigure-concept-a-uniform-v2.png`（次选）、`shigure-reference-photo-1.jpg`（外貌），确认看懂 v3 的剪影/头身比/脸/辫子/制服后再落像素。
2. **视觉规格落地（对照 docs/07 §3 比例表）**：
   - 头身比 2.2-2.4：regular 头/发高约 8-9px、**横向宽发轮廓**（禁止细窄柱）；compact 5-6px、宽发
   - 柔和小椭圆脸 + 明亮蓝眼（regular 每侧 ≥2px 蓝眼簇；compact 每侧 ≥1px）
   - **单侧细辫**：头部一侧垂到胸前的独立细辫钩（regular 明显可辨；compact 至少轮廓可辨）——v1 缺失，必须补
   - 深色水手服 + 两侧暖白侧板 + 红长领结（结 + 向下 2-4px 尾部；compact 红色纵向 2-3px）
   - 深色短裙（细红下边）+ 黑色过膝袜（两腿独立）+ 深红棕短靴
   - 圆润低重心、短肢、桌宠感（这是 v1 最缺的）
3. **视觉自检闭环（交付前必做）**：
   1. `npx tsx scripts/preview-assets.ts` + `python3 scripts/art-render-png.py` 生成 PNG
   2. **打开生成 PNG 与 v3 概念图并排比较**：逐项核对剪影、头身比、脸/眼、辫子、白边、红结、裙袜靴
   3. 不像就迭代重画，直到接近；交付说明附"视觉对照表"（逐项：对照 v3 后的结论）
4. 机器门禁与数据契约照常（§4-§6、§9 工作流），不作为视觉合格的替代。

---

## 9. 验证工作流（按序执行）

```bash
npm run validate-assets          # 1. 机器门（真实帧）
npx vitest run src/manifest.test.ts   # 2. manifest/validator 测试
npm run typecheck                # 3. 类型
npm test                         # 4. 全量回归
npx tsx scripts/preview-assets.ts     # 5. 产出视觉证据（§8.2）
```

全部通过后：记录每步退出码到 `.omo/evidence/art-delivery-notes.txt`，报告 DoneClaim（changed_files = [src/assets/final.ts, src/manifest.ts, scripts/preview-assets.ts] + 证据路径）。

---

## 10. 常见失败与修复

| 失败 | 原因 | 修复 |
|---|---|---|
| `top/left/right edge is not transparent` | 角色触到画布边缘 | 把头发/辫子/靴向内侧收 1px（底部允许贴边） |
| `required token X is missing`（如 error 缺 eye_blue） | 该状态帧内某个识别 token 未出现 | 在该状态至少一帧保留 1px 该 token（error 眼睛闭合 → 加窄缝高光） |
| `palette index N out of range` | 行字符串里用了图例之外的字符 | 只用 `.0123456789ab`（对照 §4.2） |
| `frameDurationMs outside [167,600]` / `FPS exceeds 6` | 改了 manifest-data 时长 | **不要改 manifest-data**；时长已固定 |
| `pixel array length mismatch` | 行数 ≠ 尺寸 / 行宽 ≠ 尺寸 | 每帧行数=行宽=24（regular）或 16（compact） |
| 测试引用 `ASSETS_ARE_PLACEHOLDER === true` 变红 | 开关反转 | `src/manifest.test.ts` 改为断言 `FINAL_ASSETS_READY === true` 且 `SHIGURE_MANIFEST` 通过 `validateManifest`（允许最小修改该测试，见 §3 边界——测试文件不在 2 文件清单内，如确需修改请把改动也列入 DoneClaim 报告） |
| 视觉上轮廓融入深色背景 | 深色制服无边 | outline(12) 像素必须覆盖轮廓一圈；预览用浅色 outline 复验 |

---

## 11. 已知限制与参考

- OpenCode 1.18.10 TUI 事件总线不投递 `session.next.*` → "工作"状态在运行期不可观测（探针实证），由 S01-S15 单测覆盖；**不影响美术资产**，成功/完成/等待/待机均可在真实 TUI 观测。
- 占位生成器（`src/placeholder.ts`）保留：可作为姿态/分层参考，切换后不再被 `SHIGURE_MANIFEST` 使用。
- 概念 PNG 不是运行时资源（docs/05 §9.1）；本文不要求解码 PNG。

---

## 12. 验收清单（DoD，全部满足才算完成）

- [ ] `src/assets/final.ts` 存在且导出 §4.1 全部符号；`src/manifest.ts` 开关生效
- [ ] `npm run validate-assets` exit 0（校验的是**真实帧**）
- [ ] `npx vitest run src/manifest.test.ts` + `npm run typecheck` + `npm test` 全绿
- [ ] 两尺寸 × 七状态帧齐全；循环状态 2 帧、一次性 1 帧；时长/loop 与 §5.3 一致
- [ ] 13 项调色板未新增；索引 0 = 透明；上/左/右边缘透明、底部 ≥0
- [ ] 每 (size, state) 含 eye_blue / ribbon_red / trim_warm_white / sock_black 各 ≥1 像素
- [ ] docs/07 §9 人类检查清单逐条"是"（身份锚点、无舰装/机械/禁止效果）
- [ ] 基线稳定（仅 success 跳起 ≤1px）；idle 两帧有可见微变化且基线不动
- [ ] 视觉证据落盘：`art-preview-regular.txt` / `art-preview-compact.txt` / `art-preview-light.txt`（实际尺寸，浅/深两种）
- [ ] 边界遵守：仅修改 2 文件（+可选 preview 脚本与测试同步），未触碰运行时模块/docs/design/配置
- [ ] 交付说明（DoneClaim）含逐条验收证据与盲测移交说明
