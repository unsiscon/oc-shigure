# 时雨终端美术与渲染：代码变更审核交接

> 状态：**已由开发 Agent 审核，批准进入 A/B 临时接入与美术候选制作阶段（有条件）；最终代码实施仍待 A/B 选型与用户授权**  
> 日期：2026-08-05  
> 审核对象：负责 OpenCode TUI 插件运行时、渲染器、构建和测试的开发 Agent  
> 本阶段唯一交付物：本文档。本文档不是实现完成声明，也不授权修改 `src/`、测试、构建脚本、生成资产或运行时配置。

## 1. 审核结论摘要

用户提供的新实际 TUI 截图已经验证了此前的实验补丁：深色主题中的 `b`（outline token）大部分已经显示为 `backgroundPanel`，截图中也没有出现精确的旧 outline 色 `#17141B`。但角色仍被深色横条切割。

因此当前问题不能继续简单归因于 outline。剩余主要来源是：

1. `hairShadow #2A1D1A`、制服色和袜色在 24×24 自动追踪网格中形成较长的水平段；
2. `▀ / ▄ / █` 将两行逻辑像素合成一个字符格，放大了相邻逻辑行之间的水平边界；
3. 透明半格目前依赖 OpenTUI/父节点继承 panel 背景，没有在每个相关 span 上显式写入 panel 色；
4. 当前 regular idle frame 1 是 approved-v2，但其他状态仍主要来自旧的程序化追踪/去噪管线，不能视为完整的终端原生美术。

拟议路线不是立即重写插件，而是：

- 保留半块字符方案作为 A/B 基线；
- 先手工制作 24×24 与 32×32 两套 regular idle 候选；
- 在真实 OpenCode TUI 中比较后，由用户选择尺寸；
- 只有审核通过后，才实施本文列出的最小运行时代码改动；
- 选择尺寸前不展开七状态，不把临时 A/B 开关留在最终运行时。

## 2. 新截图证据与根因修正

### 2.1 截图与网格对齐

分析对象：用户本轮提供的 `codex-clipboard-88a710b4-199f-4aed-93fa-0226c4d75ad6.png`，尺寸为 680×548。

截图中的宠物可以和 `design/art-v2/shigure-v3-terminal-seed-24-approved-v2-grid.txt` 对齐：

- 逻辑网格：24×24；
- 截图中每个逻辑像素约为 14×14 屏幕像素；
- 估算网格原点约为 `(198, 116)`；
- 宠物显示区域约为 336×336 屏幕像素；
- 映射符合终端字符约 14×28 屏幕像素、上下半块各承担 14px 高度的行为。

### 2.2 颜色取样结果

截图中最常见的 panel 颜色集中在：

```text
#22252B / #22252C
#20252B / #20252C
```

按 approved-v2 网格在每个逻辑像素中心取样时：

- `b` 位置最常见颜色与上述 panel 背景一致；
- 截图中精确 `#17141B` 像素计数为 0；
- `#4A2B24`、`#704739`、`#153A78`、`#F1E8DF`、`#4B2624` 等主体色仍可在截图中直接找到；
- 仍然明显的暗带与发影、制服、袜子和靴子区域一致。

这意味着 `src/sidebar.tsx` 中“dark outline 使用 `backgroundPanel`”的实验改动已在这张截图对应的显示链中生效。`docs/10` 中“尚待用户真实终端复验”的状态应更新为：**已复验，补丁只能消除 outline 类横带，不能解决主体色块造成的割裂。**

### 2.3 修正后的根因链

```text
24×24 自动追踪/程序化清理稿
  -> 发影、制服、袜子存在长水平深色段
  -> 半块字符把相邻逻辑行压入一个字符格
  -> 真实字体和行高强化水平分界
  -> outline 融入 panel 后，主体暗带仍然存在
  -> 角色继续呈现为多层色带
```

结论：继续只改 outline 映射不会收敛；必须用终端原生手绘候选验证 24 与 32 两种画布。

## 3. A/B 美术方案与终端占用

两套候选必须共享同一身份锁定：

- 体型与重心：`design/samples/shigure-concept-a-rounded-v3.png`；
- 制服结构：`design/samples/shigure-concept-a-uniform-v2.png`；
- 发色、蓝眼、脸型、长发和侧辫：`design/references/shigure-reference-photo-1.jpg`；
- 角色为圆润、低重心的少女型桌宠，不加入舰装、武器、场景或漂浮效果。

### 3.1 Candidate A：Regular 24

```text
logical canvas = 24×24
terminal cells = 24×12
compact remains = 16×16 -> 16×8
```

约束：

- 顶部逻辑行 `y=0` 和 `y=1` 全透明，保证第一终端字符行完整留白；
- 左右至少 1px、底部至少 1px 透明安全边距；
- 角色主体建议占 20–21px 高；
- 两帧 idle：中立帧 + 微眨眼/呼吸帧；
- 不从 rounded-v3 或 approved-v2 机械缩放；
- `b` 只允许作与外部透明区相邻的外轮廓；
- 发影、制服和袜色不得形成横跨脸、躯干或双腿的连续色带。

### 3.2 Candidate B：Regular 32

```text
logical canvas = 32×32
terminal cells = 32×16
compact remains = 16×16 -> 16×8
```

约束：

- 与 Candidate A 使用同一姿势、表情、调色板和视觉重心；
- 顶部逻辑行 `y=0` 和 `y=1` 全透明；
- 左右至少 1–2px、底部至少 1px 透明安全边距；
- 新增空间只用于增强椭圆脸、分离双眼、侧辫钩、白侧板、红长领结和裙袜靴分层；
- 不增加发丝噪点、渐变抖动或微小装饰；
- 两帧 idle 的动作幅度和 A 相同，避免因为动画不同影响尺寸选择。

### 3.3 A/B 选择门禁

开发 Agent审核并允许接入后，依次生成两个真实 TUI 构建并截图：

1. dark theme / Candidate A；
2. light theme / Candidate A；
3. dark theme / Candidate B；
4. light theme / Candidate B。

必须固定：OpenCode 版本、终端、字体、字号、缩放、主题、侧栏宽度和状态标签。截图同时保留用户本轮实际截图作为 baseline。

用户选择 A 或 B 前：

- 不展开七状态；
- 不正式改变 `SIZE_DIMENSIONS`；
- 不替换 `FINAL_MANIFEST` 的完整资产；
- 不把临时 selector、环境变量或 probe 资源留在最终 bundle。

推荐的临时接入方式是由开发 Agent在单独的临时提交中顺序接入 A、B 并构建截图；每次只接入一个候选。完成选择后删除 probe 入口，只保留选中的正式契约。不要在生产配置中加入新的用户可见选项。

## 4. 拟议代码改动总览

以下均为**待审核方案**，尚未实施。

| 文件 | A/B 共用 | 仅选 32 时 | 修改目的 | 冲突风险 |
|---|---:|---:|---|---|
| `src/renderer.ts` | 是 | 否 | 显式处理透明半格的 panel 背景 | 中 |
| `src/sidebar.tsx` | 是 | 否 | 传入 `backgroundPanel`；收口实验 outline 行为 | **高：当前已有未提交改动** |
| `src/renderer.test.ts` | 是 | 断言随尺寸更新 | 新 merge table oracle 与显式背景测试 | 低 |
| `scripts/preview-assets.ts` | 是 | 是 | 为预览传入背景色并按实际尺寸输出 | 低 |
| `src/types.ts` | 否 | 是 | `PixelFrame` 支持 32 | 中 |
| `src/manifest-data.ts` | 否 | 是 | `regular` 从 24 改为 32 | **高：尺寸契约中心** |
| `src/manifest.ts` | 资产接入时 | 是 | 校验最终尺寸和顶部完整终端行留白 | 中 |
| `src/placeholder.ts` | 否 | 是 | placeholder 按新 regular 尺寸生成 | 低 |
| `src/manifest.test.ts` | 资产接入时 | 是 | 尺寸与边距合同 | 低 |
| `src/animation.test.ts` | 否 | 是 | 测试 frame helper 支持 32 | 低 |
| `src/registry.test.ts` | 否 | 是 | regular frame 宽度期望从 24 改为 32 | 低 |
| `scripts/audit-art-noise.ts` | 是 | 是 | 支持候选网格、顶部两行、长暗色 run 报告 | 中 |
| `src/audit-art-noise.test.ts` | 是 | 是 | 审计规则与无 IPC CLI 测试 | 低 |
| `scripts/build-final-assets.ts` | 正式资产阶段 | 是 | 改为声明式帧编译，不再程序化改画 | **高：生成资产所有权** |
| `src/assets/final.ts` | 正式资产阶段 | 是 | 由批准的声明式资产确定性生成 | **高：生成文件，不手工并行编辑** |
| 视觉/架构/质量文档 | 正式选型后 | 是 | 更新最终尺寸、资产源和真实 TUI QA | 低 |

明确不修改：

- `src/reducer.ts` 及状态归约；
- SDK/TUI 事件适配；
- `src/animation.ts` 的计时与状态行为（除类型测试适配外）；
- `src/registry.ts` 的会话生命周期；
- 配置键 `enabled`、`size`、`animations`；
- 配置值 `regular | compact`；
- success/error 时长、七状态含义和事件序列；
- 插件入口、命令注册、KV 存储、网络与隐私边界。

## 5. 公共接口与拟议代码

### 5.1 `RenderOptions`

当前：

```ts
export interface RenderOptions {
  transparentIndex: number;
  outlineColor: string;
}
```

拟议：

```ts
export interface RenderOptions {
  transparentIndex: number;
  /** palette 末项 outline token 的主题映射色。 */
  outlineColor: string;
  /** OpenTUI sidebar panel 的实际背景色。 */
  backgroundColor: string;
}
```

影响：`renderFrame` 的所有调用点必须显式传入背景色。该字段不建议设为可选，因为可选值会让旧的“继承父背景”路径继续存在，无法证明透明半格行为一致。

### 5.2 半块合并表

当前行为：

```ts
transparent / transparent -> { text: " " }
color       / transparent -> { text: "▀", fg: top }
transparent / color       -> { text: "▄", fg: bottom }
same color  / same color  -> { text: "█", fg: color }
color A     / color B     -> { text: "▀", fg: A, bg: B }
```

拟议行为：

```ts
transparent / transparent -> { text: " ", bg: backgroundColor }
color       / transparent -> { text: "▀", fg: top,    bg: backgroundColor }
transparent / color       -> { text: "▄", fg: bottom, bg: backgroundColor }
same color  / same color  -> { text: "█", fg: color }
color A     / color B     -> { text: "▀", fg: A, bg: B }
```

接近最终实现的拟议 diff：

```diff
 export interface RenderOptions {
   transparentIndex: number;
   outlineColor: string;
+  backgroundColor: string;
 }

 if (topColor === undefined && bottomColor === undefined) {
-  cell = { text: SPACE_GLYPH };
+  cell = { text: SPACE_GLYPH, bg: opts.backgroundColor };
 } else if (topColor !== undefined && bottomColor === undefined) {
-  cell = { text: TOP_GLYPH, fg: topColor };
+  cell = { text: TOP_GLYPH, fg: topColor, bg: opts.backgroundColor };
 } else if (topColor === undefined && bottomColor !== undefined) {
-  cell = { text: BOTTOM_GLYPH, fg: bottomColor };
+  cell = { text: BOTTOM_GLYPH, fg: bottomColor, bg: opts.backgroundColor };
 } else if (topColor === bottomColor) {
   cell = { text: FULL_GLYPH, fg: topColor };
 } else {
   cell = { text: TOP_GLYPH, fg: topColor, bg: bottomColor };
 }
```

审核点：

- 请确认 OpenTUI `text`/`span` 对空格的 `bg` 写入不会改变布局宽度；
- 请确认 `bg` 在相邻 span 与换行之间不会泄漏；
- 请确认 `FULL_GLYPH` 不需要额外写 `bg`；如 OpenTUI 的 rasterizer 对 `█` 有不同语义，应在审核中调整；
- 合并 run 时继续以 `fg + bg` 完全相同为条件，不改变字符宽度。

### 5.3 `SidebarPet` 主题值

当前实验代码：

```ts
const outlineColor = (): string =>
  props.api.theme.mode() === "dark"
    ? rgbToHex(props.api.theme.current.backgroundPanel)
    : SHIGURE_PALETTE[SHIGURE_PALETTE.length - 1];
```

拟议收口：

```ts
const panelBackground = (): string => rgbToHex(props.api.theme.current.backgroundPanel);

const outlineColor = (): string =>
  props.api.theme.mode() === "dark"
    ? panelBackground()
    : SHIGURE_PALETTE[SHIGURE_PALETTE.length - 1];

return renderFrame(frame(), SHIGURE_PALETTE, {
  transparentIndex: 0,
  outlineColor: outlineColor(),
  backgroundColor: panelBackground(),
});
```

接近最终实现的拟议 diff：

```diff
+const panelBackground = (): string =>
+  rgbToHex(props.api.theme.current.backgroundPanel);

 const outlineColor = (): string =>
   props.api.theme.mode() === "dark"
-    ? rgbToHex(props.api.theme.current.backgroundPanel)
+    ? panelBackground()
     : SHIGURE_PALETTE[SHIGURE_PALETTE.length - 1];

 return renderFrame(frame(), SHIGURE_PALETTE, {
   transparentIndex: 0,
   outlineColor: outlineColor(),
+  backgroundColor: panelBackground(),
 });
```

深色 outline 继续等于 panel 的理由：用户新截图已经证明这一改动不会产生旧的 `#17141B` 黑色 outline 带；A/B 必须先隔离美术画布变量，不在同一轮额外实验新的 outline 对比度。

### 5.4 仅在选择 32×32 后修改的尺寸接口

当前：

```ts
export interface PixelFrame {
  width: 24 | 16;
  height: 24 | 16;
  pixels: Uint8Array;
}

export const SIZE_DIMENSIONS: Record<PetSize, 24 | 16> = {
  regular: 24,
  compact: 16,
};
```

若用户选择 Candidate B，拟议改为：

```ts
export interface PixelFrame {
  width: 32 | 16;
  height: 32 | 16;
  pixels: Uint8Array;
}

export const SIZE_DIMENSIONS: Record<PetSize, 32 | 16> = {
  regular: 32,
  compact: 16,
};
```

说明：

- `PetSize` 仍为 `"regular" | "compact"`，不新增配置值；
- renderer 的算法已经按 `frame.width/height` 循环，本身无需为 32 增加特殊分支；
- manifest、placeholder、预览、资产审计和硬编码测试需要同步更新；
- 24 与 32 不应同时成为生产 `regular` 契约；用户选择后只保留一种；
- 如果选择 A，则完全不修改 `PixelFrame` 与 `SIZE_DIMENSIONS`。

## 6. A/B 临时接入方案

不建议增加永久环境变量或用户配置。拟议流程：

1. 美术候选先存放在非运行时目录，例如：

   ```text
   design/art-v3/candidates/regular-24-idle.json
   design/art-v3/candidates/regular-32-idle.json
   ```

2. 开发 Agent审核后，以临时提交接入 Candidate A：
   - regular 尺寸维持 24；
   - 只替换 probe manifest 的 idle 两帧；
   - 构建、完全重启 OpenCode、捕获深浅主题；
   - 保存 commit hash 和截图元数据。
3. 以第二个临时提交接入 Candidate B：
   - 临时将 regular 尺寸契约改为 32；
   - 同步最小必要类型和 validator；
   - 构建、完全重启、捕获相同环境截图。
4. 用户选择后，以普通反向补丁删除未选候选和所有 probe 接线；不得使用会覆盖工作树的 `git reset --hard` 或 `git checkout --`。
5. `git diff` 和 bundle 搜索必须证明没有 `ART_PROBE`、candidate selector、临时环境变量或未选尺寸残留。

如开发 Agent认为两个临时提交会与当前脏工作树冲突，可在独立工作树/临时分支完成，但不得复制或覆盖用户现有未提交改动。

## 7. 正式资产数据流

当前 `scripts/build-final-assets.ts` 会对追踪种子执行 `trimEdges`、`clearTopGap`、`injectEyes`、`clearScatter`、`writeMasks`、`denoiseIterative`、`hairMend` 和状态派生。该流程会在构建时改变美术，不适合作为新终端原生资产的权威来源。

正式选型后拟议数据流：

```text
design/art-v3/shigure-terminal-art.json
  -> parse + schema validation
  -> art/outline/noise/edge validation
  -> deterministic TypeScript emission
  -> src/assets/final.ts
  -> SHIGURE_MANIFEST
```

声明式源至少包含：

```ts
type ArtSource = {
  version: 3;
  palette: readonly string[];
  sizes: Record<"regular" | "compact", {
    dimension: 24 | 16; // 若选 B 则 32 | 16
    states: Record<PetState, {
      frameDurationMs: number;
      loop: boolean;
      frames: readonly string[][];
    }>;
  }>;
};
```

生成器允许：

- 校验行数、行宽、字符图例和调色板索引；
- 校验帧数、帧时长、循环标志和 required tokens；
- 校验顶部两行、左右、底部安全边距；
- 生成 `Uint8Array` 和导出表；
- 输出审计和预览证据。

生成器禁止：

- 缩放、追踪、去噪或补洞；
- 自动注入眼睛、白边、红结等身份像素；
- 从 idle 程序化派生 thinking/working/waiting/error/retry；
- 自动镜像带不对称发饰/侧辫的帧；
- 为了通过 required token 检查偷偷写入单像素。

`src/assets/final.ts` 应视为生成文件，由一个 Agent运行编译器生成；其他 Agent不得同时手工编辑。

## 8. 美术审计拟议变更

现有 `scripts/audit-art-noise.ts` 已实现：

- rule 1：拒绝内部 `b` 和漂浮 `b`；
- rule 2：拒绝多数非强调色的孤立像素；
- boundary outline cell 计数。

拟议新增：

1. `parseGrid` 在 A/B 审核阶段接受 16、24、32；正式选型后以 source schema 的 dimension 为准；
2. 每帧 `y=0`、`y=1`、`x=0`、`x=width-1`、`y=height-1` 必须透明；
3. 检测暗色 token `hairShadow`、`uniform`、`sockBlack` 的水平连续 run；
4. run 达到阈值时输出 warning 和坐标，不直接自动判定美术失败；
5. warning 必须在真实 TUI 截图中逐项标记为 approved 或 failed；
6. idle 两帧必须存在非零差异，同时脚底基线和外接框不能发生意外跳动。

长暗色 run 建议初始报告阈值：

```text
24×24: >= 6 logical pixels
32×32: >= 8 logical pixels
16×16: >= 4 logical pixels
```

阈值只是审查触发器。头顶发块、裙摆边缘等可能存在合理水平结构，但任何穿过脸、胸前制服或双腿的连续暗带都必须失败。

## 9. 测试变更

### 9.1 `renderer.test.ts`

测试 oracle 的 options 同步增加：

```ts
type RenderOpts = {
  transparentIndex: number;
  outlineColor: string;
  backgroundColor: string;
};
```

五组合预期更新为：

```ts
[
  { text: " ", bg: PANEL },
  { text: "▀", fg: RED, bg: PANEL },
  { text: "▄", fg: GREEN, bg: PANEL },
  { text: "█", fg: RED },
  { text: "▀", fg: RED, bg: GREEN },
]
```

当前失败测试 `keeps fully transparent rows free of fg and bg` 不应再依赖 real manifest 的第一输出行。它需要拆分为：

- 合成 blank frame：透明格显式使用 panel bg；
- 单上半/单下半合成帧：panel bg 正确；
- 资产 validator：独立验证顶部两个逻辑行透明。

尺寸测试应从 `SIZE_DIMENSIONS` 推导，不在测试正文散落硬编码 24/16。选择 B 后 regular 预期自然变为 32×16 terminal cells。

### 9.2 `audit-art-noise.test.ts`

当前三个 CLI 测试通过 `spawnSync("npx", ["tsx", ...])` 启动，沙箱中会因 tsx IPC socket `listen EPERM` 失败。拟议改为无 IPC 的调用方式，例如由开发 Agent验证以下形式：

```ts
spawnSync(process.execPath, ["--import", "tsx", SCRIPT, ...args], {
  cwd: process.cwd(),
  encoding: "utf8",
});
```

如果当前 Node/tsx 版本不支持这一入口，则将 CLI 参数解析与 `main` 暴露为可直接单测函数，仅保留一个在允许 IPC 的集成环境执行的 CLI 冒烟。不得把沙箱权限错误误报为资产失败。

新增审计测试：

- 32×32 grid 解析；
- 顶部第二逻辑行非透明失败；
- 底部或左右边缘非透明失败；
- 长暗色 run 生成 warning；
- idle 两帧相同失败；
- 合法外轮廓仍通过。

### 9.3 完整门禁

代码实施后运行：

```bash
npm test
npm run validate-assets
npm run typecheck
npm run build
```

真实 TUI 门禁：

- 完全重启 OpenCode，确认加载最新 `dist/tui.js`；
- dark/light 各捕获一次；
- A/B 使用相同终端环境；
- 动画开关、regular/compact 切换、会话切换和插件重载无残影；
- 最终七状态在实际尺寸下检查，不以放大 PNG 代替。

## 10. 兼容性与风险

### 10.1 显式背景风险

- OpenTUI 对空格 span 的 `bg` 处理可能与普通 glyph 不同；必须用真实 sidebar_content 验证；
- 如果 `backgroundPanel` 在主题切换时的响应式更新不触发 subtree 重建，需要开发 Agent确认当前 accessor 已读取主题信号；
- 大量显式 bg 可能增加 run 数量，但相邻同背景空格仍会合并，预期影响有限；
- 如果 OpenTUI 的父 panel 存在透明/混色效果，显式 RGB 会冻结最终颜色；当前目标正是与 `backgroundPanel` 一致，需由开发 Agent确认这是期望语义。

### 10.2 32×32 风险

- sidebar 宽度从 24 增至 32 cells，高度从 12 增至 16 rows；
- 小窗口、窄侧栏或 LSP/其他内容较多时更容易拥挤；
- 32 只提升绘制空间，不保证自动解决横带；因此必须先 A/B，不能先改正式契约；
- placeholder、测试和文档若漏改会产生尺寸不一致；
- compact 必须保持独立 16×16，不能从 32 自动缩放。

### 10.3 资产重构风险

- 手工重描可能改善终端但偏离角色身份，必须以三张批准参考做 identity lock；
- 七状态若从单帧机械派生，会重现现有问题；每个状态应作为独立美术交付；
- `hatch-pet` 的身份一致性、状态语义、基线稳定、无漂浮效果和正常尺寸视觉 QA 原则适用；其 192×208 cell、8×11 atlas、16 look directions 和 `spriteVersionNumber: 2` 不适用于本 OpenCode TUI 项目。

## 11. 回滚方案

所有回滚必须使用明确的反向补丁或 `git revert`，不得使用会覆盖当前脏工作树的 `git reset --hard`、`git checkout --` 或广泛删除。

分层回滚：

1. **A/B probe 回滚**：删除临时 probe 接线与未选候选的运行时引用，保留截图和审查记录；
2. **显式背景回滚**：移除 `backgroundColor` 参数及调用点，恢复审核前 merge table；不覆盖用户已有的 outline→panel 实验补丁；
3. **32 尺寸回滚**：将 `PixelFrame`、`SIZE_DIMENSIONS`、placeholder、validator 和测试一致地恢复到 24/16；
4. **资产编译器回滚**：恢复旧 `FINAL_MANIFEST` 入口，但保留新声明式源和 QA 证据供排查；
5. 任何回滚后重新运行完整测试并完全重启 OpenCode。

## 12. 当前工作树与冲突清单

审核时记录到的工作树状态：

- `src/sidebar.tsx`：已修改，内容为 dark outline 映射到 `backgroundPanel` 的实验补丁；
- `docs/10-art-and-terminal-rendering-handoff.md`：未跟踪；
- `.omo/evidence/art-loop/`：存在多张未跟踪诊断预览和文本；
- `.omo/run-continuation/`：存在未跟踪会话记录；
- `.DS_Store`、`.omo/boulder.json`：已有无关修改；
- `src/renderer.ts`、`src/types.ts`、`src/manifest-data.ts`、`scripts/build-final-assets.ts`、测试文件：审核时没有相关未提交 diff。

协作要求：

- 不清理 `.DS_Store`、`.omo` 或 continuation 文件；
- 不重置用户工作树；
- 开发 Agent开始前先重新运行 `git status --short`；
- `src/sidebar.tsx` 的现有 patch 应由开发 Agent接管并在同一提交中收口，其他 Agent不要同时编辑；
- `src/assets/final.ts` 只由资产编译器所有者生成。

## 13. Agent 分工与文件所有权

### 美术 Agent

负责：

- `design/art-v3/candidates/` 下的 24/32 idle 源；
- 角色 identity lock、调色板索引、轮廓和状态动作；
- 深浅主题预览和用户视觉验收说明；
- 正式 `design/art-v3/shigure-terminal-art.json` 的美术内容。

不得修改：

- `src/renderer.ts`；
- `src/sidebar.tsx`；
- `src/manifest-data.ts`；
- 状态机和会话生命周期代码。

### 开发 Agent

负责：

- `src/renderer.ts`、`src/sidebar.tsx`；
- 32 分支的类型、尺寸、placeholder 和 manifest 集成；
- OpenTUI 实际行为、build 和真实 TUI 重启捕获；
- 临时 A/B 接线的创建与彻底移除。

### 测试/审计 Agent

负责：

- renderer oracle；
- art audit 规则；
- manifest/animation/registry 尺寸回归；
- dark/light、尺寸、动画、会话与重载矩阵；
- 检查临时 selector 未进入最终 bundle。

### 单一集成所有者

以下文件必须由一个 Agent串行集成：

```text
src/sidebar.tsx
src/manifest-data.ts
src/assets/final.ts
```

推荐由开发 Agent担任集成所有者，美术 Agent只交付声明式源和验收意见。

## 14. 审核问题清单

请开发 Agent逐项回复。以下为集成所有者（开发 Agent）的逐项答复：

1. 是否同意 `RenderOptions.backgroundColor` 为必填字段？
2. OpenTUI 空格 span 显式 `bg` 是否安全，是否需要对 `FULL_GLYPH` 同时写 bg？
3. `backgroundPanel` 是否会在主题切换时触发当前 Solid accessor 重算？
4. 是否同意深色 outline 在 A/B 阶段继续等于 panel，以隔离画布变量？
5. 是否接受顺序临时提交的 A/B 接线方式，或需要独立 worktree？
6. 选择 32 时，除本文列出的类型、placeholder、validator、preview 和测试外，是否还有隐藏的 24 常量？
7. 是否同意正式生成器只编译/校验声明式帧，禁止程序化改画？
8. CLI 测试应采用 `node --import tsx` 还是直接函数测试？
9. 是否存在当前未列出的并行改动或文件所有权冲突？
10. 是否批准进入代码实施阶段；如不批准，请给出需要更新的条目。

### 14.1 开发 Agent 逐项答复

1. `RenderOptions.backgroundColor` 必填——**同意**。可选会让"继承父背景"旧路径残留,无法证明透明半格行为一致;必填后所有调用点强制显式,符合最小改动且可机械验证。

2. OpenTUI 空格 span 显式 bg 安全性——**需以真实 sidebar_content 验证为前置条件**,不能只靠单测。`FULL_GLYPH`(同色实心块)当前不需要写 bg;若 OpenTUI rasterizer 对 `█` 的 bg 语义不同,在集成验证时调整并在测试 oracle 中固化。合并 run 继续以 `fg+bg` 完全相同为条件,不改变字符宽度。

3. `backgroundPanel` 主题切换响应——**需确认**当前 `props.api.theme.current` accessor 是否订阅了主题信号。若主题切换不触发 subtree 重建,renderer 输出会陈旧;集成验证时必须在 dark/light 各捕获一次确认。

4. 深色 outline 在 A/B 阶段继续等于 panel——**同意**。用户新截图已证明 outline→panel 补丁生效(截图中 `#17141B` 计数为 0),A/B 必须隔离画布变量,不在同一轮混入 outline 对比度实验。

5. 顺序临时提交的 A/B 接线——**接受**,但两个前提:①当前 `src/sidebar.tsx` 已有美术 Agent 的 outline→panel 未提交实验补丁,该补丁必须由单一集成所有者在第一个临时提交中一并收口,不得与其他 Agent 并行编辑;②当前工作树还有 `.omo/` 与 `.DS_Store` 修改,临时提交只 `git add` 与候选接入相关的文件,不 `git add -A`。

6. 选择 32 时隐藏的 24 常量——**需要 grep 全库排查**。已知隐藏点:`src/types.ts` PixelFrame `24|16`、`src/manifest-data.ts` SIZE_DIMENSIONS、`src/placeholder.ts`、`scripts/audit-art-noise.ts` parseGrid、`src/registry.test.ts`、`src/animation.test.ts`、`src/manifest.test.ts`、`scripts/preview-assets.ts`。任何硬编码 `24`/`12` 都要在选型 32 时更新,不能只改 manifest-data.ts。

7. 正式生成器只编译/校验声明式帧、禁止程序化改画——**同意**。这是本计划 todo 7「生成器退役」的延伸;`scripts/build-final-assets.ts` 当前对种子做 trimEdges/injectEyes/denoise 等改画,必须退役为声明式编译(或进 `scripts/legacy/` + 硬守卫)。`src/assets/final.ts` 视为生成文件,单一集成所有者生成,其他 Agent 不并行手工编辑。

8. CLI 测试用 `node --import tsx` 还是直接函数测试——**优先直接函数测试**:将 `parseArgs`/`runAudit`/`main` 拆分,CLI 参数解析与审计逻辑暴露为可直接单测的函数;`node --import tsx` 作为 fallback 仅在当前 Node/tsx 版本支持时用。不得把沙箱 IPC 权限错误(EPERM)误报为资产失败。

9. 并行改动/文件所有权冲突——**有一个已确认冲突**:`src/sidebar.tsx` 当前有美术 Agent 的未提交实验补丁(约 21 行 diff),必须由集成所有者收口;另有 `src/assets/final.ts` 的 TEMP preview(approved-v2,commit 1f6c3a9)在正式资产接入时会被声明式资产替换。其余文件无未提交冲突。

10. 是否批准进入代码实施——**有条件批准**。批准范围:①A/B 候选美术制作(design/art-v3/candidates/ 下的 24/32 idle 源)立即开始;②透明半格显式背景的最小 renderer/sidebar 改动可在临时提交中实施用于 A/B 对比;③**禁止**在 A/B 选型前改 `SIZE_DIMENSIONS` 正式契约、不展开七状态、不把 probe 开关留在最终 bundle。最终选型与正式资产接入需用户授权(见第 15 节)。

## 15. 审核与授权记录

```text
developer_agent_review = approved（原 A/B 与透明半格方案）
reviewer = atlas（开发 Agent/集成所有者）
review_date = 2026-08-05
approved_items =
  - A/B 候选美术制作（design/art-v3/candidates/ 下的 24/32 idle 源）立即开始
  - 透明半格显式背景的最小 renderer/sidebar 改动，可在临时提交中实施用于 A/B 对比
  - 顺序临时提交的 A/B 接线方式（前提条件见 requested_changes）
requested_changes =
  - src/sidebar.tsx 的 outline→panel 未提交实验补丁由单一集成所有者在第一个临时提交中一并收口，不得与其他 Agent 并行编辑
  - 临时提交只 git add 与候选接入相关的文件，不 git add -A
  - OpenTUI 空格 span 显式 bg 需以真实 sidebar_content 验证为前置条件；FULL_GLYPH 不额外写 bg，合并 run 以 fg+bg 完全相同为条件
  - A/B 选型前禁止修改 SIZE_DIMENSIONS 正式契约、不展开七状态、不把 probe 开关留在最终 bundle
  - 选择 32 时全库排查隐藏的 24/12 常量，不得只改 manifest-data.ts
  - 不得把沙箱 IPC 权限错误（EPERM）误报为资产失败
integration_owner = 开发 Agent（单一集成所有者）
user_authorization = approved（用户已明确回复“授权，你开始吧”；仅覆盖上述已审核范围）
authorization_date = 2026-08-05
```

上述授权不自动覆盖后续新增的接口、临时探针或路线切换。新增内容必须在本文档追加审核记录；开发 Agent重新批准后，再由用户明确允许实施。

## 16. 美术 Agent 注意事项(开发 Agent 审核追加)

以下要点供美术 Agent 在制作 A/B 候选与正式资产时遵守。**美术设计全权归美术 Agent(轮廓、像素色块、纹理、细节取舍、姿势与动作幅度均自行决定);开发 Agent 只负责机器门禁与格式契约,不提供美术指导。**

### 16.1 角色身份(锚定,不规定画法)

- 身份来源:体型与重心 `design/samples/shigure-concept-a-rounded-v3.png`;制服 `design/samples/shigure-concept-a-uniform-v2.png`;发色/蓝眼/脸型/长发/侧辫 `design/references/shigure-reference-photo-1.jpg`;圆润低重心少女型桌宠,不加舰装/武器/场景/漂浮效果。
- 以上是用户已批准的视觉方向锁定;**具体如何用像素实现由美术 Agent 全权决定**。
- 两套候选(A 24 / B 32)必须共享同一身份与姿势,只有分辨率差异。

### 16.2 输出格式(机器契约)

- 候选网格:24×24(A)或 32×32(B),每行恰好 24/32 字符,字符集 `.0123456789ab`;
- 存放:`design/art-v3/candidates/regular-24-idle.json` 与 `regular-32-idle.json`(含调色板索引矩阵 + 两帧 idle),不直接改 `src/assets/final.ts`;
- 每版交付附:网格文件、`.sha256`、深浅主题半块预览 PNG、与参考图的对照说明;
- 版本规则:approved-v0/v1/v2 全部保留不覆盖;新候选为 art-v3 命名空间,迭代用 -vN 递增。

### 16.3 机器门禁(接入前由集成所有者运行,不通过则退回;只报告机器可验证问题,不评论美术)

- `npx tsx scripts/audit-art-noise.ts --grid <候选> --size regular --frame idle` 必须 0 违规;
- validateManifest 模拟必须通过:上/左/右边缘透明、required tokens(eyeBlue `4`/ribbonRed `8`/trimWarmWhite `7`/sockBlack `9`)每 (size,state) ≥1;
- 帧 2 眨眼派生:必须有 ≥1 个 `4` 供 `patchFirst("4","5")` 使用;两帧存在非零差异(机器可测);
- 顶部逻辑行 `y=0`、`y=1` 全透明;左右至少 1px、底部至少 1px 透明安全边距;
- 长暗色 run 报告(仅 warning,不自动失败;阈值 24×24 ≥6 / 32×32 ≥8 / 16×16 ≥4):集成所有者输出坐标清单,**如何处理由美术 Agent 决定**。

### 16.4 技术底线(机器可验证,非美术指导)

- 不从 rounded-v3 或 approved-v2 机械缩放(A 与 B 都禁止缩放,32 是独立重绘——缩放必然产生模糊网格,属格式/质量技术事实);
- 不得为通过 required token 检查偷偷写单像素豁免(防门禁作弊);
- 蓝眼 `4`、领结 `8`、白边 `7`、袜 `9` 是豁免 token 索引(机器契约),存在性是门禁检查项;画在哪里、画成什么样由美术 Agent 决定。

### 16.5 与集成所有者的协作循环

- 美术 Agent 产出候选 → 集成所有者跑三门(审计/validateManifest/眨眼派生)→ 合格写临时提交并构建 → 真实 TUI 截图 → 用户 A/B 选型;
- 不合格 → 集成所有者退回并列出**机器可验证的剩余问题**(增量指令只报门禁失败项,不报美术意见),美术 Agent 自行决定如何修;
- 每轮只接入一个候选;选型完成前不展开七状态;
- 正式资产用声明式源 `design/art-v3/shigure-terminal-art.json`,由生成器确定性编译为 `src/assets/final.ts`,美术 Agent 不手工改生成文件。

## 17. 第二次实机截图后的诊断补充（待开发 Agent复审）

### 17.1 新证据与结论边界

用户提供了第二张真实 TUI 截图 `codex-clipboard-50e91562-8dc1-440b-b0ec-5b7fe505c295.png`。截图中的 Candidate A 占用约 24 个逻辑列、12 个终端行；每个 24×24 逻辑像素在屏幕上约放大为 12–14 个物理像素，因此 1px 的斜边和高光位移会成为明显的阶梯或横向色带。

代码复核同时发现，本文第 5 节已获批的显式 panel 背景尚未进入当前实现：

- `src/renderer.ts` 的 `RenderOptions` 仍只有 `transparentIndex` 与 `outlineColor`；
- 透明/透明、颜色/透明、透明/颜色仍未显式写入 panel 背景；
- 上下同色仍输出只有 `fg` 的 `█`；
- `src/sidebar.tsx` 调用 `renderFrame` 时仍未传入 `backgroundPanel`。

因此必须把截图里的问题拆成两类，不能继续用重画同时猜测：

1. **单元格填充问题**：字体栅格、行高、span 背景继承或 `█` 覆盖不完整造成的 panel 漏底/细缝；这类问题应以确定性的 renderer 实验处理。
2. **网格几何问题**：24×24 方形像素被大倍率显示后，斜边、高光和辫子天然形成台阶；显式背景不能消除这类结构。

当前置信度：

- 高：显式 `backgroundColor` 尚未实施，源代码可直接证明；
- 高：截图中的主要棕色阶梯与 `REGULAR_IDLE_ROWS` 的逐行结构一致；
- 中：给 `█` 同时写入同色 `bg` 能消除多少细缝，必须在用户实际终端验证；
- 高：任何 `bg` 补丁都不会消除 24×24 网格本身的阶梯。

本补充遵循“确定性渲染失败先确定性验证；同一根因重复出现后改变策略”的收敛原则。在探针完成前暂停继续重画人物，也不扩展七状态。

### 17.2 四模式单元格填充探针

探针目的不是展示新美术，而是在同一个真实 `sidebar_content`、同一主题、字体、字号和缩放下隔离字符填充行为。使用一个固定主体色（建议当前头发中间色）和真实 `backgroundPanel`，每种模式绘制至少 `6×4` 个连续终端单元，并在左右各保留两个显式 panel 背景单元：

| 模式 | Run | 验证目标 |
|---|---|---|
| A / control | `{ text: "██████", fg: color }` | 当前 `FULL_GLYPH` 基线 |
| B / full+bg | `{ text: "██████", fg: color, bg: color }` | 验证 `█` 字形边缘/行间漏底 |
| C / half+bg | `{ text: "▀▀▀▀▀▀", fg: color, bg: color }` | 验证同色前后景的半块覆盖 |
| D / bg-only | `{ text: "      ", bg: color }` | 完全绕过块字符字形的单元格背景基线 |

同一屏还需绘制四个对应的简单对角线/阶梯样本。探针必须包含深色与浅色主题截图，但第一轮优先用用户问题最明显的深色主题。

拟议的接近最终实现代码仅用于审核说明；开发 Agent可调整放置位置，但不得改变四种语义：

```ts
type FillProbeMode = "fg-full" | "fg-bg-full" | "fg-bg-half" | "bg-space";

function fillProbeRun(mode: FillProbeMode, color: string): Run {
  switch (mode) {
    case "fg-full":
      return { text: "██████", fg: color };
    case "fg-bg-full":
      return { text: "██████", fg: color, bg: color };
    case "fg-bg-half":
      return { text: "▀▀▀▀▀▀", fg: color, bg: color };
    case "bg-space":
      return { text: "      ", bg: color };
  }
}
```

每一条样本的边界必须显式写 panel 色，禁止再依赖父级继承：

```ts
const panel = { text: "  ", bg: backgroundColor };
return [panel, fillProbeRun(mode, color), panel];
```

探针接入规则：

- 只允许存在于开发 Agent拥有的临时提交/临时构建；
- 不新增配置键、环境变量、用户可见开关或持久化状态；
- 建议在临时提交中用固定的开发入口顺序替换宠物内容，截图后整提交反向撤销；
- 不允许 raw ANSI、直接写 stdout 或绕过 OpenTUI renderer；
- 不修改状态机、控制器、事件适配、会话生命周期和动画计时；
- 探针代码与接线不得进入最终 bundle。

### 17.3 探针前必须实施的已审核背景补丁

第 5 节的 `RenderOptions.backgroundColor` 仍是必填字段，透明组合仍按已审核表实现。第二张实机截图使原审核问题“`FULL_GLYPH` 是否需要 bg”成为必须实测的项目；在探针结果出来前，不直接改变正式的同色合并行为。

正式 renderer 的基线候选保持：

```ts
interface RenderOptions {
  transparentIndex: number;
  outlineColor: string;
  backgroundColor: string;
}

transparent / transparent -> { text: " ", bg: backgroundColor }
color       / transparent -> { text: "▀", fg: top,    bg: backgroundColor }
transparent / color       -> { text: "▄", fg: bottom, bg: backgroundColor }
same color  / same color  -> probe 决定
color A     / color B     -> { text: "▀", fg: A, bg: B }
```

探针后的 `same color / same color` 只能从以下结果中选择，并在测试 oracle 中固化：

```ts
// B 胜出
{ text: "█", fg: color, bg: color }

// C 胜出
{ text: "▀", fg: color, bg: color }

// D 明显胜出且 B/C 仍有缝
// 停止把半块 renderer 当作高保真画布，进入第 17.5 节路线评估。
```

### 17.4 结果判定与硬停止门槛

所有判定以真实 TUI 截图为准，单元测试只验证输出契约。

1. **A 有缝，B/C 无缝**：确认是 `█` 或背景填充问题；选择 B/C 中边缘更稳定者，实施显式背景并重新验证当前候选。
2. **A/B/C 有缝，D 无缝**：字符字形路径在该终端/字体组合下不可靠；正式路线改为背景单元格绘制，半块只作为少量边缘修饰或完全禁用。
3. **四种模式实体色块都干净，但对角线均明显**：renderer 技术上通过，问题属于 24×24 网格几何；停止继续重画 24×24 半块人物。
4. **B/C 修掉细缝，但当前人物仍有横向/斜向切割感**：不得再以清噪、补洞、换 outline 或局部像素修补继续循环；进入终端单元格原生设计。
5. **任何模式在主题切换、完整重载或动画帧切换后残留**：视为 OpenTUI 生命周期/重绘问题，由开发 Agent先解决，不进入美术设计。

硬停止条件：显式背景实验后，用户实际截图仍将棕色台阶识别为“斜杠/横杠”，则 24×24 半块高保真路线判定失败。失败后不得制作 32×32 半块 B 版来赌更高分辨率；先评估第 17.5 节的终端原生单元格路线，因为 32 列会增加侧栏占用且仍保留阶梯机制。

### 17.5 后续路线（探针之后才选择）

#### 路线 T：终端单元格原生设计（首选可移植方案）

- 直接按终端字符格比例设计，例如 `18×11` 或 `20×12` 单元，而不是先画方形像素再纵向压成半块；
- 主体使用带 `bg` 的空格填充完整单元格；仅在真实探针证明可靠时少量使用 `▀/▄` 修边；
- 保留宽发、椭圆脸、蓝眼、侧辫、白侧板、红结、裙袜靴等身份锚点，但接受“终端吉祥物图标”而非高保真像素立绘；
- 先只做 neutral 与 blink/breathe 两帧，用户实机批准后再展开七状态；
- 新尺寸/布局契约必须另写接口审核，不复用当前 `PixelFrame 24|16` 假装兼容。

#### 路线 I：宿主级原生图片（高保真但非当前插件内最小改动）

- 通过 OpenTUI/OpenCode 正式暴露的图片 Renderable 使用 Kitty Graphics/Sixel/iTerm2 等协议显示透明 PNG；
- 当前项目的 `@opentui/core`/`@opentui/solid` 版本为 `0.4.5`，本地公开类型中能看到 `kitty_graphics`/`sixel` 能力检测，但未发现可由该插件安全使用的 Image Renderable；
- 插件不得自行向 stdout 注入图片协议，因为宿主拥有光标、重绘、滚动和清理生命周期；
- 只有宿主提供正式 Renderable、删除/重绘语义、能力降级和 tmux/SSH 策略后才进入此路线；否则不纳入本轮实现。

Braille、象限块和 `░▒▓█` ASCII 可作为风格实验，但多色角色身份和跨字体一致性弱，不列为主路线。

### 17.6 本次新增预计文件范围

本补充审核通过后，探针阶段预计涉及：

| 文件 | 变更 | 生命周期 | 所有者 |
|---|---|---|---|
| `src/renderer.ts` | 实施已审核的必填 `backgroundColor`；正式同色行为等待探针 | 保留 | 开发 Agent |
| `src/sidebar.tsx` | 传入真实 panel 色；临时接入探针 | 背景接线保留，探针接线删除 | 开发 Agent（单一集成） |
| `src/renderer.test.ts` | 五种半块组合、显式 panel、run merge；探针结果后增加同色 oracle | 保留 | 开发/测试 Agent |
| 临时 probe helper（路径由开发 Agent审核决定） | 四模式和对角线样本 | 截图后删除 | 开发 Agent |
| `docs/11-terminal-art-rendering-code-change-review.md` | 记录截图、结果和最终选择 | 保留 | 集成所有者 |

探针阶段明确不修改：

- `src/assets/final.ts` 和任何候选美术；
- `src/types.ts`、`src/manifest-data.ts`、`src/manifest.ts` 与尺寸合同；
- `scripts/build-final-assets.ts` 和资产生成链；
- 状态机、控制器、事件适配、配置键和值、会话生命周期；
- 七状态帧和 Compact 16×16。

### 17.7 测试、截图与回滚

代码层验证：

- `transparent/transparent`、`color/transparent`、`transparent/color`、`same/same`、`different/different`；
- 显式 panel 色在 run 输出中存在；
- run 合并仍比较 `fg + bg`；
- 主题切换后重新计算 `backgroundPanel`；
- probe helper 如单独成文件，测试四模式输出后随 helper 一起删除，不进入长期测试面。

真实 TUI 截图矩阵：

1. dark / 四模式实体块 + 对角线；
2. light / 四模式实体块 + 对角线；
3. 胜出模式 / 当前 Candidate A 静态帧；
4. 胜出模式 / Candidate A idle 两帧动画；
5. 胜出模式 / 完整重载与主题切换。

所有截图固定 OpenCode、终端、字体、字号、缩放、侧栏宽度和主题。每张截图记录模式、commit、终端及字体信息，禁止只看脚本生成预览。

回滚：探针必须是可单独反向提交的临时改动；截图后删除 helper 与接线。若显式背景补丁导致布局或主题回归，使用明确反向补丁恢复第 5 节之前的 merge table，不重置工作树、不覆盖 `src/sidebar.tsx` 既有修改。

### 17.8 第二次审核与授权门禁

请开发 Agent逐项回复：

1. 是否确认当前代码确实尚未实施第 5 节的 `backgroundColor`？
2. 是否批准 A/B/C/D 四模式探针语义及 `6×4` 最小样本？
3. 临时 probe helper 放在哪个文件，如何保证不进入最终 bundle？
4. 是否同意探针前不改变正式 `same/same` 行为，探针后再选择 `█ fg+bg` 或 `▀ fg+bg`？
5. OpenTUI 的主题 accessor、空格 bg、行间填充和重载生命周期还需补充哪些真实验证？
6. 是否同意“显式背景后仍被用户识别为斜杠，即停止 24×24/32×32 半块高保真路线”的硬门槛？
7. 是否确认插件层当前没有安全、受宿主管理的原生图片 Renderable；如有，请给出准确接口和生命周期约束？
8. 是否批准第 17.6 节文件范围与单一集成所有权？

### 17.9 开发 Agent 逐项答复(集成所有者)

1. **是否确认当前代码确实尚未实施第 5 节的 `backgroundColor`?** —— **确认属实,源代码可直接证明**:`src/renderer.ts` 第 25-30 行 `RenderOptions` 仍只有 `transparentIndex` 与 `outlineColor`;`src/sidebar.tsx` 第 133-135 行调用 `renderFrame` 时只传这两个字段。透明/透明、色/透明、透明/色仍无显式 `bg`,同色 `█` 只写 `fg`。第 17.1 节声明与代码一致。
2. **是否批准 A/B/C/D 四模式探针语义及 `6×4` 最小样本?** —— **批准**。四种模式语义正确隔离了 `█` 字形边缘、半块覆盖、空格背景三条独立路径;`6×4` 连续单元 + 左右各 2 个显式 panel 单元足够观察行间漏底。补充两点:①探针必须同时含深/浅主题两轮截图(第一轮深色优先,与 17.2 一致);②四模式需与四个对角线/阶梯样本同屏,判定才能区分"字形问题"与"网格几何问题"。
3. **临时 probe helper 放在哪个文件,如何保证不进入最终 bundle?** —— 建议 `scripts/fill-probe.ts`(开发 Agent 所有,临时)。保证不进 bundle 的三道闸:①只从 `src/sidebar.tsx` 的临时分支引用(不经过正式导出路径);②最终 bundle 验证用 `grep -c "fillProbeRun\|FillProbeMode" dist/tui.js` 断言 0 命中;③探针完成后整提交反向撤销(`git revert` 探针提交),不留 `--force` 逃生口。
4. **是否同意探针前不改变正式 `same/same` 行为,探针后再选择 `█ fg+bg` 或 `▀ fg+bg`?** —— **同意**。`same/same` 是高频路径,探针前改动会污染判定;探针结果出来后按 17.3 的胜出表固化到 renderer oracle 测试。
5. **OpenTUI 的主题 accessor、空格 bg、行间填充和重载生命周期还需补充哪些真实验证?** —— 四项验证必须在真实 TUI 截图矩阵中覆盖:①主题切换时 `props.api.theme.current` 是否触发重算(切深/浅主题各截一次对比);②空格 span 显式 `bg` 不改变布局宽度;③`█`/`▀` 行间细缝(用 17.2 的 D 模式对比 B/C);④完整重载(重开会话)与动画帧切换后无残留。
6. **是否同意"显式背景后仍被用户识别为斜杠,即停止 24×24/32×32 半块高保真路线"的硬门槛?** —— **同意,且这是本审核最关键的决策点**。硬门槛成立的前提:探针 B/C/D 模式实体色块都干净、但当前人物仍被识别为斜杠——这证明问题属于网格几何而非渲染器。此门槛下**同时停止 32×32 半块 B 版**(17.4 硬停止条件一致),因为 32 只增加侧栏占用、不消除阶梯机制;后续评估路线 T(终端单元格原生设计)。该门槛涉及美术路线根本转向,最终由用户拍板,开发 Agent 负责提供探针证据。
7. **是否确认插件层当前没有安全、受宿主管理的原生图片 Renderable?** —— **确认**。`@opentui/core@0.4.5` 的公开类型(`node_modules/@opentui/core/dist/`)中未发现可安全使用的 Image/kitty/sixel Renderable;插件不得自行向 stdout 注入图片协议(宿主拥有光标/重绘/滚动/清理生命周期)。路线 I 仅在宿主提供正式 Renderable 后才进入评估,本轮不纳入。
8. **是否批准第 17.6 节文件范围与单一集成所有权?** —— **批准**。文件范围(renderer.ts / sidebar.tsx / renderer.test.ts / 临时 probe helper / docs/11)正确;`src/assets/final.ts`、types.ts、manifest-data.ts、manifest.ts、资产生成链、状态机、七状态与 Compact 16×16 全部明确排除;单一集成所有者=开发 Agent,与第 13 节一致。

状态记录：

```text
diagnostic_addendum_review = approved
reviewer = atlas（开发 Agent/集成所有者）
review_date = 2026-08-05
approved_probe = A/B/C/D four-mode fill probe（6x4 cells, dark/light, 4 diagonal samples on-screen）
probe_helper_path = scripts/fill-probe.ts（临时, 截后随提交反向撤销）
same_color_decision = pending-real-tui-probe（B/C 胜出后固化到 renderer oracle）
native_image_renderable = confirmed-absent（@opentui/core 0.4.5 无受宿主管理的图片 Renderable）
requested_changes =
  - 探针必须含深/浅两轮截图, 四模式与对角线样本同屏
  - dist/tui.js 以 grep -c "fillProbeRun|FillProbeMode" == 0 验证探针不残留
  - 探针完成后 git revert 探针提交, 不留 --force 逃生口
  - 显式背景补丁按第 5 节 merge table 实施, 探针前不改变 same/same 行为
user_authorization_for_probe = approved（用户 2026-08-05 授权四模式探针执行,并接受第 17.4 硬门槛:显式背景后仍识别为斜杠即停 24×24/32×32 半块高保真路线,转路线 T）
authorization_date = 2026-08-05
```

在 `diagnostic_addendum_review = approved` 且 `user_authorization_for_probe = approved` 前，只允许编辑本文档；不得修改 `src/`、测试、构建脚本、运行时配置或资产。
