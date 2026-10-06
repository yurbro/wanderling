# Wanderling 风格指南 v0 与生图提示词

日期：2026-10-04，角色设计与文风更新于 2026-10-06（会话 19）
用途：所有美术（明信片、地标、道具、角色参考）生成与验收的唯一依据。代码里的天空与大地色板与本文一致。

## 1. 一句话

手绘、安静、留白。像一本被翻旧了的旅行手账：铅笔感的轮廓线、低饱和的暖色、纸的质感、没有光效。

## 2. 参考与禁忌

参考：旅行青蛙（旅かえる）的插画；昭和时代日本旅行海报的留白；水彩明信片。

禁忌：写实渲染、3D 质感、强渐变、镜头光晕、霓虹色、堆砌细节、任何文字与水印、人脸特写。

## 3. 色板（与代码一致）

天空由代码按太阳高度实时插值，插画只需参考大致氛围：

| 时段 | 天顶 | 地平线 |
|---|---|---|
| 夜 | #1C2240 | #343B5E |
| 暮 | #5C6498 | #C78E8B |
| 日落 | #7F86B0 | #E6AA8E |
| 日 | #A6CBE3 | #E4EEF2 |

大地：远山 #A7B8B4，中山 #7E9A8C，近山 #587868，地面 #A4A684，小路 #D9CFAE。

纸与墨：纸 #F4EFE4，墨 #343A4D。

点缀：暖黄（灯光、太阳）#F8EBC0，砖红 #B86B5A，靛蓝 #4D5B8A。

规则：一张图里不超过 6 到 8 个色相；大面积用灰调；饱和色只给一个焦点物（一盏灯、一面旗、一个邮筒）。

## 4. 线条与质感

- 轮廓线用深灰褐（约 #4A4A52），不用纯黑；粗细略有变化；允许轻微手抖和断线。
- 填色可以略微出界（像蜡笔或水彩没对准），这是手绘感的关键。
- 纸纹在后处理里统一叠加，不要让生图工具画强纹理。场景里试过两种代码纸纹（逐像素噪点像照片颗粒，大块斑驳又雾蒙蒙），都去掉了（会话 23）；现在场景只靠山脊、地面交界和小路边缘的铅笔线（粗细游走）和贴图旅人的轮廓线统一语气。
- 无投影，或只有非常淡的接地阴影。

## 5. 构图规格

### 明信片（每个地点一张）

- 3:4 竖版，输出 1536×2048 或工具允许的最接近尺寸。
- 主体居中偏下，占画面 50% 到 60%；上方留干净的天空。
- 可选一个很小的旅人背影，位于下三分之一，身高不超过画面高度的 8%。
- 四周留 6% 到 8% 的留白边框，像真的明信片。
- 没有文字。

### 地标与道具（场景内使用）

- 透明背景 PNG，1:1 或 4:5。
- 平视或略仰视，正面或四分之三侧面。
- 平光，无方向性阴影（场景会按昼夜统一调色）。
- 底边干净，便于放在地面上。

### 角色设计（供代码绘制参考）

旅人是一只「wanderling」小生物，不是人类背包客（设计决策 D1，详见 `docs/design/decisions.md` 第 5 节）。定稿的三视图、动作表和比例数字在 `docs/design/art/`（先读其中的 README.md）。生图只用来定比例和配色，场景里会动的他仍由代码绘制。

- 正面与侧面各一张，站姿，平静表情，1:1，纯白背景。
- 身体：头身一体的圆团子（略呈蛋形，宽约为高的 0.9），米白色，略带纸感。没有单独的头。
- 头顶一片小叶子：跟真实风向、风速摆动。叶子竖起是好奇，耷拉是困。
- 眼睛：两个墨点，可以睁、眨、弯成笑眼。没有嘴。
- 围巾：砖红 #B86B5A，尾巴随风飘，是全画面唯一的饱和焦点物。
- 背包：高度约为身体的 0.8 倍，颜色 #9C8A6A，大半藏在身体后面，以后挂行囊里的那件东西。
- 两条短腿，两只很小的手。画面里身高约为屏幕高度的 8%。
- 拆成 8 个可动部件：身体、叶子、眼睛、围巾尾、背包、两腿、双手。

## 6. 提示词模板（英文）

基础风格后缀，每条都加：

```
hand-drawn illustration in the style of a quiet Japanese travel journal, soft pencil outlines, muted warm palette, flat colors with slight watercolor texture, generous negative space, subtle paper texture, no gradients, no lens flare, no text, no watermark, minimal details, calm and cozy mood
```

明信片：

```
A postcard illustration of {landmark} in {place}, at {time of day}, {weather}. The landmark sits in the lower center of the frame with a clean open sky above. A tiny traveler with a backpack is seen from behind in the lower third, very small. Thin white border like a real postcard. Portrait 3:4. {style suffix}
```

地标与道具：

```
A single {object} on a plain white background, front three-quarter view, flat lighting, no cast shadow, clean bottom edge, centered, {style suffix}
```

角色设计：

```
Character design sheet of a tiny round creature called a wanderling: a soft bean-shaped body with no separate head, cream colored, two small dot eyes, no mouth, a single small leaf growing from the top of its head, a brick-red scarf, a large travel backpack bigger than half its body, two short legs and two tiny arms. Front view and side view, standing, calm expression, plain white background, {style suffix}
```

负面提示（支持负面提示的工具使用）：

```
photorealistic, 3D render, glossy, neon, dramatic lighting, lens flare, text, watermark, busy background, extra limbs
```

工具提示：ChatGPT 图像生成可上传锚点图作为参考以保持风格一致；Recraft 可直接出矢量图，适合地标和道具；Midjourney 用 --sref 固定风格。

## 7. 风格锚点：先生成这 5 张

1. 海边灯塔，傍晚，小雨（测试雨天与暖光）。
2. 山谷小村，清晨，薄雾（测试留白与远近层次）。
3. 沙漠公路，正午，晴（测试高亮与简洁）。
4. 雪夜小城，夜晚，下雪（测试夜景与灯光）。
5. 春天的林间小路，白天，晴（测试绿色系与植被）。

每张生成 3 到 4 版，各挑 1 张。锚点定下来之后，所有后续的图都要「和锚点放在一起不突兀」。

## 8. 验收清单（入库前逐条看）

- 色相不超过 8 个，整体偏灰。
- 轮廓线不是纯黑，粗细有变化。
- 没有渐变天空、没有光晕。
- 没有任何文字、水印、签名。
- 明信片：主体位置与留白符合规格，天空干净。
- 地标：背景透明，底边干净。
- 和 5 张锚点放在一起看不突兀。

## 9. 交付方式

把挑中的原图上传到对话里，命名 `postcard-{place-slug}.png`、`prop-{name}.png`、`character-{name}-front.png`；Claude 负责去背景、统一色板、叠纸纹、裁切并入库。

## 10. 文风与文案红线

旅人说的每一句话都算美术的一部分。规则与 `docs/design/decisions.md` 第 6 节一致，以那里为准。

性格：好奇、慢吞吞、有点迷糊，很认真地对待小事。他不完全懂人类的东西。他会想你，但从不怪你。

- 第一人称，短句，每句不超过 12 个英文词。只写看到的、碰到的，不写道理。
- 把人类的东西说得稍微偏一点：雨伞是「会走的屋顶」，火车是「一座会跑的房子」。
- 除了一句天气关心，从不提醒用户做事；从不提用户多久没来。
- 禁用句式：「你错过了」「好久不见」「连续 X 天」，以及任何让人内疚的说法。
- 不在日常文案里出现使用时长、打开次数；出发天数只在里程碑信里用。
- 中文文案不用破折号「—」。
- 所有文案走 `i18n.ts`，入库前按以上红线检查。

样句：

- Your sky was grey this morning. Mine too. I think the clouds are following me.
- I found a bench that faces the sea. I sat for a very long time. Benches are good.
- Rain tomorrow where you are. Bring your walking roof.
