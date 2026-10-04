# Wanderling：给每个开发会话的说明

Wanderling 是一个「放置式旅途陪伴」PWA：一个小旅人替用户走向山河湖海，头顶的天空、天气、昼夜与用户所在地的现实同步。面向海外用户，先做网页版（PWA），后期用 Capacitor 包 iOS。

## 先读什么

1. `docs/dev-log.md`：每次会话第一件读的、最后一件写的东西。末尾的「下次会话开场清单」就是本次要做的事。
2. `docs/process-plan-v1.md`：分工、阶段、里程碑、决策记录（ADR）。
3. `docs/style-guide-v0.md`：美术与色板，代码里的颜色必须与它一致。
4. `docs/framework-v1.md`：产品与架构的整体构思。

## 协作方式

- 用户 Yu 没有开发经验，用中文交流。解释要具体、短，避免术语堆砌；中文里不要用破折号「—」。
- 一次会话一个目标。MVP 之外的新想法记进 `docs/dev-log.md` 的停车场，不打断当前目标。
- 用户看效果的唯一渠道是 iPhone 上的 https://yurbro.github.io/wanderling/ ，所以每次改动都要能在线上看到。

## 工作流

- 直接在 `main` 上提交并推送（单人项目，`.github/workflows/deploy.yml` 会自动测试、构建、部署到 GitHub Pages）。推送前必须通过 `npm test` 和 `npm run build`。
- 如果环境只允许推分支，就推分支并开 PR，然后在回复里告诉 Yu 去 GitHub 点 Merge。
- 视觉改动要自检：`npm run build`，`npx vite preview --port 4173`，再用 `tools/screenshot.cjs` 截图查看（需要 playwright；没有就 `npm i -D playwright` 后用其自带浏览器）。
- 会话结束前：更新 `docs/dev-log.md`（做了什么、产出在哪、下一步、Yu 的作业），确认推送成功，并在回复里给出线上地址和「这次看哪里」。

## 架构约定

- `src/core/` 纯逻辑，不碰 DOM 和 PixiJS：`WorldState`（时间、地点、太阳、月亮、天气）经 `sceneDirector.direct()` 变成 `RenderState`。这里的代码都要有单元测试（vitest，`tests/`）。
- `src/scene/` 用 PixiJS 画 `RenderState`；`src/data/` 对接外部世界（定位、天气）；`src/ui/` 是薄薄的 DOM 覆盖层。
- 所有现实同步都是锦上添花：没有定位、没有网络、API 挂了，画面都要成立（缓存、降级、手选城市）。
- 定位只取城市级粗略坐标（两位小数），不上传精确坐标。
- 电量：后台暂停、前台 30fps 封顶、粒子数封顶。

## 常用命令

```bash
npm install
npm test
npm run build
npm run dev
```
