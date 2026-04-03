# ⚡️ MiPulse - 全球监控新纪元

![MiPulse Hero](./public/images/hero.png)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/imzyb/MiPulse)

> [!TIP]
> **如果你是从本仓库 Fork 而来**：为了让上方的一键部署按钮指向你自己的仓库，请在 Fork 后修改 `README.md`，将上方链接中的 `imzyb` 替换为你的 GitHub 用户名。

> **MiPulse** 是一款基于 Cloudflare 生态系统（Hono + D1 + Workers with Assets）构建的高性能、极简风格 VPS 探针监控系统。它专为追求极致性能与现代审美且无需复杂服务器配置的用户设计。

---

## ✨ 核心特性

- **🚀 全栈 Cloudflare 驱动**: 利用 Workers with Assets 架构，实现 API 与静态资源的高速全球分发。
- **💎 极简美学设计**: 采用玻璃拟态（Glassmorphism）风格，配备动态数据可视化图表与平滑动画。
- **📊 实时性能洞察**: CPU 负载、内存占用、磁盘空间以及实时的双向带宽速率监控。
- **🛡️ 节点安全隔离**: 采用基于 JWT 的鉴权机制，探针与管理端通过签名/Secret 安全通信。
- **📉 离线判定与告警**: 毫秒级心跳检测，自动识别离线节点并生成控制台告警。

---

## 🏗️ 架构概览

```mermaid
graph LR
    subgraph "Global Nodes"
        A[VPS Node A]
        B[VPS Node B]
    end

    subgraph "Cloudflare Ecosystem"
        C[Hono Worker API]
        D[(Cloudflare D1 DB)]
        E[Vite Assets]
    end

    A -- Report (HMAC/Secret) --> C
    B -- Report (HMAC/Secret) --> C
    C -- Queries --> D
    User -- Browser Access --> E
    E -- API Calls (JWT) --> C
```

---

## 🚀 快速开始

### 1. 全自动一键部署 (推荐)

只需要登录 Cloudflare，然后运行以下命令，系统将自动创建数据库、KV、更新配置并完成发布：

```bash
# 将warngler更新到最新版
npm install wrangler@latest --save-dev

# 确保已登录 Cloudflare
npx wrangler login

# 执行全自动部署
npm run deploy:full
```

#### 📌 一键部署填写指南 (Dashboard Guide)

如果在点击上方按钮后进入 Cloudflare 部署界面，请按照以下几点填写：

1.  **D1 / KV 数据库**：下拉列表中选择 **"+ Create (新建)"**，系统将自动为你创建并填入 ID。
2.  **构建 & 部署命令**：保持默认即可（`npm run build` 和 `npm run deploy`）。

### 2. 手动分步部署 (进阶)

如果你希望手动控制资源创建过程：

```bash
npm install
npm run db:create

# 将输出结果中的 database_id 复制到 wrangler.toml 中
# 运行本地与远程初始化
npm run db:init
npm run db:init:remote

npm run deploy
```

---

## 🔐 初始安全配置

系统默认提供了一个初始管理员账号用于首次运行：

- **URL**: `https://<your-worker>.workers.dev/login`
- **用户名**: `admin`
- **密码**: `mipulse-secret`

> [!CAUTION]
> **重要安全性提示**: 登录后，请立即进入 **管理面板 -> 个人资料** 修改默认密码。

---

## 🛠️ 探针部署

在你想监控的 VPS 上运行探针（支持多种客户端，如 MiPulse-Probe）：

```bash
# 通用配置环境变量
export MIPULSE_URL="https://<your-worker>.workers.dev"
export MIPULSE_ID="your-node-id"
export MIPULSE_SECRET="your-node-secret"
```

## 🔄 如何同步更新

当上游仓库有新功能或修复发布时，你可以通过以下方式同步：

1.  **手动同步 (推荐)**: 在你的 Fork 仓库页面点击 `Sync fork` -> `Update branch`。GitHub 会自动合并最新代码，并触发 Cloudflare 的自动构建与部署。
2.  **自动化同步**: 本项目内置了 GitHub Action 脚本。进入你仓库的 `Actions` 选项卡并启用 `Fork Sync` 工作流，系统将每天自动检查并同步上游更新。

## 📜 开源协议

本项目采用 **MIT** 协议开源。

---

<p align="center">Designed with ❤️ by <b>Antigravity</b> (Google Deepmind Team)</p>
