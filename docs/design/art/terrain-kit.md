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

## 其余七种地形（之后再做）

每种只需要重出第一张图，道具图可以共用，少数地形加一两样专属道具：

| 地形 | 带子的差别 | 专属道具 |
| --- | --- | --- |
| 平原 | 三条都很低平，近景是田埂 | 稻草垛或干草卷 |
| 山地 | 远山是尖峰，中近山陡 | 木桥 |
| 森林 | 中近两层是成片的树冠剪影 | 蘑菇、树桩 |
| 海岸 | 远中两层由代码画海，只要近景的沙丘或礁石一条 | 灯塔、小船（海已有代码版） |
| 湖 | 远山加一条平静的岸线 | 码头 |
| 沙漠 | 三条沙丘，近景几丛灌木 | 仙人掌、骆驼刺 |
| 城市 | 远中两层是天际线剪影，近景矮房 | 长椅、邮筒 |

## 已完成（会话 24）

丘陵套件已入库：`terrain-hills-layers.png`、`terrain-hills-props.png` 在本目录，抠好的带子和道具在 `public/art/terrain/`。接法见 `src/scene/terrain.ts` 和 `renderer.ts` 的 `dressTerrain()`。处理记录：带子去边框、泛洪去白底、`-level 0,80%` 提亮、镜像接龙、底部渐隐；道具收边一像素、缩到 60%。要做下一种地形，只需按「第一张图」的提示词改地形描述，道具图可共用。
