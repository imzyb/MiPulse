/**
 * MiPulse Heartbeat Handler
 * 
 * 用于Cloudflare Workers Cron Trigger
 * 定期检测节点离线状态，发送恢复通知，避免在高频报告请求中进行全表扫描
 * 
 * 配置: 在 wrangler.toml 中添加:
 * [[triggers.crons]]
 * 该注释里避免出现“星号后接斜杠”组合，否则 Node 语法检查会认为注释结束。
 * 示例中可以写成: crons = '<STAR>/<5> * * * *'，实际 wrangler.toml 里面写成星号斜杠 5 的标准 cron 表达式。
 */

const SETTINGS_KEY = 'worker_settings_v1';

function nowIso() {
  return new Date().toISOString();
}

function normalizeString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function clampNumber(value, min, max, fallback = null) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function isoFromMs(ms) {
  return new Date(ms).toISOString();
}

function isNodeOnline(lastSeenAt, thresholdMinutes) {
  if (!lastSeenAt) return false;
  const last = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(last)) return false;
  const diffMs = Date.now() - last;
  return diffMs <= thresholdMinutes * 60 * 1000;
}

function buildAlertMessage(title, bodyLines) {
  const lines = Array.isArray(bodyLines) ? bodyLines : [];
  return `${title}\n\n${lines.filter(Boolean).join('\n')}`.trim();
}

function mapNodeRow(row) {
  return {
    id: row.id,
    name: row.name,
    tag: row.tag,
    groupTag: row.group_tag,
    region: row.region,
    countryCode: row.country_code,
    description: row.description,
    status: row.status,
    enabled: row.enabled === 1,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    overloadState: row.overload_state_json ? JSON.parse(row.overload_state_json) : null
  };
}

/**
 * 获取alert冷却时间戳（从KV）
 */
async function getAlertCooldownTimestamp(env, nodeId, alertType) {
  if (!env?.MIPULSE_KV) return null;
  try {
    const key = `mipulse:alert:cooldown:${nodeId}:${alertType}`;
    const value = await env.MIPULSE_KV.get(key);
    return value ? Number(value) : null;
  } catch (error) {
    console.error('KV alert cooldown read failed:', error?.message);
    return null;
  }
}

/**
 * 设置alert冷却时间戳到KV
 */
async function setAlertCooldownTimestamp(env, nodeId, alertType, timestamp, cooldownMs) {
  if (!env?.MIPULSE_KV) return;
  try {
    const key = `mipulse:alert:cooldown:${nodeId}:${alertType}`;
    const ttlSeconds = Math.ceil((cooldownMs + 30000) / 1000);
    await env.MIPULSE_KV.put(key, String(timestamp), { expirationTtl: ttlSeconds });
  } catch (error) {
    console.error('KV alert cooldown write failed:', error?.message);
  }
}

/**
 * 主处理函数 - Cron触发器
 */
export async function handleHeartbeatCron(env) {
  if (!env?.MIPULSE_DB) {
    console.error('[Heartbeat] D1 Binding (MIPULSE_DB) not found');
    return;
  }

  try {
    console.log('[Heartbeat] Starting offline detection...');
    
    // Step 1: 读取settings
    const settingsResult = await env.MIPULSE_DB.prepare(
      'SELECT value FROM settings WHERE key = ?'
    ).bind(SETTINGS_KEY).first();
    
    let settings = {};
    if (settingsResult?.value) {
      try {
        settings = JSON.parse(settingsResult.value);
      } catch {
        settings = {};
      }
    }

    const threshold = clampNumber(settings?.vpsMonitor?.offlineThresholdMinutes, 1, 1440, 10);
    const cooldownMs = clampNumber((settings?.vpsMonitor?.alertCooldownMinutes || 15) * 60 * 1000, 1000, 86400000, 900000);
    const cutoff = new Date(Date.now() - threshold * 60 * 1000).toISOString();

    console.log(`[Heartbeat] Threshold: ${threshold}min, Cutoff: ${cutoff}`);

    // Step 2: 查找所有应该离线的节点
    const staleResult = await env.MIPULSE_DB.prepare(
      `SELECT * FROM vps_nodes 
       WHERE status = 'online' AND (last_seen_at < ? OR last_seen_at IS NULL) AND enabled = 1`
    ).bind(cutoff).all();

    const staleNodes = (staleResult?.results || []).map(mapNodeRow);
    console.log(`[Heartbeat] Found ${staleNodes.length} stale nodes to offline`);

    // Step 3: 批量更新离线节点并发送通知
    for (const node of staleNodes) {
      const now = nowIso();
      
      try {
        // 更新节点状态为离线
        await env.MIPULSE_DB.prepare(
          `UPDATE vps_nodes SET status = ?, updated_at = ? WHERE id = ?`
        ).bind('offline', now, node.id).run();

        // 发送离线通知（如启用）
        if (settings?.vpsMonitor?.notifyOffline !== false) {
          // 检查冷却时间（优先使用KV）
          let lastOfflineTs = null;
          if (env?.MIPULSE_KV) {
            lastOfflineTs = await getAlertCooldownTimestamp(env, node.id, 'offline');
          }

          // 如果KV中没有或者没有KV，从D1查询
          if (lastOfflineTs === null) {
            const lastOffline = await env.MIPULSE_DB.prepare(
              'SELECT created_at FROM vps_alerts WHERE node_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1'
            ).bind(node.id, 'offline').first();
            
            if (lastOffline?.created_at) {
              lastOfflineTs = new Date(lastOffline.created_at).getTime();
            }
          }

          // 检查是否在冷却期内
          const now_ms = Date.now();
          const shouldAlert = !lastOfflineTs || (now_ms - lastOfflineTs) >= cooldownMs;

          if (shouldAlert) {
            const alertId = crypto.randomUUID();
            const message = buildAlertMessage('❌ VPS 离线', [
              `*节点:* ${node.name || node.id}`,
              node.tag ? `*标签:* ${node.tag}` : '',
              node.region ? `*地区:* ${node.region}` : '',
              `*时间:* ${new Date().toLocaleString('zh-CN')}`
            ]);
            
            // 插入离线警报
            await env.MIPULSE_DB.prepare(
              `INSERT INTO vps_alerts (id, node_id, type, message, created_at) 
               VALUES (?, ?, ?, ?, ?)`
            ).bind(alertId, node.id, 'offline', message, now).run();

            // 更新KV缓存
            await setAlertCooldownTimestamp(env, node.id, 'offline', now_ms, cooldownMs);

            console.log(`[Heartbeat] Alert created for node: ${node.id}`);
          } else {
            console.log(`[Heartbeat] Node ${node.id} in cooldown period, skipping alert`);
          }
        }
      } catch (error) {
        console.error(`[Heartbeat] Error processing node ${node.id}:`, error?.message);
      }
    }

    // Step 4: 检查是否有节点应该恢复
    const recoveryThreshold = threshold * 2; // 恢复需要2倍的时间窗口以确保稳定
    const recoveryCutoff = new Date(Date.now() - recoveryThreshold * 60 * 1000).toISOString();
    
    const onlineResult = await env.MIPULSE_DB.prepare(
      `SELECT * FROM vps_nodes 
       WHERE status = 'offline' AND last_seen_at > ? AND enabled = 1`
    ).bind(recoveryCutoff).all();

    const recoveryNodes = (onlineResult?.results || []).map(mapNodeRow);
    console.log(`[Heartbeat] Found ${recoveryNodes.length} nodes to potentially recover`);

    for (const node of recoveryNodes) {
      const now = nowIso();
      
      try {
        // 更新节点状态为在线
        await env.MIPULSE_DB.prepare(
          `UPDATE vps_nodes SET status = ?, updated_at = ? WHERE id = ?`
        ).bind('online', now, node.id).run();

        // 发送恢复通知（如启用）
        if (settings?.vpsMonitor?.notifyRecovery !== false) {
          // 检查冷却时间
          let lastRecoveryTs = null;
          if (env?.MIPULSE_KV) {
            lastRecoveryTs = await getAlertCooldownTimestamp(env, node.id, 'recovery');
          }

          if (lastRecoveryTs === null) {
            const lastRecovery = await env.MIPULSE_DB.prepare(
              'SELECT created_at FROM vps_alerts WHERE node_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1'
            ).bind(node.id, 'recovery').first();
            
            if (lastRecovery?.created_at) {
              lastRecoveryTs = new Date(lastRecovery.created_at).getTime();
            }
          }

          const now_ms = Date.now();
          const shouldAlert = !lastRecoveryTs || (now_ms - lastRecoveryTs) >= cooldownMs;

          if (shouldAlert) {
            const alertId = crypto.randomUUID();
            const message = buildAlertMessage('✅ VPS 恢复在线', [
              `*节点:* ${node.name || node.id}`,
              node.tag ? `*标签:* ${node.tag}` : '',
              node.region ? `*地区:* ${node.region}` : '',
              `*时间:* ${new Date().toLocaleString('zh-CN')}`
            ]);
            
            // 插入恢复警报
            await env.MIPULSE_DB.prepare(
              `INSERT INTO vps_alerts (id, node_id, type, message, created_at) 
               VALUES (?, ?, ?, ?, ?)`
            ).bind(alertId, node.id, 'recovery', message, now).run();

            // 更新KV缓存
            await setAlertCooldownTimestamp(env, node.id, 'recovery', now_ms, cooldownMs);

            console.log(`[Heartbeat] Recovery alert created for node: ${node.id}`);
          }
        }
      } catch (error) {
        console.error(`[Heartbeat] Error processing recovery for node ${node.id}:`, error?.message);
      }
    }

    // Step 5: 清理过期的警报
    try {
      const ALERTS_MAX_KEEP = 1000;
      await env.MIPULSE_DB.prepare(
        `DELETE FROM vps_alerts
         WHERE id NOT IN (
           SELECT id FROM vps_alerts ORDER BY created_at DESC LIMIT ${ALERTS_MAX_KEEP}
         )`
      ).run();
    } catch (error) {
      console.error('[Heartbeat] Error cleaning up alerts:', error?.message);
    }

    console.log('[Heartbeat] Offline detection completed successfully');
    
  } catch (error) {
    console.error('[Heartbeat] Fatal error:', error);
    throw error;
  }
}

export default {
  async fetch(request, env, ctx) {
    return new Response('Not Found', { status: 404 });
  },

  async scheduled(event, env, ctx) {
    console.log(`[Heartbeat] Cron triggered: ${event.cron}`);
    ctx.waitUntil(handleHeartbeatCron(env));
  }
};
