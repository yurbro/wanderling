# 旅人 wanderling 的角色参考图

2026-10-06 定稿。这几张是 AI 生图，作为代码绘制的参考。

2026-10-06 Yu 在 Code 会话 22 决定：代码画的旅人画风不够像参考图，改为「部件贴图」：用生图出一张部件表（见文末），Claude 抠出每个部件贴到现有骨架上，动作逻辑不变。部件表已到（会话 23），`src/scene/wanderer.ts` 现在把这些贴图挂在原来的骨架上；只有眼睛和白气还由代码画，便于眨眼、笑眼和眯眼。这条决定需要在下次 Cowork 评审时回写到 decisions.md 第 5 节。

| 文件 | 用途 |
| --- | --- |
| `character-wanderling-turnaround.png` | 三视图（正面、侧面走路、背面、3/4），比例和部件以它为准 |
| `character-wanderling-poses.png` | 8 个动作，对应 decisions.md 第 5 节的动作状态 |
| `character-wanderling-explore.png` | 体型探索稿：取最右边的身体、最左边的背包 |
| `character-wanderling-direction.png` | 合成后的代码草图，侧面比例的简化版 |
| `character-wanderling-parts.png` | 部件表：9 个部件各一张，抠图后放在 `public/art/`，场景里的旅人就是用这些贴图拼的 |

## 比例（从三视图量的，近似值）

以身体高度 H 为 1：

- 身体：蛋形，宽约 0.9 H，下半部略宽。
- 眼睛：两个实心墨点，中心在从顶往下约 0.3 H 处；侧面只露一只眼，贴近前缘。
- 围巾：带子中线在约 0.45 H 处，宽约 0.1 H；结在身体后侧，尾巴一条，飘向身后。
- 叶柄：从头顶正中伸出，长约 0.3 H，微弯；叶片长约 0.35 H，灰绿 #7E9A8C。
- 手：贴在身体两侧的小椭圆，长约 0.25 H，位置在下半身。
- 腿：两只深色短靴，高约 0.12 H，露在身体下方。
- 背包：正面看不见；侧面露出约 0.3 H 宽、0.6 H 高；背面是带翻盖的方包。

## 每个动作要点

| 动作 | 参考图里的样子 | 代码实现时注意 |
| --- | --- | --- |
| 走路 | 身体略前倾，两靴前后 | 身体随步伐上下起伏，叶子轻晃 |
| 撑伞 | 一手举一片大叶子当伞，叶柄当伞柄 | 替换现在的靛蓝雨伞；伞叶比头顶叶子大 3 倍左右 |
| 提灯 | 前手提一盏小煤油灯，灯光暖黄 | 灯光是全图唯一允许的第二个暖色，沿用现有光晕层 |
| 顶风 | 身体前倾，叶子和围巾倒向身后，眼睛眯成两个小「>」 | 由风速和风向驱动；眯眼可以只在大风时出现 |
| 怕冷 | 正面站着，围巾裹得更厚，呼出一团白气 | 侧面走路时也可以做：围巾加厚，偶尔一团白气 |
| 睡觉 | 蜷坐在路边，背包靠着身体 | 闭眼画成两条短弧线，放在眼睛的高度，不要画成一条像嘴的弧 |
| 抬头看 | 停下，叶子竖直，眼睛看向上方 | 对应现有的「抬头看天」小动作 |
| 挥手 | 回头，前手举起挥动 | 长按触发 |

## 设计约束（和 decisions.md 一致）

- 任何状态都没有嘴，表情只靠眼睛、叶子和身体倾斜。
- 围巾砖红 #B86B5A 是画面里唯一的饱和色（提灯的暖光除外）。
- 轮廓用深灰褐 #4A4A52，不用纯黑；没有渐变和光效。
- 画面里身高约为屏幕高度的 8%，缩到这么小时叶子、围巾、眼睛仍要看得清。

## 三视图里不用照搬的地方

- 背面图里围巾两侧都有尾巴，以侧面图为准：结在后面，只有一条尾巴。
- 3/4 视图里眼睛位置偏后，以正面和侧面为准。

## 部件表（2026-10-06 已生成：`character-wanderling-parts.png`）

目的：把旅人拆成单独的部件各画一张，Claude 抠图后作为贴图挂到 `wanderer.ts` 现有的 8 个可动部件上。要求所有部件同一画风、同一比例，和三视图的侧面走路那张一致。

每个部件之间留足空白，白底，没有阴影，没有文字。建议上传 `character-wanderling-turnaround.png` 作为风格参考，输出 2048×2048。

部件清单（都是面向右的侧面视角，比例以身体高度为 1）：

| 编号 | 部件 | 要求 |
| --- | --- | --- |
| 1 | 身体 | 蛋形，米白，带轻微纸纹和水彩阴影；不画眼睛、不画围巾、不画叶子（这些单独画或由代码画） |
| 2 | 叶子 | 叶柄加叶片，竖直向上，叶柄底端在最下方 |
| 3 | 围巾带 | 只画绕在身体上的那一圈砖红色带子，形状按身体 0.45 处的弧度 |
| 4 | 围巾尾 | 一条飘向左边的尾巴，根部在右端 |
| 5 | 背包 | 侧面，高约 0.8，颜色 #9C8A6A，带翻盖和一个小口袋 |
| 6 | 靴子 | 一只深色短靴，侧面 |
| 7 | 手 | 一只小椭圆的手，米白 |
| 8 | 大叶子伞 | 一片大叶子加长叶柄，叶柄在下，比头顶叶子大 3 倍左右 |
| 9 | 灯 | 一盏小煤油灯，玻璃罩暖黄，提环在上 |

提示词：

```
Character parts sheet of a tiny round creature called a wanderling, for a paper-doll animation. Nine separate parts laid out in a 3 by 3 grid on a plain pure white background, generous spacing, nothing overlapping, no labels, no text, no shadows. All parts in side view facing right, same scale, same style:
1. the body alone: a soft egg-shaped cream body with gentle watercolor shading, NO eyes, NO scarf, NO leaf;
2. a single small leaf on a short curved stalk, standing upright;
3. a brick-red scarf band only, curved as if wrapped around the body;
4. one brick-red scarf tail, streaming to the left;
5. a brown canvas travel backpack with a flap and a small pocket, side view;
6. one small dark grey boot, side view;
7. one tiny cream oval hand;
8. a big leaf on a long stalk held like an umbrella, stalk pointing down;
9. a small kerosene lantern with a warm yellow glass and a handle on top.
{style suffix}
```

`{style suffix}` 用风格指南第 6 节的基础风格后缀。生成后把原图上传到对话里，命名 `character-wanderling-parts.png`，Claude 负责抠图、按比例裁切并接入。

抠图小贴士：背景要纯白（不是纸色），部件内部可以有纸纹；部件之间别挨着；如果工具总是给部件加阴影，在提示词里再写一遍 no drop shadow。

抠图记录（会话 23）：用 ImageMagick 从四角泛洪填充把白底变透明（容差 7%，灯的提环内侧单独补了一个种子点），再用连通区域找到 9 个部件的包围盒，各留 4 像素边裁出。部件在骨架上的锚点和尺寸写在 `wanderer.ts` 的 `dress()` 里，以身体高度为单位。
