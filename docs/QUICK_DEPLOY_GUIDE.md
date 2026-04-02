# MiPulse 快速部署指南

> 针对 Fork 用户的最快部署方案

## 🚀 一键部署 (3 分钟)

### 方案 A: 自动交互式配置 (推荐)

```bash
# 1. 克隆您 Fork 的仓库
git clone https://github.com/YOUR_USERNAME/MiPulse.git
cd MiPulse

# 2. 运行自动配置脚本 (会交互式询问您所有需要的信息)
chmod +x setup.sh
./setup.sh

# 3. 一键部署
chmod +x deploy.sh
./deploy.sh production
```

**所需信息** (脚本会一一询问):
- Cloudflare Account ID
- D1 数据库 ID (或自动创建)
- KV 命名空间 ID (或自动创建)
- 自定义域名 (可选)

**耗时**: 约 2-3 分钟

---

### 方案 B: 手动配置 (如果脚本不可用)

```bash
# 1. 复制配置模板
cp wrangler.toml.example wrangler.toml

# 2. 编辑 wrangler.toml，填入您的 Cloudflare ID
#    - account_id: https://dash.cloudflare.com → Settings
#    - database_id: https://dash.cloudflare.com → Workers → D1
#    - kv namespace id: 运行 wrangler kv:namespace create "MIPULSE_KV"

# 3. 部署
npm install
npm run build
wrangler pages deploy dist --env production
```

---

## 📋 详细步骤

### 第 1 步: 获取 Cloudflare 凭证

#### 1.1 Account ID
1. 打开 https://dash.cloudflare.com/
2. 点击右上角账户图标 → **My Account**
3. 左侧菜单 → **Settings**
4. 复制 **Account ID**

![Account ID 位置](https://developers.cloudflare.com/images/workers/cli/account-id.png)

#### 1.2 D1 数据库 ID
```bash
# 查看已有的 D1 数据库
wrangler d1 list

# 或从 Dashboard 查看
# https://dash.cloudflare.com → Workers & Pages → D1
```

#### 1.3 创建 KV 命名空间
```bash
# 创建生产环境
wrangler kv:namespace create "MIPULSE_KV"
# 输出: id = "abc123..."

# 创建预览环境
wrangler kv:namespace create "MIPULSE_KV" --preview
# 输出: preview_id = "xyz789..."
```

---

### 第 2 步: 配置 wrangler.toml

如果未运行 `setup.sh`，手动编辑 `wrangler.toml`:

```toml
account_id = "your-account-id"

[env.production.d1_databases]
database_id = "your-d1-id"

[env.production.kv_namespaces]
id = "your-kv-id"
preview_id = "your-kv-preview-id"

# 启用离线检测 (可选)
[[triggers.crons]]
crons = ["*/5 * * * *"]
```

---

### 第 3 步: 部署

#### 自动部署 (推荐)
```bash
./deploy.sh production
```

#### 手动部署
```bash
# 安装依赖
npm install

# 构建
npm run build

# 部署到生产环境
wrangler pages deploy dist --env production

# 或部署到开发环境(测试)
wrangler pages deploy dist --env development
```

---

## ✅ 验证部署

部署完成后，检查以下内容:

### 1. 检查部署状态
```bash
wrangler tail --env production
```

应该看到类似输出:
```
✓ Deployed to https://your-project.pages.dev
```

### 2. 监控 D1 消耗
1. Cloudflare Dashboard → Workers & Pages → D1
2. 选择 **mipulse** 数据库
3. 查看 **Rows Read** 统计
4. 应该看到从 ~158 万次 降低到 ~14 万次 (91% 下降)

### 3. 检查 KV 缓存
1. Cloudflare Dashboard → Workers → KV
2. 应该看到:
   - Read 请求: ~9000/天
   - Hit Ratio: > 90%

### 4. 测试应用功能
```bash
curl https://your-project.pages.dev/api/vps
```

---

## 🆘 常见问题

### Q1: 我没有 Cloudflare 账户
**A**: 
1. 注册免费账户: https://dash.cloudflare.com/sign-up
2. 添加网站或使用 Workers 免费计划
3. 按上述步骤获取 Account ID

### Q2: Account ID 在哪里?
**A**: 
- Dashboard → Settings (左侧菜单最下方) → Account ID (页面右侧)

### Q3: set-up.sh 脚本出错

**A**:
1. 确保是在仓库根目录运行
2. 确保有执行权限: `chmod +x setup.sh`
3. 手动运行配置: `cp wrangler.toml.example wrangler.toml`

### Q4: 部署后 D1 消耗没有下降

**A1**: 检查 KV 是否正确配置
```bash
# 检查绑定
wrangler secret list --env production
# 应该看到 MIPULSE_KV 绑定

# 检查 KV 是否有数据
wrangler kv:key list --binding MIPULSE_KV
```

**A2**: 检查 Cron 触发器是否启用
```bash
# 查看后台触发器状态
wrangler deployments list
```

### Q5: 如何回滚到上个版本?

**A**:
```bash
git revert <commit-hash>
npm run build
wrangler pages deploy dist --env production
```

---

## 📊 性能对比

部署后，您应该看到:

| 指标 | 优化前 | 优化后 | 改善 |
|-----|-------|-------|------|
| D1 Rows Read | 158万/天 | 14万/天 | **91%** ↓ |
| KV Requests | - | 9000/天 | 免费配额内 |
| 成本 | $按量 | $0/月 | **完全免费** |

---

## 🔄 解决上游更新冲突

fork 用户的最大问题是上游更新时产生冲突。MiPulse 已解决:

### 配置文件隔离

```
.gitignore 中:
  - wrangler.toml (您的本地配置，不被追踪)
  
git 中:
  + wrangler.toml.example (模板，会更新)
```

### 安全更新方式

```bash
# 1. 获取上游最新版本
git fetch upstream

# 2. 合并更新 (不会冲突，因为 wrangler.toml 未被追踪)
git merge upstream/master

# 3. 部署新版本
npm run build
wrangler pages deploy dist --env production
```

---

## 📚 进阶指南

- **详细优化说明**: 查看 [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md)
- **完整部署清单**: 查看 [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)
- **性能监控**: 查看 [OPTIMIZATION_QUICK_REFERENCE.md](./OPTIMIZATION_QUICK_REFERENCE.md)

---

## 🎯 总结

| 步骤 | 耗时 | 命令 |
|-----|------|------|
| 获取 ID | 2分钟 | 在 Dashboard 中复制 |
| 运行配置脚本 | 1分钟 | `./setup.sh` |
| 部署 | 1分钟 | `./deploy.sh production` |
| **总耗时** | **4分钟** | |

---

## 💡 下一步

1. ✅ 部署应用
2. ✅ 监控 D1 消耗 (应该看到大幅下降)
3. ✅ 配置告知和日志
4. ⭐ 如果满意，给主仓库一个 Star

---

## 🤝 技术支持

遇到问题?
1. 查看 [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md) 的故障排除部分
2. 检查 Cloudflare Dashboard 的 Workers 日志
3. 提交 Issue 或 Pull Request

---

**Happy Deploying! 🚀**
