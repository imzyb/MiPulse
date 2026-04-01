# MiPulse - VPS Monitor

一个基于 Vue 3 和 Cloudflare Pages 构建的轻量级 VPS 监控面板。

## 技术栈

- **前端**: Vue 3 + Vite + Pinia + Vue Router
- **样式**: TailwindCSS + PostCSS
- **后端**: Cloudflare Pages Functions
- **数据库**: Cloudflare D1 (SQLite)
- **认证**: JWT (jose)
- **图标**: Lucide Icons
- **HTTP 客户端**: Axios

## 功能特性

- 多节点 VPS 状态监控
- 实时指标报告与历史数据查询
- 网络目标检测 (HTTP/TCP/Ping)
- 告警系统
- 流量统计与管理
- 用户认证与权限管理
- 暗色模式支持
- 响应式设计

## 部署指南

### 第一步：创建 D1 数据库

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** → **D1 SQL Database** → **Create database**
3. 输入数据库名称（如 `mipulse-db`），点击创建
4. 创建完成后，记录 **Database ID**

### 第二步：部署到 Cloudflare Pages

1. 进入 **Workers & Pages** → **Create application** → **Pages**
2. 选择 **Direct Upload** 或连接你的 Git 仓库
3. 构建配置：
   - **框架预设**: Vue
   - **构建命令**: `npm run build`
   - **构建输出目录**: `dist`
4. 点击部署

### 第三步：绑定 D1 数据库

1. 进入你的 Pages 项目 → **Settings** → **Functions** → **D1 database bindings**
2. 点击 **Add binding**
3. 填写以下信息：
   - **Variable name**: `MIPULSE_DB`（必须完全一致）
   - **D1 database**: 选择第一步创建的数据库
4. 点击 **Save**
5. 重新部署项目使绑定生效

### 第四步：初始化数据库表

部署成功并绑定数据库后，数据库表会在首次访问 API 时自动创建。

你也可以通过 Cloudflare Dashboard 的 D1 SQL 控制台手动执行 `schema.sql` 中的建表语句。

## 默认账号

- **用户名**: `admin`
- **密码**: `admin`

> **安全提示**: 首次登录后请立即在后台修改密码。

## JWT 密钥

JWT 签名密钥会在首次登录时自动生成一个 64 位随机字符串，并安全存储到 D1 数据库中，无需手动配置。

## 数据库表结构

| 表名 | 说明 |
|------|------|
| `users` | 用户表 |
| `vps_nodes` | VPS 节点表 |
| `vps_reports` | 节点指标报告表 |
| `vps_alerts` | 告警记录表 |
| `vps_network_targets` | 网络检测目标表 |
| `vps_network_samples` | 网络检测样本表 |
| `settings` | 系统配置表（含 JWT 密钥） |

## 许可证

MIT
