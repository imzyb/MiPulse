import { Hono } from 'hono';
import { sendTestNotifications, nowIso } from '../../services/notification.js';
import { logAudit, AuditActions, ResourceTypes } from '../../services/audit.js';
import { 
    createNodeSchema, 
    updateNodeSchema, 
    createTargetSchema, 
    updateTargetSchema, 
    checkTargetSchema,
    settingsSchema,
    validateBody 
} from '../validators.js';

const vps = new Hono();
const PUBLIC_NODES_CACHE_KEY = 'cache:public_nodes';
const PUBLIC_NODES_CACHE_TTL_SECONDS = 60;
const PUBLIC_NODES_MEMORY_TTL_MS = 15 * 1000;
const ADMIN_NODES_MEMORY_TTL_MS = 10 * 1000;
const ALERTS_MEMORY_TTL_MS = 10 * 1000;
const TARGETS_MEMORY_TTL_MS = 10 * 1000;
const SETTINGS_CACHE_TTL_MS = 5 * 60 * 1000;
const KV_INVALIDATION_THROTTLE_MS = 60 * 1000;

let publicNodesMemoryCache = null;
let adminNodesMemoryCache = null;
let alertsMemoryCache = null;
let monitorSettingsCache = null;
let networkSettingsCache = null;
let targetListMemoryCache = new Map();
let recentNetworkSampleWrites = new Map();
let lastPublicCacheInvalidationAt = 0;

// --- Utilities ---
function isoFromMs(ms) { return new Date(ms).toISOString(); }

function getNumericTrafficValue(value) {
    const num = Number(value);
    return Number.isFinite(num) && num >= 0 ? num : 0;
}

function computeTrafficDelta(currentValue, previousValue, hasPreviousReport) {
    const current = getNumericTrafficValue(currentValue);
    if (!hasPreviousReport) return 0;
    const previous = getNumericTrafficValue(previousValue);
    
    // 如果之前的报文是 0（可能是探针故障、重启初次报文等），
    // 此时无法计算可靠的增量，应将当前值作为下次计算的基准，避免加回几百GB甚至TB的全量数据。
    if (previous === 0) return 0;
    
    if (current >= previous) return current - previous;
    
    // 如果当前值小于之前值，通常是 VPS 重启后流量计数器归零
    return current;
}

function shouldStoreReport(reportedAt, lastSeenAt, reportStoreIntervalMinutes) {
    if (!lastSeenAt) return true;
    const intervalMinutes = Math.max(1, Number(reportStoreIntervalMinutes) || 5);
    const deltaMs = new Date(reportedAt).getTime() - new Date(lastSeenAt).getTime();
    if (!Number.isFinite(deltaMs) || deltaMs < 0) return true;
    return deltaMs >= intervalMinutes * 60 * 1000;
}

async function getMonitorSettings(db) {
    if (monitorSettingsCache && monitorSettingsCache.expiresAt > Date.now()) {
        return monitorSettingsCache.value;
    }
    const rows = await db.prepare('SELECT key, value FROM settings WHERE key IN (?)')
        .bind('vps_monitor_json')
        .all();
    const settings = rows.results?.[0]?.value
        ? safeJsonParse(rows.results[0].value, {})
        : {};
    const value = {
        reportStoreIntervalMinutes: Math.max(1, Number(settings.reportStoreIntervalMinutes) || 5)
    };
    monitorSettingsCache = {
        value,
        expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS
    };
    return value;
}

async function getNetworkSettings(db) {
    if (networkSettingsCache && networkSettingsCache.expiresAt > Date.now()) {
        return networkSettingsCache.value;
    }
    const rows = await db.prepare('SELECT key, value FROM settings WHERE key IN (?)')
        .bind('network_monitor_json')
        .all();
    const settings = rows.results?.[0]?.value
        ? safeJsonParse(rows.results[0].value, {})
        : {};
    const value = {
        intervalMin: Math.max(1, Number(settings.intervalMin) || 5)
    };
    networkSettingsCache = {
        value,
        expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS
    };
    return value;
}

function readPublicNodesMemoryCache() {
    if (!publicNodesMemoryCache || publicNodesMemoryCache.expiresAt <= Date.now()) {
        publicNodesMemoryCache = null;
        return null;
    }
    return publicNodesMemoryCache.payload;
}

function writePublicNodesMemoryCache(payload) {
    publicNodesMemoryCache = {
        payload,
        expiresAt: Date.now() + PUBLIC_NODES_MEMORY_TTL_MS
    };
}

function invalidatePublicNodesMemoryCache() {
    publicNodesMemoryCache = null;
}

function readAdminNodesMemoryCache() {
    if (!adminNodesMemoryCache || adminNodesMemoryCache.expiresAt <= Date.now()) {
        adminNodesMemoryCache = null;
        return null;
    }
    return adminNodesMemoryCache.payload;
}

function writeAdminNodesMemoryCache(payload) {
    adminNodesMemoryCache = {
        payload,
        expiresAt: Date.now() + ADMIN_NODES_MEMORY_TTL_MS
    };
}

function invalidateAdminNodesCache() {
    adminNodesMemoryCache = null;
}

function readAlertsMemoryCache() {
    if (!alertsMemoryCache || alertsMemoryCache.expiresAt <= Date.now()) {
        alertsMemoryCache = null;
        return null;
    }
    return alertsMemoryCache.payload;
}

function writeAlertsMemoryCache(payload) {
    alertsMemoryCache = {
        payload,
        expiresAt: Date.now() + ALERTS_MEMORY_TTL_MS
    };
}

function invalidateAlertsCache() {
    alertsMemoryCache = null;
}

function getTargetsCacheKey(nodeId) {
    return nodeId === 'global' ? 'global' : (nodeId || '');
}

function readTargetsMemoryCache(nodeId) {
    const key = getTargetsCacheKey(nodeId);
    const entry = targetListMemoryCache.get(key);
    if (!entry || entry.expiresAt <= Date.now()) {
        targetListMemoryCache.delete(key);
        return null;
    }
    return entry.payload;
}

function writeTargetsMemoryCache(nodeId, payload) {
    targetListMemoryCache.set(getTargetsCacheKey(nodeId), {
        payload,
        expiresAt: Date.now() + TARGETS_MEMORY_TTL_MS
    });
}

function invalidateTargetsCache(nodeId = null) {
    if (!nodeId) {
        targetListMemoryCache.clear();
        return;
    }
    targetListMemoryCache.delete(getTargetsCacheKey(nodeId));
}

function shouldPersistNetworkSample(check, intervalMin) {
    const nodeId = check.nodeId || '';
    const targetId = check.targetId || '';
    if (!nodeId || !targetId) return false;
    const key = `${nodeId}:${targetId}`;
    const checkedAt = new Date(check.checkedAt || nowIso()).getTime();
    const currentAt = Number.isFinite(checkedAt) ? checkedAt : Date.now();
    const cooldownMs = Math.max(1, Number(intervalMin) || 5) * 60 * 1000;
    const lastAt = recentNetworkSampleWrites.get(key) || 0;
    if (currentAt - lastAt < cooldownMs) return false;
    recentNetworkSampleWrites.set(key, currentAt);
    return true;
}

async function invalidatePublicNodesCache(kv, force = false) {
    invalidatePublicNodesMemoryCache();
    if (!kv) return;
    const now = Date.now();
    if (!force && now - lastPublicCacheInvalidationAt < KV_INVALIDATION_THROTTLE_MS) {
        return;
    }
    lastPublicCacheInvalidationAt = now;
    try {
        await kv.delete(PUBLIC_NODES_CACHE_KEY);
    } catch {
    }
}

function normalizeNodeList(rows) {
    return rows.map((n) => ({
        ...n,
        enabled: !!n.enabled,
        networkMonitorEnabled: !!n.networkMonitorEnabled,
        latest: safeJsonParse(n.lastReport, null)
    }));
}

function buildLatencyMapFromNodes(nodes) {
    const latencyMap = {};
    for (const node of nodes || []) {
        const latest = safeJsonParse(node.lastReport, null);
        const latency = Number(latest?.latencyMs);
        latencyMap[node.id] = Number.isFinite(latency) && latency >= 0 ? [latency] : [];
    }
    return latencyMap;
}

export function normalizeReportTimestamp(rawValue, fallbackIso) {
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

function buildGuide(apiOrigin, nodeId, secret) {
    return {
        installCommand: `curl -sSL '${apiOrigin}/api/vps/install?nodeId=${nodeId}&secret=${secret}' | bash`,
        uninstallCommand: `curl -sSL '${apiOrigin}/api/vps/uninstall' | bash`
    };
}

function generateUnambiguousSecret(len = 12) {
    const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXY3456789';
    let res = '';
    for (let i = 0; i < len; i++) res += chars.charAt(Math.floor(Math.random() * chars.length));
    return res;
}

export function safeJsonParse(value, fallback) {
    if (!value) return fallback;
    try {
        return JSON.parse(value);
    } catch {
        return fallback;
    }
}

async function getNotificationConfig(db) {
    const rows = await db.prepare('SELECT key, value FROM settings WHERE key IN (?, ?)')
        .bind('vps_monitor_json', 'notification_json')
        .all();
    const settings = {};
    for (const row of rows.results || []) {
        settings[row.key] = safeJsonParse(row.value, {});
    }
    const notification = settings.notification_json || {};
    const legacy = settings.vps_monitor_json || {};
    return {
        notificationEnabled: notification.enabled ?? legacy.notificationEnabled ?? false,
        telegram: {
            enabled: notification.telegram?.enabled ?? legacy.notifyTelegram ?? false,
            botToken: notification.telegram?.botToken ?? legacy.telegramBotToken ?? '',
            chatId: notification.telegram?.chatId ?? legacy.telegramChatId ?? ''
        },
        webhook: {
            enabled: notification.webhook?.enabled ?? legacy.notifyWebhook ?? false,
            url: notification.webhook?.url ?? legacy.webhookUrl ?? ''
        },
        pushplus: {
            enabled: notification.pushplus?.enabled ?? legacy.notifyAppPush ?? false,
            token: notification.pushplus?.token ?? legacy.appPushKey ?? ''
        }
    };
}

export function buildTargetUrl(target) {
    const scheme = target.scheme || (target.type === 'http' ? 'https' : 'https');
    const portPart = target.port ? `:${target.port}` : '';
    const path = target.path || '/';
    return `${scheme}://${target.target}${portPart}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function executeTargetCheck(target, fetchImpl = fetch) {
    const startedAt = Date.now();
    const timeoutMs = 5000;
    let probeUrl = '';

    if (target.type === 'http') {
        probeUrl = buildTargetUrl(target);
    } else if (target.type === 'tcp') {
        const port = target.port ? `:${target.port}` : '';
        probeUrl = `https://${target.target}${port}/`;
    } else {
        probeUrl = `https://${target.target}/`;
    }

    try {
        const response = await fetchImpl(probeUrl, {
            method: 'HEAD',
            redirect: 'manual',
            signal: AbortSignal.timeout(timeoutMs)
        });
        return {
            ok: true,
            status: response.status,
            latencyMs: Date.now() - startedAt,
            checkedAt: nowIso(),
            mode: target.type === 'http' ? 'http' : 'tcp-like',
            url: probeUrl
        };
    } catch (error) {
        return {
            ok: false,
            status: null,
            latencyMs: Date.now() - startedAt,
            checkedAt: nowIso(),
            mode: target.type === 'http' ? 'http' : 'tcp-like',
            url: probeUrl,
            error: error?.message || 'Probe failed'
        };
    }
}

async function getProbeNode(db, rawId, rawSecret) {
    if (!rawId || !rawSecret) return null;
    const node = await db.prepare('SELECT id, secret, network_monitor_enabled FROM vps_nodes WHERE LOWER(id) = LOWER(?)').bind(rawId).first();
    if (!node || node.secret !== rawSecret) return null;
    return node;
}

async function getProbeTargets(db, node) {
    let query = 'SELECT id, node_id AS nodeId, type, target, name, scheme, port, path, force_check_at AS forceCheckAt FROM vps_network_targets WHERE enabled = 1 AND (node_id = ?';
    if (node.network_monitor_enabled) query += " OR node_id = 'global'";
    query += ')';
    const { results } = await db.prepare(query).bind(node.id).all();
    return results || [];
}

function normalizeTargetListItem(target, latestSampleMap) {
    return {
        ...target,
        enabled: !!target.enabled,
        latestSample: latestSampleMap[target.id] || null
    };
}

// --- Routes ---

vps.get('/public', async (c) => {
    const db = c.env.MIPULSE_DB;
    const kv = c.env.MIPULSE_KV;
    const memoryCached = readPublicNodesMemoryCache();
    if (memoryCached) return c.json(memoryCached);
    if (kv) {
        try {
            const cached = await kv.get(PUBLIC_NODES_CACHE_KEY);
            if (cached) {
                const payload = JSON.parse(cached);
                writePublicNodesMemoryCache(payload);
                return c.json(payload);
            }
        } catch {
        }
    }
    try {
        const { results: nodes } = await db.prepare(`SELECT id, name, region, country_code AS countryCode, status, last_seen_at AS lastSeenAt, tag, group_tag AS groupTag, last_report_json AS lastReport, total_rx AS totalRx, total_tx AS totalTx FROM vps_nodes WHERE enabled = 1 ORDER BY name ASC`).all();
        const { results: latencyRows } = await db.prepare(`SELECT node_id, CAST(json_extract(data, '$.latencyMs') AS FLOAT) as latencyMs, reported_at AS reportedAt FROM (SELECT node_id, data, reported_at, ROW_NUMBER() OVER(PARTITION BY node_id ORDER BY reported_at DESC) as rn FROM vps_reports WHERE reported_at > datetime('now', '-24 hours')) WHERE rn <= 20`).all();
        const latencyMap = {}; latencyRows.forEach(r => { if (!latencyMap[r.node_id]) latencyMap[r.node_id] = []; latencyMap[r.node_id].push(r.latencyMs); });
        const data = nodes.map(n => ({ ...n, latency: latencyMap[n.id] || [], latest: safeJsonParse(n.lastReport, null) }));
        
        // Fetch global settings for theme and layout
        const { results: settingsRows } = await db.prepare('SELECT key, value FROM settings WHERE key IN ("theme_json", "layout_json")').all();
        const settings = {}; settingsRows.forEach(r => settings[r.key] = safeJsonParse(r.value, {}));
        
        const result = { 
            success: true, 
            nodes: data,
            theme: settings.theme_json || {},
            layout: settings.layout_json || {}
        };
        writePublicNodesMemoryCache(result);
        if (kv) {
            try {
                await kv.put(PUBLIC_NODES_CACHE_KEY, JSON.stringify(result), { expirationTtl: PUBLIC_NODES_CACHE_TTL_SECONDS });
            } catch {
            }
        }
        return c.json(result);
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.post('/report', async (c) => {
    const db = c.env.MIPULSE_DB;
    const rawBody = await c.req.text();
    let payload; try { payload = JSON.parse(rawBody); } catch(e) { return c.json({ error: 'Invalid JSON' }, 400); }
    const report = payload?.report || payload;
    const nodeId = (c.req.header('x-node-id') || payload?.nodeId || payload?.id || '').trim();
    const secret = (c.req.header('x-node-secret') || payload?.nodeSecret || payload?.secret || '').trim();
    if (!nodeId) return c.json({ error: 'Missing node id' }, 400);
    const node = await db.prepare('SELECT id, secret, last_seen_at AS lastSeenAt, last_report_json AS lastReport FROM vps_nodes WHERE LOWER(id) = LOWER(?)').bind(nodeId).first();
    if (!node) return c.json({ error: 'Node not found' }, 404);
    if (node.secret && !secret) return c.json({ error: 'Missing secret' }, 401);
    if (node.secret !== secret) return c.json({ error: 'Invalid secret' }, 401);
    const reportedAt = normalizeReportTimestamp(report.ts || report.timestamp, nowIso());
    const lastRep = safeJsonParse(node.lastReport, {});
    const hasPreviousReport = !!node.lastSeenAt && !!node.lastReport;
    const rxDelta = computeTrafficDelta(report.traffic?.rx, lastRep.traffic?.rx, hasPreviousReport);
    const txDelta = computeTrafficDelta(report.traffic?.tx, lastRep.traffic?.tx, hasPreviousReport);
    const timeDelta = (new Date(reportedAt).getTime() - (node.lastSeenAt ? new Date(node.lastSeenAt).getTime() : 0)) / 1000;
    const monitorSettings = await getMonitorSettings(db);
    const storeDetailedReport = shouldStoreReport(reportedAt, node.lastSeenAt, monitorSettings.reportStoreIntervalMinutes);
    if (!report.traffic) report.traffic = { rx: 0, tx: 0 };
    report.traffic.rxSpeed = (timeDelta > 0 && timeDelta < 3600) ? rxDelta / timeDelta : 0;
    report.traffic.txSpeed = (timeDelta > 0 && timeDelta < 3600) ? txDelta / timeDelta : 0;
    const connectingIp = c.req.header('cf-connecting-ip');
    const country = c.req.header('cf-ipcountry') || c.req.raw.cf?.country || null;
    if (connectingIp) { if (!report.meta) report.meta = {}; report.meta.publicIp = connectingIp; }
    try {
        const statements = [
            db.prepare(`UPDATE vps_nodes SET status = 'online', last_seen_at = ?, last_report_json = ?, total_rx = total_rx + ?, total_tx = total_tx + ?, country_code = COALESCE(?, country_code) WHERE id = ?`).bind(reportedAt, JSON.stringify(report), rxDelta, txDelta, country, node.id)
        ];
        if (storeDetailedReport) {
            statements.push(db.prepare(`INSERT INTO vps_reports (id, node_id, data, reported_at) VALUES (?, ?, ?, ?)`).bind(crypto.randomUUID(), node.id, JSON.stringify({ 
                cpuPercent: report.cpuPercent || 0, 
                memPercent: report.memPercent || 0, 
                diskPercent: report.diskPercent || 0, 
                load1: report.load1 || 0, 
                latencyMs: report.latencyMs || 0,
                lossPercent: report.lossPercent || 0,
                checks: report.checks || []
            }), reportedAt));
        }
        await db.batch(statements);
        invalidateAdminNodesCache();
        invalidateAlertsCache();
        invalidatePublicNodesMemoryCache();
        return c.json({ success: true, timestamp: reportedAt });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.get('/nodes', async (c) => {
    const db = c.env.MIPULSE_DB;
    try {
        const cached = readAdminNodesMemoryCache();
        if (cached) return c.json(cached);
        const { results } = await db.prepare('SELECT id, name, tag, group_tag AS groupTag, region, country_code AS countryCode, secret, status, enabled, network_monitor_enabled AS networkMonitorEnabled, last_report_json AS lastReport, total_rx AS totalRx, total_tx AS totalTx FROM vps_nodes ORDER BY name ASC').all();
        const nodes = normalizeNodeList(results);
        const payload = { success: true, data: nodes, nodes };
        writeAdminNodesMemoryCache(payload);
        return c.json(payload);
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.post('/nodes', async (c) => {
    const db = c.env.MIPULSE_DB;
    const body = await c.req.json();
    
    // Validate request body
    const validation = validateBody(body, createNodeSchema);
    if (!validation.success) {
        return c.json({ 
            success: false, 
            error: 'Validation failed',
            details: validation.errors 
        }, 400);
    }
    
    const data = validation.data;
    const id = crypto.randomUUID(); 
    const secret = data.secret || generateUnambiguousSecret(12);
    
    try {
        await db.prepare('INSERT INTO vps_nodes (id, name, tag, group_tag, region, enabled, secret, status) VALUES (?, ?, ?, ?, ?, ?, ?, "offline")')
            .bind(id, data.name, data.tag || '', data.groupTag || 'Default', data.region || 'Global', data.enabled ? 1 : 0, secret)
            .run();
        
        // Audit logging
        const payload = c.get('jwtPayload');
        await logAudit(db, {
            userId: payload?.id,
            action: AuditActions.CREATE_NODE,
            resourceType: ResourceTypes.VPS_NODE,
            resourceId: id,
            newValue: { name: data.name, tag: data.tag, groupTag: data.groupTag, region: data.region },
            ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
            userAgent: c.req.header('user-agent')
        });
        
        invalidateAdminNodesCache();
        await invalidatePublicNodesCache(c.env.MIPULSE_KV, true);
        return c.json({ 
            success: true, 
            node: { id, secret }, 
            guide: buildGuide(new URL(c.req.url).origin, id, secret) 
        });
    } catch (err) { 
        return c.json({ success: false, error: err.message }, 500); 
    }
});

vps.get('/nodes/:id', async (c) => {
    const db = c.env.MIPULSE_DB; const id = c.req.param('id');
    try {
        const node = await db.prepare('SELECT *, group_tag AS groupTag, network_monitor_enabled AS networkMonitorEnabled, last_report_json AS lastReport FROM vps_nodes WHERE LOWER(id) = LOWER(?)').bind(id).first();
        if (!node) return c.json({ error: 'Not found' }, 404);
        const normalizedNode = { ...node, enabled: !!node.enabled, networkMonitorEnabled: !!node.networkMonitorEnabled, latest: safeJsonParse(node.lastReport, null) };
        return c.json({ success: true, data: normalizedNode, node: normalizedNode, guide: buildGuide(new URL(c.req.url).origin, node.id, node.secret) });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.put('/nodes/:id', async (c) => {
    const db = c.env.MIPULSE_DB; 
    const id = c.req.param('id'); 
    const body = await c.req.json(); 
    const apiOrigin = new URL(c.req.url).origin;
    
    // Validate request body
    const validation = validateBody(body, updateNodeSchema);
    if (!validation.success) {
        return c.json({ 
            success: false, 
            error: 'Validation failed',
            details: validation.errors 
        }, 400);
    }
    
    const data = validation.data;
    
    try {
        if (data.resetSecret) { 
            const newSecret = generateUnambiguousSecret(12); 
            await db.prepare("UPDATE vps_nodes SET secret = ?, updated_at = datetime('now') WHERE id = ?")
                .bind(newSecret, id)
                .run(); 
            return c.json({ success: true, guide: buildGuide(apiOrigin, id, newSecret) }); 
        }
        await db.prepare('UPDATE vps_nodes SET name = ?, tag = ?, group_tag = ?, region = ?, enabled = ?, secret = ?, network_monitor_enabled = ?, updated_at = datetime("now") WHERE id = ?')
            .bind(data.name, data.tag || '', data.groupTag || 'Default', data.region || 'Global', data.enabled ? 1 : 0, data.secret, data.networkMonitorEnabled ? 1 : 0, id)
            .run();
        invalidateAdminNodesCache();
        await invalidatePublicNodesCache(c.env.MIPULSE_KV, true);
        return c.json({ success: true, guide: buildGuide(apiOrigin, id, data.secret) });
    } catch (err) { 
        return c.json({ success: false, error: err.message }, 500); 
    }
});

vps.post('/nodes/:id/reset-traffic', async (c) => {
    const db = c.env.MIPULSE_DB;
    const id = c.req.param('id');
    try {
        await db.prepare('UPDATE vps_nodes SET total_rx = 0, total_tx = 0 WHERE id = ?').bind(id).run();
        invalidateAdminNodesCache();
        await invalidatePublicNodesCache(c.env.MIPULSE_KV, true);
        return c.json({ success: true });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.delete('/nodes/:id', async (c) => {
    const db = c.env.MIPULSE_DB; 
    const id = c.req.param('id');
    const payload = c.get('jwtPayload');
    
    try {
        // Get node info before deletion for audit log
        const node = await db.prepare('SELECT name, tag FROM vps_nodes WHERE id = ?').bind(id).first();
        
        await db.batch([ 
            db.prepare('DELETE FROM vps_nodes WHERE id = ?').bind(id), 
            db.prepare('DELETE FROM vps_reports WHERE node_id = ?').bind(id), 
            db.prepare('DELETE FROM vps_network_targets WHERE node_id = ?').bind(id) 
        ]);
        
        // Audit logging
        await logAudit(db, {
            userId: payload?.id,
            action: AuditActions.DELETE_NODE,
            resourceType: ResourceTypes.VPS_NODE,
            resourceId: id,
            oldValue: node,
            ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
            userAgent: c.req.header('user-agent')
        });
        
        invalidateAdminNodesCache(); 
        await invalidatePublicNodesCache(c.env.MIPULSE_KV, true); 
        return c.json({ success: true }); 
    } catch (err) { 
        return c.json({ success: false, error: err.message }, 500); 
    }
});

vps.get('/targets', async (c) => {
    const db = c.env.MIPULSE_DB;
    try {
        const nodeId = c.req.query('nodeId');
        const cached = readTargetsMemoryCache(nodeId);
        if (cached) return c.json(cached);
        const { results } = await db.prepare('SELECT * FROM vps_network_targets WHERE node_id = ? ORDER BY created_at DESC').bind(nodeId).all();
        const { results: sampleRows } = await db.prepare('SELECT data FROM vps_network_samples WHERE node_id = ? ORDER BY reported_at DESC LIMIT 100').bind(nodeId === 'global' ? 'global' : nodeId).all();
        const latestSampleMap = {};
        for (const row of sampleRows || []) {
            const parsed = safeJsonParse(row.data, null);
            if (parsed?.targetId && !latestSampleMap[parsed.targetId]) {
                latestSampleMap[parsed.targetId] = parsed;
            }
        }
        const normalizedTargets = (results || []).map((target) => normalizeTargetListItem(target, latestSampleMap));
        const payload = { success: true, data: normalizedTargets, targets: normalizedTargets };
        writeTargetsMemoryCache(nodeId, payload);
        return c.json(payload);
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.post('/targets', async (c) => {
    const db = c.env.MIPULSE_DB; 
    const body = await c.req.json(); 
    
    // Validate request body
    const validation = validateBody(body, createTargetSchema);
    if (!validation.success) {
        return c.json({ 
            success: false, 
            error: 'Validation failed',
            details: validation.errors 
        }, 400);
    }
    
    const data = validation.data;
    
    try { 
        await db.prepare('INSERT INTO vps_network_targets (id, node_id, type, target, name, enabled) VALUES (?, ?, ?, ?, ?, 1)')
            .bind(crypto.randomUUID(), data.nodeId, data.type, data.target, data.name)
            .run(); 
        invalidateTargetsCache(data.nodeId); 
        return c.json({ success: true }); 
    } catch (err) { 
        return c.json({ success: false, error: err.message }, 500); 
    }
});

vps.put('/targets/:id', async (c) => {
    const db = c.env.MIPULSE_DB;
    const id = c.req.param('id');
    const body = await c.req.json();
    
    // Validate request body
    const validation = validateBody(body, updateTargetSchema);
    if (!validation.success) {
        return c.json({ 
            success: false, 
            error: 'Validation failed',
            details: validation.errors 
        }, 400);
    }
    
    const data = validation.data;
    
    try {
        const existing = await db.prepare('SELECT * FROM vps_network_targets WHERE id = ?').bind(id).first();
        if (!existing) return c.json({ success: false, error: 'Target not found' }, 404);
        const next = {
            type: data.type ?? existing.type,
            target: data.target ?? existing.target,
            name: data.name ?? existing.name,
            scheme: data.scheme ?? existing.scheme,
            port: data.port ?? existing.port,
            path: data.path ?? existing.path,
            enabled: data.enabled === undefined ? existing.enabled : (data.enabled ? 1 : 0)
        };
        await db.prepare('UPDATE vps_network_targets SET type = ?, target = ?, name = ?, scheme = ?, port = ?, path = ?, enabled = ?, updated_at = datetime("now") WHERE id = ?')
            .bind(next.type, next.target, next.name, next.scheme, next.port, next.path, next.enabled, id)
            .run();
        invalidateTargetsCache(existing.node_id);
        return c.json({ success: true, data: { id, ...next, enabled: !!next.enabled } });
    } catch (err) { 
        return c.json({ success: false, error: err.message }, 500); 
    }
});

vps.delete('/targets/:id', async (c) => {
    const db = c.env.MIPULSE_DB; 
    try { 
        const targetId = c.req.param('id'); 
        const existing = await db.prepare('SELECT * FROM vps_network_targets WHERE id = ?').bind(targetId).first(); 
        await db.prepare('DELETE FROM vps_network_targets WHERE id = ?').bind(targetId).run(); 
        invalidateTargetsCache(existing?.node_id); 
        return c.json({ success: true }); 
    } catch (err) { 
        return c.json({ success: false, error: err.message }, 500); 
    }
});

vps.post('/targets/check', async (c) => {
    const db = c.env.MIPULSE_DB;
    const body = await c.req.json();
    
    // Validate request body
    const validation = validateBody(body, checkTargetSchema);
    if (!validation.success) {
        return c.json({ 
            success: false, 
            error: 'Validation failed',
            details: validation.errors 
        }, 400);
    }
    
    const data = validation.data;
    
    try {
        const target = await db.prepare('SELECT * FROM vps_network_targets WHERE id = ? AND node_id = ?').bind(data.targetId, data.nodeId).first();
        if (!target) return c.json({ success: false, error: 'Target not found' }, 404);
        if (body.nodeId !== 'global') {
            await db.prepare('UPDATE vps_network_targets SET force_check_at = datetime("now"), updated_at = datetime("now") WHERE id = ?')
                .bind(target.id)
                .run();
            return c.json({
                success: true,
                data: {
                    targetId: target.id,
                    nodeId: body.nodeId,
                    status: 'queued',
                    queuedAt: nowIso(),
                    mode: 'probe'
                }
            });
        }
        const result = await executeTargetCheck(target);
        return c.json({
            success: true,
            data: {
                targetId: target.id,
                nodeId: target.node_id,
                status: result.ok ? 'reachable' : 'unreachable',
                checkedAt: result.checkedAt,
                latencyMs: result.latencyMs,
                statusCode: result.status,
                mode: result.mode,
                url: result.url,
                error: result.error || null
            }
        });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.get('/alerts', async (c) => {
    const db = c.env.MIPULSE_DB;
    try {
        const cached = readAlertsMemoryCache();
        if (cached) return c.json(cached);
        const { results } = await db.prepare('SELECT id, node_id AS nodeId, type, message, created_at AS createdAt FROM vps_alerts ORDER BY created_at DESC LIMIT 100').all();
        const payload = { success: true, data: results, alerts: results };
        writeAlertsMemoryCache(payload);
        return c.json(payload);
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.delete('/alerts', async (c) => {
    const db = c.env.MIPULSE_DB;
    try {
        await db.prepare('DELETE FROM vps_alerts').run();
        invalidateAlertsCache();
        return c.json({ success: true, data: { cleared: true } });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

// 6.5 PROBE: GET /api/vps/probe/targets (v1.5.7)
vps.get('/probe/targets', async (c) => {
    c.header('Cache-Control', 'no-store, max-age=0');
    const db = c.env.MIPULSE_DB;
    const rawId = (c.req.query('nodeId') || c.req.query('id') || c.req.header('x-node-id') || '').trim();
    const rawSecret = (c.req.query('secret') || c.req.query('key') || c.req.header('x-node-secret') || '').trim();
    if (!rawId || !rawSecret) return c.json({ error: 'Missing credentials' }, 401);
    const node = await getProbeNode(db, rawId, rawSecret);
    if (!node) return c.json({ error: 'Invalid credentials' }, 401);
    try {
        const results = await getProbeTargets(db, node);
        return c.json({ success: true, targets: results.map(r => r.target) });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.get('/probe/checks', async (c) => {
    c.header('Cache-Control', 'no-store, max-age=0');
    const db = c.env.MIPULSE_DB;
    const rawId = (c.req.query('nodeId') || c.req.query('id') || c.req.header('x-node-id') || '').trim();
    const rawSecret = (c.req.query('secret') || c.req.query('key') || c.req.header('x-node-secret') || '').trim();
    const node = await getProbeNode(db, rawId, rawSecret);
    if (!node) return c.json({ error: 'Invalid credentials' }, 401);
    try {
        const targets = await getProbeTargets(db, node);
        const pendingChecks = targets.filter((target) => target.forceCheckAt);
        return c.json({ success: true, data: pendingChecks, checks: pendingChecks });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.get('/probe/checks.txt', async (c) => {
    c.header('Cache-Control', 'no-store, max-age=0');
    const db = c.env.MIPULSE_DB;
    const rawId = (c.req.query('nodeId') || c.req.query('id') || c.req.header('x-node-id') || '').trim();
    const rawSecret = (c.req.query('secret') || c.req.query('key') || c.req.header('x-node-secret') || '').trim();
    const node = await getProbeNode(db, rawId, rawSecret);
    if (!node) return c.text('unauthorized', 401);
    try {
        const targets = await getProbeTargets(db, node);
        const pendingChecks = targets.filter((target) => target.forceCheckAt);
        const lines = pendingChecks.map((target) => [
            target.id,
            target.type || '',
            target.target || '',
            target.scheme || '',
            target.port || '',
            target.path || ''
        ].join('|'));
        return c.text(lines.join('\n'));
    } catch (err) { return c.text(err.message, 500); }
});

vps.post('/probe/check-results', async (c) => {
    const db = c.env.MIPULSE_DB;
    const body = await c.req.json();
    const rawId = (c.req.header('x-node-id') || body?.nodeId || '').trim();
    const rawSecret = (c.req.header('x-node-secret') || body?.secret || '').trim();
    const node = await getProbeNode(db, rawId, rawSecret);
    if (!node) return c.json({ error: 'Invalid credentials' }, 401);

    const checks = Array.isArray(body?.checks) ? body.checks : [];
    try {
        const networkSettings = await getNetworkSettings(db);
        const statements = [];
        for (const check of checks) {
            if (!check?.targetId) continue;
            const normalizedCheck = { ...check, nodeId: check.nodeId || node.id, checkedAt: check.checkedAt || nowIso() };
            if (shouldPersistNetworkSample(normalizedCheck, networkSettings.intervalMin)) {
                statements.push(
                    db.prepare('INSERT INTO vps_network_samples (id, node_id, reported_at, data) VALUES (?, ?, ?, ?)')
                        .bind(crypto.randomUUID(), normalizedCheck.nodeId, nowIso(), JSON.stringify(normalizedCheck))
                );
            }
            statements.push(
                db.prepare('UPDATE vps_network_targets SET force_check_at = NULL, updated_at = datetime("now") WHERE id = ?')
                    .bind(check.targetId)
            );
            invalidateTargetsCache(normalizedCheck.nodeId);
        }
        if (statements.length) {
            await db.batch(statements);
        }
        return c.json({ success: true, data: { accepted: checks.length } });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

// 6.6 PUBLIC DETAIL: GET /api/vps/public/nodes/:id (History for charts - v1.5.8)
vps.get('/public/nodes/:id', async (c) => {
    const db = c.env.MIPULSE_DB;
    const id = c.req.param('id');
    try {
        const node = await db.prepare('SELECT id, name, region, status FROM vps_nodes WHERE id = ? AND enabled = 1').bind(id).first();
        if (!node) return c.json({ error: 'Not found or disabled' }, 404);

        const { results: targetRows } = await db.prepare('SELECT target, name FROM vps_network_targets WHERE node_id = ? OR node_id = "global"').bind(id).all();
        const targetNames = {};
        targetRows.forEach(row => { if (row.name) targetNames[row.target] = row.name; });

        const { results: reports } = await db.prepare(`
            SELECT data, reported_at as timestamp FROM vps_reports 
            WHERE node_id = ? AND reported_at > datetime('now', '-24 hours')
            ORDER BY reported_at ASC
        `).bind(id).all();

        const samples = reports.map(r => {
            const d = safeJsonParse(r.data, {});
            return {
                timestamp: r.timestamp,
                lossPercent: d.lossPercent || 0,
                checks: d.checks && d.checks.length > 0 ? d.checks : [
                    { name: 'Average Latency', type: 'ICMP', latencyMs: d.latencyMs || 0, lossPercent: d.lossPercent || 0 }
                ]
            };
        });

        const MAX_POINTS = 288;
        if (samples.length > MAX_POINTS) {
            const step = Math.ceil(samples.length / MAX_POINTS);
            const downsampled = [];
            for (let i = 0; i < samples.length; i += step) {
                downsampled.push(samples[i]);
            }
            samples.length = 0;
            samples.push(...downsampled);
        }

        return c.json({ success: true, node, networkSamples: samples, targetNames });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.get('/settings', async (c) => {
    const db = c.env.MIPULSE_DB; try { const { results } = await db.prepare('SELECT key, value FROM settings').all(); const settings = {}; results.forEach(r => settings[r.key] = r.key.endsWith('_json') ? safeJsonParse(r.value, {}) : r.value); return c.json({ success: true, data: settings, settings }); } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.post('/settings', async (c) => {
    const db = c.env.MIPULSE_DB; 
    const body = await c.req.json();
    const payload = c.get('jwtPayload');
    
    // Validate request body
    const validation = validateBody(body, settingsSchema);
    if (!validation.success) {
        return c.json({ 
            success: false, 
            error: 'Validation failed',
            details: validation.errors 
        }, 400);
    }
    
    try {
        const normalizedBody = validation.data.vpsMonitor ? { vps_monitor_json: validation.data.vpsMonitor } : validation.data;
        
        // Get old settings for audit log
        const oldSettings = {};
        for (const key of Object.keys(normalizedBody)) {
            const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind(key).first();
            if (row) {
                oldSettings[key] = safeJsonParse(row.value, row.value);
            }
        }
        
        const queries = Object.entries(normalizedBody).map(([k, v]) => {
            const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
            return db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))').bind(k, val);
        });
        await db.batch(queries);
        
        // Audit logging
        await logAudit(db, {
            userId: payload?.id,
            action: AuditActions.UPDATE_SETTINGS,
            resourceType: ResourceTypes.SETTING,
            oldValue: oldSettings,
            newValue: normalizedBody,
            ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
            userAgent: c.req.header('user-agent')
        });
        
        // Invalidate public cache
        monitorSettingsCache = null;
        networkSettingsCache = null;
        await invalidatePublicNodesCache(c.env.MIPULSE_KV, true);
        return c.json({ success: true, data: normalizedBody, settings: normalizedBody });
    } catch (err) { 
        return c.json({ success: false, error: err.message }, 500); 
    }
});

vps.post('/notifications/test', async (c) => {
    const db = c.env.MIPULSE_DB;
    try {
        const config = await getNotificationConfig(db);
        const result = await sendTestNotifications(config);
        return c.json({
            success: true,
            data: {
                ...result,
                checkedAt: nowIso()
            }
        });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

// 8. PUBLIC: GET /install (v1.5.6 Optimized)
vps.get('/install', async (c) => {
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
    const db = c.env.MIPULSE_DB;
    const nodeId = (c.req.query('nodeId') || '').trim();
    const secret = (c.req.query('secret') || '').trim();
    if (!nodeId || !secret) return c.json({ error: 'Missing params' }, 400);

    const node = await db.prepare('SELECT id, name, secret FROM vps_nodes WHERE LOWER(id) = LOWER(?)').bind(nodeId).first();
    if (!node || node.secret !== secret) return c.json({ error: 'Invalid node or secret' }, 401);

    const apiOrigin = new URL(c.req.url).origin;

    const reporterScript = [
        '#!/bin/bash',
        'LOG="/opt/mipulse/reporter.log"',
        'last_log_rotation=$(date +%s)',
        'echo "[$(date)] MiPulse Reporter started. v1.7.4 URL=$MIPULSE_URL ID=$MIPULSE_ID" >> "$LOG"',
        '',
        'targets=()',
        'fetch_targets() {',
        '  local resp=$(curl -sSL --connect-timeout 10 -m 30 -H "x-node-id: $MIPULSE_ID" -H "x-node-secret: $MIPULSE_SECRET" "$MIPULSE_URL/api/vps/probe/targets?nodeId=$MIPULSE_ID&secret=$MIPULSE_SECRET")',
        '  if echo "$resp" | grep -q \'"success":true\'; then',
        '    local t_str=$(echo "$resp" | awk -F\'"targets"[[:space:]]*:[[:space:]]*\\[\' \'{print $2}\' | awk -F\'\\]\' \'{print $1}\')',
        '    targets=($(echo "$t_str" | tr -d \'"\' | tr \',\' \' \'))',
        '    echo "[$(date)] Targets updated: ${targets[*]}" >> "$LOG"',
        '  else',
        '    echo "[$(date)] Targets update failed. Response: $resp" >> "$LOG"',
        '  fi',
        '}',
        '',
        'submit_forced_checks() {',
        '  local check_lines=$(curl -sSL --connect-timeout 10 -m 30 -H "x-node-id: $MIPULSE_ID" -H "x-node-secret: $MIPULSE_SECRET" "$MIPULSE_URL/api/vps/probe/checks.txt?nodeId=$MIPULSE_ID&secret=$MIPULSE_SECRET")',
        '  [[ -z "$check_lines" ]] && return 0',
        '  while IFS="|" read -r target_id target_type target_host target_scheme target_port target_path; do',
        '    [[ -z "$target_id" ]] && continue',
        '    check_url=""',
        '    latency=0',
        '    code=0',
        '    status="unreachable"',
        '    mode="probe"',
        '    started=$(date +%s)',
        '    if [[ "$target_type" == "icmp" ]]; then',
        '      mode="icmp"',
        '      check_url="$target_host"',
        '      if command -v ping >/dev/null 2>&1; then',
        '        ping_out=$(ping -c 1 -W 2 "$target_host" 2>/dev/null || true)',
        '        avg=$(echo "$ping_out" | grep -o "time=[0-9.]*" | cut -d= -f2 | tr -d "\r")',
        '        if [[ -n "$avg" ]]; then status="reachable"; latency=${avg%.*}; [[ -z "$latency" ]] && latency=1; code=200; fi',
        '      fi',
        '    elif [[ "$target_type" == "tcp" ]]; then',
        '      mode="tcp"',
        '      tcp_port=${target_port:-80}',
        '      check_url="tcp://$target_host:$tcp_port"',
        '      if timeout 5 bash -c "</dev/tcp/$target_host/$tcp_port" >/dev/null 2>&1; then status="reachable"; code=200; fi',
        '    else',
        '      mode="http"',
        '      check_url="https://$target_host"',
        '      [[ -n "$target_scheme" ]] && check_url="$target_scheme://$target_host"',
        '      [[ -n "$target_port" ]] && check_url="$check_url:$target_port"',
        '      [[ -n "$target_path" ]] && check_url="$check_url$target_path"',
        '      code=$(curl -o /dev/null -s -w "%{http_code}" --connect-timeout 5 -m 10 -I "$check_url" 2>/dev/null || echo 000)',
        '      if [[ "$code" != "000" ]]; then status="reachable"; fi',
        '    fi',
        '    ended=$(date +%s)',
        '    if [[ "$latency" -eq 0 ]]; then latency=$(( (ended-started) * 1000 )); fi',
        '    payload="{\"checks\":[{\"targetId\":\"$target_id\",\"nodeId\":\"$MIPULSE_ID\",\"status\":\"$status\",\"statusCode\":${code:-0},\"latencyMs\":${latency:-0},\"checkedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"mode\":\"$mode\",\"url\":\"$check_url\"}]}"',
        '    curl -sS --connect-timeout 10 -m 30 -X POST "$MIPULSE_URL/api/vps/probe/check-results" -H "Content-Type: application/json" -H "x-node-id: $MIPULSE_ID" -H "x-node-secret: $MIPULSE_SECRET" -d "$payload" >/dev/null 2>&1 || true',
        '    echo "[$(date)] Forced check $target_id => $status ($latency ms)" >> "$LOG"',
        '  done <<< "$check_lines"',
        '}',
        '',
        'fetch_targets',
        'last_target_update=$(date +%s)',
        'last_forced_check_poll=$(date +%s)',
        '',
        'while true; do',
        '  now=$(date +%s)',
        '  if (( now - last_target_update > 300 )); then fetch_targets; last_target_update=$now; fi',
        '  if (( now - last_forced_check_poll > 20 )); then submit_forced_checks; last_forced_check_poll=$now; fi',
        '  ',
        '  cpu_percent="0.00"',
        '  if [[ -f /proc/stat ]]; then',
        '    read -r c_name u_n s_n s_s i_e i_w i_q s_q s_l _ < <(grep "^cpu " /proc/stat)',
        '    t1=$((u_n+s_n+s_s+i_e+i_w+i_q+s_q+s_l))',
        '    i1=$((i_e+i_w))',
        '    sleep 2',
        '    read -r c_name u_n s_n s_s i_e i_w i_q s_q s_l _ < <(grep "^cpu " /proc/stat)',
        '    t2=$((u_n+s_n+s_s+i_e+i_w+i_q+s_q+s_l))',
        '    i2=$((i_e+i_w))',
        '    dt=$((t2-t1)); di=$((i2-i1))',
        '    if [[ $dt -gt 0 ]]; then',
        '       cpu_percent=$(awk -v d="$dt" -v i="$di" \'BEGIN {printf "%.2f", 100*(d-i)/d}\' 2>/dev/null | tr -d \'\n\r\')',
        '    fi',
        '  fi',
        '  ',
        '  mt=$(awk \'/^MemTotal:/{print $2}\' /proc/meminfo 2>/dev/null | tr -d \'\n\r\' || echo 0)',
        '  ma=$(awk \'/^MemAvailable:/{print $2}\' /proc/meminfo 2>/dev/null | tr -d \'\n\r\' || echo 0)',
        '  mem_percent=0; [[ "$mt" -gt 0 ]] && mem_percent=$(awk -v t="$mt" -v a="$ma" \'BEGIN {printf "%d", 100*(t-a)/t}\' 2>/dev/null | tr -d \'\n\r\')',
        '  disk_percent=$(df / 2>/dev/null | awk \'NR==2{gsub(/%/,\"\",$5); print $5}\' | tr -d \'\n\r\') || disk_percent=0',
        '  load1="0.00"; [[ -f /proc/loadavg ]] && read -r load1 _ < /proc/loadavg',
        '  up=0; [[ -f /proc/uptime ]] && read -r up _ < /proc/uptime; uptime_sec=$(echo "$up" | cut -d. -f1 | tr -d \'\n\r\')',
        '  ',
        '  # 优化网卡流量统计：优先找默认路由主网卡，排除虚拟接口',
        '  main_iface=$(ip route | grep default | awk \'{print $5}\' | head -n 1)',
        '  if [[ -z "$main_iface" ]]; then',
        '    # 回退逻辑：排除常见虚拟接口',
        '    rx=$(awk \'NR>2 && $1 !~ /lo|veth|docker|br-|tun|tap|any/{gsub(/:/,\" \",$1); sum+=$2} END{printf "%.0f", sum}\' /proc/net/dev 2>/dev/null | tr -d \'\n\r\' || echo 0)',
        '    tx=$(awk \'NR>2 && $1 !~ /lo|veth|docker|br-|tun|tap|any/{gsub(/:/,\" \",$1); sum+=$10} END{printf "%.0f", sum}\' /proc/net/dev 2>/dev/null | tr -d \'\n\r\' || echo 0)',
        '  else',
        '    # 精确统计主网卡',
        '    rx=$(awk -v iface="$main_iface" \'$1 ~ iface":" {print $2}\' /proc/net/dev 2>/dev/null | tr -d \'\n\r\' || echo 0)',
        '    tx=$(awk -v iface="$main_iface" \'$1 ~ iface":" {print $10}\' /proc/net/dev 2>/dev/null | tr -d \'\n\r\' || echo 0)',
        '  fi',
        '  ',
        '  latency_ms=0; latency_sum=0; latency_count=0; unreachable_count=0; checks_json=""',
        '  for t in "${targets[@]}"; do',
        '    # 测量 DNS 解析时间 + ICMP ping 延迟',
        '    raw_p=$(ping -c 3 -W 2 "$t" 2>&1); ping_out=$(echo "$raw_p" | tail -n 1)',
        '    avg=0; if [[ "$ping_out" == *"/"* ]]; then',
        '      avg=$(echo "$ping_out" | awk -F\'/\' \'{if (NF >= 7) print $(NF-2); else if (NF >= 5) print $(NF-1); else print "0"}\' | sed \'s/[^0-9.]//g\' | tr -d \'\n\r\')',
        '      if [[ -z "$avg" ]] || [[ "$avg" == "0" ]]; then avg=$(echo "$ping_out" | sed \'s/.*= *//\' | cut -d/ -f2 | awk \'{print $1}\' | tr -d " ms" | tr -d \'\n\r\'); fi',
        '    fi',
        '    # 如果 ping 失败，尝试 TCP 连接（包含 DNS 解析）',
        '    if [[ -z "$avg" ]] || [[ "$avg" == "0" ]]; then',
        '      tcp_lat=$(curl -o /dev/null -s -w "%{time_total}" --connect-timeout 2 "https://$t" 2>/dev/null) || tcp_lat=""',
        '      if [[ -z "$tcp_lat" ]] || [[ "$tcp_lat" == "0.000" ]]; then',
        '        tcp_lat=$(curl -o /dev/null -s -w "%{time_total}" --connect-timeout 2 "http://$t" 2>/dev/null) || tcp_lat=""',
        '      fi',
        '      if [[ ! -z "$tcp_lat" ]] && [[ "$tcp_lat" != "0.000" ]]; then avg=$(awk -v t="$tcp_lat" \'BEGIN {printf "%.2f", t * 1000}\' 2>/dev/null | tr -d \'\n\r\'); fi',
        '    fi',
        '    if [[ ! -z "$avg" ]] && [[ "$avg" != "0" ]]; then',
        '      latency_sum=$(awk -v s="$latency_sum" -v a="$avg" \'BEGIN {print s + a}\' 2>/dev/null | tr -d \'\n\r\')',
        '      latency_count=$((latency_count + 1))',
        '      comma=""; [[ ! -z "$checks_json" ]] && comma=","; checks_json="${checks_json}${comma}{\\\"name\\\":\\\"$t\\\",\\\"latencyMs\\\":$avg,\\\"loss\\\":0}"',
        '    else',
        '      unreachable_count=$((unreachable_count + 1))',
        '      comma=""; [[ ! -z "$checks_json" ]] && comma=","; checks_json="${checks_json}${comma}{\\\"name\\\":\\\"$t\\\",\\\"latencyMs\\\":0,\\\"loss\\\":100}"',
        '    fi',
        '  done',
        '  [[ $latency_count -gt 0 ]] && latency_ms=$(awk -v s="$latency_sum" -v c="$latency_count" \'BEGIN {printf "%.2f", s / c}\' 2>/dev/null | tr -d \'\n\r\')',
        '  target_count=${#targets[@]}',
        '  loss_percent=0; [[ $target_count -gt 0 ]] && loss_percent=$((100 * unreachable_count / target_count))',
        '  ',
        '  os_info="Linux"; [[ -f /etc/os-release ]] && os_info=$(. /etc/os-release && echo "$PRETTY_NAME")',
        '  os_pretty=$(echo "$os_info" | tr -d \'"\' | tr -d \'\n\r\')',
        '  json="{\\\"cpuPercent\\\":\\\"$cpu_percent\\\",\\\"memPercent\\\":${mem_percent:-0},\\\"diskPercent\\\":${disk_percent:-0},\\\"uptimeSec\\\":${uptime_sec:-0},\\\"load1\\\":\\\"${load1:-0.00}\\\",\\\"latencyMs\\\":${latency_ms:-0},\\\"lossPercent\\\":${loss_percent:-0},\\\"checks\\\":[$checks_json],\\\"traffic\\\":{\\\"rx\\\":${rx:-0},\\\"tx\\\":${tx:-0}},\\\"meta\\\":{\\\"os\\\":\\\"$os_pretty\\\",\\\"version\\\":\\\"vBash-1.7.4\\\"}}"',
        '  resp=$(curl -sS --connect-timeout 10 -m 30 -X POST "$MIPULSE_URL/api/vps/report" -H "Content-Type: application/json" -H "x-node-id: $MIPULSE_ID" -H "x-node-secret: $MIPULSE_SECRET" -d "$json" 2>&1) || true',
        '  echo "[$(date)] CPU=$cpu_percent MEM=$mem_percent LAT=$latency_ms LOSS=$loss_percent% $resp" >> "$LOG"',
        '  # 日志轮转：每小时或超过 5000 行时执行',
        '  now=$(date +%s)',
        '  log_lines=$(wc -l < "$LOG" 2>/dev/null || echo 0)',
        '  if (( now - last_log_rotation > 3600 )) || (( log_lines > 5000 )); then',
        '    tail -300 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG" 2>/dev/null',
        '    last_log_rotation=$now',
        '  fi',
        '  sleep 55',
        'done',
    ].join('\n');

    const script = `#!/bin/bash
echo "# MiPulse Probe Universal Installer (Bash v1.7.4)"
echo "=========================================="
echo "  MiPulse Universal Bash Probe v1.7.4"

echo "=========================================="
if [[ $EUID -ne 0 ]]; then echo "Error: must be root"; exit 1; fi
mkdir -p /opt/mipulse && cd /opt/mipulse
echo "Downloading reporter script..."
cat > /opt/mipulse/reporter.sh << 'REPORTER_EOF'
${reporterScript}
REPORTER_EOF
chmod +x /opt/mipulse/reporter.sh
cat > /etc/systemd/system/mipulse-probe.service << SVCEOF
[Unit]
Description=MiPulse VPS Bash Probe
After=network.target
[Service]
Type=simple
User=root
WorkingDirectory=/opt/mipulse
ExecStart=/bin/bash /opt/mipulse/reporter.sh
Restart=always
RestartSec=10
Environment=MIPULSE_URL=${apiOrigin}
Environment=MIPULSE_ID=${nodeId}
Environment=MIPULSE_SECRET=${secret}
[Install]
WantedBy=multi-user.target
SVCEOF
systemctl daemon-reload
systemctl enable mipulse-probe
systemctl restart mipulse-probe
echo "=========================================="
echo "  MiPulse Bash Probe v1.7.4 installed!"
echo "  Debug log: cat /opt/mipulse/reporter.log"
echo "=========================================="
`;
    return c.text(script);
});

vps.get('/uninstall', async (c) => {
    const script = `#!/bin/bash
echo "Uninstalling MiPulse Probe..."
systemctl stop mipulse-probe || true
systemctl disable mipulse-probe || true
rm -f /etc/systemd/system/mipulse-probe.service
systemctl daemon-reload
rm -rf /opt/mipulse
echo "Uninstallation complete."
`;
    return c.text(script);
});

export default vps;
