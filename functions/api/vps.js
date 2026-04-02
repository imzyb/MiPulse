// MiPulse VPS API Handler
// Synced with MiSub VPS monitor behaviors (D1 Only)

const REPORTS_MAX_KEEP = 5000;
const ALERTS_MAX_KEEP = 1000;

// --- Utilities ---

function createJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function createError(msg, status = 400) {
  return new Response(JSON.stringify({ error: msg, success: false }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function nowIso() {
  return new Date().toISOString();
}

function isoFromMs(ms) {
  return new Date(ms).toISOString();
}

function normalizeString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function normalizeJsonString(value) {
  const raw = normalizeString(value);
  if (!raw) return '';
  try {
    return JSON.stringify(JSON.parse(raw));
  } catch {
    return raw;
  }
}

function clampNumber(value, min, max, fallback = null) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function clampPositiveInt(value, min, max, fallback) {
  const num = Math.floor(Number(value));
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
}

function getClientIp(request) {
  return request.headers.get('CF-Connecting-IP')
    || request.headers.get('X-Forwarded-For')
    || request.headers.get('X-Real-IP')
    || '';
}

async function computeSignature(secret, nodeId, timestamp, payloadCanonical) {
  const data = `${nodeId}.${timestamp}.${payloadCanonical}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalizeReportTimestamp(rawValue, fallbackIso) {
  if (rawValue === null || rawValue === undefined) return fallbackIso;
  if (typeof rawValue === 'number') {
    const ts = rawValue > 1e12 ? rawValue : rawValue * 1000;
    return isoFromMs(ts);
  }
  if (typeof rawValue === 'string') {
    const trimmed = rawValue.trim();
    if (!trimmed) return fallbackIso;
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      const ts = num > 1e12 ? num : num * 1000;
      return isoFromMs(ts);
    }
    const parsed = new Date(trimmed).getTime();
    if (Number.isFinite(parsed)) return isoFromMs(parsed);
  }
  return fallbackIso;
}

function isNodeOnline(lastSeenAt, thresholdMinutes) {
  if (!lastSeenAt) return false;
  const last = new Date(lastSeenAt).getTime();
  if (!Number.isFinite(last)) return false;
  const diffMs = Date.now() - last;
  return diffMs <= thresholdMinutes * 60 * 1000;
}

function clampPayloadUsage(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(100, Math.max(0, num));
}

function clampPayloadLoad(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(0, Math.min(1000, num));
}

function clampPayloadUptime(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.min(10 ** 9, num);
}

function buildNetworkCheckKey(item) {
  const type = normalizeString(item?.type).toLowerCase();
  const target = normalizeString(item?.target).toLowerCase();
  const scheme = type === 'http' ? normalizeString(item?.scheme || 'https').toLowerCase() : '';
  const rawPort = item?.port;
  const portNumber = rawPort === null || rawPort === undefined || rawPort === '' ? null : Number(rawPort);
  const port = Number.isFinite(portNumber) ? String(portNumber) : '';
  const path = type === 'http' ? normalizeString(item?.path || '/') : '';
  return `${type}|${target}|${scheme}|${port}|${path}`;
}

function rehydrateCheckNames(checks, targets) {
  if (!Array.isArray(checks) || !Array.isArray(targets)) return checks;
  const exactNameMap = new Map();
  const fallbackNameMap = new Map();

  targets.forEach(target => {
    const name = normalizeString(target?.name);
    const normalizedTarget = normalizeString(target?.target).toLowerCase();
    if (!name || !normalizedTarget) return;
    exactNameMap.set(buildNetworkCheckKey(target), name);
    if (!fallbackNameMap.has(normalizedTarget)) {
      fallbackNameMap.set(normalizedTarget, name);
    }
  });

  return checks.map(check => {
    if (check?.name || !check?.target) return check;
    const exactName = exactNameMap.get(buildNetworkCheckKey(check));
    if (exactName) return { ...check, name: exactName };
    const fallbackName = fallbackNameMap.get(normalizeString(check.target).toLowerCase());
    return fallbackName ? { ...check, name: fallbackName } : check;
  });
}

function sanitizeNetworkChecks(checks) {
  if (!Array.isArray(checks)) return [];
  return checks.map((item) => {
    const type = normalizeString(item?.type).toLowerCase();
    if (!['icmp', 'tcp', 'http'].includes(type)) return null;
    const target = normalizeString(item?.target);
    if (!target) return null;
    const name = normalizeString(item?.name || '');
    const status = normalizeString(item?.status) || 'unknown';
    const latencyMs = clampNumber(item?.latencyMs, 0, 60 * 1000, null);
    const lossPercent = clampNumber(item?.lossPercent, 0, 100, null);
    const httpCode = clampNumber(item?.httpCode, 0, 999, null);
    const scheme = normalizeString(item?.scheme || 'https');
    const port = item?.port !== undefined && item?.port !== null ? Number(item.port) : null;
    const path = normalizeString(item?.path || '/');
    const dnsMs = clampNumber(item?.dnsMs, 0, 60 * 1000, null);
    const connectMs = clampNumber(item?.connectMs, 0, 60 * 1000, null);
    const tlsMs = clampNumber(item?.tlsMs, 0, 60 * 1000, null);
    const checkedAt = normalizeReportTimestamp(item?.checkedAt, null);
    return {
      type,
      target,
      name,
      status,
      latencyMs,
      lossPercent,
      httpCode,
      scheme,
      port: Number.isFinite(port) ? port : null,
      path,
      dnsMs,
      connectMs,
      tlsMs,
      checkedAt
    };
  }).filter(Boolean);
}

function computeOverload(report, settings) {
  const cpuThreshold = clampNumber(settings?.vpsMonitor?.cpuWarnPercent, 1, 100, 90);
  const memThreshold = clampNumber(settings?.vpsMonitor?.memWarnPercent, 1, 100, 90);
  const diskThreshold = clampNumber(settings?.vpsMonitor?.diskWarnPercent, 1, 100, 90);

  const cpu = clampNumber(report.cpu?.usage ?? report.cpuPercent, 0, 100, null);
  const mem = clampNumber(report.mem?.usage ?? report.memPercent, 0, 100, null);
  const disk = clampNumber(report.disk?.usage ?? report.diskPercent, 0, 100, null);

  const overload = {
    cpu: cpu !== null && cpu >= cpuThreshold,
    mem: mem !== null && mem >= memThreshold,
    disk: disk !== null && disk >= diskThreshold
  };
  overload.any = overload.cpu || overload.mem || overload.disk;
  return { overload, thresholds: { cpuThreshold, memThreshold, diskThreshold }, values: { cpu, mem, disk } };
}

function computeOverloadState(previous, overloadInfo) {
  const state = {
    count: clampPositiveInt(previous?.count, 0, 10000, 0),
    lastAt: normalizeString(previous?.lastAt || ''),
    lastSignature: normalizeString(previous?.lastSignature || '')
  };
  if (overloadInfo?.overload?.any) {
    state.count += 1;
    state.lastAt = nowIso();
  } else {
    state.count = 0;
  }
  const signature = `${overloadInfo?.values?.cpu ?? ''}|${overloadInfo?.values?.mem ?? ''}|${overloadInfo?.values?.disk ?? ''}`;
  state.lastSignature = signature;
  return state;
}

function shouldTriggerOverload(settings, state, overloadInfo) {
  if (!overloadInfo?.overload?.any) return false;
  const threshold = clampPositiveInt(settings?.vpsMonitor?.overloadConfirmCount, 1, 10, 2);
  if (state.count < threshold) return false;
  const signature = `${overloadInfo?.values?.cpu ?? ''}|${overloadInfo?.values?.mem ?? ''}|${overloadInfo?.values?.disk ?? ''}`;
  if (signature && signature === state.lastSignature && state.count > threshold) return false;
  return true;
}

function buildAlertMessage(title, bodyLines) {
  const lines = Array.isArray(bodyLines) ? bodyLines : [];
  return `${title}\n\n${lines.filter(Boolean).join('\n')}`.trim();
}

function buildSnapshot(report, node) {
  const cpuPercent = clampNumber(report.cpu?.usage, 0, 100, null);
  const memPercent = clampNumber(report.mem?.usage, 0, 100, null);
  const diskPercent = clampNumber(report.disk?.usage, 0, 100, null);

  return {
    at: nowIso(),
    status: node?.status || 'unknown',
    cpuPercent,
    memPercent,
    diskPercent,
    load1: clampNumber(report.load?.load1, 0, 1000, null),
    load5: clampNumber(report.load?.load5, 0, 1000, null),
    load15: clampNumber(report.load?.load15, 0, 1000, null),
    uptimeSec: clampNumber(report.uptimeSec, 0, 10 ** 9, null),
    traffic: report.traffic || null,
    network: report.network || null,
    ip: normalizeString(report.publicIp || report.ip || report.meta?.publicIp),
    receivedAt: report.receivedAt || report.createdAt || null,
    cpu: report.cpu || null,
    mem: report.mem || null,
    disk: report.disk || null,
    swap: report.swap || null
  };
}

function summarizeNode(node, latestReport, settings) {
  let status = node.status;
  const threshold = clampNumber(settings?.vpsMonitor?.offlineThresholdMinutes, 1, 1440, 10);
  if (node.lastSeenAt) {
    const lastSeen = new Date(node.lastSeenAt).getTime();
    if (Date.now() - lastSeen > threshold * 60 * 1000) {
      status = 'offline';
    }
  } else {
    status = 'offline';
  }

  const overloadInfo = latestReport ? computeOverload(latestReport, settings) : null;

  return {
    id: node.id,
    name: node.name,
    tag: node.tag,
    groupTag: node.groupTag || node.group_tag,
    region: node.region,
    countryCode: node.countryCode || node.country_code,
    description: node.description,
    status,
    enabled: Boolean(node.enabled),
    networkMonitorEnabled: node.networkMonitorEnabled !== false,
    useGlobalTargets: Boolean(node.useGlobalTargets || node.use_global_targets),
    totalRx: node.totalRx || node.total_rx || 0,
    totalTx: node.totalTx || node.total_tx || 0,
    trafficLimitGb: node.trafficLimitGb || node.traffic_limit_gb || 0,
    lastSeenAt: node.lastSeenAt,
    updatedAt: node.updatedAt,
    latest: latestReport || null,
    overload: overloadInfo ? overloadInfo.overload : null
  };
}

// for unit testing
export { summarizeNode };

function resolveSettings(config) {
  return { ...DEFAULT_SETTINGS, ...(config || {}) };
}

function resolvePublicThemePreset(settings) {
  const preset = normalizeString(settings?.vpsMonitor?.publicThemePreset).toLowerCase();
  const supported = new Set(['default', 'fresh', 'minimal', 'tech', 'glass']);
  if (!supported.has(preset)) return preset === 'tech-dark' ? 'tech' : 'default';
  return preset;
}

function buildPublicThemeConfig(settings) {
  const raw = settings?.vpsMonitor || {};
  const validSections = new Set(['anomalies', 'nodes', 'featured', 'details']);
  const normalizedOrder = Array.isArray(raw.publicThemeSectionOrder)
    ? raw.publicThemeSectionOrder.filter(item => validSections.has(normalizeString(item)))
    : [];
  const sectionOrder = normalizedOrder.length
    ? normalizedOrder
    : DEFAULT_SETTINGS.vpsMonitor.publicThemeSectionOrder;
  return {
    preset: resolvePublicThemePreset(settings),
    title: normalizeString(raw.publicThemeTitle) || DEFAULT_SETTINGS.vpsMonitor.publicThemeTitle,
    subtitle: normalizeString(raw.publicThemeSubtitle) || DEFAULT_SETTINGS.vpsMonitor.publicThemeSubtitle,
    logo: normalizeString(raw.publicThemeLogo),
    backgroundImage: normalizeString(raw.publicThemeBackgroundImage),
    showStats: raw.publicThemeShowStats !== false,
    showAnomalies: raw.publicThemeShowAnomalies !== false,
    showFeatured: raw.publicThemeShowFeatured !== false,
    showDetailTable: raw.publicThemeShowDetailTable !== false,
    footerText: normalizeString(raw.publicThemeFooterText) || DEFAULT_SETTINGS.vpsMonitor.publicThemeFooterText,
    sectionOrder,
    customCss: normalizeString(raw.publicThemeCustomCss)
  };
}

function getReportRetentionCutoff(settings) {
  const days = clampNumber(settings?.vpsMonitor?.reportRetentionDays, 1, 180, 30);
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function shouldTriggerAlerts(settings) {
  return settings?.vpsMonitor?.alertsEnabled !== false;
}

function getAlertCooldownMs(settings) {
  const minutes = clampNumber(settings?.vpsMonitor?.alertCooldownMinutes, 1, 1440, 15);
  return minutes * 60 * 1000;
}

function shouldSkipCooldown(settings, alertType) {
  return alertType === 'recovery' && settings?.vpsMonitor?.cooldownIgnoreRecovery === true;
}

async function pushAlert(db, settings, alert, env = null) {
  if (!alert) return;
  const cooldownMs = getAlertCooldownMs(settings);

  if (!shouldSkipCooldown(settings, alert.type)) {
    // 优化：优先从KV检查冷却时间，避免D1查询
    let lastTs = null;
    
    if (env?.MIPULSE_KV) {
      lastTs = await getAlertCooldownTimestamp(env, alert.nodeId, alert.type);
    }
    
    // 如果KV中没有或者KV不可用，从D1查询（降级）
    if (lastTs === null) {
      const lastSame = await db.prepare(
        'SELECT created_at FROM vps_alerts WHERE node_id = ? AND type = ? ORDER BY created_at DESC LIMIT 1'
      ).bind(alert.nodeId, alert.type).first();
      if (lastSame?.created_at) {
        lastTs = new Date(lastSame.created_at).getTime();
      }
    }
    
    if (lastTs && Number.isFinite(lastTs) && (Date.now() - lastTs) < cooldownMs) {
      return;
    }
  }

  await db.prepare(
    'INSERT INTO vps_alerts (id, node_id, type, message, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(alert.id, alert.nodeId, alert.type, alert.message, alert.createdAt).run();

  await db.prepare(
    `DELETE FROM vps_alerts
     WHERE id NOT IN (
       SELECT id FROM vps_alerts ORDER BY created_at DESC LIMIT ${ALERTS_MAX_KEEP}
     )`
  ).run();

  // 更新KV缓存
  const alertTimestamp = new Date(alert.createdAt).getTime();
  await setAlertCooldownTimestamp(env, alert.nodeId, alert.type, alertTimestamp, cooldownMs);

  await dispatchNotifications(settings, alert);
}

async function pushAlertsBatch(db, settings, alerts, env = null) {
  if (!alerts.length) return;
  const cooldownMs = getAlertCooldownMs(settings);

  // 优化：使用KV缓存检查冷却时间，减少D1查询
  const now = Date.now();
  let validAlerts = [];
  const kvUnavailableTypes = new Set();
  
  for (const alert of alerts) {
    if (shouldSkipCooldown(settings, alert.type)) {
      validAlerts.push(alert);
      continue;
    }
    
    let lastTs = null;
    
    // 优先从KV检查
    if (env?.MIPULSE_KV) {
      lastTs = await getAlertCooldownTimestamp(env, alert.nodeId, alert.type);
    }
    
    // 如果KV检查失败，需要从D1查询
    if (lastTs === null && !kvUnavailableTypes.has(alert.type)) {
      kvUnavailableTypes.add(alert.type);
    }
    
    if (!lastTs || (now - lastTs) >= cooldownMs) {
      validAlerts.push(alert);
    }
  }
  
  // 批量查询D1（仅查询KV不可用的类型）
  if (kvUnavailableTypes.size > 0) {
    const types = Array.from(kvUnavailableTypes);
    const placeholders = types.map(() => '?').join(',');
    const cooldownResult = await db.prepare(
      `SELECT type, created_at FROM vps_alerts WHERE node_id = ? AND type IN (${placeholders}) ORDER BY created_at DESC`
    ).bind(alerts[0].nodeId, ...types).all();

    const cooldownMap = new Map();
    (cooldownResult.results || []).forEach(row => {
      if (!cooldownMap.has(row.type)) {
        cooldownMap.set(row.type, new Date(row.created_at).getTime());
      }
    });
    
    // 再次过滤
    validAlerts = validAlerts.filter(alert => {
      const lastTs = cooldownMap.get(alert.type);
      if (lastTs && (now - lastTs) < cooldownMs) return false;
      return true;
    });
  }

  for (const alert of validAlerts) {
    await db.prepare(
      'INSERT INTO vps_alerts (id, node_id, type, message, created_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(alert.id, alert.nodeId, alert.type, alert.message, alert.createdAt).run();
    
    // 更新KV缓存
    const alertTimestamp = new Date(alert.createdAt).getTime();
    await setAlertCooldownTimestamp(env, alert.nodeId, alert.type, alertTimestamp, cooldownMs);
    
    await dispatchNotifications(settings, alert);
  }

  await db.prepare(
    `DELETE FROM vps_alerts
     WHERE id NOT IN (
       SELECT id FROM vps_alerts ORDER BY created_at DESC LIMIT ${ALERTS_MAX_KEEP}
     )`
  ).run();
}

function stripMarkdown(text) {
  return normalizeString(text).replace(/\*/g, '').replace(/`/g, '').replace(/_/g, '').trim();
}

function escapeTelegramMarkdown(text) {
  return normalizeString(text).replace(/([_\*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

async function sendTelegramNotification(settings, alert) {
  if (!settings?.vpsMonitor?.notificationEnabled) return;
  if (!settings?.vpsMonitor?.notifyTelegram) return;
  const token = normalizeString(settings?.vpsMonitor?.telegramBotToken);
  const chatId = normalizeString(settings?.vpsMonitor?.telegramChatId);
  if (!token || !chatId) return;

  const text = escapeTelegramMarkdown(stripMarkdown(alert.message));
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true
    })
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`telegram ${resp.status}: ${txt.slice(0, 160)}`);
  }
  return 'telegram';
}

async function sendWebhookNotification(settings, alert) {
  if (!settings?.vpsMonitor?.notificationEnabled) return;
  if (!settings?.vpsMonitor?.notifyWebhook) return;
  const webhookUrl = normalizeString(settings?.vpsMonitor?.webhookUrl);
  if (!webhookUrl) return;
  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: 'mipulse',
      type: alert.type,
      nodeId: alert.nodeId,
      message: stripMarkdown(alert.message),
      markdown: alert.message,
      createdAt: alert.createdAt,
      id: alert.id
    })
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`webhook ${resp.status}: ${txt.slice(0, 160)}`);
  }
  return 'webhook';
}

async function sendAppPushNotification(settings, alert) {
  if (!settings?.vpsMonitor?.notificationEnabled) return;
  if (!settings?.vpsMonitor?.notifyAppPush) return;
  const appPushKey = normalizeString(settings?.vpsMonitor?.appPushKey);
  if (!appPushKey) return;

  // PushPlus compatibility
  const resp = await fetch('https://www.pushplus.plus/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: appPushKey,
      title: `MiPulse ${alert.type.toUpperCase()} Alert`,
      content: alert.message,
      template: 'markdown'
    })
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`app_push ${resp.status}: ${txt.slice(0, 160)}`);
  }
  return 'app_push';
}

async function dispatchNotifications(settings, alert) {
  return Promise.allSettled([
    sendTelegramNotification(settings, alert),
    sendWebhookNotification(settings, alert),
    sendAppPushNotification(settings, alert)
  ]);
}

async function handleTestNotification(env) {
  const settings = await loadSettings(env);
  if (!settings?.vpsMonitor?.notificationEnabled) {
    return createError('Notification switch is disabled', 400);
  }

  const alert = {
    id: crypto.randomUUID(),
    nodeId: 'system',
    type: 'test',
    createdAt: nowIso(),
    message: buildAlertMessage('🧪 MiPulse 测试通知', [
      '*来源:* 控制台手动测试',
      `*时间:* ${new Date().toLocaleString('zh-CN')}`
    ])
  };

  const results = await dispatchNotifications(settings, alert);
  const channels = ['telegram', 'webhook', 'app_push'];
  const detail = results.map((item, index) => ({
    channel: channels[index],
    success: item.status === 'fulfilled',
    error: item.status === 'rejected' ? normalizeString(item.reason?.message || item.reason) : ''
  }));
  const successCount = detail.filter(i => i.success).length;

  if (successCount === 0) {
    return createError('All notification channels failed', 502);
  }
  return createJson({ success: true, data: { successCount, detail } });
}

// --- Module-level caches (per-worker-instance) ---

let schemaInitialized = false;
let cachedSettings = null;
let cachedSettingsAt = 0;
const SETTINGS_CACHE_TTL_MS = 30_000; // 30s cache
let lastHeartbeatCheckAt = 0;
const HEARTBEAT_CHECK_INTERVAL_MS = 60_000; // 1min
let lastPruneAt = 0;
const PRUNE_INTERVAL_MS = 300_000; // 5min

// Public snapshot cache (unauthenticated endpoint, high traffic)
let cachedPublicSnapshot = null;
let cachedPublicSnapshotAt = 0;
const PUBLIC_SNAPSHOT_TTL_MS = 30_000; // 30s cache

// Global targets cache (rarely changes)
let cachedGlobalTargets = null;
let cachedGlobalTargetsAt = 0;
const GLOBAL_TARGETS_TTL_MS = 60_000; // 60s cache

// KV cache constants
const KV_SETTINGS_KEY = 'mipulse:settings:main';
const KV_NODE_SECRET_PREFIX = 'mipulse:node:secret:';
const KV_ALERT_COOLDOWN_PREFIX = 'mipulse:alert:cooldown:';
const KV_SETTINGS_TTL_SECONDS = 300; // 5 minutes in KV
const KV_PUBLIC_SNAPSHOT_KEY = 'mipulse:public:snapshot';
const KV_PUBLIC_SNAPSHOT_TTL = 60; // 60 seconds
const NODE_SECRET_CACHE = new Map(); // Memory cache for node secrets (per-worker instance)

function shouldRefreshSettings() {
  return !cachedSettings || (Date.now() - cachedSettingsAt) > SETTINGS_CACHE_TTL_MS;
}

function shouldRunHeartbeatCheck() {
  return (Date.now() - lastHeartbeatCheckAt) > HEARTBEAT_CHECK_INTERVAL_MS;
}

function shouldRunPrune() {
  return (Date.now() - lastPruneAt) > PRUNE_INTERVAL_MS;
}

function shouldRefreshPublicSnapshot() {
  return !cachedPublicSnapshot || (Date.now() - cachedPublicSnapshotAt) > PUBLIC_SNAPSHOT_TTL_MS;
}

function shouldRefreshGlobalTargets() {
  return !cachedGlobalTargets || (Date.now() - cachedGlobalTargetsAt) > GLOBAL_TARGETS_TTL_MS;
}

function invalidateGlobalTargetsCache() {
  cachedGlobalTargets = null;
  cachedGlobalTargetsAt = 0;
}

function invalidatePublicSnapshotCache() {
  cachedPublicSnapshot = null;
  cachedPublicSnapshotAt = 0;
}

// --- Settings ---

const DEFAULT_SETTINGS = {
  vpsMonitor: {
    requireSecret: true,
    requireSignature: false,
    signatureClockSkewMinutes: 5,
    offlineThresholdMinutes: 10,
    cpuWarnPercent: 90,
    memWarnPercent: 90,
    diskWarnPercent: 90,
    overloadConfirmCount: 2,
    alertCooldownMinutes: 15,
    networkSampleIntervalMinutes: 5,
    reportIntervalMinutes: 1,
    reportStoreIntervalMinutes: 1,
    networkTargetsLimit: 3,
    publicThemePreset: 'default',
    publicThemeTitle: 'VPS 探针公开视图',
    publicThemeSubtitle: '对外展示节点健康、资源负载与在线率。所有关键指标以清晰、可信的方式汇总呈现。',
    publicThemeLogo: '',
    publicThemeBackgroundImage: '',
    publicThemeShowStats: true,
    publicThemeShowAnomalies: true,
    publicThemeShowFeatured: true,
    publicThemeShowDetailTable: true,
    publicThemeFooterText: '由 MiPulse VPS 监控引擎提供实时数据驱动',
    publicThemeSectionOrder: ['anomalies', 'nodes', 'featured', 'details'],
    publicThemeCustomCss: '',
    alertsEnabled: true,
    notifyOffline: true,
    notifyRecovery: true,
    notifyOverload: true,
    notificationEnabled: false,
    notifyTelegram: false,
    telegramBotToken: '',
    telegramChatId: '',
    notifyWebhook: false,
    webhookUrl: '',
    notifyAppPush: false,
    appPushKey: '',
    reportRetentionDays: 30,
    cooldownIgnoreRecovery: true,
    networkMonitorEnabled: true
  }
};

const SETTINGS_KEY = 'worker_settings_v1';

function isMissingSettingsTableError(error) {
  const message = normalizeString(error?.message || error);
  return message.includes('no such table: settings');
}

async function ensureCoreSchema(env) {
  if (schemaInitialized || !env?.MIPULSE_DB) return;
  const statements = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS vps_nodes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tag TEXT,
      group_tag TEXT,
      region TEXT,
      country_code TEXT,
      description TEXT,
      secret TEXT NOT NULL,
      status TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      use_global_targets INTEGER DEFAULT 0,
      network_monitor_enabled INTEGER DEFAULT 1,
      total_rx INTEGER DEFAULT 0,
      total_tx INTEGER DEFAULT 0,
      traffic_limit_gb INTEGER DEFAULT 0,
      last_seen_at DATETIME,
      last_report_json TEXT,
      overload_state_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS vps_reports (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      reported_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      data TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS vps_alerts (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS vps_network_targets (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      type TEXT NOT NULL,
      target TEXT NOT NULL,
      name TEXT,
      scheme TEXT,
      port INTEGER,
      path TEXT,
      enabled INTEGER DEFAULT 1,
      force_check_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS vps_network_samples (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL,
      reported_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      data TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    'CREATE INDEX IF NOT EXISTS idx_vps_nodes_updated_at ON vps_nodes(updated_at)',
    'CREATE INDEX IF NOT EXISTS idx_vps_reports_node_time ON vps_reports(node_id, reported_at)',
    'CREATE INDEX IF NOT EXISTS idx_vps_alerts_node_time ON vps_alerts(node_id, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_vps_network_targets_node ON vps_network_targets(node_id, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_vps_network_samples_node_time ON vps_network_samples(node_id, reported_at)',
    'CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at)'
  ];

  for (const sql of statements) {
    await env.MIPULSE_DB.prepare(sql).run();
  }
  schemaInitialized = true;
}

async function ensureSettingsTable(env) {
  if (!env?.MIPULSE_DB) return;
  await env.MIPULSE_DB.prepare(
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();
  await env.MIPULSE_DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at)'
  ).run();
}

async function loadSettings(env) {
  // 1. 检查内存缓存
  if (!shouldRefreshSettings()) return resolveSettings(cachedSettings);
  if (!env?.MIPULSE_DB) return resolveSettings();
  
  // 2. 尝试从 KV 获取设置（可选，需要 MIPULSE_KV 绑定）
  if (env?.MIPULSE_KV) {
    try {
      const kvValue = await env.MIPULSE_KV.get(KV_SETTINGS_KEY);
      if (kvValue) {
        const parsed = JSON.parse(kvValue);
        cachedSettings = parsed;
        cachedSettingsAt = Date.now();
        return resolveSettings(parsed);
      }
    } catch (error) {
      // KV 读取失败，继续使用 D1
      console.error('KV settings read failed, falling back to D1:', error?.message);
    }
  }

  // 3. 从 D1 读取设置
  let row;
  try {
    row = await env.MIPULSE_DB.prepare('SELECT value FROM settings WHERE key = ?').bind(SETTINGS_KEY).first();
  } catch (error) {
    if (!isMissingSettingsTableError(error)) throw error;
    await ensureSettingsTable(env);
    return resolveSettings();
  }
  if (!row?.value) return resolveSettings();
  let parsed = {};
  try {
    parsed = JSON.parse(row.value);
  } catch {
    parsed = {};
  }
  cachedSettings = parsed;
  cachedSettingsAt = Date.now();
  
  // 4. 回填 KV 缓存（后续读取更快）
  if (env?.MIPULSE_KV) {
    try {
      await env.MIPULSE_KV.put(KV_SETTINGS_KEY, JSON.stringify(parsed), { 
        expirationTtl: KV_SETTINGS_TTL_SECONDS 
      });
    } catch (error) {
      // KV 写入失败不影响主流程
      console.error('KV settings write failed:', error?.message);
    }
  }
  
  return resolveSettings(parsed);
}

async function saveSettings(env, settings) {
  if (!env?.MIPULSE_DB) return;
  const now = nowIso();
  try {
    await env.MIPULSE_DB.prepare(
      'INSERT INTO settings (key, value, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
    ).bind(SETTINGS_KEY, JSON.stringify(settings), now, now).run();
  } catch (error) {
    if (!isMissingSettingsTableError(error)) throw error;
    await ensureSettingsTable(env);
    await env.MIPULSE_DB.prepare(
      'INSERT INTO settings (key, value, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
    ).bind(SETTINGS_KEY, JSON.stringify(settings), now, now).run();
  }
  
  // 更新缓存
  cachedSettings = settings;
  cachedSettingsAt = Date.now();
  
  // 更新 KV 缓存
  if (env?.MIPULSE_KV) {
    try {
      await env.MIPULSE_KV.put(KV_SETTINGS_KEY, JSON.stringify(settings), { 
        expirationTtl: KV_SETTINGS_TTL_SECONDS 
      });
    } catch (error) {
      console.error('KV settings update failed:', error?.message);
    }
  }
}

// --- KV Cache Helpers ---

/**
 * 快速获取node的secret（用于报告验证）
 * 优先使用KV缓存，避免D1查询
 */
async function getNodeSecretFast(env, nodeId) {
  // 1. 检查内存缓存
  if (NODE_SECRET_CACHE.has(nodeId)) {
    return NODE_SECRET_CACHE.get(nodeId);
  }
  
  // 2. 尝试从KV获取
  if (env?.MIPULSE_KV) {
    try {
      const kvKey = KV_NODE_SECRET_PREFIX + nodeId;
      const secret = await env.MIPULSE_KV.get(kvKey);
      if (secret) {
        NODE_SECRET_CACHE.set(nodeId, secret);
        return secret;
      }
    } catch (error) {
      // KV读取失败，继续用D1
      console.error('KV node secret read failed:', error?.message);
    }
  }
  
  return null; // 需要从D1查询
}

/**
 * 缓存node的secret到KV和内存
 */
async function cacheNodeSecret(env, nodeId, secret) {
  NODE_SECRET_CACHE.set(nodeId, secret);
  
  if (env?.MIPULSE_KV) {
    try {
      const kvKey = KV_NODE_SECRET_PREFIX + nodeId;
      await env.MIPULSE_KV.put(kvKey, secret, { 
        expirationTtl: KV_SETTINGS_TTL_SECONDS 
      });
    } catch (error) {
      console.error('KV node secret write failed:', error?.message);
    }
  }
}

/**
 * 清除node的secret缓存
 */
function invalidateNodeSecretCache(nodeId) {
  NODE_SECRET_CACHE.delete(nodeId);
}

/**
 * 获取alert冷却时间戳（从KV）
 * key格式: mipulse:alert:cooldown:{nodeId}:{alertType}
 */
async function getAlertCooldownTimestamp(env, nodeId, alertType) {
  if (!env?.MIPULSE_KV) return null;
  try {
    const key = KV_ALERT_COOLDOWN_PREFIX + nodeId + ':' + alertType;
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
    const key = KV_ALERT_COOLDOWN_PREFIX + nodeId + ':' + alertType;
    const ttlSeconds = Math.ceil((cooldownMs + 30000) / 1000); // +30s buffer
    await env.MIPULSE_KV.put(key, String(timestamp), { 
      expirationTtl: ttlSeconds 
    });
  } catch (error) {
    console.error('KV alert cooldown write failed:', error?.message);
  }
}


// --- Data Access ---

function mapNodeRow(row) {
  return {
    id: row.id,
    name: row.name,
    tag: row.tag,
    groupTag: row.group_tag,
    region: row.region,
    countryCode: row.country_code,
    description: row.description,
    secret: row.secret,
    status: row.status,
    enabled: row.enabled === 1,
    useGlobalTargets: row.use_global_targets === 1,
    networkMonitorEnabled: row.network_monitor_enabled !== 0,
    totalRx: Number(row.total_rx || 0),
    totalTx: Number(row.total_tx || 0),
    trafficLimitGb: Number(row.traffic_limit_gb || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
    lastReport: row.last_report_json ? JSON.parse(row.last_report_json) : null,
    overloadState: row.overload_state_json ? JSON.parse(row.overload_state_json) : null
  };
}

async function fetchNodes(db) {
  const result = await db.prepare(
    'SELECT id, name, tag, group_tag, region, country_code, description, status, enabled, use_global_targets, network_monitor_enabled, total_rx, total_tx, traffic_limit_gb, last_seen_at, updated_at, last_report_json, overload_state_json, created_at FROM vps_nodes ORDER BY created_at DESC'
  ).all();
  return (result.results || []).map(mapNodeRow);
}

async function fetchNode(db, nodeId) {
  const row = await db.prepare('SELECT * FROM vps_nodes WHERE id = ?').bind(nodeId).first();
  return row ? mapNodeRow(row) : null;
}

async function insertNode(db, node) {
  await db.prepare(
    `INSERT INTO vps_nodes
     (id, name, tag, group_tag, region, country_code, description, secret, status, enabled, use_global_targets, network_monitor_enabled, total_rx, total_tx, traffic_limit_gb, created_at, updated_at, last_seen_at, last_report_json, overload_state_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    node.id,
    node.name,
    node.tag,
    node.groupTag,
    node.region,
    node.countryCode,
    node.description,
    node.secret,
    node.status,
    node.enabled ? 1 : 0,
    node.useGlobalTargets ? 1 : 0,
    node.networkMonitorEnabled !== false ? 1 : 0,
    node.totalRx || 0,
    node.totalTx || 0,
    node.trafficLimitGb || 0,
    node.createdAt,
    node.updatedAt,
    node.lastSeenAt,
    node.lastReport ? JSON.stringify(node.lastReport) : null,
    node.overloadState ? JSON.stringify(node.overloadState) : null
  ).run();
}

async function updateNode(db, node) {
  await db.prepare(
    `UPDATE vps_nodes
     SET name = ?, tag = ?, group_tag = ?, region = ?, country_code = ?, description = ?, secret = ?, status = ?, enabled = ?,
         use_global_targets = ?, network_monitor_enabled = ?, total_rx = ?, total_tx = ?, traffic_limit_gb = ?, updated_at = ?, last_seen_at = ?, last_report_json = ?, overload_state_json = ?
     WHERE id = ?`
  ).bind(
    node.name,
    node.tag,
    node.groupTag,
    node.region,
    node.countryCode,
    node.description,
    node.secret,
    node.status,
    node.enabled ? 1 : 0,
    node.useGlobalTargets ? 1 : 0,
    (node.networkMonitorEnabled === true || node.networkMonitorEnabled === 1) ? 1 : 0,
    node.totalRx || 0,
    node.totalTx || 0,
    node.trafficLimitGb || 0,
    node.updatedAt,
    node.lastSeenAt,
    node.lastReport ? JSON.stringify(node.lastReport) : null,
    node.overloadState ? JSON.stringify(node.overloadState) : null,
    node.id
  ).run();
}

async function updateNodeMetrics(db, node) {
  await db.prepare(
    `UPDATE vps_nodes
     SET status = ?, total_rx = ?, total_tx = ?, updated_at = ?, last_seen_at = ?, last_report_json = ?, overload_state_json = ?
     WHERE id = ?`
  ).bind(
    node.status,
    node.totalRx || 0,
    node.totalTx || 0,
    node.updatedAt,
    node.lastSeenAt,
    node.lastReport ? JSON.stringify(node.lastReport) : null,
    node.overloadState ? JSON.stringify(node.overloadState) : null,
    node.id
  ).run();
}

async function deleteNode(db, nodeId) {
  invalidatePublicSnapshotCache();
  await db.prepare('DELETE FROM vps_nodes WHERE id = ?').bind(nodeId).run();
  await db.prepare('DELETE FROM vps_reports WHERE node_id = ?').bind(nodeId).run();
  await db.prepare('DELETE FROM vps_alerts WHERE node_id = ?').bind(nodeId).run();
}

async function insertReport(db, report) {
  await db.prepare(
    'INSERT INTO vps_reports (id, node_id, reported_at, created_at, data) VALUES (?, ?, ?, ?, ?)'
  ).bind(report.id, report.nodeId, report.reportedAt, report.createdAt, JSON.stringify(report)).run();
}

async function pruneReports(db, settings) {
  const cutoff = new Date(getReportRetentionCutoff(settings)).toISOString();
  await db.prepare('DELETE FROM vps_reports WHERE reported_at < ?').bind(cutoff).run();
  await db.prepare(
    `DELETE FROM vps_reports
     WHERE id NOT IN (
       SELECT id FROM vps_reports ORDER BY reported_at DESC LIMIT ${REPORTS_MAX_KEEP}
     )`
  ).run();
}

async function fetchReportsForNode(db, nodeId, settings) {
  const cutoff = new Date(getReportRetentionCutoff(settings)).toISOString();
  const result = await db.prepare(
    'SELECT data FROM vps_reports WHERE node_id = ? AND reported_at >= ? ORDER BY reported_at ASC LIMIT ?'
  ).bind(nodeId, cutoff, REPORTS_MAX_KEEP).all();
  return (result.results || []).map(row => JSON.parse(row.data));
}

async function fetchNetworkSamples(db, nodeId, settings) {
  const cutoff = new Date(getReportRetentionCutoff(settings)).toISOString();
  const result = await db.prepare(
    'SELECT data FROM vps_network_samples WHERE node_id = ? AND reported_at >= ? ORDER BY reported_at ASC LIMIT ?'
  ).bind(nodeId, cutoff, REPORTS_MAX_KEEP).all();
  return (result.results || []).map(row => JSON.parse(row.data));
}

async function insertNetworkSample(db, sample) {
  await db.prepare(
    'INSERT INTO vps_network_samples (id, node_id, reported_at, created_at, data) VALUES (?, ?, ?, ?, ?)'
  ).bind(sample.id, sample.nodeId, sample.reportedAt, sample.createdAt, JSON.stringify(sample)).run();
}

async function pruneNetworkSamples(db, settings) {
  const cutoff = new Date(getReportRetentionCutoff(settings)).toISOString();
  await db.prepare('DELETE FROM vps_network_samples WHERE reported_at < ?').bind(cutoff).run();
  await db.prepare(
    `DELETE FROM vps_network_samples
     WHERE id NOT IN (
       SELECT id FROM vps_network_samples ORDER BY reported_at DESC LIMIT ${REPORTS_MAX_KEEP}
     )`
  ).run();
}

async function fetchNetworkTargets(db, nodeId) {
  const result = await db.prepare('SELECT * FROM vps_network_targets WHERE node_id = ? ORDER BY created_at DESC').bind(nodeId).all();
  return (result.results || []).map(row => ({
    id: row.id,
    nodeId: row.node_id,
    type: row.type,
    target: row.target,
    name: row.name || '',
    scheme: row.scheme || 'https',
    port: row.port,
    path: row.path,
    forceCheckAt: row.force_check_at,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
}

async function fetchGlobalNetworkTargets(db) {
  if (!shouldRefreshGlobalTargets() && cachedGlobalTargets) return cachedGlobalTargets;
  const result = await db.prepare('SELECT * FROM vps_network_targets WHERE node_id = ? ORDER BY created_at DESC').bind('global').all();
  const targets = (result.results || []).map(row => ({
    id: row.id,
    nodeId: row.node_id,
    type: row.type,
    target: row.target,
    name: row.name || '',
    scheme: row.scheme || 'https',
    port: row.port,
    path: row.path,
    forceCheckAt: row.force_check_at,
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
  cachedGlobalTargets = targets;
  cachedGlobalTargetsAt = Date.now();
  return targets;
}

async function insertNetworkTarget(db, nodeId, payload) {
  invalidateGlobalTargetsCache();
  invalidatePublicSnapshotCache();
  const target = {
    id: crypto.randomUUID(),
    nodeId,
    type: normalizeString(payload.type).toLowerCase(),
    target: normalizeString(payload.target),
    name: normalizeString(payload.name || ''),
    scheme: normalizeString(payload.scheme || 'https'),
    port: payload.port ? Number(payload.port) : null,
    path: normalizeString(payload.path),
    enabled: payload.enabled !== false,
    forceCheckAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  await db.prepare(
    `INSERT INTO vps_network_targets
     (id, node_id, type, target, name, scheme, port, path, enabled, force_check_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    target.id,
    target.nodeId,
    target.type,
    target.target,
    target.name,
    target.scheme,
    target.port,
    target.path,
    target.enabled ? 1 : 0,
    null,
    target.createdAt,
    target.updatedAt
  ).run();
  return target;
}

async function updateNetworkTarget(db, targetId, payload) {
  const existing = await db.prepare('SELECT * FROM vps_network_targets WHERE id = ?').bind(targetId).first();
  if (!existing) return null;
  const updated = {
    id: existing.id,
    nodeId: existing.node_id,
    type: payload.type !== undefined ? normalizeString(payload.type).toLowerCase() : existing.type,
    target: payload.target !== undefined ? normalizeString(payload.target) : existing.target,
    name: payload.name !== undefined ? normalizeString(payload.name) : (existing.name || ''),
    scheme: payload.scheme !== undefined ? normalizeString(payload.scheme || 'https') : existing.scheme || 'https',
    port: payload.port !== undefined ? Number(payload.port) : existing.port,
    path: payload.path !== undefined ? normalizeString(payload.path) : existing.path,
    enabled: typeof payload.enabled === 'boolean' ? payload.enabled : existing.enabled === 1,
    forceCheckAt: payload.forceCheckAt !== undefined ? payload.forceCheckAt : existing.force_check_at,
    updatedAt: nowIso()
  };
  await db.prepare(
    `UPDATE vps_network_targets
     SET type = ?, target = ?, name = ?, scheme = ?, port = ?, path = ?, enabled = ?, force_check_at = ?, updated_at = ?
     WHERE id = ?`
  ).bind(
    updated.type,
    updated.target,
    updated.name,
    updated.scheme,
    updated.port,
    updated.path,
    updated.enabled ? 1 : 0,
    updated.forceCheckAt,
    updated.updatedAt,
    updated.id
  ).run();
  return updated;
}

async function deleteNetworkTarget(db, targetId) {
  await db.prepare('DELETE FROM vps_network_targets WHERE id = ?').bind(targetId).run();
}

function validateNetworkTarget(payload) {
  const type = normalizeString(payload.type).toLowerCase();
  const target = normalizeString(payload.target);
  if (!['icmp', 'tcp', 'http'].includes(type)) {
    return '类型仅支持 icmp/tcp/http';
  }
  if (!target) {
    return '目标不能为空';
  }
  if (type === 'tcp') {
    const port = Number(payload.port);
    if (!Number.isFinite(port) || port <= 0 || port > 65535) {
      return 'TCP 端口无效';
    }
  }
  if (type === 'http') {
    const path = normalizeString(payload.path || '/');
    if (!path.startsWith('/')) {
      return 'HTTP 路径必须以 / 开头';
    }
    const scheme = normalizeString(payload.scheme || 'https');
    if (!['http', 'https'].includes(scheme)) {
      return 'HTTP 协议仅支持 http/https';
    }
  }
  return null;
}

async function checkAllNodesHeartbeat(db, settings) {
  const threshold = clampNumber(settings?.vpsMonitor?.offlineThresholdMinutes, 1, 1440, 10);
  const cutoff = new Date(Date.now() - threshold * 60 * 1000).toISOString();

  const staleNodesResult = await db.prepare(
    "SELECT * FROM vps_nodes WHERE status = 'online' AND (last_seen_at < ? OR last_seen_at IS NULL) AND enabled = 1"
  ).bind(cutoff).all();

  const staleNodes = staleNodesResult?.results || [];
  if (!staleNodes.length) return;

  for (const row of staleNodes) {
    const node = mapNodeRow(row);
    node.status = 'offline';
    node.updatedAt = nowIso();
    await updateNode(db, node);
  }
}

async function updateNodeStatus(db, settings, node, report, env = null) {
  const threshold = clampNumber(settings?.vpsMonitor?.offlineThresholdMinutes, 1, 1440, 10);
  const wasOnline = node.status === 'online';
  node.lastSeenAt = normalizeString(report.reportedAt || report.createdAt || nowIso()) || nowIso();
  const nowOnline = isNodeOnline(node.lastSeenAt, threshold);
  node.status = nowOnline ? 'online' : 'offline';

  const pendingAlerts = [];

  if (wasOnline && !nowOnline && settings?.vpsMonitor?.notifyOffline !== false) {
    pendingAlerts.push({
      id: crypto.randomUUID(),
      nodeId: node.id,
      type: 'offline',
      createdAt: nowIso(),
      message: buildAlertMessage('❌ VPS 离线', [
        `*节点:* ${node.name || node.id}`,
        node.tag ? `*标签:* ${node.tag}` : '',
        node.region ? `*地区:* ${node.region}` : '',
        `*时间:* ${new Date().toLocaleString('zh-CN')}`
      ])
    });
  }

  if (!wasOnline && nowOnline && settings?.vpsMonitor?.notifyRecovery !== false) {
    pendingAlerts.push({
      id: crypto.randomUUID(),
      nodeId: node.id,
      type: 'recovery',
      createdAt: nowIso(),
      message: buildAlertMessage('✅ VPS 恢复在线', [
        `*节点:* ${node.name || node.id}`,
        node.tag ? `*标签:* ${node.tag}` : '',
        node.region ? `*地区:* ${node.region}` : '',
        `*时间:* ${new Date().toLocaleString('zh-CN')}`
      ])
    });
  }

  const overloadInfo = computeOverload(report, settings);
  const overloadState = computeOverloadState(node.overloadState, overloadInfo);
  node.overloadState = overloadState;
  if (shouldTriggerOverload(settings, overloadState, overloadInfo) && settings?.vpsMonitor?.notifyOverload !== false) {
    const flags = [];
    if (overloadInfo.overload.cpu) flags.push(`CPU ${overloadInfo.values.cpu}%`);
    if (overloadInfo.overload.mem) flags.push(`内存 ${overloadInfo.values.mem}%`);
    if (overloadInfo.overload.disk) flags.push(`磁盘 ${overloadInfo.values.disk}%`);

    pendingAlerts.push({
      id: crypto.randomUUID(),
      nodeId: node.id,
      type: 'overload',
      createdAt: nowIso(),
      message: buildAlertMessage('⚠️ VPS 负载告警', [
        `*节点:* ${node.name || node.id}`,
        `*指标:* ${flags.join(' / ')}`,
        `*阈值:* CPU ${overloadInfo.thresholds.cpuThreshold}% / 内存 ${overloadInfo.thresholds.memThreshold}% / 磁盘 ${overloadInfo.thresholds.diskThreshold}%`,
        `*时间:* ${new Date().toLocaleString('zh-CN')}`
      ])
    });
  }

  if (pendingAlerts.length) {
    await pushAlertsBatch(db, settings, pendingAlerts, env);
  }
}

// --- Script Generation ---

function buildInstallScript(reportUrl, node, settings) {
  return [
    '#!/usr/bin/env bash',
    '',
    'set -euo pipefail',
    '',
    `REPORT_URL="${reportUrl}"`,
    `NODE_ID="${node.id}"`,
    `NODE_SECRET="${node.secret}"`,
    `CONFIG_URL="${reportUrl.replace('/api/vps/report', '/api/vps/config')}?nodeId=${node.id}&secret=${node.secret}&format=env"`,
    '',
    "cat > /usr/local/bin/mipulse-vps-probe.sh <<'EOF'",
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    'for cmd in curl awk free df top hostname uname ping timeout; do',
    '  if ! command -v "$cmd" >/dev/null 2>&1; then',
    '    echo "[mipulse-probe] missing command: $cmd" >&2',
    '    echo "[mipulse-probe] please install it and rerun the script." >&2',
    '    exit 1',
    '  fi',
    'done',
    settings?.vpsMonitor?.requireSignature === true
      ? 'if ! command -v openssl >/dev/null 2>&1; then echo "[mipulse-probe] openssl is required when signature is enabled" >&2; exit 1; fi'
      : 'if ! command -v openssl >/dev/null 2>&1; then echo "[mipulse-probe] openssl missing, signature disabled" >&2; fi',
    '',
    'HAS_SOCKETS=1',
    'if [ ! -e /dev/tcp/127.0.0.1/80 ] 2>/dev/null; then',
    '  HAS_SOCKETS=0',
    'fi',
    '',
    `REPORT_URL="${reportUrl}"`,
    `NODE_ID="${node.id}"`,
    `NODE_SECRET="${node.secret}"`,
    `CONFIG_URL="${reportUrl.replace('/api/vps/report', '/api/vps/config')}?nodeId=${node.id}&secret=${node.secret}&format=env"`,
    '',
    'HOSTNAME="$(hostname)"',
    'OS="$(. /etc/os-release && echo "$PRETTY_NAME" || uname -s)"',
    'ARCH="$(uname -m)"',
    'KERNEL="$(uname -r)"',
    "UPTIME_SEC=\"$(awk '{print int($1)}' /proc/uptime)\"",
    '',
    'cpu_usage() {',
    '  if command -v mpstat >/dev/null 2>&1; then',
    '    mpstat 1 2 | awk "/Average/ {printf \"%.0f\", 100-$NF}"',
    '    return',
    '  fi',
    '  local idle1 total1 idle2 total2',
    '  read -r idle1 total1 <<<"$(awk \'/^cpu /{idle=$5; total=0; for(i=2;i<=11;i++) total+=$i; print idle, total}\' /proc/stat)"',
    '  sleep 2',
    '  read -r idle2 total2 <<<"$(awk \'/^cpu /{idle=$5; total=0; for(i=2;i<=11;i++) total+=$i; print idle, total}\' /proc/stat)"',
    '  local total_diff=$((total2-total1))',
    '  local idle_diff=$((idle2-idle1))',
    '  if [ "$total_diff" -le 0 ]; then',
    '    echo 0',
    '  else',
    '    awk -v t="$total_diff" -v i="$idle_diff" \'BEGIN{printf "%.0f", (100*(t-i))/t}\'',
    '  fi',
    '}',
    'PROBE_VERSION="1.0.0"',
    'LAST_ERROR=""',
    'CPU_USAGE="$(cpu_usage)"',
    "MEM_USAGE=\"$(free | awk '/Mem/ {printf \"%.0f\", $3/$2*100}')\"",
    "DISK_USAGE=\"$(df -P / | awk 'NR==2 {gsub(/%/,\"\"); print $5}')\"",
    "LOAD1=\"$(awk '{print $1}' /proc/loadavg)\"",
    "TRAFFIC_JSON=\"$(cat /proc/net/dev | awk 'NR>2 && $1 != \"lo:\" {rx += $2; tx += $10} END {printf \"{\\\"rx\\\": %d, \\\"tx\\\": %d}\", rx, tx}')\"",
    '',
    'REPORT_INTERVAL=60',
    'REPORT_STORE_INTERVAL=60',
    'NETWORK_INTERVAL=300',
    'SIGN_REQUIRED=0',
    'TARGETS=()',
    'if CONFIG_ENV=$(curl -fsSL "$CONFIG_URL" 2>/dev/null); then',
    '  while IFS= read -r line; do',
    '    case "$line" in',
    '      REPORT_INTERVAL=*) REPORT_INTERVAL=$((${line#*=} * 60)) ;;',
    '      REPORT_STORE_INTERVAL=*) REPORT_STORE_INTERVAL=$((${line#*=} * 60)) ;;',
    '      NETWORK_INTERVAL=*) NETWORK_INTERVAL=$((${line#*=} * 60)) ;;',
    '      SIGN_REQUIRED=*) SIGN_REQUIRED=${line#*=} ;;',
    '      TARGET=*) TARGETS+=("${line#*=}") ;;',
    '    esac',
    '  done <<< "$CONFIG_ENV"',
    'fi',
    '',
    'NETWORK_STATE="/var/tmp/mipulse-vps-network.ts"',
    'REPORT_STATE="/var/tmp/mipulse-vps-report.ts"',
    'REPORT_STORE_STATE="/var/tmp/mipulse-vps-report-store.ts"',
    'NETWORK_JSON="null"',
    'now_ts=$(date +%s)',
    'last_ts=0',
    'if [ -f "$NETWORK_STATE" ]; then last_ts=$(cat "$NETWORK_STATE" || echo 0); fi',
    'if [ $((now_ts-last_ts)) -ge "$NETWORK_INTERVAL" ]; then',
    '  checks=()',
    '  for item in "${TARGETS[@]}"; do',
    '    IFS="|" read -r ttype ttarget tscheme tport tpath tenabled tforce tname <<< "$item"',
    '    if [ "${tenabled:-1}" = "0" ]; then continue; fi',
    '    checked_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)',
    '    if [ "$ttype" = "icmp" ]; then',
    '      ping_out=$(ping -c 3 -w 4 "$ttarget" 2>/dev/null || true)',
    '      loss=$(echo "$ping_out" | awk -F", " \'/packet loss/ {print $3}\' | awk \'{gsub(/%/," "); print $1}\')',
    '      avg=$(echo "$ping_out" | awk -F"/" \'/rtt/ {print $5}\')',
    '      if [ -z "$avg" ]; then status="down"; avg=null; else status="up"; fi',
    '      checks+=("{\\\"type\\\":\\\"icmp\\\",\\\"target\\\":\\\"$ttarget\\\",\\\"name\\\":\\\"$tname\\\",\\\"status\\\":\\\"$status\\\",\\\"latencyMs\\\":${avg:-null},\\\"lossPercent\\\":${loss:-null},\\\"checkedAt\\\":\\\"$checked_at\\\"}")',
    '    elif [ "$ttype" = "tcp" ]; then',
    '      start=$(date +%s%3N)',
    '      if [ "$HAS_SOCKETS" = "1" ] && timeout 3 bash -c "cat < /dev/null > /dev/tcp/$ttarget/$tport" 2>/dev/null; then',
    '        end=$(date +%s%3N); latency=$((end-start)); status="up"',
    '      else',
    '        latency=null; status="down"',
    '      fi',
    '      checks+=("{\\\"type\\\":\\\"tcp\\\",\\\"target\\\":\\\"$ttarget\\\",\\\"name\\\":\\\"$tname\\\",\\\"port\\\":$tport,\\\"status\\\":\\\"$status\\\",\\\"latencyMs\\\":${latency},\\\"checkedAt\\\":\\\"$checked_at\\\"}")',
    '    elif [ "$ttype" = "http" ]; then',
    '      scheme="${tscheme:-https}"',
    '      url="$scheme://$ttarget"',
    '      if [ -n "$tport" ]; then url="$url:$tport"; fi',
    '      if [ -n "$tpath" ]; then url="$url$tpath"; fi',
    '      result=$(curl -o /dev/null -s -w "%{time_total} %{http_code} %{time_namelookup} %{time_connect} %{time_appconnect}" --max-time 5 "$url" || true)',
    '      time_total=$(echo "$result" | awk \'{print $1}\')',
    '      http_code=$(echo "$result" | awk \'{print $2}\')',
    '      t_dns=$(echo "$result" | awk \'{print $3}\')',
    '      t_connect=$(echo "$result" | awk \'{print $4}\')',
    '      t_tls=$(echo "$result" | awk \'{print $5}\')',
    '      if [ -n "$time_total" ] && [ "$http_code" != "000" ]; then',
    '        latency=$(awk -v t="$time_total" \'BEGIN{printf "%.0f", t*1000}\')',
    '        dns=$(awk -v t="$t_dns" \'BEGIN{printf "%.0f", t*1000}\')',
    '        connect=$(awk -v t="$t_connect" \'BEGIN{printf "%.0f", t*1000}\')',
    '        tls=$(awk -v t="$t_tls" \'BEGIN{printf "%.0f", t*1000}\')',
    '        status="up"',
    '      else',
    '        latency=null; http_code="000"; dns=null; connect=null; tls=null; status="down"',
    '      fi',
    '      checks+=("{\\\"type\\\":\\\"http\\\",\\\"target\\\":\\\"$ttarget\\\",\\\"name\\\":\\\"$tname\\\",\\\"scheme\\\":\\\"${scheme}\\\",\\\"port\\\":${tport:-null},\\\"path\\\":\\\"${tpath:-/}\\\",\\\"status\\\":\\\"$status\\\",\\\"latencyMs\\\":${latency},\\\"httpCode\\\":$http_code,\\\"dnsMs\\\":${dns},\\\"connectMs\\\":${connect},\\\"tlsMs\\\":${tls},\\\"checkedAt\\\":\\\"$checked_at\\\"}")',
    '    fi',
    '  done',
    '  NETWORK_JSON="["$(IFS=,; echo "${checks[*]}")"]"',
    '  echo "$now_ts" > "$NETWORK_STATE"',
    'fi',
    '',
    'SHOULD_SEND=0',
    'if [ ! -f "$REPORT_STATE" ]; then SHOULD_SEND=1; else',
    '  last_report=$(cat "$REPORT_STATE" || echo 0)',
    '  if [ $((now_ts-last_report)) -ge "$REPORT_INTERVAL" ]; then SHOULD_SEND=1; fi',
    'fi',
    'SHOULD_STORE=0',
    'if [ ! -f "$REPORT_STORE_STATE" ]; then SHOULD_STORE=1; else',
    '  last_store=$(cat "$REPORT_STORE_STATE" || echo 0)',
    '  if [ $((now_ts-last_store)) -ge "$REPORT_STORE_INTERVAL" ]; then SHOULD_STORE=1; fi',
    'fi',
    'if [ "$SHOULD_SEND" = "1" ]; then',
    '  if [ "$SHOULD_STORE" = "1" ]; then echo "$now_ts" > "$REPORT_STORE_STATE"; fi',
    '  PAYLOAD=$(cat <<PAYLOAD_EOF',
    '{',
    '  "hostname": "${HOSTNAME}",',
    '  "os": "${OS}",',
    '  "arch": "${ARCH}",',
    '  "kernel": "${KERNEL}",',
    '  "probeVersion": "${PROBE_VERSION}",',
    '  "lastError": "${LAST_ERROR}",',
    '  "uptimeSec": ${UPTIME_SEC},',
    '  "cpu": { "usage": ${CPU_USAGE} },',
    '  "mem": { "usage": ${MEM_USAGE} },',
    '  "disk": { "usage": ${DISK_USAGE} },',
    '  "load": { "load1": ${LOAD1} },',
    '  "traffic": ${TRAFFIC_JSON},',
    '  "network": ${NETWORK_JSON}',
    '}',
    'PAYLOAD_EOF',
    ')',
    '',
    '  TS_MS=$(date +%s%3N 2>/dev/null || true)',
    '  if [ -z "$TS_MS" ]; then TS_MS=$(($(date +%s) * 1000)); fi',
    '  SIG=""',
    '  if command -v openssl >/dev/null 2>&1; then',
    '    SIG=$(printf "%s" "${NODE_ID}.${TS_MS}.${PAYLOAD}" | openssl dgst -sha256 -hmac "${NODE_SECRET}" -hex | awk \'{print $2}\')',
    '  else',
    '    if [ "$SIGN_REQUIRED" = "1" ]; then',
    '      echo "[mipulse-probe] openssl missing, cannot sign payload" >&2',
    '    else',
    '      echo "[mipulse-probe] openssl missing, signature disabled" >&2',
    '    fi',
    '  fi',
    '',
    `curl -sS -X POST "${reportUrl}" \\`,
    '  -H "Content-Type: application/json" \\',
    `  -H "x-node-id: ${node.id}" \\`,
    `  -H "x-node-secret: ${node.secret}" \\`,
    '  -H "x-node-timestamp: ${TS_MS}" \\',
    '  -H "x-node-signature: ${SIG}" \\',
    '  --data "${PAYLOAD}" >/dev/null',
    '  echo "$now_ts" > "$REPORT_STATE"',
    'fi',
    'EOF',
    '',
    'chmod +x /usr/local/bin/mipulse-vps-probe.sh',
    '',
    "cat > /etc/systemd/system/mipulse-vps-probe.service <<'EOF'",
    '[Unit]',
    'Description=MiPulse VPS Probe',
    'After=network-online.target',
    'Wants=network-online.target',
    '',
    '[Service]',
    'Type=oneshot',
    'ExecStart=/usr/local/bin/mipulse-vps-probe.sh',
    'EOF',
    '',
    "cat > /etc/systemd/system/mipulse-vps-probe.timer <<'EOF'",
    '[Unit]',
    'Description=MiPulse VPS Probe Timer',
    '',
    '[Timer]',
    'OnBootSec=2min',
    'OnUnitActiveSec=60s',
    'Unit=mipulse-vps-probe.service',
    'Persistent=true',
    '',
    '[Install]',
    'WantedBy=timers.target',
    'EOF',
    '',
    'systemctl daemon-reload',
    '',
    'systemctl enable --now mipulse-vps-probe.timer',
    '',
    'systemctl status mipulse-vps-probe.timer --no-pager'
  ].join('\n');
}

function buildUninstallScript() {
  return [
    '#!/usr/bin/env bash',
    '',
    'set -euo pipefail',
    '',
    'echo "[mipulse-probe] stopping and disabling mipulse-vps-probe.timer..."',
    'systemctl stop mipulse-vps-probe.timer || true',
    'systemctl disable mipulse-vps-probe.timer || true',
    '',
    'echo "[mipulse-probe] removing systemd configuration..."',
    'rm -f /etc/systemd/system/mipulse-vps-probe.timer',
    'rm -f /etc/systemd/system/mipulse-vps-probe.service',
    'systemctl daemon-reload',
    '',
    'echo "[mipulse-probe] removing probe script..."',
    'rm -f /usr/local/bin/mipulse-vps-probe.sh',
    '',
    'echo "[mipulse-probe] cleaning up temporary files..."',
    'rm -f /var/tmp/mipulse-vps-network.ts /var/tmp/mipulse-vps-report.ts /var/tmp/mipulse-vps-report-store.ts',
    '',
    'echo "[mipulse-probe] uninstallation complete."'
  ].join('\n');
}

function buildPublicGuide(env, request, node) {
  const baseUrl = new URL(request.url).origin;
  const reportUrl = `${baseUrl}/api/vps/report`;
  const installScript = buildInstallScript(reportUrl, node);
  const installCommand = `curl -fsSL "${baseUrl}/api/vps/install?nodeId=${node.id}&secret=${node.secret}" | bash`;
  const uninstallScript = buildUninstallScript(node);
  const uninstallCommand = `curl -fsSL "${baseUrl}/api/vps/uninstall?nodeId=${node.id}&secret=${node.secret}" | bash`;
  return {
    reportUrl,
    nodeId: node.id,
    nodeSecret: node.secret,
    headers: {
      'Content-Type': 'application/json',
      'x-node-id': node.id,
      'x-node-secret': node.secret
    },
    installScript,
    installCommand,
    uninstallScript,
    uninstallCommand
  };
}

// --- Main Request Handler ---

export async function handleVpsRequest(path, request, env, auth) {
  const db = env.MIPULSE_DB;
  if (!db) return createError('D1 Binding (MIPULSE_DB) not found', 500);
  if (!schemaInitialized) await ensureCoreSchema(env);

  const url = new URL(request.url);
  const parts = path.split('/');
  const method = request.method;

  // Public report endpoint
  if (parts[1] === 'report' && method === 'POST') {
    return handleReport(request, db, env);
  }

  // Public scripts/config
  if (parts[1] === 'install' && method === 'GET') {
    return handleInstallScript(request, db, env);
  }
  if (parts[1] === 'uninstall' && method === 'GET') {
    return handleUninstallScript(request, db, env);
  }
  if (parts[1] === 'config' && method === 'GET') {
    return handleNodeConfig(request, db, env);
  }

  if (parts[1] === 'public' && method === 'GET') {
    if (parts[2] === 'nodes' && parts[3]) {
      return handlePublicNodeDetail(request, db, env);
    }
    return handlePublicSnapshot(request, db, env);
  }

  // Settings (public GET, auth POST)
  if (parts[1] === 'settings' && method === 'GET') {
    return handleGetSettings(env);
  }

  if (!auth) return createError('Unauthorized', 401);

  if (parts[1] === 'settings' && method === 'POST') {
    return handleSaveSettings(request, env);
  }

  if (parts[1] === 'notifications' && parts[2] === 'test' && method === 'POST') {
    return handleTestNotification(env);
  }

  if (parts[1] === 'nodes') {
    if (method === 'GET') {
      if (parts[2]) return handleGetNodeDetail(parts[2], db, env, request);
      return handleListNodes(db, env);
    }
    if (method === 'POST') return handleCreateNode(request, db, env);
    if (method === 'PUT' && parts[2]) return handleUpdateNode(parts[2], request, db, env);
    if (method === 'DELETE' && parts[2]) return handleDeleteNode(parts[2], db);
  }

  if (parts[1] === 'alerts') {
    if (method === 'GET') return handleListAlerts(db);
    if (method === 'DELETE') return handleClearAlerts(db);
  }

  if (parts[1] === 'targets') {
    if (parts[2] === 'check' && method === 'POST') return handleNetworkCheck(request, db, env);
    if (method === 'GET') return handleListTargets(url.searchParams.get('nodeId'), db);
    if (method === 'POST') return handleCreateTarget(request, db, env);
    if (method === 'PUT' && parts[2]) return handleUpdateTarget(parts[2], request, db);
    if (method === 'DELETE' && parts[2]) return handleDeleteTarget(parts[2], db);
  }

  if (parts[1] === 'network_targets') {
    return handleNetworkTargets(request, db, env);
  }

  if (parts[1] === 'network_check') {
    return handleNetworkCheck(request, db, env);
  }

  return createError('Not Found', 404);
}

// --- Implementation Logic ---

async function handleReport(request, db, env) {
  let payload;
  let rawBody = '';
  try {
    rawBody = await request.text();
    payload = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    return createError('Invalid JSON', 400);
  }

  const nodeId = normalizeString(request.headers.get('x-node-id') || payload?.nodeId);
  const nodeSecret = normalizeString(request.headers.get('x-node-secret') || payload?.secret);
  const signature = normalizeString(request.headers.get('x-node-signature') || payload?.signature);
  const signatureTs = normalizeString(request.headers.get('x-node-timestamp') || payload?.timestamp);

  if (!nodeId) return createError('Missing node id', 401);

  const settings = await loadSettings(env);
  const node = await fetchNode(db, nodeId);
  if (!node) return createError('Node not found', 404);
  if (node.enabled === false) return createError('Node disabled', 403);

  if (settings?.vpsMonitor?.requireSecret !== false) {
    if (!nodeSecret) return createError('Missing node secret', 401);
    if (node.secret !== nodeSecret) return createError('Unauthorized', 401);
  }

  if (settings?.vpsMonitor?.requireSignature === true) {
    if (!signature || !signatureTs) return createError('Missing signature', 401);
    const tsNumber = Number(signatureTs);
    if (!Number.isFinite(tsNumber)) return createError('Invalid timestamp', 400);
    const skewMinutes = clampNumber(settings?.vpsMonitor?.signatureClockSkewMinutes, 1, 60, 5);
    const nowMs = Date.now();
    const skewMs = skewMinutes * 60 * 1000;
    if (Math.abs(nowMs - tsNumber) > skewMs) return createError('Signature expired', 401);
    const bodyToSign = normalizeString(rawBody || safeJsonStringify(payload?.report || payload));
    const expected = await computeSignature(node.secret, node.id, String(tsNumber), bodyToSign);
    if (expected !== signature) return createError('Invalid signature', 401);
  }

  const report = payload?.report || payload;
  const receivedAt = nowIso();
  const reportedAt = normalizeReportTimestamp(report.reportedAt || report.at || report.timestamp || report.ts, receivedAt);

  const networkPayload = report.network || report.checks || null;
  const sanitizedChecks = sanitizeNetworkChecks(networkPayload);

  if (request.cf?.country) {
    node.countryCode = normalizeString(request.cf.country);
  }

  if (report.traffic) {
    const lastTraffic = node.lastReport?.traffic || {};
    const curRx = Number(report.traffic.rx || 0);
    const curTx = Number(report.traffic.tx || 0);
    const lastRx = Number(lastTraffic.rx || 0);
    const lastTx = Number(lastTraffic.tx || 0);

    const rxDelta = (curRx < lastRx || lastRx === 0) ? curRx : (curRx - lastRx);
    const txDelta = (curTx < lastTx || lastTx === 0) ? curTx : (curTx - lastTx);

    node.totalRx = (Number(node.totalRx) || 0) + rxDelta;
    node.totalTx = (Number(node.totalTx) || 0) + txDelta;
  }

  const normalizedReport = {
    id: crypto.randomUUID(),
    nodeId: node.id,
    reportedAt,
    createdAt: nowIso(),
    receivedAt,
    meta: {
      hostname: normalizeString(report.hostname || report.host),
      os: normalizeString(report.os || report.platform),
      arch: normalizeString(report.arch),
      kernel: normalizeString(report.kernel),
      version: normalizeString(report.version),
      probeVersion: normalizeString(report.probeVersion || report.agentVersion || report.version),
      lastError: normalizeString(report.lastError || report.error),
      publicIp: normalizeString(report.publicIp || report.ip || getClientIp(request)),
      countryCode: node.countryCode
    },
    cpu: { usage: clampPayloadUsage(report.cpu?.usage), cores: Number(report.cpu?.cores || 0) },
    mem: { 
      usage: clampPayloadUsage(report.mem?.usage), 
      total: Number(report.mem?.total || 0),
      used: Number(report.mem?.used || 0)
    },
    disk: { 
      usage: clampPayloadUsage(report.disk?.usage),
      total: Number(report.disk?.total || 0),
      used: Number(report.disk?.used || 0)
    },
    swap: {
      usage: clampPayloadUsage(report.swap?.usage),
      total: Number(report.swap?.total || 0),
      used: Number(report.swap?.used || 0)
    },
    load: { 
      load1: clampPayloadLoad(report.load?.load1),
      load5: clampPayloadLoad(report.load?.load5),
      load15: clampPayloadLoad(report.load?.load15)
    },
    uptimeSec: clampPayloadUptime(report.uptimeSec ?? report.uptime) ?? 0,
    traffic: report.traffic || null,
    network: sanitizedChecks.length ? sanitizedChecks : null
  };

  if (sanitizedChecks.length && node.networkMonitorEnabled !== false) {
    const networkSample = {
      id: crypto.randomUUID(),
      nodeId: node.id,
      reportedAt,
      createdAt: nowIso(),
      checks: sanitizedChecks
    };
    await insertNetworkSample(db, networkSample);
  }

  await insertReport(db, normalizedReport);

  if (shouldRunPrune()) {
    await pruneNetworkSamples(db, settings);
    await pruneReports(db, settings);
    lastPruneAt = Date.now();
  }

  node.lastSeenAt = normalizedReport.reportedAt;
  // 注意: checkAllNodesHeartbeat() 已移至 Cron Trigger（scheduled 事件）
  // 这样可以避免每个报告请求都进行全表扫描
  // 现在只在报告中处理当前节点的离线状态更新
  await updateNodeStatus(db, settings, node, normalizedReport, env);

  node.lastReport = buildSnapshot(normalizedReport, node);
  node.updatedAt = nowIso();
  await updateNodeMetrics(db, node);

  return createJson({ success: true });
}

async function handleListNodes(db, env) {
  const settings = await loadSettings(env);
  const nodes = await fetchNodes(db);
  const data = nodes.map(node => summarizeNode(node, node.lastReport || null, settings));
  return createJson({ success: true, data: { data } });
}

async function handleCreateNode(request, db, env) {
  const body = await request.json();
  const name = normalizeString(body.name);
  if (!name) return createError('Name is required', 400);

  const node = {
    id: crypto.randomUUID(),
    name,
    tag: normalizeString(body.tag),
    groupTag: normalizeString(body.groupTag),
    region: normalizeString(body.region),
    countryCode: normalizeString(body.countryCode),
    description: normalizeString(body.description),
    secret: normalizeString(body.secret) || crypto.randomUUID(),
    status: 'offline',
    enabled: body.enabled !== false,
    networkMonitorEnabled: body.networkMonitorEnabled !== false,
    useGlobalTargets: body.useGlobalTargets === true,
    totalRx: 0,
    totalTx: 0,
    trafficLimitGb: Number(body.trafficLimitGb || 0),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    lastSeenAt: null,
    lastReport: null,
    overloadState: null
  };
  await insertNode(db, node);

  return createJson({ success: true, data: node, guide: buildPublicGuide(env, request, node) });
}

async function handleUpdateNode(id, request, db, env) {
  const body = await request.json();
  const node = await fetchNode(db, id);
  if (!node) return createError('Node not found', 404);

  const fields = ['name', 'tag', 'groupTag', 'region', 'countryCode', 'description'];
  fields.forEach(field => {
    if (body[field] !== undefined) {
      node[field] = normalizeString(body[field]);
    }
  });
  if (typeof body.useGlobalTargets === 'boolean') node.useGlobalTargets = body.useGlobalTargets;
  if (typeof body.networkMonitorEnabled === 'boolean') node.networkMonitorEnabled = body.networkMonitorEnabled;
  if (typeof body.trafficLimitGb === 'number') node.trafficLimitGb = body.trafficLimitGb;
  if (typeof body.enabled === 'boolean') node.enabled = body.enabled;
  if (body.resetSecret) node.secret = crypto.randomUUID();

  node.updatedAt = nowIso();
  await updateNode(db, node);
  return createJson({ success: true, data: node, guide: buildPublicGuide(env, request, node) });
}

async function handleDeleteNode(id, db) {
  await deleteNode(db, id);
  return createJson({ success: true });
}

async function handleGetNodeDetail(id, db, env, request) {
  const settings = await loadSettings(env);
  const node = await fetchNode(db, id);
  if (!node) return createError('Node not found', 404);

  const latestReport = node.lastReport || null;
  let reports = await fetchReportsForNode(db, id, settings);
  const nodeTargets = await fetchNetworkTargets(db, id);
  const globalTargets = node?.useGlobalTargets ? await fetchGlobalNetworkTargets(db) : [];
  const targets = node?.useGlobalTargets ? globalTargets : nodeTargets;
  let networkSamples = await fetchNetworkSamples(db, id, settings);

  reports = reports.map(r => {
    if (r.network) r.network = rehydrateCheckNames(r.network, targets);
    return r;
  });
  networkSamples = networkSamples.map(s => {
    if (s.checks) s.checks = rehydrateCheckNames(s.checks, targets);
    return s;
  });

  return createJson({
    success: true,
    data: {
      data: summarizeNode(node, latestReport, settings),
      reports,
      targets,
      networkSamples,
      guide: buildPublicGuide(env, request, node)
    }
  });
}

async function handlePublicSnapshot(request, db, env) {
  // 1. 检查内存缓存
  if (!shouldRefreshPublicSnapshot() && cachedPublicSnapshot) {
    return createJson(cachedPublicSnapshot);
  }

  // 2. 尝试从 KV 缓存获取（避免重新查询D1）
  if (env?.MIPULSE_KV) {
    try {
      const kvValue = await env.MIPULSE_KV.get(KV_PUBLIC_SNAPSHOT_KEY);
      if (kvValue) {
        const result = JSON.parse(kvValue);
        cachedPublicSnapshot = result;
        cachedPublicSnapshotAt = Date.now();
        return createJson(result);
      }
    } catch (error) {
      console.error('KV public snapshot read failed:', error?.message);
    }
  }

  // 3. 从 D1 查询重建快照
  const settings = await loadSettings(env);

  const layout = {
    headerEnabled: true,
    footerEnabled: true
  };

  const nodes = await fetchNodes(db);
  if (!nodes.length) {
    const result = { success: true, data: [], theme: buildPublicThemeConfig(settings), layout };
    cachedPublicSnapshot = result;
    cachedPublicSnapshotAt = Date.now();
    
    // 回填 KV 缓存
    if (env?.MIPULSE_KV) {
      try {
        await env.MIPULSE_KV.put(KV_PUBLIC_SNAPSHOT_KEY, JSON.stringify(result), { 
          expirationTtl: KV_PUBLIC_SNAPSHOT_TTL 
        });
      } catch (error) {
        console.error('KV public snapshot write failed:', error?.message);
      }
    }
    return createJson(result);
  }

  const nodeIds = nodes.map(n => n.id);
  const latestSamples = await fetchLatestNetworkSamplesBatch(db, nodeIds);
  const samplesMap = new Map(latestSamples.map(s => [s.nodeId, s.checks]));
  const placeholders = nodeIds.map(() => '?').join(',');

  const allTargetsResult = await db.prepare(
    'SELECT * FROM vps_network_targets WHERE node_id IN (' + placeholders + ') OR node_id = ?'
  ).bind(...nodeIds, 'global').all();
  const allTargetsMap = new Map();
  (allTargetsResult.results || []).forEach(row => {
    const tid = row.node_id;
    if (!allTargetsMap.has(tid)) allTargetsMap.set(tid, []);
    allTargetsMap.get(tid).push({
      type: row.type,
      target: row.target,
      name: row.name,
      scheme: row.scheme || 'https',
      port: row.port,
      path: row.path
    });
  });

  const data = nodes.map(node => {
    const summary = summarizeNode(node, node.lastReport || null, settings);
    let latestNetwork = samplesMap.get(node.id);

    const nodeSpecificTargets = allTargetsMap.get(node.id) || [];
    const globalTargets = allTargetsMap.get('global') || [];
    const targets = node.useGlobalTargets ? globalTargets : nodeSpecificTargets;

    if (latestNetwork && latestNetwork.length > 0) {
      latestNetwork = rehydrateCheckNames(latestNetwork, targets);
      if (!summary.latest) summary.latest = { at: nowIso() };
      summary.latest.network = latestNetwork;
    }

    if (summary.latest) {
      if (summary.latest.publicIp) delete summary.latest.publicIp;
      if (summary.latest.ip) delete summary.latest.ip;
    }

    return summary;
  });

  const result = {
    success: true,
    data,
    theme: buildPublicThemeConfig(settings),
    layout
  };
  cachedPublicSnapshot = result;
  cachedPublicSnapshotAt = Date.now();
  
  // 4. 回填 KV 缓存
  if (env?.MIPULSE_KV) {
    try {
      await env.MIPULSE_KV.put(KV_PUBLIC_SNAPSHOT_KEY, JSON.stringify(result), { 
        expirationTtl: KV_PUBLIC_SNAPSHOT_TTL 
      });
    } catch (error) {
      console.error('KV public snapshot write failed:', error?.message);
    }
  }
  
  return createJson(result);
}

async function fetchLatestNetworkSamplesBatch(db, nodeIds) {
  if (!nodeIds.length) return [];
  const placeholders = nodeIds.map(() => '?').join(',');
  const sql = `
    SELECT s1.node_id, s1.data, s1.reported_at
    FROM vps_network_samples s1
    INNER JOIN (
      SELECT node_id, MAX(reported_at) AS max_reported_at
      FROM vps_network_samples
      WHERE node_id IN (${placeholders})
      GROUP BY node_id
    ) s2 ON s1.node_id = s2.node_id AND s1.reported_at = s2.max_reported_at
  `;
  const { results } = await db.prepare(sql).bind(...nodeIds).all();

  const latestMap = new Map();
  for (const row of results) {
    if (!latestMap.has(row.node_id)) {
      latestMap.set(row.node_id, {
        nodeId: row.node_id,
        checks: row.data ? JSON.parse(row.data).checks : [],
        reportedAt: row.reported_at
      });
    }
  }
  return Array.from(latestMap.values());
}

async function handlePublicNodeDetail(request, db, env) {
  const settings = await loadSettings(env);
  

  const url = new URL(request.url);
  let nodeId = normalizeString(url.pathname.split('/').pop());
  if (!nodeId || nodeId === 'nodes') {
    nodeId = normalizeString(url.searchParams.get('id'));
  }
  if (!nodeId) return createError('Node id required', 400);

  const node = await fetchNode(db, nodeId);
  if (!node) return createError('Node not found', 404);

  const nodeTargets = await fetchNetworkTargets(db, nodeId);
  const globalTargets = node?.useGlobalTargets ? await fetchGlobalNetworkTargets(db) : [];
  const targets = node?.useGlobalTargets ? globalTargets : nodeTargets;

  const cutoff = new Date(getReportRetentionCutoff(settings)).toISOString();
  const result = await db.prepare(
    'SELECT data FROM vps_network_samples WHERE node_id = ? AND reported_at >= ? ORDER BY reported_at ASC LIMIT 500'
  ).bind(nodeId, cutoff).all();

  const samples = (result.results || []).map(row => {
    const s = JSON.parse(row.data);
    if (s.checks) s.checks = rehydrateCheckNames(s.checks, targets);
    return s;
  });

  const summary = summarizeNode(node, node.lastReport || null, settings);
  if (summary.latest) {
    if (summary.latest.publicIp) delete summary.latest.publicIp;
    if (summary.latest.ip) delete summary.latest.ip;
  }

  return createJson({
    success: true,
    data: summary,
    networkSamples: samples,
    layout: {
      headerEnabled: true,
      footerEnabled: true
    }
  });
}

async function handleListAlerts(db) {
  const result = await db.prepare('SELECT * FROM vps_alerts ORDER BY created_at DESC LIMIT 100').all();
  const alerts = (result.results || []).map(row => ({
    id: row.id,
    nodeId: row.node_id,
    type: row.type,
    message: row.message,
    createdAt: row.created_at
  }));
  return createJson({ success: true, data: { data: alerts } });
}

async function handleClearAlerts(db) {
  await db.prepare('DELETE FROM vps_alerts').run();
  return createJson({ success: true });
}

async function handleListTargets(nodeId, db) {
  const query = nodeId ? 'SELECT * FROM vps_network_targets WHERE node_id = ?' : 'SELECT * FROM vps_network_targets';
  const params = nodeId ? [nodeId] : [];
  const { results } = await db.prepare(query).bind(...params).all();
  return createJson({ success: true, data: results });
}

async function handleCreateTarget(request, db, env) {
  const settings = await loadSettings(env);
  const body = await request.json();
  const nodeId = normalizeString(body.nodeId || 'global');
  const error = validateNetworkTarget(body);
  if (error) return createError(error, 400);

  const current = nodeId === 'global'
    ? await fetchGlobalNetworkTargets(db)
    : await fetchNetworkTargets(db, nodeId);
  const limit = clampNumber(settings?.vpsMonitor?.networkTargetsLimit, 1, 10, 3);
  if (current.length >= limit) return createError(`目标数量超过上限（${limit}）`, 400);

  const target = await insertNetworkTarget(db, nodeId, body);
  return createJson({ success: true, data: target });
}

async function handleUpdateTarget(id, request, db) {
  const body = await request.json();
  if (body.type || body.target || body.port || body.path || body.scheme) {
    const error = validateNetworkTarget({
      type: body.type || 'icmp',
      target: body.target || '1.1.1.1',
      port: body.port,
      path: body.path,
      scheme: body.scheme
    });
    if (error) return createError(error, 400);
  }
  const updated = await updateNetworkTarget(db, id, body);
  if (!updated) return createError('Target not found', 404);
  return createJson({ success: true, data: updated });
}

async function handleDeleteTarget(id, db) {
  await db.prepare('DELETE FROM vps_network_targets WHERE id = ?').bind(id).run();
  return createJson({ success: true });
}

async function handleNodeConfig(request, db, env) {
  const settings = await loadSettings(env);
  const url = new URL(request.url);
  const nodeId = normalizeString(url.searchParams.get('nodeId'));
  const nodeSecret = normalizeString(url.searchParams.get('secret'));
  const format = normalizeString(url.searchParams.get('format')) || 'json';
  if (!nodeId || !nodeSecret) return createError('Missing node credentials', 401);

  const node = await fetchNode(db, nodeId);
  if (!node || node.secret !== nodeSecret) return createError('Unauthorized', 401);

  const nodeTargets = await fetchNetworkTargets(db, nodeId);
  const globalTargets = node?.useGlobalTargets ? await fetchGlobalNetworkTargets(db) : [];
  const targets = node?.useGlobalTargets ? globalTargets : nodeTargets;
  const interval = clampNumber(settings?.vpsMonitor?.networkSampleIntervalMinutes, 1, 60, 5);
  const reportInterval = clampNumber(settings?.vpsMonitor?.reportIntervalMinutes, 1, 60, 1);
  const reportStoreInterval = clampNumber(settings?.vpsMonitor?.reportStoreIntervalMinutes, 1, 60, 1);

  if (format === 'env') {
    const lines = [
      `NETWORK_INTERVAL=${interval}`,
      `REPORT_INTERVAL=${reportInterval}`,
      `REPORT_STORE_INTERVAL=${reportStoreInterval}`,
      `SIGN_REQUIRED=${settings?.vpsMonitor?.requireSignature === true ? 1 : 0}`
    ];
    const pending = [];
    targets.forEach(target => {
      const line = `TARGET=${target.type}|${target.target}|${target.scheme || 'https'}|${target.port || ''}|${target.path || ''}|${target.enabled ? 1 : 0}|${target.forceCheckAt || ''}|${target.name || ''}`;
      lines.push(line);
      if (target.forceCheckAt) pending.push(target.id);
    });
    if (pending.length) {
      await db.prepare(
        `UPDATE vps_network_targets SET force_check_at = NULL, updated_at = ? WHERE id IN (${pending.map(() => '?').join(',')})`
      ).bind(nowIso(), ...pending).run();
    }
    return new Response(lines.join('\n'), {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  return createJson({
    success: true,
    data: {
      intervalMinutes: interval,
      targets
    }
  });
}

async function handleNetworkTargets(request, db, env) {
  const settings = await loadSettings(env);
  const url = new URL(request.url);
  const nodeId = normalizeString(url.searchParams.get('nodeId'));
  const isGlobal = nodeId === 'global';
  if (!nodeId) return createError('Node id required', 400);
  if (!isGlobal) {
    const node = await fetchNode(db, nodeId);
    if (!node) return createError('Node not found', 404);
  }

  if (request.method === 'GET') {
    const targets = isGlobal ? await fetchGlobalNetworkTargets(db) : await fetchNetworkTargets(db, nodeId);
    return createJson({ success: true, data: targets });
  }

  if (request.method === 'POST') {
    const payload = await request.json();
    const error = validateNetworkTarget(payload);
    if (error) return createError(error, 400);
    const current = isGlobal ? await fetchGlobalNetworkTargets(db) : await fetchNetworkTargets(db, nodeId);
    const limit = clampNumber(settings?.vpsMonitor?.networkTargetsLimit, 1, 10, 3);
    if (current.length >= limit) return createError(`目标数量超过上限（${limit}）`, 400);
    const target = await insertNetworkTarget(db, nodeId, payload);
    return createJson({ success: true, data: target });
  }

  if (request.method === 'PATCH') {
    const payload = await request.json();
    const targetId = normalizeString(payload.id);
    if (!targetId) return createError('Target id required', 400);
    const error = payload.type || payload.target || payload.port || payload.path || payload.scheme
      ? validateNetworkTarget({
        type: payload.type || 'icmp',
        target: payload.target || '1.1.1.1',
        port: payload.port,
        path: payload.path,
        scheme: payload.scheme
      })
      : null;
    if (error) return createError(error, 400);
    const updated = await updateNetworkTarget(db, targetId, payload);
    if (!updated) return createError('Target not found', 404);
    return createJson({ success: true, data: updated });
  }

  if (request.method === 'DELETE') {
    const payload = await request.json();
    const targetId = normalizeString(payload.id);
    if (!targetId) return createError('Target id required', 400);
    await deleteNetworkTarget(db, targetId);
    return createJson({ success: true });
  }

  return createError('Method Not Allowed', 405);
}

async function handleNetworkCheck(request, db, env) {
  if (request.method !== 'POST') return createError('Method Not Allowed', 405);
  const settings = await loadSettings(env);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return createError('Invalid JSON', 400);
  }

  const nodeId = normalizeString(payload.nodeId);
  if (!nodeId) return createError('Node id required', 400);
  const targetId = normalizeString(payload.targetId);
  if (!targetId) return createError('Target id required', 400);

  const node = await fetchNode(db, nodeId);
  if (!node) return createError('Node not found', 404);
  if (node.enabled === false) return createError('Node disabled', 403);

  const targetRow = await db.prepare(
    'SELECT * FROM vps_network_targets WHERE id = ? AND (node_id = ? OR node_id = ?)'
  ).bind(targetId, nodeId, 'global').first();
  if (!targetRow) return createError('Target not found', 404);
  if (targetRow.enabled === 0) return createError('Target disabled', 400);

  const now = nowIso();
  await db.prepare(
    'UPDATE vps_network_targets SET force_check_at = ?, updated_at = ? WHERE id = ?'
  ).bind(now, now, targetRow.id).run();

  const target = {
    id: targetRow.id,
    type: targetRow.type,
    target: targetRow.target,
    scheme: targetRow.scheme || 'https',
    port: targetRow.port,
    path: targetRow.path,
    forceCheckAt: now
  };

  return createJson({ success: true, data: target, message: 'Probe will run check on next report' });
}

async function handleInstallScript(request, db, env) {
  const settings = await loadSettings(env);
  const url = new URL(request.url);
  const nodeId = normalizeString(url.searchParams.get('nodeId'));
  const nodeSecret = normalizeString(url.searchParams.get('secret'));
  if (!nodeId || !nodeSecret) return createError('Missing node credentials', 401);

  const node = await fetchNode(db, nodeId);
  if (!node) return createError('Node not found', 404);
  if (node.secret !== nodeSecret) return createError('Unauthorized', 401);

  const reportUrl = `${url.origin}/api/vps/report`;
  const script = buildInstallScript(reportUrl, node, settings);
  return new Response(script, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

async function handleUninstallScript(request, db, env) {
  const settings = await loadSettings(env);
  const url = new URL(request.url);
  const nodeId = normalizeString(url.searchParams.get('nodeId'));
  const nodeSecret = normalizeString(url.searchParams.get('secret'));
  if (!nodeId || !nodeSecret) return createError('Missing node credentials', 401);

  const node = await fetchNode(db, nodeId);
  if (!node) return createError('Node not found', 404);
  if (node.secret !== nodeSecret) return createError('Unauthorized', 401);

  const script = buildUninstallScript(node);
  return new Response(script, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

async function handleGetSettings(env) {
  const settings = await loadSettings(env);
  return createJson({ success: true, ...settings });
}

async function handleSaveSettings(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return createError('Invalid JSON', 400);
  }
  const current = await loadSettings(env);
  const merged = { ...current, ...payload };
  if (payload?.vpsMonitor) {
    merged.vpsMonitor = { ...current.vpsMonitor, ...payload.vpsMonitor };
  }
  await saveSettings(env, merged);
  return createJson({ success: true, data: merged });
}
