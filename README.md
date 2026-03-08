# 能源 ERP 情报中心

**实时行业情报仪表板** — AI 驱动的新闻聚合、企业动态监控、业务分布追踪，统一的态势感知界面。

![GitHub stars](https://img.shields.io/github/stars/yunxiao-789/worldmonitor)
![GitHub forks](https://img.shields.io/github/forks/yunxiao-789/worldmonitor)
![License: AGPL v3](https://img.shields.io/badge/license:AGPL-v3-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Last commit](https://img.shields.io/github/last-commit/yunxiao-789/worldmonitor)

[Web App](https://yunxiao-789.github.io/worldmonitor) · [Download Windows](https://github.com/yunxiao-789/worldmonitor/releases/latest) · [Download macOS](https://github.com/yunxiao-789/worldmonitor/releases/latest) · [Download Linux](https://github.com/yunxiao-789/worldmonitor/releases/latest)

![能源 ERP 情报中心仪表板](docs/images/energy-erp-dashboard.jpg)

---

## 为什么需要能源 ERP 情报中心？

| 问题 | 解决方案 |
|------|---------|
| 厂商信息分散在 100+ 来源 | **统一情报仪表板**，聚合五厂商 435+ 新闻源 |
| 没有业务分布的地理上下文 | **交互式地图**，45 个可切换业务数据层 |
| 信息过载 | **AI 摘要**，智能提炼核心情报 |
| 市场竞争态势不明 | **竞争力雷达**，实时对比五厂商市场表现 |
| 专业 OSINT 工具昂贵 | **100% 免费开源**，AGPL-3.0 许可 |
| 静态新闻推送 | **实时更新**，AI 驱动的情报推送 |
| 云端 AI 工具数据隐私风险 | **本地 AI**，Ollama/LM Studio，数据不出机器 |
| 仅 Web 访问 | **原生桌面应用**（Tauri），支持离线地图 |

---

## 核心功能

### 🗺️ 地图与可视化

- **双地图引擎** — 3D 地球（globe.gl + Three.js）和 WebGL 平面地图（deck.gl），运行时切换，45 个共享数据层
- **45 个可切换数据层** — 厂商中标、客户分布、业务网络、差旅路线、竞争力指数等
- **8 个区域预设** — 全国、华北、华东、华南、华中、西南、西北、东北，时间过滤（1 小时 -7 天）
- **竞争力热力图** — 五层颜色梯度，实时绘制各区域厂商竞争力得分
- **URL 状态共享** — 地图中心、缩放、活跃图层、时间范围编码到可分享 URL

### 🤖 AI 与情报

- **行业简报** — LLM 合成摘要，4 层降级：Ollama（本地）→ Groq → OpenRouter → 浏览器 T5
- **AI 推演与预测** — 基于实时新闻的行业分析、市场预测
- **智能告警** — 重大中标、战略合作、政策变化实时推送
- **多语言支持** — 21 种语言，原生语言 RSS、AI 翻译摘要、RTL（阿拉伯语）支持

### 📊 行业数据

- **五厂商追踪** — 远光软件、用友网络、金蝶国际、浪潮软件、中兴新云
- **中标项目库** — 实时聚合政府采购网、招标雷达等来源
- **产品发布库** — 厂商官网、发布会、产品更新
- **财报业绩库** — 营收、利润、增长率、云业务占比
- **政策法规库** — 财政部、国资委、发改委、工信部等政策

---

## 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/yunxiao-789/worldmonitor.git
cd worldmonitor
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env，配置 Convex、AI API 等
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173

### 5. 部署到 Vercel

```bash
npm run build
vercel deploy
```

---

## 技术架构

### 前端
- **框架**：React 18 + TypeScript
- **构建**：Vite 5
- **地图**：deck.gl 8 + globe.gl 4 + Three.js
- **UI**：Tailwind CSS + Radix UI
- **状态管理**：Zustand
- **路由**：React Router 6

### 后端
- **实时数据库**：Convex
- **API**：Proto-first API（22 个类型化服务）
- **RSS 聚合**：node-fetch + xml2js
- **AI 集成**：Ollama + Groq + OpenRouter

### 桌面应用
- **框架**：Tauri 2
- **打包**：GitHub Actions CI/CD
- **平台**：Windows、macOS、Linux

---

## 数据源

### 厂商新闻（435+ 源）
- 厂商官网（5）
- 政府采购网（1）
- 招标雷达（1）
- 财经媒体（20+）
- 社交媒体（50+）

### 政策法规
- 财政部
- 国资委
- 发改委
- 工信部
- 网信办
- 税务总局

---

## 部署

### Vercel（推荐）

1. 安装 Vercel CLI
```bash
npm i -g vercel
```

2. 部署
```bash
vercel
```

### GitHub Pages

1. 启用 GitHub Pages
2. 配置 Actions 自动部署
3. 访问 `https://yunxiao-789.github.io/worldmonitor`

### 桌面应用

1. 构建
```bash
npm run tauri build
```

2. 安装包在 `src-tauri/target/release/bundle/`

---

## 贡献

欢迎贡献！请查看：
- [贡献指南](CONTRIBUTING.md)
- [行为准则](CODE_OF_CONDUCT.md)
- [安全政策](SECURITY.md)

---

## 许可证

**AGPL-3.0** —  Affero General Public License v3.0

本项目基于 [worldmonitor](https://github.com/koala73/worldmonitor) 重构，感谢原作者的开源精神。

---

## 联系方式

- **GitHub Issues**：https://github.com/yunxiao-789/worldmonitor/issues
- **讨论区**：https://github.com/yunxiao-789/worldmonitor/discussions

---

**最后更新**：2026-03-08
