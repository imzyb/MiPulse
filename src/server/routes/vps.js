import { Hono } from 'hono';

const vps = new Hono();

// --- Utilities ---
function nowIso() { return new Date().toISOString(); }
function isoFromMs(ms) { return new Date(ms).toISOString(); }

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

function buildTargetUrl(target) {
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

async function sendTelegramNotification(config, text, fetchImpl = fetch) {
    const response = await fetchImpl(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: config.telegram.chatId,
            text
        })
    });
    if (!response.ok) {
        throw new Error(`Telegram request failed with ${response.status}`);
    }
    return { channel: 'telegram' };
}

async function sendWebhookNotification(config, text, fetchImpl = fetch) {
    const response = await fetchImpl(config.webhook.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            source: 'MiPulse',
            type: 'test',
            message: text,
            timestamp: nowIso()
        })
    });
    if (!response.ok) {
        throw new Error(`Webhook request failed with ${response.status}`);
    }
    return { channel: 'webhook' };
}

async function sendAppPushNotification(config, text, fetchImpl = fetch) {
    const response = await fetchImpl('https://www.pushplus.plus/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            token: config.pushplus.token,
            title: 'MiPulse Test Notification',
            content: text,
            template: 'txt'
        })
    });
    if (!response.ok) {
        throw new Error(`App push request failed with ${response.status}`);
    }

    const payload = await response.json().catch(() => null);
    if (payload && payload.code && payload.code !== 200) {
        throw new Error(payload.msg || 'App push rejected the request');
    }
    return { channel: 'appPush' };
}

export async function sendTestNotifications(config, fetchImpl = fetch) {
    const text = `MiPulse test notification\nTime: ${nowIso()}`;
    const jobs = [];

    if (config.notificationEnabled && config.telegram?.enabled && config.telegram?.botToken && config.telegram?.chatId) {
        jobs.push(sendTelegramNotification(config, text, fetchImpl));
    }
    if (config.notificationEnabled && config.webhook?.enabled && config.webhook?.url) {
        jobs.push(sendWebhookNotification(config, text, fetchImpl));
    }
    if (config.notificationEnabled && config.pushplus?.enabled && config.pushplus?.token) {
        jobs.push(sendAppPushNotification(config, text, fetchImpl));
    }

    const results = await Promise.allSettled(jobs);
    const channels = results.map((result) => result.status === 'fulfilled'
        ? { ok: true, channel: result.value.channel }
        : { ok: false, error: result.reason?.message || 'Notification failed' });
    return {
        successCount: channels.filter((item) => item.ok).length,
        failureCount: channels.filter((item) => !item.ok).length,
        channels
    };
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
    const cacheKey = 'cache:public_nodes';
    if (kv) { try { const cached = await kv.get(cacheKey); if (cached) return c.json(JSON.parse(cached)); } catch (e) {} }
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
        if (kv) { try { await kv.put(cacheKey, JSON.stringify(result), { expirationTtl: 60 }); } catch (e) {} }
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
    const rxDelta = Math.max(0, Number(report.traffic?.rx || 0) - Number(lastRep.traffic?.rx || 0));
    const txDelta = Math.max(0, Number(report.traffic?.tx || 0) - Number(lastRep.traffic?.tx || 0));
    const timeDelta = (new Date(reportedAt).getTime() - (node.lastSeenAt ? new Date(node.lastSeenAt).getTime() : 0)) / 1000;
    if (!report.traffic) report.traffic = { rx: 0, tx: 0 };
    report.traffic.rxSpeed = (timeDelta > 0 && timeDelta < 3600) ? rxDelta / timeDelta : 0;
    report.traffic.txSpeed = (timeDelta > 0 && timeDelta < 3600) ? txDelta / timeDelta : 0;
    const connectingIp = c.req.header('cf-connecting-ip');
    const country = c.req.header('cf-ipcountry') || c.req.raw.cf?.country || null;
    if (connectingIp) { if (!report.meta) report.meta = {}; report.meta.publicIp = connectingIp; }
    try {
        await db.batch([
            db.prepare(`UPDATE vps_nodes SET status = 'online', last_seen_at = ?, last_report_json = ?, total_rx = total_rx + ?, total_tx = total_tx + ?, country_code = COALESCE(?, country_code) WHERE id = ?`).bind(reportedAt, JSON.stringify(report), rxDelta, txDelta, country, node.id),
            db.prepare(`INSERT INTO vps_reports (id, node_id, data, reported_at) VALUES (?, ?, ?, ?)`).bind(crypto.randomUUID(), node.id, JSON.stringify({ 
                cpuPercent: report.cpuPercent || 0, 
                memPercent: report.memPercent || 0, 
                diskPercent: report.diskPercent || 0, 
                load1: report.load1 || 0, 
                latencyMs: report.latencyMs || 0,
                lossPercent: report.lossPercent || 0,
                checks: report.checks || []
            }), reportedAt)
        ]);
        const kv = c.env.MIPULSE_KV; 
        return c.json({ success: true, timestamp: reportedAt });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.get('/nodes', async (c) => {
    const db = c.env.MIPULSE_DB;
    try {
        const { results } = await db.prepare('SELECT id, name, tag, group_tag AS groupTag, region, country_code AS countryCode, secret, status, enabled, network_monitor_enabled AS networkMonitorEnabled, last_report_json AS lastReport FROM vps_nodes ORDER BY name ASC').all();
        return c.json({ success: true, data: results.map(n => ({ ...n, enabled: !!n.enabled, networkMonitorEnabled: !!n.networkMonitorEnabled, latest: safeJsonParse(n.lastReport, null) })), nodes: results.map(n => ({ ...n, enabled: !!n.enabled, networkMonitorEnabled: !!n.networkMonitorEnabled, latest: safeJsonParse(n.lastReport, null) })) });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.post('/nodes', async (c) => {
    const db = c.env.MIPULSE_DB;
    const body = await c.req.json();
    const id = crypto.randomUUID(); const secret = body.secret || generateUnambiguousSecret(12);
    try {
        await db.prepare('INSERT INTO vps_nodes (id, name, tag, group_tag, region, enabled, secret, status) VALUES (?, ?, ?, ?, ?, ?, ?, "offline")').bind(id, body.name, body.tag || '', body.groupTag || 'Default', body.region || 'Global', body.enabled ? 1 : 0, secret).run();
        return c.json({ success: true, node: { id, secret }, guide: buildGuide(new URL(c.req.url).origin, id, secret) });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
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
    const db = c.env.MIPULSE_DB; const id = c.req.param('id'); const body = await c.req.json(); const apiOrigin = new URL(c.req.url).origin;
    try {
        if (body.resetSecret) { const newSecret = generateUnambiguousSecret(12); await db.prepare("UPDATE vps_nodes SET secret = ?, updated_at = datetime('now') WHERE id = ?").bind(newSecret, id).run(); return c.json({ success: true, guide: buildGuide(apiOrigin, id, newSecret) }); }
        await db.prepare('UPDATE vps_nodes SET name = ?, tag = ?, group_tag = ?, region = ?, enabled = ?, secret = ?, network_monitor_enabled = ?, updated_at = datetime("now") WHERE id = ?').bind(body.name, body.tag || '', body.groupTag || 'Default', body.region || 'Global', body.enabled ? 1 : 0, body.secret, body.networkMonitorEnabled ? 1 : 0, id).run();
        return c.json({ success: true, guide: buildGuide(apiOrigin, id, body.secret) });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.delete('/nodes/:id', async (c) => {
    const db = c.env.MIPULSE_DB; const id = c.req.param('id');
    try { await db.batch([ db.prepare('DELETE FROM vps_nodes WHERE id = ?').bind(id), db.prepare('DELETE FROM vps_reports WHERE node_id = ?').bind(id), db.prepare('DELETE FROM vps_network_targets WHERE node_id = ?').bind(id) ]); return c.json({ success: true }); } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.get('/targets', async (c) => {
    const db = c.env.MIPULSE_DB;
    try {
        const nodeId = c.req.query('nodeId');
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
        return c.json({ success: true, data: normalizedTargets, targets: normalizedTargets });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.post('/targets', async (c) => {
    const db = c.env.MIPULSE_DB; const body = await c.req.json(); try { await db.prepare('INSERT INTO vps_network_targets (id, node_id, type, target, name, enabled) VALUES (?, ?, ?, ?, ?, 1)').bind(crypto.randomUUID(), body.nodeId, body.type, body.target, body.name).run(); return c.json({ success: true }); } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.put('/targets/:id', async (c) => {
    const db = c.env.MIPULSE_DB;
    const id = c.req.param('id');
    const body = await c.req.json();
    try {
        const existing = await db.prepare('SELECT * FROM vps_network_targets WHERE id = ?').bind(id).first();
        if (!existing) return c.json({ success: false, error: 'Target not found' }, 404);
        const next = {
            type: body.type ?? existing.type,
            target: body.target ?? existing.target,
            name: body.name ?? existing.name,
            scheme: body.scheme ?? existing.scheme,
            port: body.port ?? existing.port,
            path: body.path ?? existing.path,
            enabled: body.enabled === undefined ? existing.enabled : (body.enabled ? 1 : 0)
        };
        await db.prepare('UPDATE vps_network_targets SET type = ?, target = ?, name = ?, scheme = ?, port = ?, path = ?, enabled = ?, updated_at = datetime("now") WHERE id = ?')
            .bind(next.type, next.target, next.name, next.scheme, next.port, next.path, next.enabled, id)
            .run();
        return c.json({ success: true, data: { id, ...next, enabled: !!next.enabled } });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.delete('/targets/:id', async (c) => {
    const db = c.env.MIPULSE_DB; try { await db.prepare('DELETE FROM vps_network_targets WHERE id = ?').bind(c.req.param('id')).run(); return c.json({ success: true }); } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.post('/targets/check', async (c) => {
    const db = c.env.MIPULSE_DB;
    const body = await c.req.json();
    try {
        const target = await db.prepare('SELECT * FROM vps_network_targets WHERE id = ? AND node_id = ?').bind(body.targetId, body.nodeId).first();
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
        const { results } = await db.prepare('SELECT id, node_id AS nodeId, type, message, created_at AS createdAt FROM vps_alerts ORDER BY created_at DESC LIMIT 100').all();
        return c.json({ success: true, data: results, alerts: results });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.delete('/alerts', async (c) => {
    const db = c.env.MIPULSE_DB;
    try {
        await db.prepare('DELETE FROM vps_alerts').run();
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
        const statements = [];
        for (const check of checks) {
            if (!check?.targetId) continue;
            statements.push(
                db.prepare('INSERT INTO vps_network_samples (id, node_id, reported_at, data) VALUES (?, ?, ?, ?)')
                    .bind(crypto.randomUUID(), check.nodeId || node.id, nowIso(), JSON.stringify({ ...check, checkedAt: check.checkedAt || nowIso() }))
            );
            statements.push(
                db.prepare('UPDATE vps_network_targets SET force_check_at = NULL, updated_at = datetime("now") WHERE id = ?')
                    .bind(check.targetId)
            );
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
    const db = c.env.MIPULSE_DB; const body = await c.req.json(); 
    try { 
        const normalizedBody = body.vpsMonitor ? { vps_monitor_json: body.vpsMonitor } : body;
        const queries = Object.entries(normalizedBody).map(([k, v]) => { 
            const val = typeof v === 'object' ? JSON.stringify(v) : String(v); 
            return db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))').bind(k, val); 
        }); 
        await db.batch(queries); 
        // Invalidate public cache
        const kv = c.env.MIPULSE_KV; if (kv) { await kv.delete('cache:public_nodes'); }
        return c.json({ success: true, data: normalizedBody, settings: normalizedBody }); 
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
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
        'echo "[$(date)] MiPulse Reporter started. v1.7.2 URL=$MIPULSE_URL ID=$MIPULSE_ID" >> "$LOG"',
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
        '    # Use read builtin for stability',
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
        '  rx=$(awk \'NR>2 && $1 !~ /lo:/{gsub(/:/,\" \",$1); sum+=$2} END{print int(sum)}\' /proc/net/dev 2>/dev/null | tr -d \'\n\r\' || echo 0)',
        '  tx=$(awk \'NR>2 && $1 !~ /lo:/{gsub(/:/,\" \",$1); sum+=$10} END{print int(sum)}\' /proc/net/dev 2>/dev/null | tr -d \'\n\r\' || echo 0)',
        '  ',
        '  latency_ms=0; latency_sum=0; latency_count=0; loss_count=0; checks_json=""',
        '  for t in "${targets[@]}"; do',
        '    raw_p=$(ping -c 3 -W 2 "$t" 2>&1); ping_out=$(echo "$raw_p" | tail -n 1)',
        '    avg=0; if [[ "$ping_out" == *"/"* ]]; then',
        '      avg=$(echo "$ping_out" | awk -F\'/\' \'{if (NF >= 7) print $(NF-2); else if (NF >= 5) print $(NF-1); else print "0"}\' | sed \'s/[^0-9.]//g\' | tr -d \'\n\r\')',
        '      if [[ -z "$avg" ]] || [[ "$avg" == "0" ]]; then avg=$(echo "$ping_out" | sed \'s/.*= *//\' | cut -d/ -f2 | awk \'{print $1}\' | tr -d " ms" | tr -d \'\n\r\'); fi',
        '    fi',
        '    if [[ -z "$avg" ]] || [[ "$avg" == "0" ]]; then',
        '      tcp_lat=$(curl -o /dev/null -s -w "%{time_connect}\\n" --connect-timeout 2 "https://$t" 2>/dev/null) || tcp_lat=""',
        '      if [[ -z "$tcp_lat" ]] || [[ "$tcp_lat" == "0.000" ]]; then tcp_lat=$(curl -o /dev/null -s -w "%{time_connect}\\n" --connect-timeout 2 "http://$t" 2>/dev/null) || tcp_lat=""; fi',
        '      if [[ ! -z "$tcp_lat" ]] && [[ "$tcp_lat" != "0.000" ]]; then avg=$(awk -v t="$tcp_lat" \'BEGIN {printf "%.2f", t * 1000}\' 2>/dev/null | tr -d \'\n\r\'); fi',
        '    fi',
        '    if [[ ! -z "$avg" ]] && [[ "$avg" != "0" ]]; then',
        '      latency_sum=$(awk -v s="$latency_sum" -v a="$avg" \'BEGIN {print s + a}\' 2>/dev/null | tr -d \'\n\r\')',
        '      latency_count=$((latency_count + 1))',
        '      comma=""; [[ ! -z "$checks_json" ]] && comma=","; checks_json="${checks_json}${comma}{\\\"name\\\":\\\"$t\\\",\\\"latencyMs\\\":$avg,\\\"loss\\\":0}"',
        '    else',
        '      loss_count=$((loss_count + 1))',
        '      comma=""; [[ ! -z "$checks_json" ]] && comma=","; checks_json="${checks_json}${comma}{\\\"name\\\":\\\"$t\\\",\\\"latencyMs\\\":0,\\\"loss\\\":100}"',
        '    fi',
        '  done',
        '  [[ $latency_count -gt 0 ]] && latency_ms=$(awk -v s="$latency_sum" -v c="$latency_count" \'BEGIN {printf "%.2f", s / c}\' 2>/dev/null | tr -d \'\n\r\')',
        '  target_count=${#targets[@]}',
        '  loss_percent=0; [[ $target_count -gt 0 ]] && loss_percent=$((100 * loss_count / target_count))',
        '  ',
        '  os_info="Linux"; [[ -f /etc/os-release ]] && os_info=$(. /etc/os-release && echo "$PRETTY_NAME")',
        '  os_pretty=$(echo "$os_info" | tr -d \'"\' | tr -d \'\n\r\')',
        '  json="{\\\"cpuPercent\\\":\\\"$cpu_percent\\\",\\\"memPercent\\\":${mem_percent:-0},\\\"diskPercent\\\":${disk_percent:-0},\\\"uptimeSec\\\":${uptime_sec:-0},\\\"load1\\\":\\\"${load1:-0.00}\\\",\\\"latencyMs\\\":${latency_ms:-0},\\\"lossPercent\\\":${loss_percent:-0},\\\"checks\\\":[$checks_json],\\\"traffic\\\":{\\\"rx\\\":${rx:-0},\\\"tx\\\":${tx:-0}},\\\"meta\\\":{\\\"os\\\":\\\"$os_pretty\\\",\\\"version\\\":\\\"vBash-1.7.2\\\"}}"',
        '  resp=$(curl -sS --connect-timeout 10 -m 30 -X POST "$MIPULSE_URL/api/vps/report" -H "Content-Type: application/json" -H "x-node-id: $MIPULSE_ID" -H "x-node-secret: $MIPULSE_SECRET" -d "$json" 2>&1) || true',
        '  echo "[$(date)] CPU=$cpu_percent MEM=$mem_percent LAT=$latency_ms LOSS=$loss_percent% $resp" >> "$LOG"',
        '  tail -300 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG" 2>/dev/null',
        '  sleep 55',
        'done',
    ].join('\n');

    const script = `#!/bin/bash
echo "# MiPulse Probe Universal Installer (Bash v1.7.1)"
echo "=========================================="
echo "  MiPulse Universal Bash Probe v1.7.2"

echo "=========================================="
if [[ $EUID -ne 0 ]]; then echo "Error: must be root"; exit 1; fi
mkdir -p /opt/mipulse && cd /opt/mipulse
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
echo "  MiPulse Bash Probe v1.7.0 installed!"
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
