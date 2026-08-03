# 时雨概念样本生成记录

> 目标文件：`shigure-concept-a.png`、`shigure-concept-b.png`  
> 生成方式：Codex 内置 ImageGen，每个方向独立调用  
> 当前状态：A/B 已于 2026-08-02 通过 Codex 内置 ImageGen 生成，并复制到本目录；此前的网络失败已重试恢复。

本文件保留可复现提示词和检查标准。概念板不是最终可发布精灵，也不是终端图像协议载荷；它们用于确认比例、轮廓、颜色与两档尺寸的信息取舍。最终运行时仍需由美术/构建 Agent 输出可验证的 24×24、16×16 调色板索引帧。

## 已生成文件

- [A：圆润陪伴型](shigure-concept-a.png) — 1536×1024 概念板。
- [B：纤细安静型](shigure-concept-b.png) — 1536×1024 概念板。
- [A 初版存档](shigure-concept-a-v1.png) — 仅用于回溯，不再作为当前视觉基准。
- [A 制服 v2（次选）](shigure-concept-a-uniform-v2.png) — 服饰结构参考。
- [A 圆润体型 v3（主选）](shigure-concept-a-rounded-v3.png) — 主视觉基准。
- [用户主参考图](../references/shigure-reference-photo-1.jpg) — 只参考脸型、发型、制服、袜靴和气质；舰装全部排除。

两张图都包含带逻辑网格的 Regular/Compact 放大视图，以及压缩终端字符格的示意预览。底部预览是视觉说明，不应被当作已导出的 ANSI 字符串或最终像素矩阵。

## 当前选定方向：A 圆润体型 v3

方向 A 的 v3 已被选定。当前基准是“更圆润的桌宠重心 + 不幼儿化的少女脸”：头身关系更接近最初 A，脸部仍小巧柔和，长发自然披散，单侧细辫垂到胸前；制服结构以 v2 为次选参考，包含白色侧板、红色长领结、红边短裙、黑色过膝袜和深红棕短靴。

当前主样本：`shigure-concept-a-rounded-v3.png`。次选参考：`shigure-concept-a-uniform-v2.png`。旧版 `shigure-concept-a.png`、`shigure-concept-a-v1.png` 和 B 方向图不得被美术 Agent 当作主基准。

## 制服修订候选 v2

用户要求保留当前 A 的外形，只让水手服更贴近主参考图。v2 的变化范围限定为服装：

- 深灰/深海军色水手上衣，白色领口与侧边板块。
- 红色长领结/垂直红色装饰，以及短裙的细红边。
- 黑色过膝袜保持独立分段，不改为连裤袜。
- 深红棕短靴，保留浅色鞋口但省略复杂鞋带、扣件和装甲。
- 不加入舰装、炮塔、鱼雷、枪械或机械背包。

v2 现在是次选制服参考，不是体型主基准。若 v3 细节无法落地，允许回看 v2 的制服结构，但不得把 v2 的较纤细体型带回主设计。

v2 生成约束摘要：保留当前 A 的脸、发型、单侧细辫、眼睛、身材比例和四格像素板；只参考主参考图的制服结构。服装采用深海军/炭黑水手上衣、暖白领口与侧边板、红色长领结、红边短裙、黑色过膝袜、深红棕短靴；忽略参考图中的枪械、炮塔、鱼雷、舰装、装甲和机械背包。

## 圆润体型候选 v3

v3 以 v2 制服与外貌为硬约束，只参考最初 A 的比例：头部相对更大、肩胯更柔和、四肢更短、重心更低、更像桌面陪伴宠物。v3 不恢复初版的大圆幼儿脸，也不恢复初版的旧制服。

## Direction A — 圆润陪伴型

预期输出：`shigure-concept-a.png`

```text
Create a polished square pixel-art CHARACTER CONCEPT BOARD for a terminal sidebar pet. Direction A: very round, comforting, low head-to-body ratio chibi, about 2 heads tall, gentle quiet companion energy. Character identity: petite anime girl inspired by Shigure; long deep chocolate-brown hair, side-swept bangs, one clearly visible thin side braid hanging over the chest on the viewer's right, bright blue eyes, dark navy sailor uniform with crisp white trim, vivid red chest bow, short dark skirt, black thigh-high socks, dark ankle boots. No weapons, no ship rigging, no turrets, no torpedoes, no machinery, no props.

Board layout on a flat neutral warm-gray background, no scene: left panel shows one enlarged front-facing idle sprite designed on a strict 24×24 logical pixel grid; right panel shows a separately redrawn enlarged compact idle sprite designed on a strict 16×16 logical pixel grid; bottom strip shows both sprites again at tiny actual terminal-preview scale. Keep four sprite displays clearly separated, aligned, and uncropped. The compact sprite must preserve blue eyes, side braid, red bow, and sailor collar silhouette rather than simply shrinking the larger sprite.

Visual style: authentic hand-placed pixel art, hard square pixel edges, nearest-neighbor enlargement, no anti-aliasing, no smooth vector curves, no gradients, no glow, no particles, no translucent effects. Limited 12–16 color palette with readable silhouette and restrained highlights. Idle pose: feet planted, arms relaxed close to body, subtle calm smile, modest posture. Concept art only, not a final animation sheet. No text, no numbers, no labels, no logo, no watermark.
```

## Direction B — 纤细安静型

预期输出：`shigure-concept-b.png`

```text
Pixel-art technical concept board, Direction B, for an OpenCode terminal sidebar pet. Four separated views on a plain cool slate background: enlarged 24x24 logical-pixel idle sprite at left on a visible square grid; independently redrawn enlarged 16x16 compact idle sprite at right on a visible grid; two tiny bottom terminal previews made from colored half-block cells, conveying 24x12 and 16x8 character footprints. No readable labels or text.

Same calm Shigure-inspired petite anime girl in every view: noticeably slender quiet chibi, about 2.4 heads tall, long deep chocolate-brown hair and side bangs, one thin side braid hanging over the chest on viewer-right, bright blue eyes, dark navy sailor uniform with crisp white trim, vivid red chest bow, short dark skirt, black thigh-high socks, dark ankle boots. Front idle pose, feet together, arms relaxed, gentle expression. Compact version is a deliberate redraw, not a resized copy; preserve eyes, braid, red bow, white sailor collar.

Authentic hand-placed pixel art, coarse square pixels, strict logical grids, nearest-neighbor edges, limited 12-16 colors, hard edges, no antialiasing, gradients, glow, shadows, particles, symbols, scenery, weapons, ship rigging, turrets, torpedoes, machinery, armor, props, emoji, logo, watermark, or photorealism. Make B clearly more vertical and slender than a round chibi concept.
```

## Direction A 修订版 — 当前主提示

本次修订使用 [用户主参考图](../references/shigure-reference-photo-1.jpg) 作为外貌参考，并使用 A 初版只作为版式参考。实际目标是“保留 A 的圆润陪伴感，但降低幼儿化”，不是回到 B 的纤细比例。

```text
Revise Direction A into a more graceful, reference-faithful round companion chibi. Use the supplied Shigure appearance reference for the face, hair, braid, uniform, stockings, and boots; ignore all heavy ship equipment. Keep a low, friendly A-direction silhouette, but make the face a soft small oval/heart shape instead of an oversized baby face, and make the body petite and lightly slender.

Show four separated technical pixel-art views: an enlarged 24x24 logical-pixel Regular idle sprite on a visible grid, an independently redrawn 16x16 Compact idle sprite on a visible grid, and two tiny bottom terminal-cell previews communicating 24x12 and 16x8 footprints. Preserve a coarse square pixel grid, hard nearest-neighbor edges, and a limited 12–16 color palette.

Character: calm petite anime girl, deep chocolate-brown long hair ending near the chest, natural side bangs and loose strands, one thin side braid hanging over the chest on the visible side of the supplied reference, bright clear light-blue eyes, dark navy/charcoal sailor uniform with warm-white trim, vivid red sailor neck ribbon/bow with slightly longer tails, short dark skirt, matte black thigh-high stockings (not tights), dark red-brown/black ankle boots. Keep the five anchors: brown hair, blue eyes, single side braid, dark sailor uniform with white trim, red ribbon.

No complete ship rigging, turrets, torpedoes, gun barrels, mechanical backpacks, armor, weapons, ocean, battle pose, mature/sexy proportions, pure black hair, twin tails, thick braid, props, scenery, particles, glow, shadows, text, logo, watermark, vector art, or photorealism.
```

## 生成后检查

- 四个展示均完整：放大 Regular、放大 Compact、两档实际尺寸预览。
- A 明显更圆、更低头身；B 明显更纤细、更安静。
- Compact 是独立重绘，不是缩放模糊版本。
- 蓝眼、单侧细辫、红结、白边水手领均可辨认。
- 无舰装、武器、机械结构、场景、文字、logo 或水印。
- 没有抗锯齿、渐变、半透明光效或不规则像素边缘。

若某个方向不满足上述条件，应只重试该方向，不改动另一个已通过的样本。
