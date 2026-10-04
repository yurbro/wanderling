# 开发日志

每次会话开始先读本文件末尾的最新一条；结束前追加一条。格式：日期、做了什么、产出在哪、下一步、Yu 的作业。

## 2026-10-04 会话 1：整体框架

- 做了什么：把「路途」的原始想法扩展为整体开发框架（产品定位、三个底层决策、主场景分层系统、世界与路线、角色、陪伴感设计、技术架构、分期、风险）。
- 产出：framework-v1.md。
- 关键观点：「天空归现实，大地归旅途」；前进机制建议时间驱动打底、现实行为温和加速；画风参考旅行青蛙。

## 2026-10-04 会话 2：命名与开发流程

- 做了什么：出命名候选（推荐「共此时」，英文 Same Sky）；确认前提（iPhone、Windows、不装本机环境、AI 生图、先海外）；规划零经验、以 Claude 为主力的完整开发流程；提出技术路线调整为网页优先（ADR-001，待确认）。
- 产出：naming-candidates.md、process-plan-v1.md。
- 已确认的前提：测试手机 iPhone；美术 AI 生图由 Yu 筛选；先面向海外用户。
- 环境检查：云端环境尚未连接 GitHub（凭证无效）；未安装 Flutter；Node 可用。
- 下一步：定名；连接 GitHub；确认技术路线；之后建仓库、初始化工程、配自动部署、出第一个页面；写风格指南 v0 与提示词模板。
- Yu 的作业：选名字；连接 GitHub 并告知用户名；确认或否决 ADR-001。

## 2026-10-04 会话 3：定名 Wanderling，搭台与第一个页面

- 决定：英文主名 Wanderling（Same Sky 在 App Store 已有同名）；ADR-001 网页优先路线确认；仓库 yurbro/wanderling（公开，Yu 创建）。
- 做了什么：初始化工程（Vite + TypeScript + PixiJS 8 + vitest）；实现 WorldState 到 SceneDirector 到分层渲染的骨架；用 suncalc 本地计算太阳高度与月相；天空三段渐变随太阳高度插值，日、月（带相位阴影）、星空（闪烁）、三层远山剪影、地面与小路；HUD（时钟、地点、Use my location 按钮，白天自动换深色文字）；定位存本地并粗化到两位小数；演示参数 ?demo=1、?t=HH:MM、?lat&lon；PWA manifest 与图标；GitHub Actions 工作流（测试、构建、部署 Pages）；7 个单元测试通过；在云端用 Playwright 截了六个时刻的图并自检。
- 产出：本地提交 8bc0d3c；发给 Yu 的 wanderling-phase0.zip 与预览图；style-guide-v0.md（含提示词模板与 5 张锚点清单）。
- 卡点：会话未绑定仓库，gh 与 git push 均被代理拒绝（「not in this session's authorized repository set」）。改走网页上传：Yu 先在 Settings 的 Pages 里把 Source 选为 GitHub Actions，再把解压后的全部文件拖到 github.com/yurbro/wanderling/upload/main，等 Actions 跑完后在 iPhone 打开 https://yurbro.github.io/wanderling/ 并添加到主屏幕。
- 下一步：验证线上页面与添加到主屏幕；下次会话接 Open-Meteo 天气，做天气状态映射、缓存与降级、雨雪雾云层；之后是旅人角色。
- Yu 的作业：上传代码并开 Pages；找到新建会话时绑定仓库的入口；生成 5 张风格锚点图。
- 后续（同日）：Yu 用网页拖拽上传了代码（`.github` 与 `.gitignore` 被跳过，workflow 文件随后通过网页新建文件补上），Actions 部署成功，Yu 在 iPhone 上打开了 https://yurbro.github.io/wanderling/ ，反馈「感觉还行」。里程碑 M0 达成，M1 的第 2 周内容（天空、日月星、远山）已提前上线。
- 已验证：在会话里带令牌推送也会被代理拒绝，自动推代码只能靠新建会话时把仓库加为来源。
- 仓库里还缺 `.gitignore`，下次有推送权限时补上。

## 会话场所的变化（2026-10-04 晚）

- 「路途app开发」是旧版的聊天型 Project，没有绑定仓库的设置，Cowork 会话推不了代码。
- 从会话 4 起，开发在 Claude Code on the web（https://claude.ai/code ）进行：在输入框下方的仓库选择器里选 yurbro/wanderling，会话会自动克隆仓库并能推送。
- 文档以仓库里的 `docs/` 为准（本文件即 `docs/dev-log.md`），`CLAUDE.md` 会被每个会话自动读取。Project 里的副本是快照，不再逐次更新。

## 下次会话开场清单（会话 4 的第一件事）

1. 读 `CLAUDE.md` 与本文件；`git remote -v` 确认是 yurbro/wanderling；`npm install`，`npm test`，确认与线上一致（线上已部署 Phase 0 页面）。
2. 先推一个小改动验证推送链路：补上 `.gitignore`（node_modules、dist、screenshots、.vite、.DS_Store、*.log），推到 main，确认 Actions 变绿。
3. 本次目标：Open-Meteo 天气接入（当前天气 + 小时预报），天气码到场景状态的映射，30 到 60 分钟缓存与离线降级，天气层（云、雨、雪、雾）。
4. 结束前：推送、确认 Actions 变绿、更新本日志与待办，回复里给出线上地址和「这次看哪里」。
5. 收集 Yu 对 Phase 0 页面的具体反馈（会话 3 结束时他只说「感觉还行」，尚未细说）。
