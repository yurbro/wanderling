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

## 2026-10-04 会话 4：天气接入（Open-Meteo）

- 环境：Claude Code on the web，仓库已绑定，推送正常。这个会话只允许推分支 `claude/continue-dev-checklist-bz9dkz`，所以开了 PR，Yu 在 GitHub 点 Merge 之后 Actions 才会部署到线上。
- 做了什么：
  - 补上 `.gitignore`，先推了一次验证推送链路。
  - `src/core/weather.ts`：WMO 天气码映射到 10 种场景天气（clear、partly-cloudy、overcast、fog、drizzle、rain、heavy-rain、thunderstorm、snow、heavy-snow）；算出云、雾、雨、雪、风、闪电六个 0 到 1 的强度；把 Open-Meteo 的响应压成快照；按任意时刻从快照里挑「当前观测」或「最近的小时预报」。
  - `src/data/weather.ts`：请求 Open-Meteo（当前 + 48 小时逐小时，坐标两位小数，无需 key），localStorage 缓存 45 分钟；换城市立刻刷新；没网或接口挂了就沿用上次快照按小时预报推算，两天预报用完才退回晴天；请求 10 秒超时，失败只在控制台留一行警告。
  - 场景导演：云量把天空推向灰色，雨天更深的灰蓝；全阴时太阳月亮整个隐去；星星按云量减少；雾先吞掉远山再吞中山；雨把地面打湿变深；气温不高于 2 度时下雪把地面染白；HUD 深浅墨色改成按天空亮度判断，所以阴天白天仍是深色字。
  - `src/scene/weatherLayers.ts`：纸片云先烘焙成贴图再淡入淡出（避免半透明时露出圆圈叠痕），随风漂移、永远有一点慢速飘动；三条雾带夹在山层之间；雨丝上限 200 根、雪花上限 110 片，风会让雨斜；雷暴时每 5 到 19 秒一次白闪。
  - HUD 多一行「14° · Overcast」，美式英语环境显示华氏；预报推算时标「(forecast)」。
  - 演示：`?demo=1` 多了天气选择器；`?weather=rain` 或 `?weather=63`（天气码）强制天气；`?temp=-3&wind=30` 微调。
  - 测试 40 个（新增 33 个），截图工具支持 `WEATHERS=` 和 `CHROMIUM_PATH=`，README 同步更新。
- 产出：分支 `claude/continue-dev-checklist-bz9dkz` 与对应 PR；截图在本地 `screenshots/`（不入库）；在云端用 Playwright 看了正午、傍晚、夜晚各种天气的图并调过两轮色调。
- 没做到或要注意：云端容器出不去 api.open-meteo.com（代理拒绝），数据层是用固定样例测试的，真实请求要在 Yu 的手机上验证；页面本身还没有 Service Worker，彻底断网时打不开页面（进停车场）。
- 下一步：Yu 合并 PR 后在手机上看真实天气；会话 5 做旅人角色（第 4 周内容：代码绘制的纸偶、走路循环、下雨撑伞、夜晚提灯）。
- Yu 的作业：合并 PR；在 iPhone 打开 https://yurbro.github.io/wanderling/ ，对照当地真实天气看一眼；打开 https://yurbro.github.io/wanderling/?demo=1 用底部的 Weather 选择器把十种天气各看一遍，说哪种不对劲（太暗、雨太大、云太假都算）；补上对 Phase 0 页面的具体反馈。

## 停车场（MVP 之外的想法）

- Service Worker：添加到主屏幕后断网也能打开页面。
- 雨天地面反光、云影扫过山坡、雪随时间越积越厚、AQI 霾层。
- 风让树和围巾摆动（等有植被和角色之后）。
- 天气变化时的过渡动画（现在天空颜色是跳变的，20 秒一次）。

## 下次会话开场清单（会话 5 的第一件事）

1. 读 `CLAUDE.md` 与本文件；`git fetch origin main` 看会话 4 的 PR 是否已合并（`git log origin/main --oneline -5` 里应有「weather」字样的提交）；没合并就先提醒 Yu。
2. `npm install`，`npm test`，确认 40 个测试通过。
3. 问 Yu 手机上真实天气显示得对不对，以及 ?demo=1 里哪种天气不对劲，先修这些。
4. 本次目标：旅人角色。先用代码画一个矢量纸偶（头、身、两臂、两腿、背包），做走路循环；下雨撑伞、夜晚提灯；路面与远山的视差滚动。
5. 结束前：推送、确认 Actions 变绿（或开 PR）、更新本日志与待办，回复里给出线上地址和「这次看哪里」。
