# 地形套件：让背景和旅人同一种画风

2026-10-07 起草（会话 24）。同日 Yu 生成了丘陵的两张图，已接进场景（见文末「已完成」）。评审 v1 的 P9 定了「场景用地形套件程序组合」，这份文件把它落到可以生图的清单。先做一种地形「丘陵」试水，Yu 看了觉得对再铺开到其余七种。

## 做法一句话

背景仍由代码分层、视差、按时间和天气套色，只是每一层的「填色」从一块平涂色换成一张手绘的灰阶画。所以：

- 画成灰阶（接近白的底加浅灰水彩纹理，深灰褐 #4A4A52 的铅笔轮廓线），颜色由代码按天空实时套上去。画了颜色反而用不了。
- 山脊条要能左右无限平铺。生图很难画出真正的无缝条，所以我用「镜像接龙」：一张条加它的镜像拼成一张，两头自然接上。只要求左右两端的高度差不多就行。
- 每一层一张透明 PNG，由我抠图、裁切、入库，流程和旅人部件表一样。

## 代码怎么用这些图

| 层 | 现在 | 换成套件后 |
| --- | --- | --- |
| 远山、中山、近山 | 三条正弦山脊的多边形，各自视差滚动 | 三条画好的山脊带子，各自视差滚动；竖向按地形的起伏系数拉伸 |
| 地面 | 平色矩形加小路 | 平铺的草地带子加小路带子 |
| 地面小物 | 代码画的草丛、石头、小花 | 画好的小贴图，三种各几张随机 |
| 云 | 代码画的圆堆 | 画好的云，三四种 |
| 路牌、路灯、小屋 | 代码画 | 画好的道具（第二张图） |
| 天空、太阳、月亮、星、雨雪、雾、海 | 代码画 | 不变 |

## 第一张图：丘陵的四条带子

文件名：`terrain-hills-layers.png`。横版，建议 2048×1024 或工具允许的最宽尺寸。纯白背景，没有文字。

| 编号 | 带子 | 要求 |
| --- | --- | --- |
| 1 | 远山 | 最矮最平缓的一条起伏山脊，占画面宽度全部，高度约为画面的 12%；山脊线用铅笔线，填充近白加极淡的水彩纹理 |
| 2 | 中山 | 起伏略大，有两三个圆润的山头，高度约 16% |
| 3 | 近山 | 起伏最明显，山头圆润，可以有一两处小树丛剪影，高度约 20% |
| 4 | 地面 | 一条草地带子，上缘略有起伏，下缘平直，带一点草的笔触，高度约 14% |

四条从上到下排列，彼此之间留白，不重叠。每条的左端和右端高度尽量一样，便于平铺。所有山的底边必须平直并延伸到带子底部（我会用底边对齐）。

提示词：

```
A parts sheet of landscape layers for a paper-cut parallax scene, in grayscale for later tinting. Four separate horizontal bands stacked top to bottom on a plain pure white background, each band spanning the full width, with white gaps between them, nothing overlapping, no labels, no text, no sky, no sun, no shadows:
1. a low, gentle line of distant rolling hills;
2. a line of middle-distance rolling hills with two or three round tops;
3. a line of near rolling hills with rounder, bolder tops and one or two small clumps of trees in silhouette;
4. a band of flat grassy ground with a slightly uneven top edge and a straight bottom edge.
Each band is a solid filled shape with a flat bottom. Fill is near-white with faint grey watercolor texture; outlines are soft dark grey-brown pencil lines of slightly varying thickness. The left and right ends of each band are at the same height so it can repeat. {style suffix}
```

`{style suffix}` 用风格指南第 6 节的基础风格后缀，但把其中的 muted warm palette 换成 grayscale only。

## 第二张图：丘陵的小物和道具

文件名：`terrain-hills-props.png`。方版 2048×2048，纯白背景，网格排列，彼此留白。这张可以带颜色，颜色按风格指南色板：草 #7E9A8C 和 #587868，石头 #A4A684，小花 #F4EFE4 加一点 #B86B5A，木头 #8C7355，墙 #E8DEC3，屋顶 #9E7A6A，灯光 #F8EBC0。

| 编号 | 物件 | 数量 | 要求 |
| --- | --- | --- | --- |
| 1 | 草丛 | 4 | 几笔的小草簇，大小略不同 |
| 2 | 石头 | 3 | 圆润的小石头 |
| 3 | 小花 | 3 | 一两朵一簇的小野花 |
| 4 | 云 | 4 | 圆润的卡通云，大小不同，近白填充加轻微纹理 |
| 5 | 路牌 | 1 | 木头立柱加两块指向右边的箭头板，没有字 |
| 6 | 路灯 | 1 | 细高的黑色路灯，灯罩暖黄 |
| 7 | 小屋 | 1 | 一间有门有一扇窗的小屋，侧面略带四分之三视角，烟囱可有可无 |

提示词：

```
A parts sheet of small landscape props for a cozy walking scene, laid out in a loose grid on a plain pure white background, generous spacing, nothing overlapping, no labels, no text, no cast shadows, each prop with a clean flat bottom edge so it can stand on the ground:
four small tufts of grass of different sizes; three small round stones; three tiny clusters of wildflowers with cream petals and a touch of brick red; four soft round cartoon clouds of different sizes, near-white with faint texture; one wooden signpost with two arrow boards pointing right and no writing; one tall slim dark street lamp with a warm yellow glass; one small cottage with a door and one window, seen slightly from the side.
Muted colors: greens #7E9A8C and #587868, stone #A4A684, wood #8C7355, walls #E8DEC3, roof #9E7A6A, lamp glow #F8EBC0. {style suffix}
```

## 验收

- 带子图：灰阶、白底、四条分开、底边平直、两端高度接近。
- 道具图：白底、互不挨着、底边干净、没有投影。
- 和旅人部件表放在一起看，线条粗细和纸纹的感觉一致。

生成后把原图上传到对话里，我负责抠图、镜像接龙、入库、接进 `renderer.ts`，并截正午、傍晚、夜晚、雨天四张图给 Yu 看。

## 其余七种地形（路线图 3c，2026-10-07 已全部入库）

八张图都在本目录（`terrain-<地形>-layers.png` 和 `terrain-extra-props.png`），抠好的带子和道具在 `public/art/terrain/`。城市的带子画得偏大，代码里按 0.55 缩小。

每种只需要一张带子图（格式和丘陵的第一张完全一样：四条灰阶带子、白底、底边平直、两端等高）。道具图共用丘陵的，专属道具合成一张 `terrain-extra-props.png`。

| 地形 | 文件名 | 带子的差别 | 专属道具 |
| --- | --- | --- | --- |
| 平原 | `terrain-plain-layers.png` | 三条都很低平，近景是田埂和几行作物的笔触 | 干草卷、稻草垛 |
| 山地 | `terrain-mountain-layers.png` | 远山是尖峰群，中山陡峭，近景是碎石坡 | 木桥、路边小石堆 |
| 森林 | `terrain-forest-layers.png` | 中近两层是成片的树冠剪影，近景有树干 | 蘑菇、树桩 |
| 海岸 | `terrain-coast-layers.png` | 只画近景一条：沙丘加几丛海草（远中两层由代码画海） | 灯塔、翻过来的小船 |
| 湖 | `terrain-lake-layers.png` | 远山加一条平静的岸线和芦苇，近景草坡 | 小码头、芦苇丛 |
| 沙漠 | `terrain-desert-layers.png` | 三条沙丘，起伏圆滑，近景几丛干灌木 | 仙人掌、骆驼刺 |
| 城市 | `terrain-city-layers.png` | 远中两层是低矮的天际线剪影（屋顶、烟囱、塔楼），近景矮房子的墙和篱笆 | 长椅、邮筒 |

带子图提示词（把方括号里的话换成对应地形那一行的描述）：

```
A parts sheet of landscape layers for a paper-cut parallax scene, in grayscale for later tinting. Four separate horizontal bands stacked top to bottom on a plain pure white background, each band spanning the full width, with white gaps between them, nothing overlapping, no labels, no text, no sky, no sun, no shadows:
1. [far layer];
2. [middle layer];
3. [near layer];
4. [ground band].
Each band is a solid filled shape with a flat bottom. Fill is near-white with faint grey watercolor texture; outlines are soft dark grey-brown pencil lines of slightly varying thickness. The left and right ends of each band are at the same height so it can repeat. hand-drawn illustration in the style of a quiet Japanese travel journal, soft pencil outlines, grayscale only, flat fills with slight watercolor texture, generous negative space, subtle paper texture, no gradients, no lens flare, no text, no watermark, minimal details, calm and cozy mood
```

四条带子每种地形怎么填：

| 地形 | 1 远 | 2 中 | 3 近 | 4 地面 |
| --- | --- | --- | --- | --- |
| 平原 | a very low, almost flat line of distant land | a low line of fields with a few hedgerows | a near line of low field edges with rows of crops suggested by short strokes | a band of flat farmland ground with a slightly uneven top edge and a straight bottom edge |
| 山地 | a line of distant sharp mountain peaks | a line of steep middle-distance mountains with ridges | a near line of rocky slopes with scattered boulders | a band of stony ground with a slightly uneven top edge and a straight bottom edge |
| 森林 | a low line of distant forested hills | a dense line of middle-distance tree crowns in silhouette | a near line of tree crowns with a few trunks reaching down to the bottom | a band of forest floor with ferns and a slightly uneven top edge and a straight bottom edge |
| 海岸 | a thin flat line of distant land on the horizon | a thin flat line of a far shore | a near line of low sand dunes with tufts of sea grass | a band of sandy ground with a slightly uneven top edge and a straight bottom edge |
| 湖 | a line of distant gentle hills | a flat calm shoreline with a few reeds | a near grassy bank with clumps of reeds | a band of grassy ground with a slightly uneven top edge and a straight bottom edge |
| 沙漠 | a low line of distant smooth dunes | a line of middle-distance rounded dunes | a near line of dunes with a few dry shrubs | a band of sandy ground with ripples and a slightly uneven top edge and a straight bottom edge |
| 城市 | a low distant skyline of rooftops and a tower in silhouette | a middle-distance row of low houses with chimneys in silhouette | a near row of low house walls and a fence with the tops of doorways | a band of paved ground with a slightly uneven top edge and a straight bottom edge |

专属道具图 `terrain-extra-props.png` 的提示词（有颜色，和丘陵道具图同一套色板）：

```
A parts sheet of small landscape props for a cozy walking scene, laid out in a loose grid on a plain pure white background, generous spacing, nothing overlapping, no labels, no text, no cast shadows, each prop with a clean flat bottom edge so it can stand on the ground:
a round hay bale; a haystack; a small wooden footbridge; a small pile of stones; a cluster of three mushrooms; a tree stump; a small striped lighthouse; a small rowing boat turned upside down; a short wooden jetty; a clump of reeds; a tall cactus; a low dry desert shrub; a wooden park bench; a red pillar post box.
Muted colors: greens #7E9A8C and #587868, stone #A4A684, wood #8C7355, walls #E8DEC3, roof #9E7A6A, brick red #B86B5A only on the post box and the lighthouse stripe. hand-drawn illustration in the style of a quiet Japanese travel journal, soft pencil outlines, muted warm palette, flat colors with slight watercolor texture, generous negative space, subtle paper texture, no gradients, no lens flare, no text, no watermark, minimal details, calm and cozy mood
```
