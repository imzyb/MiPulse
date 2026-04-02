# MiPulse D1 优化快速参考

## 已实现的优化

✅ **KV缓存层** - 三层缓存架构
- 内存缓存(30s) → KV缓存(5min) → D1(持久化)

✅ **Settings缓存** 
- `loadSettings()` 使用KV避免每次D1查询
- 写入时同时更新KV和D1

✅ **Alert冷却优化**
- `pushAlert()` 和 `pushAlertsBatch()` 使用KV存储冷却时间戳
- 降低D1查询75-95%

✅ **公开视图缓存强化**
- `handlePublicSnapshot()` 使用KV作为第二层缓存
- 内存缓存失效后仍可快速恢复

✅ **离线检测异步化**
- `checkAllNodesHeartbeat()` 从handleReport中移除
- 即将配置到Cron Trigger中单独执行

---

## 快速配置流程

### 1. 启用KV缓存 (必需)

```bash
# 创建KV命名空间
wrangler kv:namespace create "MIPULSE_KV"
wrangler kv:namespace create "MIPULSE_KV" --preview

# 记录输出的ID
```

### 2. 配置 wrangler.toml

```toml
[[env.production.kv_namespaces]]
binding = "MIPULSE_KV"
id = "YOUR_KV_ID"  # 替换为上面获得的ID

[[triggers.crons]]
crons = ["*/5 * * * *"]  # 每5分钟检测一次离线节点
```

### 3. 本地测试

```bash
npm run dev
# 检查 KV 是否正常工作
```

---

## D1读取消耗估算

### 每日场景 (1000探针, 每分钟报告)

| 操作 | 优化前 | 优化后 | 节省 |
|-----|-------|-------|------|
| Settings读取 | 144万 | 1440 | 99.9% ↓ |
| Alert冷却检查 | 14.4万 | 7200 | 95% ↓ |
| 离线检测 | 288 | 288 | 0% |
| 总计 | ~158.7万 | ~9000 | **94%** ↓ |

免费计划配额: 每天100万次读取 ✅

---

## 环境变量检查

```javascript
// 在handleVpsRequest中验证
console.log('D1 available:', !!env.MIPULSE_DB);
console.log('KV available:', !!env.MIPULSE_KV);
```

---

## KV缓存键设计

```javascript
// Settings
'mipulse:settings:main'

// Node Secrets (可选)
'mipulse:node:secret:{nodeId}'

// Alert Cooldown
'mipulse:alert:cooldown:{nodeId}:{alertType}'

// Public Snapshot
'mipulse:public:snapshot'
```

---

## 故障排除速查表

| 症状 | 原因 | 修复 |
|-----|------|------|
| KV返回undefined | 绑定未配置 | 检查wrangler.toml |
| Cron不运行 | 触发器未启用 | 添加triggers.crons配置 |
| 缓存过期太快 | TTL设置过短 | Settings: 300s, Snapshot: 60s |
| 仍然很慢 | KV缓存未命中 | 检查缓存key一致性 |

---

## 性能优化清单

- [ ] 启用KV绑定
- [ ] 部署包含KV支持的vps.js
- [ ] 配置heartbeat.js (可选)
- [ ] 启用Cron触发器 (可选)
- [ ] 测试settings缓存
- [ ] 测试alert冷却
- [ ] 监控D1读取统计
- [ ] 监控KV请求数

---

## 监控指标

在Cloudflare Dashboard中查看:

📊 **D1 Analytics**:
- Rows Read (应降低至约1万/天)
- Query Performance
- Error Rate

📊 **KV Analytics**:
- Requests Read (应约5000/天)
- Requests Write (应约500-1000/天)
- Hit Ratio (应 > 90%)

---

## 需要帮助?

1. 检查Workers日志: `wrangler tail`
2. 查看完整文档: `OPTIMIZATION_GUIDE.md`
3. 验证绑定: 在环境中打印 `env` 对象

---

## 版本历史

- **v1.0** (当前)
  - KV缓存层实现
  - Alert冷却KV化
  - Snapshot缓存增强
  - Cron异步化准备

**下一步**: 
- [ ] Node秘钥内存缓存优化
- [ ] 分布式缓存预热
- [ ] 自适应TTL调整
