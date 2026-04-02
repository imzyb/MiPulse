import { Hono } from 'hono';

const vps = new Hono();

// --- Utilities ---
const REPORTS_MAX_KEEP = 5000;
const ALERTS_MAX_KEEP = 1000;

function nowIso() { return new Date().toISOString(); }
function isoFromMs(ms) { return new Date(ms).toISOString(); }
function normalizeString(val) { return (val === null || val === undefined) ? '' : String(val).trim(); }

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

// --- Routes ---

// 1. PUBLIC: GET /api/vps/public (Public Dashboard)
vps.get('/public', async (c) => {
    const db = c.env.MIPULSE_DB;
    const kv = c.env.MIPULSE_KV;
    const cacheKey = 'cache:public_nodes';
    
    // Check KV Cache first
    if (kv) {
        try {
            const cached = await kv.get(cacheKey);
            if (cached) {
                console.log('[API] Serving from KV cache...');
                return c.json(JSON.parse(cached));
            }
        } catch (e) {
            console.warn('[KV Cache Error]', e.message);
        }
    }

    try {
        console.log('[API] Fetching public nodes from D1...');
        const { results: nodes } = await db.prepare(`
            SELECT id, name, region, country_code AS countryCode, status, last_seen_at AS lastSeenAt, 
                   tag, group_tag AS groupTag, last_report_json AS lastReport, total_rx AS totalRx, total_tx AS totalTx 
            FROM vps_nodes 
            WHERE enabled = 1 
            ORDER BY name ASC
        `).all();

        const { results: latencyRows } = await db.prepare(`
            SELECT node_id, json_extract(data, '$.latencyMs') as latencyMs, reported_at AS reportedAt 
            FROM (
                SELECT node_id, data, reported_at,
                       ROW_NUMBER() OVER(PARTITION BY node_id ORDER BY reported_at DESC) as rn
                FROM vps_reports
                WHERE reported_at > datetime('now', '-24 hours')
            ) WHERE rn <= 20
        `).all();

        const latencyMap = {};
        latencyRows.forEach(r => {
            if (!latencyMap[r.node_id]) latencyMap[r.node_id] = [];
            latencyMap[r.node_id].push(r.latencyMs);
        });

        const data = nodes.map(n => ({
            ...n,
            latency: latencyMap[n.id] || [],
            latest: n.lastReport ? JSON.parse(n.lastReport) : null
        }));

        const result = { success: true, nodes: data };
        
        // Store in KV Cache for 60s if available
        if (kv) {
            try {
                await kv.put(cacheKey, JSON.stringify(result), { expirationTtl: 60 });
            } catch (e) {
                console.warn('[KV Cache Put Error]', e.message);
            }
        }
        
        return c.json(result);
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

// 2. PROBE: POST /api/vps/report (Health Check)
vps.post('/report', async (c) => {
    const db = c.env.MIPULSE_DB;
    const nodeId = c.req.header('x-node-id');
    const secret = c.req.header('x-node-secret');
    const signature = c.req.header('x-node-signature');
    const timestamp = c.req.header('x-node-timestamp');
    const payload = await c.req.json();

    if (!nodeId) return c.json({ error: 'Missing x-node-id' }, 400);

    const node = await db.prepare('SELECT id, secret, last_report_json AS lastReport, last_seen_at AS lastSeenAt, country_code FROM vps_nodes WHERE id = ?').bind(nodeId).first();
    if (!node) return c.json({ error: 'Node not found' }, 404);

    if (node.secret) {
        if (signature && timestamp) {
            const expectedSig = await computeSignature(node.secret, nodeId, timestamp, JSON.stringify(payload));
            if (expectedSig !== signature) return c.json({ error: 'Invalid signature' }, 401);
        } else if (node.secret !== secret) {
            return c.json({ error: 'Invalid secret' }, 401);
        }
    }

    const report = payload?.report || payload;
    const receivedAt = nowIso();
    const reportedAt = normalizeReportTimestamp(report.ts || report.timestamp, receivedAt);

    const lastRep = node.lastReport ? JSON.parse(node.lastReport) : {};
    const rxDelta = Math.max(0, Number(report.traffic?.rx || 0) - Number(lastRep.traffic?.rx || 0));
    const txDelta = Math.max(0, Number(report.traffic?.tx || 0) - Number(lastRep.traffic?.tx || 0));

    const timeDelta = (new Date(reportedAt).getTime() - (node.lastSeenAt ? new Date(node.lastSeenAt).getTime() : 0)) / 1000;
    if (timeDelta > 0 && timeDelta < 3600) {
        report.traffic.rxSpeed = rxDelta / timeDelta;
        report.traffic.txSpeed = txDelta / timeDelta;
    }

    try {
        await db.batch([
            db.prepare(`
                UPDATE vps_nodes SET 
                    status = 'online', last_seen_at = ?, last_report_json = ?, 
                    total_rx = total_rx + ?, total_tx = total_tx + ?,
                    country_code = COALESCE(?, country_code)
                WHERE id = ?
            `).bind(reportedAt, JSON.stringify(report), rxDelta, txDelta, c.req.raw.cf?.country || null, nodeId),
            db.prepare(`
                INSERT INTO vps_reports (id, node_id, data, reported_at)
                VALUES (?, ?, ?, ?)
            `).bind(crypto.randomUUID(), nodeId, JSON.stringify({
                cpuPercent: report.cpuPercent || 0, 
                memPercent: report.memPercent || 0, 
                diskPercent: report.diskPercent || 0,
                load1: report.load1 || 0, 
                latencyMs: report.latencyMs || 0
            }), reportedAt)
        ]);
        return c.json({ success: true, timestamp: reportedAt });
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

// --- ADMIN MANAGEMENT ROUTES (Protected by Auth) ---

// 3. ADMIN: GET/POST /nodes
vps.get('/nodes', async (c) => {
    const db = c.env.MIPULSE_DB;
    try {
        const { results } = await db.prepare(`
            SELECT id, name, tag, group_tag AS groupTag, region, country_code AS countryCode, 
                   description, secret, status, enabled AS isPublic, 
                   total_rx AS totalRx, total_tx AS totalTx, last_seen_at AS lastSeenAt, 
                   last_report_json AS lastReport, created_at, updated_at 
            FROM vps_nodes ORDER BY name ASC
        `).all();
        return c.json({ success: true, nodes: results.map(n => ({ ...n, latest: n.lastReport ? JSON.parse(n.lastReport) : null })) });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.post('/nodes', async (c) => {
    const db = c.env.MIPULSE_DB;
    const body = await c.req.json();
    const id = crypto.randomUUID();
    const secret = body.secret || Math.random().toString(36).substring(2, 15);
    try {
        await db.prepare(`
            INSERT INTO vps_nodes (id, name, tag, group_tag, region, enabled, secret, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'offline')
        `).bind(id, body.name, body.tag || '', body.groupTag || 'Default', body.region || 'Global', body.isPublic ? 1 : 0, secret).run();
        return c.json({ success: true, node: { id, secret } });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

// 4. ADMIN: GET/PUT/DELETE /nodes/:id
vps.get('/nodes/:id', async (c) => {
    const db = c.env.MIPULSE_DB;
    const id = c.req.param('id');
    try {
        const node = await db.prepare(`
            SELECT *, group_tag AS groupTag, country_code AS countryCode, enabled AS isPublic, 
                   total_rx AS totalRx, total_tx AS totalTx, last_seen_at AS lastSeenAt, last_report_json AS lastReport 
            FROM vps_nodes WHERE id = ?
        `).bind(id).first();
        if (!node) return c.json({ error: 'Not found' }, 404);
        return c.json({ success: true, node: { ...node, latest: node.lastReport ? JSON.parse(node.lastReport) : null } });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.put('/nodes/:id', async (c) => {
    const db = c.env.MIPULSE_DB;
    const id = c.req.param('id');
    const body = await c.req.json();
    try {
        await db.prepare(`
            UPDATE vps_nodes SET 
                name = ?, tag = ?, group_tag = ?, region = ?, enabled = ?, secret = ?, updated_at = datetime('now')
            WHERE id = ?
        `).bind(body.name, body.tag || '', body.groupTag || 'Default', body.region || 'Global', body.isPublic ? 1 : 0, body.secret, id).run();
        return c.json({ success: true });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.delete('/nodes/:id', async (c) => {
    const db = c.env.MIPULSE_DB;
    const id = c.req.param('id');
    try {
        await db.batch([
            db.prepare('DELETE FROM vps_nodes WHERE id = ?').bind(id),
            db.prepare('DELETE FROM vps_reports WHERE node_id = ?').bind(id),
            db.prepare('DELETE FROM vps_alerts WHERE node_id = ?').bind(id),
            db.prepare('DELETE FROM vps_network_targets WHERE node_id = ?').bind(id)
        ]);
        return c.json({ success: true });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

// 5. ADMIN: GET/DELETE /alerts
vps.get('/alerts', async (c) => {
    const db = c.env.MIPULSE_DB;
    try {
        const { results } = await db.prepare('SELECT id, node_id, type, message, created_at AS createdAt FROM vps_alerts ORDER BY created_at DESC LIMIT 100').all();
        return c.json({ success: true, alerts: results });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.delete('/alerts', async (c) => {
    const db = c.env.MIPULSE_DB;
    try {
        await db.prepare('DELETE FROM vps_alerts').run();
        return c.json({ success: true });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

// 6. ADMIN: GET/POST/PUT/DELETE /targets
vps.get('/targets', async (c) => {
    const db = c.env.MIPULSE_DB;
    const nodeId = c.req.query('nodeId');
    try {
        const { results } = await db.prepare('SELECT * FROM vps_network_targets WHERE node_id = ? ORDER BY created_at DESC').bind(nodeId).all();
        return c.json({ success: true, targets: results });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.post('/targets', async (c) => {
    const db = c.env.MIPULSE_DB;
    const body = await c.req.json();
    const id = crypto.randomUUID();
    try {
        await db.prepare(`
            INSERT INTO vps_network_targets (id, node_id, type, target, name, scheme, port, path, enabled)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(id, body.nodeId, body.type, body.target, body.name, body.scheme || '', body.port || 0, body.path || '', 1).run();
        return c.json({ success: true, target: { id } });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.put('/targets/:id', async (c) => {
    const db = c.env.MIPULSE_DB;
    const id = c.req.param('id');
    const body = await c.req.json();
    try {
        await db.prepare(`
            UPDATE vps_network_targets SET 
                type = ?, target = ?, name = ?, scheme = ?, port = ?, path = ?, enabled = ?, updated_at = datetime('now')
            WHERE id = ?
        `).bind(body.type, body.target, body.name, body.scheme || '', body.port || 0, body.path || '', body.enabled ? 1 : 0, id).run();
        return c.json({ success: true });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.delete('/targets/:id', async (c) => {
    const db = c.env.MIPULSE_DB;
    const id = c.req.param('id');
    try {
        await db.prepare('DELETE FROM vps_network_targets WHERE id = ?').bind(id).run();
        return c.json({ success: true });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

// 7. ADMIN: GET/POST /settings
vps.get('/settings', async (c) => {
    const db = c.env.MIPULSE_DB;
    try {
        const { results } = await db.prepare('SELECT key, value FROM settings').all();
        const settings = {};
        results.forEach(r => settings[r.key] = r.key.endsWith('_json') ? JSON.parse(r.value) : r.value);
        return c.json({ success: true, settings });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.post('/settings', async (c) => {
    const db = c.env.MIPULSE_DB;
    const body = await c.req.json();
    try {
        const queries = Object.entries(body).map(([k, v]) => {
            const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
            return db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime("now"))').bind(k, val);
        });
        await db.batch(queries);
        return c.json({ success: true });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

export default vps;
