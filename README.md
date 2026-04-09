# ⚡️ MiPulse - 全球监控新纪元

![MiPulse Hero](./public/images/hero.png)



> **MiPulse** 是一款基于 Cloudflare 生态系统（Hono + D1 + Workers with Assets）构建的高性能、极简风格 VPS 探针监控系统。它专为追求极致性能与现代审美且无需复杂服务器配置的用户设计。

---

## ✨ 核心特性

- **🚀 全栈 Cloudflare 驱动**: 利用 Workers with Assets 架构，实现 API 与静态资源的高速全球分发。
- **💎 极简美学设计**: 采用玻璃拟态（Glassmorphism）风格，配备动态数据可视化图表与平滑动画。
- **📊 实时性能洞察**: CPU 负载、内存占用、磁盘空间以及实时的双向带宽速率监控。
- **🛡️ 节点安全隔离**: 采用基于 JWT 的鉴权机制，探针与管理端通过签名/Secret 安全通信。
- **📉 离线判定与告警**: 毫秒级心跳检测，自动识别离线节点并生成控制台告警。

---

## 🚀 快速部署 (Quick Start)

根据你的需求选择以下部署方式。我们强烈推荐使用 **选项 0** 以获得最佳的长期维护体验。

如果你希望 Fork 本项目并能随时同步主仓库的更新，这是**最标准且推荐**的方式：

1.  **Fork 本项目**: 点击页面右上角的 **Fork** 按钮。
2.  **登录 Cloudflare**: 进入 [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) 控制台。
3.  **创建应用**: 点击 **Create application** -> **Workers** -> **Connect to Git**。
4.  **关联仓库**: 选择你 Fork 后的 `MiPulse` 仓库。
5.  **构建设置**:
    - **Build command**: `npm run build`
    - **Build output directory**: `dist`
6.  **配置资源 (重要)**:
    - 第一次部署完成后，进入项目的 **Settings -> Bindings**。
    - 在 **D1 database bindings** 中添加名称 `MIPULSE_DB`，并选择你的 D1 数据库。
    - 在 **KV namespace bindings** 中添加名称 `MIPULSE_KV`，并选择你的 KV 命名空间。
    - 重新点击 **Deployments -> Retry deployment**。

> [!TIP]
> **自动更新**: 使用此方法后，你只需在 GitHub 页面点击 **"Sync Fork"** 即可自动触发 Cloudflare 的同步部署。

---

### 选项 1：一键快照部署 (适合快速试用 ⚡)

如果你不想 Fork，只想快速尝试功能，可以使用此按钮。

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/imzyb/MiPulse)

1. 点击按钮并按照提示创建 D1 和 KV 资源。
2. 系统会自动完成初始部署并进入运行状态。

> [!WARNING]
> **更新限制**: 通过此方式导入的仓库是**独立快照**，无法直接通过 GitHub 网页同步上游更新。如果你后续需要同步新功能，请参考下方的 [如何同步更新](#-如何同步更新) 指南。

---

## 🗄️ 数据库初始化 (重要)

由于网页端部署目前不会自动执行 SQL 脚本，首次部署成功后，你**必须**执行以下步骤来创建数据表，否则会报 `no such table` 错误。

### 方法 A：通过 Cloudflare 网页控制台 (无需环境)

1.  登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2.  进入 **Workers & Pages** -> **D1** -> 点击你的 **`mipulse_db`**。
3.  在页面下方点击 **Console** (控制台) 选项卡。
4.  打开项目根目录下的 [schema.sql](schema.sql) 文件，复制其全部内容。
5.  粘贴到控制台的输入框中，点击 **Execute**。

### 方法 B：通过本地命令行 (推荐)

在本地项目终端运行：
```bash
npm run db:init:remote
```

---

## 🔄 如何同步更新

如果你使用的是“选项 1：一键快照部署”，或者想通过命令行手动同步主仓库的代码：

1. **添加上游仓库 (仅需一次)**:
   ```bash
   git remote add upstream https://github.com/imzyb/MiPulse.git
   ```

2. **拉取并合并更新**:
   ```bash
   git fetch upstream
   git merge upstream/main
   git push origin main
   ```
   *推送成功后，Cloudflare 会自动识别变动并重新构建。*

---

> [!TIP]
> **自定义域名 (推荐)**: 为避开部分地区对 `workers.dev` 的访问限制，建议在 **Settings -> Domains** 中绑定你的自定义域名。

---

## 🔐 初始安全配置

系统默认提供了一个初始管理员账号用于首次运行：

- **URL**: `https://<your-worker>.workers.dev/login`
- **用户名**: `admin`
- **密码**: `admin`

> [!CAUTION]
> **重要安全性提示**:
> - 🚨 **首次登录强制改密**: 系统会在您首次登录后自动跳转到设置页面，要求立即修改默认密码。
> - 💡 **密码建议**: 建议使用至少 8 位包含大小写字母和数字的强密码。
> - ⚠️ **安全警告**: 如果不及时修改默认密码，您的管理面板可能会面临安全风险。

---

## 🛠️ 探针部署

在你想监控的 VPS 上运行探针（支持多种客户端，如 MiPulse-Probe）：

```bash
# 通用配置环境变量
export MIPULSE_URL="https://<your-worker>.workers.dev"
export MIPULSE_ID="your-node-id"
export MIPULSE_SECRET="your-node-secret"
```

## 📜 开源协议

本项目采用 **MIT** 协议开源。

---

<p align="center">Designed with ❤️ by <b>Antigravity</b> (Google Deepmind Team)</p>
