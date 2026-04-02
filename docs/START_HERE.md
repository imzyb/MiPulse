# MiPulse Fork 用户快速入门

> 如果您 Fork 了 MiPulse 仓库，请先快速阅读此指南 (2 分钟)

---

## 🎯 概览

MiPulse 已为 Fork 用户提供了**完全自动化的部署方案**，解决了以下问题:

✅ **配置文件隔离** - wrangler.toml 不会导致上游更新冲突  
✅ **自动配置脚本** - 无需手动复制粘贴 ID  
✅ **一键部署** - 包含完整的验证和错误检查  
✅ **无缝更新** - 上游更新不会破坏您的配置  

---

## ⚡ 5 分钟快速部署

### 步骤 1: 赋予脚本执行权限
```bash
chmod +x setup.sh deploy.sh
```

### 步骤 2: 自动配置 (交互式)
```bash
./setup.sh
```

脚本会自动询问您:
- Cloudflare Account ID
- D1 数据库 ID
- KV 命名空间 ID
- 自定义域名 (可选)
- Cron 触发器 (可选)

### 步骤 3: 一键部署
```bash
./deploy.sh production
```

完成! 🎉 您的应用已部署到 Cloudflare。

---

## 📚 文档导航

**新 Fork 用户应按以下顺序阅读:**

| 文档 | 用途 | 阅读时间 |
|-----|------|--------|
| ← **您正在看** | 快速入门 | 2 分钟 |
| [QUICK_DEPLOY_GUIDE.md](./QUICK_DEPLOY_GUIDE.md) | 详细部署步骤和问题解决 | 5 分钟 |
| [FORK_DEPLOYMENT.md](./FORK_DEPLOYMENT.md) | Fork 用户的特殊指南 | 5 分钟 |
| [OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md) | 了解优化原理 | 10 分钟 |
| [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) | 部署前检查清单 | 5 分钟 |

---

## 🗂️ 重要文件说明

### 自动配置文件

| 文件 | 说明 |
|-----|------|
| **setup.sh** | 交互式配置脚本，生成 wrangler.toml |
| **deploy.sh** | 一键部署脚本，包含完整验证 |
| **wrangler.toml.example** | 配置文件模板 |

### 配置隔离

| 文件 | 说明 | 被 Git 追踪 | 作用 |
|-----|------|----------|------|
| wrangler.toml | **您的实际配置** | ✗ | 生产部署 |
| wrangler.toml.example | 配置模板 | ✓ | 上游会更新 |

**重要**: 您的 `wrangler.toml` 在 `.gitignore` 中，上游更新不会产生冲突！

---

## ⚙️ 所需信息

部署前，您需要从 Cloudflare 获得以下 4 项信息:

### 1. Account ID (1 分钟)
```
https://dash.cloudflare.com
→ 右上角账户图标
→ My Account (或 Settings)
→ Account ID (页面右侧)
```

### 2. D1 Database ID (可选)
```
方案 A: 使用现有数据库
  https://dash.cloudflare.com
  → Workers & Pages
  → D1
  → 选择 mipulse
  → 复制 Database ID

方案 B: 让脚本创建新数据库
  setup.sh 会自动创建
```

### 3. KV Namespace ID (脚本可创建)
```
方案 A: 手动创建
  wrangler kv:namespace create "MIPULSE_KV"

方案 B: 让脚本创建
  setup.sh 会交互式询问是否创建
```

### 4. 自定义域名 (可选)
```
如果使用自定义域名，您需要:
- Domain name: 例如 example.com
- Zone ID: 从 Cloudflare Dashboard → Websites → 选择您的域名 → Zone ID
```

---

## 🚀 工作流程演示

```bash
# 1. Clone 您的 Fork
git clone https://github.com/YOUR_USERNAME/MiPulse.git
cd MiPulse

# 2. 赋予权限
chmod +x setup.sh deploy.sh

# 3. 交互式配置 (会询问上述 4 项信息)
./setup.sh
# ✓ Created: wrangler.toml

# 4. 部署到生产环境
./deploy.sh production
# ✓ Deployed successfully!

# 5. 验证部署 (或在 Cloudflare Dashboard 中查看)
wrangler tail --env production
```

---

## 🔄 上游同步流程

fork 用户最关心的是: **上游更新是否会破坏我的配置?**

**答案**: 完全不会! 因为:

```bash
# 上游更新来了
git fetch upstream
git merge upstream/master

# 只有代码文件会更新
# wrangler.toml 不会任何改变 ✓
# 因为它在 .gitignore 中

# 新代码部署
./deploy.sh production
# 完成！新功能 + 您的配置 = 无缝集成
```

---

## ✅ 部署后检查清单

部署完成后，按顺序检查:

### ① 检查部署状态
```bash
wrangler tail --env production
```
应该看到日志输出，没有错误。

### ② 查看 D1 消耗
```
Cloudflare Dashboard
→ Workers & Pages
→ D1
→ Rows Read 统计

预期: 从 ~158万/天 降低到 ~14万/天 (91% 下降)
```

### ③ 检查 KV 工作状态
```
Cloudflare Dashboard
→ Workers
→ KV

预期: Read ~9000/天, Hit Ratio > 90%
```

### ④ 测试应用
```bash
curl https://your-project.pages.dev/api/vps/nodes
```
应该返回节点列表。

---

## 🆘 出错了?

### 错误 1: "找不到 Cloudflare Account ID"
**解决**: https://dash.cloudflare.com → Settings → Account ID (页面右侧)

### 错误 2: "wrangler 命令未找到"
**解决**: `npm install -g wrangler`

### 错误 3: setup.sh 无法执行
**解决**: `chmod +x setup.sh`

### 错误 4: 部署失败
**检查**:
1. 是否有网络连接?
2. Cloudflare 凭证是否正确?
3. 查看详细错误: `wrangler tail --env production`

⚠️ **仍然有问题?** 请查看 [QUICK_DEPLOY_GUIDE.md](./QUICK_DEPLOY_GUIDE.md) 的详细故障排除

---

## 📊 部署后的成熟配置

部署成功后，您的项目目录会有:

```
MiPulse/
├── wrangler.toml          ← 🔒 您的配置 (本地存储，不被追踪)
├── wrangler.toml.example  ← 配置模板 (git 追踪)
├── setup.sh               ← 配置脚本 (git 追踪)
├── deploy.sh              ← 部署脚本 (git 追踪)
├── .env.example           ← 环境变量模板 (git 追踪)
├── functions/api/
│   ├── vps.js             ← D1 优化代码 ✓
│   └── heartbeat.js       ← Cron 处理器 ✓
└── [其他项目文件]
```

---

## 🎯 接下来做什么?

### 立即 (今天)
- ✅ 运行 `./setup.sh` 配置
- ✅ 运行 `./deploy.sh production` 部署
- ✅ 验证部署成功

### 短期 (本周)
- ⭐ 在 Cloudflare Dashboard 中监控 D1 消耗
- ⭐ 测试应用的各项功能
- ⭐ 如果满意，给主仓库一个 Star

### 长期 (持续)
- 🔄 定期检查上游更新
- 🔄 根据需要合并新功能
- 🔄 监控性能指标

---

## 💡 有用的命令速记

```bash
# 查看实时日志
wrangler tail --env production

# 检查 KV 数据
wrangler kv:key list --binding MIPULSE_KV --env production

# 查看部署历史
wrangler deployments list --env production

# 快速重新部署 (已配置后)
npm run build && wrangler pages deploy dist --env production

# 切换到开发环境部署/测试
./deploy.sh development
```

---

## 📖 完整文档

这只是快速入门指南。完整的文档包括:

- **[FORK_DEPLOYMENT.md](./FORK_DEPLOYMENT.md)** - Fork 用户专用指南
- **[QUICK_DEPLOY_GUIDE.md](./QUICK_DEPLOY_GUIDE.md)** - 详细部署步骤
- **[OPTIMIZATION_GUIDE.md](./OPTIMIZATION_GUIDE.md)** - 技术细节
- **[DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)** - 检查清单

---

## ❓ 常见问题

**Q: 脚本支持 Windows 吗?**
A: setup.sh 和 deploy.sh 是 Bash 脚本，在 Windows 上使用 WSL2 或 Git Bash 运行。

**Q: 可以不用脚本手动部署吗?**
A: 可以，但不推荐。脚本包含了许多安全检查和验证。

**Q: 如何在本地开发?**
A: `npm run dev` 使用本地开发服务器

**Q: 如何在 0 成本下运行?**
A: 使用 Cloudflare 免费计划，我们已优化到完全免费！

**Q: 支持多个环境吗?**
A: 完全支持！配置中包含 development 和 production 两个环境。

---

## 🚀 准备好了吗?

```bash
chmod +x setup.sh deploy.sh
./setup.sh
./deploy.sh production
```

**就是这样!**  
您的 MiPulse 应用已部署到 Cloudflare，享受 91% 的 D1 成本节省! 🎉

---

## 📞 需要帮助?

1. 查看 [QUICK_DEPLOY_GUIDE.md](./QUICK_DEPLOY_GUIDE.md) - 更详细的步骤
2. 检查 [FORK_DEPLOYMENT.md](./FORK_DEPLOYMENT.md) - Fork 特定问题
3. 查看 Cloudflare Dashboard 的 Workers Logs
4. 提交 Issue 或 Discussion

---

**Happy Deploying! 🚀**

*最后更新: 2024年4月*
