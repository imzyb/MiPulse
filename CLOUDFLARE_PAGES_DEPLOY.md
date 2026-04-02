# MiPulse Cloudflare Pages 部署指南

## 概述

MiPulse 现在支持通过 Cloudflare Pages 连接 GitHub 仓库进行自动部署，提供更便捷的更新和协作体验。

## 部署方式

### 1. Fork 本仓库

首先 fork [MiPulse 仓库](https://github.com/imzyb/MiPulse) 到您的 GitHub 账户。

### 2. 配置 wrangler.toml

运行配置脚本：

```bash
./setup.sh
```

按照提示输入您的 Cloudflare Account ID、D1 数据库 ID 和 KV 命名空间 ID。

### 3. 连接 Cloudflare Pages

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages
2. 点击 "Create a project" → "Connect to Git"
3. 选择您的 GitHub 账户和 fork 的仓库
4. 配置构建设置：
   - **Production branch**: `main` (或您的主分支)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `/` (留空)

### 4. 配置环境变量

在 Pages 项目设置中添加环境变量：

- **ENVIRONMENT**: `production`

### 5. 配置 D1 和 KV 绑定

在 Pages 设置 → Functions → D1/KV namespace bindings 中配置：

- **D1 Database**: 绑定您的 D1 数据库
- **KV Namespace**: 绑定您的 KV 命名空间

## 自动部署优势

✅ **推送自动部署**: 推送到主分支自动触发部署
✅ **分支预览**: 为每个分支创建预览环境
✅ **便捷更新**: 从上游仓库同步更新更容易
✅ **团队协作**: 支持多开发者协作

## 本地开发

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 构建测试
npm run build
```

## 更新流程

当上游仓库有更新时：

1. 从上游同步代码到您的 fork
2. 测试本地构建：`npm run build`
3. 推送更新到主分支
4. Cloudflare Pages 自动部署

## 故障排除

### 构建失败
- 检查 `npm run build` 是否在本地正常运行
- 确认所有依赖都已正确安装

### 部署失败
- 检查 Cloudflare Pages 的部署日志
- 确认 D1 和 KV 绑定配置正确
- 验证环境变量设置

### 功能异常
- 检查 Cloudflare Workers 的日志
- 确认 D1 数据库和 KV 命名空间权限