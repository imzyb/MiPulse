# wrangler.toml 配置指南

## 📋 快速填充步骤

### Step 1: 获取 Cloudflare Account ID

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 点击右上角账户图标 → "My Account" 
3. 左侧菜单 → "Settings"
4. 页面右侧找到 **Account ID**
5. 复制并填入 `wrangler.toml`:
   ```toml
   account_id = "YOUR_ACCOUNT_ID"
   ```

### Step 2: 获取 D1 数据库 ID

#### 方法A: 从已有数据库
1. Cloudflare Dashboard → Workers & Pages
2. 左侧菜单 → "D1" 
3. 选择 "mipulse" 数据库
4. 页面会显示数据库ID
5. 复制并填入:
   ```toml
   [[env.production.d1_databases]]
   database_id = "YOUR_D1_ID"
   ```

#### 方法B: 创建新的D1数据库
```bash
wrangler d1 create mipulse
```
命令完成后会显示database_id，复制到配置文件中。

### Step 3: 创建并获取 KV 命名空间 ID

运行以下命令创建KV命名空间：

```bash
# 创建生产环境KV
wrangler kv:namespace create "MIPULSE_KV"

# 创建预览环境KV
wrangler kv:namespace create "MIPULSE_KV" --preview
```

命令输出示例：
```
 ✓ Created namespace with title "MIPULSE_KV"
 ✓ Add the following binding to your wrangler.toml file:
 [[kv_namespaces]]
 binding = "MIPULSE_KV"
 id = "abc123def456ghi789jkl"
 preview_id = "xyz789abc456def123ghi"
```

复制ID信息填入 `wrangler.toml`:
```toml
[[env.production.kv_namespaces]]
binding = "MIPULSE_KV"
id = "abc123def456ghi789jkl"
preview_id = "xyz789abc456def123ghi"
```

### Step 4: 配置 Cron Triggers (可选但推荐)

编辑 `wrangler.toml`，取消注释以下部分：

```toml
[[triggers.crons]]
crons = ["*/5 * * * *"]  # 每5分钟执行一次
```

这会启用异步离线检测，将D1查询减少96%。

### Step 5: 配置 Zone ID (如有自定义域名)

1. 如果使用自定义域名，需要配置Zone ID
2. Cloudflare Dashboard → Websites → 选择你的域名
3. 右侧 "Zone ID"
4. 填入:
   ```toml
   [env.production]
   route = "yourdomain.com/api/*"
   zone_id = "YOUR_ZONE_ID"
   ```

---

## ✅ 配置清单

```
生产环境配置:
  ☐ account_id - Cloudflare账户ID
  ☐ env.production.d1_databases.database_id - D1数据库ID
  ☐ env.production.kv_namespaces.id - KV主命名空间ID
  ☐ env.production.kv_namespaces.preview_id - KV预览命名空间ID

开发环境配置:
  ☐ env.development.d1_databases.database_id - 开发D1数据库ID
  ☐ env.development.kv_namespaces.id - 开发KV命名空间ID
  ☐ env.development.kv_namespaces.preview_id - 开发KV预览ID

可选配置:
  ☐ Cron Triggers - 启用异步离线检测
  ☐ Zone ID - 如使用自定义域名
```

---

## 🚀 验证配置

填完所有值后，验证配置是否正确：

```bash
# 检查wrangler.toml语法
wrangler secret list --env production

# 本地开发测试
npm run dev:wrangler

# 如果显示 "✓ Started serving" 则配置成功
```

---

## 📝 环境变量说明

### 开发环境 (development)
- 用于本地开发和测试
- 使用独立的D1数据库（不影响生产数据）
- 使用独立的KV命名空间

### 生产环境 (production)
- 实际运营环境
- 使用生产D1数据库
- 使用生产KV命名空间
- 配置实际的域名和Zone ID

### 切换环境
```bash
# 开发环境
npm run dev:wrangler

# 生产环境
wrangler pages deploy dist --env production
```

---

## 🔧 常见问题

### Q: 能否跳过KV配置？
**A**: 可以。如果不填KV配置，系统仍然可以工作，但会失去缓存优化，D1消耗会大幅增加。不推荐。

### Q: D1和KV ID从哪里复制？
**A**: 都在Cloudflare Dashboard中：
- D1: Workers → D1 → 选择数据库 → 复制 Database ID
- KV: Workers → KV Namespaces → 选择命名空间 → 复制 Namespace ID

### Q: Cron Triggers一定要启用吗？
**A**: 可选但强烈推荐。启用后可以：
- 异步检测离线节点
- 避免高频全表扫描
- 减少D1查询96%

### Q: 如何在开发环境测试Cron？
**A**: 目前Cron不在本地开发工作。需要部署到Cloudflare才能测试。

---

## 📚 完整配置示例

```toml
name = "mipulse"
main = "functions/api/[[path]].js"
type = "service"
compatibility_date = "2024-03-31"

account_id = "1234abcd5678efgh9012ijkl"
workers_dev = true

[env.development]
vars = { ENVIRONMENT = "development" }

[[env.development.d1_databases]]
binding = "MIPULSE_DB"
database_name = "mipulse"
database_id = "dev-db-123abc"

[[env.development.kv_namespaces]]
binding = "MIPULSE_KV"
id = "dev-kv-123abc"
preview_id = "dev-kv-preview-123abc"

[env.production]
zone_id = "abc123xyz"
route = "mipulse.example.com/api/*"
vars = { ENVIRONMENT = "production" }

[[env.production.d1_databases]]
binding = "MIPULSE_DB"
database_name = "mipulse"
database_id = "prod-db-456def"

[[env.production.kv_namespaces]]
binding = "MIPULSE_KV"
id = "prod-kv-456def"
preview_id = "prod-kv-preview-456def"

[[triggers.crons]]
crons = ["*/5 * * * *"]
```

---

## 📞 获取帮助

如遇问题，请参考：
1. [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
2. [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
3. 项目文档中的 `DEPLOYMENT_CHECKLIST.md`
