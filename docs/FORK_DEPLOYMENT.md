# Fork 用户部署指南

本文档专为 Fork 了 MiPulse 仓库的用户编写，提供无缝的部署体验。

## 🎯 目标

- ✅ 新 Fork 用户可以在 **5 分钟内** 部署到生产环境
- ✅ **自动生成** wrangler.toml，无需手动复制粘贴
- ✅ **上游更新不会产生冲突**（配置文件从 git 中隔离）
- ✅ **一键部署**，包含完整的验证和检查

---

## 📋 快速开始

### 第 1 步: Fork & Clone

```bash
# 1. Fork 本仓库到您的账户 (GitHub UI)

# 2. Clone 您 Fork 的仓库
git clone https://github.com/YOUR_USERNAME/MiPulse.git
cd MiPulse

# 3. 添加上游远程 (可选，用于获取更新)
git remote add upstream https://github.com/imzyb/MiPulse.git
```

### 第 2 步: 自动配置与部署

```bash
# 单个命令完成所有操作
chmod +x setup.sh deploy.sh
./setup.sh      # 交互式配置
./deploy.sh production  # 一键部署
```

完成! 🎉

---

## 🔄 上游同步 (无冲突)

MiPulse 采用了配置文件隔离策略，确保上游更新不会产生冲突:

### 隔离策略

```
.gitignore:
  ✓ wrangler.toml      # 您的本地配置(不被追踪)

Git 追踪:
  ✓ wrangler.toml.example  # 模板配置(会更新)
  ✓ setup.sh           # 配置脚本(会更新)
  ✓ deploy.sh          # 部署脚本(会更新)
```

### 安全的更新流程

```bash
# 1. 获取上游最新版本
git fetch upstream

# 2. 检查有什么新变化
git log --oneline upstream/master ^master | head -10

# 3. 合并更新 (不会产生 wrangler.toml 冲突)
git merge upstream/master

# 4. 如果有脚本更新，重新配置一次 (可选)
./setup.sh

# 5. 重新部署新版本
./deploy.sh production
```

**结果**: 新的优化、功能、修复会自动合并，您的配置保持不变！

---

## 🗂️ 文件说明

### 部署相关文件

| 文件 | 说明 | 被追踪? |
|-----|------|--------|
| `wrangler.toml` | 您的 Cloudflare 配置 | ✗ (.gitignore) |
| `wrangler.toml.example` | 配置模板 | ✓ |
| `setup.sh` | 交互式配置脚本 | ✓ |
| `deploy.sh` | 一键部署脚本 | ✓ |
| `.env.example` | 环境变量模板 | ✓ |
| `QUICK_DEPLOY_GUIDE.md` | 快速部署指南 | ✓ |

### 优化相关文档

| 文件 | 说明 |
|-----|------|
| `OPTIMIZATION_GUIDE.md` | 完整的优化实现指南 |
| `OPTIMIZATION_QUICK_REFERENCE.md` | 性能指标快速参考 |
| `DEPLOYMENT_CHECKLIST.md` | 部署前检查清单 |
| `D1_OPTIMIZATION_README.md` | D1 优化项目说明 |

---

## 🚀 部署流程详解

### 方案 A: 完全自动部署 (推荐)

```bash
./setup.sh
```

**脚本会自动**:
1. ✓ 检查 Node.js、npm、wrangler 是否安装
2. ✓ 检查或创建 D1 数据库
3. ✓ 创建 KV 命名空间
4. ✓ 交互式询问您的 Cloudflare Account ID
5. ✓ 生成 wrangler.toml
6. ✓ 验证配置

然后:
```bash
./deploy.sh production
```

**脚本会自动**:
1. ✓ 检查前置条件
2. ✓ 安装依赖
3. ✓ 构建项目
4. ✓ 部署到 Cloudflare
5. ✓ 验证部署成功
6. ✓ 运行后检查

### 方案 B: 手动步骤

如果脚本有问题，可以手动操作:

```bash
# 1. 复制模板
cp wrangler.toml.example wrangler.toml

# 2. 获取必要的 ID
# 从 https://dash.cloudflare.com 获取:
# - Account ID (Settings)
# - D1 Database ID (Workers → D1)
# - KV Namespace ID (Workers → KV 或创建新的)

# 3. 编辑 wrangler.toml 填入这些 ID

# 4. 部署
npm install
npm run build
wrangler pages deploy dist --env production
```

---

## ⚙️ 配置参数解释

### wrangler.toml 中的关键部分

```toml
# 您的 Cloudflare 账户 ID
account_id = "abc123xyz"

# 开发环境配置 (可选，用于本地测试)
[env.development]
[[env.development.d1_databases]]
database_id = "dev-db-id"

[[env.development.kv_namespaces]]
id = "dev-kv-id"

# 生产环境配置 (实际运营环境)
[env.production]
[[env.production.d1_databases]]
database_id = "prod-db-id"

[[env.production.kv_namespaces]]
id = "prod-kv-id"

# 异步离线检测 (每5分钟执行一次)
[[triggers.crons]]
crons = ["*/5 * * * *"]
```

### 环境变量

在 `.env.local` 中配置 (不被追踪):

```env
CLOUDFLARE_ACCOUNT_ID=your-id
CLOUDFLARE_API_TOKEN=your-token
PROD_D1_DATABASE_ID=your-db-id
PROD_KV_NAMESPACE_ID=your-kv-id
```

---

## 📊 部署后验证

部署完成后，检查以下内容:

### 1. 检查部署是否成功

```bash
wrangler tail --env production
```

应该看到日志输出，没有错误。

### 2. 查看 D1 消耗

```
Cloudflare Dashboard
→ Workers & Pages
→ D1
→ mipulse
→ Analytics

Rows Read 应该从 ~158万/天 降低到 ~14万/天 (91% 下降)
```

### 3. 测试应用

```bash
curl https://your-project.pages.dev/api/vps/nodes
```

应该返回节点列表。

### 4. 监控 KV 使用

```
Cloudflare Dashboard
→ Workers
→ KV

应该看到:
- Requests Read: ~9000/天
- Hit Ratio: > 90%
```

---

## 🆘 故障排除

### 问题 1: setup.sh 找不到

```bash
# 确保您在仓库根目录
cd /path/to/MiPulse

# 标记脚本为可执行
chmod +x setup.sh deploy.sh

# 重试
./setup.sh
```

### 问题 2: wrangler 未找到

```bash
# 安装 wrangler CLI
npm install -g wrangler

# 验证安装
wrangler --version
```

### 问题 3: "Account ID not found"

```bash
# 从 Cloudflare Dashboard 获取:
# https://dash.cloudflare.com → 右上角 → Settings → Account ID (页面右侧)
```

### 问题 4: 部署后 D1 消耗没有下降

**检查点**:
1. KV 是否正确配置?
   ```bash
   wrangler kv:key list --binding MIPULSE_KV --env production
   ```

2. Cron 触发器是否启用?
   - 编辑 `wrangler.toml`，取消注释 `[[triggers.crons]]`
   - 重新部署

3. 是否有缓存填充代码?
   - 检查 `functions/api/vps.js` 中的 KV 调用

### 问题 5: 上游更新产生冲突

```bash
# 如果产生冲突，通常只在代码文件中
# 因为 wrangler.toml 不被追踪

# 解决冲突后重新部署
git merge --continue
./deploy.sh production
```

---

## 🔄 定期维护

### 每周

- [ ] 检查 D1 Analytics，确保消耗在预期范围
- [ ] 查看 Workers Logs，检查错误
- [ ] 测试关键功能

### 每月

- [ ] 检查是否有上游更新
- [ ] 合并上游最新版本
- [ ] 验证部署成功

### 缓存 TTL 调整 (基于实际情况)

```javascript
// functions/api/vps.js

// 如果流量很大，增加这些值以减少 D1 查询
const SETTINGS_CACHE_TTL_MS = 60_000;      // 默认 30 秒
const KV_SETTINGS_TTL_SECONDS = 600;       // 默认 5 分钟
```

---

## 💡 最佳实践

### 1. 版本管理

```bash
# 在部署前创建 git tag
git tag -a v1.0-deployed -m "Production deployment"
git push origin v1.0-deployed

# 如果需要回滚，可以轻松返回
git revert <commit-hash>
./deploy.sh production
```

### 2. 环境分离

- 使用 `development` 环境进行测试
- 使用 `production` 环境实际运营
- 不同环境使用不同的 D1 数据库和 KV 命名空间

```bash
# 测试部署
./deploy.sh development

# 验证没问题后才部署到生产
./deploy.sh production
```

### 3. 监控告警

在 Cloudflare Dashboard 中设置:
- D1 Rows Read 异常告警
- Workers 错误率告警
- KV Hit Ratio 过低告警

### 4. 日志收集

```bash
# 实时查看日志
wrangler tail --env production --format json | jq '.logs[]'

# 导出日志用于分析
wrangler tail --env production --format json > logs.jsonl
```

---

## 📚 相关文档

- [QUICK_DEPLOY_GUIDE.md](./QUICK_DEPLOY_GUIDE.md) - 详细部署步骤
- [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md) - 优化实现指南
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - 部署检查清单

---

## 🤝 贡献

如果您改进了部署脚本或文档，欢迎提交 Pull Request!

```bash
git checkout -b improve/deploy-script
# 进行您的改进
git push origin improve/deploy-script
# 在 GitHub 上创建 Pull Request
```

---

## ❓ FAQ

**Q: 每次上游更新都需要重新配置吗?**
A: 不需要。您的 `wrangler.toml` 已从 git 中隔离，上游更新不会影响它。

**Q: 可以多个 Fork 用户共用一个 Cloudflare 账户吗?**
A: 可以，但需要为每个 Fork 创建不同的 D1 数据库和 KV 命名空间。

**Q: 如何在本地测试然后再部署到生产?**
A: 先部署到 development 环境: `./deploy.sh development`，测试无误后: `./deploy.sh production`

**Q: 部署需要多长时间?**
A: 通常 2-3 分钟，包括构建、上传、部署。

**Q: 如何回滚到上个版本?**
A: `git revert <commit>` 后重新部署: `./deploy.sh production`

---

## 📞 获取帮助

1. 查看 [QUICK_DEPLOY_GUIDE.md](./QUICK_DEPLOY_GUIDE.md) 的常见问题
2. 查看 [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md) 的故障排除
3. 检查 Cloudflare Dashboard 的 Workers Logs
4. 提交 Issue 或 Discussion

---

**祝部署顺利! 🚀**
