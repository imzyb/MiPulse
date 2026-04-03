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

function buildGuide(apiOrigin, nodeId, secret) {
    return {
        installCommand: `curl -sSL '${apiOrigin}/api/vps/install?nodeId=${nodeId}&secret=${secret}' | bash`,
        uninstallCommand: `curl -sSL '${apiOrigin}/api/vps/uninstall' | bash`
    };
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
    const rawBody = await c.req.text();
    let payload;
    try { payload = JSON.parse(rawBody); } catch(e) { return c.json({ error: 'Invalid JSON' }, 400); }
    const report = payload?.report || payload;

    const nodeId = c.req.header('x-node-id') || payload?.nodeId || payload?.id;
    const secret = c.req.header('x-node-secret') || payload?.nodeSecret || payload?.secret;
    const signature = c.req.header('x-node-signature');
    const timestamp = c.req.header('x-node-timestamp');

    if (!nodeId) return c.json({ error: 'Missing node id' }, 400);

    const node = await db.prepare('SELECT id, secret, last_report_json AS lastReport, last_seen_at AS lastSeenAt, country_code FROM vps_nodes WHERE id = ?').bind(nodeId).first();
    if (!node) return c.json({ error: 'Node not found' }, 404);

    if (node.secret) {
        if (signature && timestamp) {
            const expectedSig = await computeSignature(node.secret, nodeId, timestamp, rawBody);
            if (expectedSig !== signature) return c.json({ error: 'Invalid signature' }, 401);
        } else if (secret && node.secret !== secret) {
            return c.json({ error: 'Invalid secret' }, 401);
        }
    }

    const receivedAt = nowIso();
    const reportedAt = normalizeReportTimestamp(report.ts || report.timestamp, receivedAt);

    // Auto-detect IP and country via Cloudflare headers
    const connectingIp = c.req.header('cf-connecting-ip');
    const country = c.req.header('cf-ipcountry') || c.req.raw.cf?.country || null;
    if (connectingIp) {
        if (!report.meta) report.meta = {};
        report.meta.publicIp = connectingIp;
    }

    // Normalize metrics (additive)
    const cpuVal = report.cpuPercent ?? report.cpu_usage ?? report.cpu?.usage ?? 0;
    if (!report.cpu || typeof report.cpu !== 'object') report.cpu = {};
    report.cpu.usage = Number(cpuVal); report.cpuPercent = Number(cpuVal);

    const memVal = report.memPercent ?? report.memory_usage ?? report.mem?.usage ?? 0;
    if (!report.mem || typeof report.mem !== 'object') report.mem = {};
    report.mem.usage = Number(memVal); report.memPercent = Number(memVal);

    const dskVal = report.diskPercent ?? report.disk_usage ?? report.disk?.usage ?? 0;
    if (!report.disk || typeof report.disk !== 'object') report.disk = {};
    report.disk.usage = Number(dskVal); report.diskPercent = Number(dskVal);

    if (!report.traffic) report.traffic = { rx: 0, tx: 0 };
    const lastRep = node.lastReport ? JSON.parse(node.lastReport) : {};
    const rxDelta = Math.max(0, Number(report.traffic?.rx || 0) - Number(lastRep.traffic?.rx || 0));
    const txDelta = Math.max(0, Number(report.traffic?.tx || 0) - Number(lastRep.traffic?.tx || 0));

    const timeDelta = (new Date(reportedAt).getTime() - (node.lastSeenAt ? new Date(node.lastSeenAt).getTime() : 0)) / 1000;
    if (timeDelta > 0 && timeDelta < 3600) {
        report.traffic.rxSpeed = rxDelta / timeDelta;
        report.traffic.txSpeed = txDelta / timeDelta;
    } else {
        report.traffic.rxSpeed = 0;
        report.traffic.txSpeed = 0;
    }

    try {
        await db.batch([
            db.prepare(`
                UPDATE vps_nodes SET 
                    status = 'online', last_seen_at = ?, last_report_json = ?, 
                    total_rx = total_rx + ?, total_tx = total_tx + ?,
                    country_code = COALESCE(?, country_code)
                WHERE id = ?
            `).bind(reportedAt, JSON.stringify(report), rxDelta, txDelta, country, nodeId),
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
        // Purge KV cache so public dashboard refreshes immediately
        const kv = c.env.MIPULSE_KV;
        if (kv) { try { await kv.delete('cache:public_nodes'); } catch(e) {} }
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
                   description, secret, status, enabled, 
                   network_monitor_enabled AS networkMonitorEnabled,
                   use_global_targets AS useGlobalTargets,
                   total_rx AS totalRx, total_tx AS totalTx, last_seen_at AS lastSeenAt, 
                   last_report_json AS lastReport, created_at, updated_at 
            FROM vps_nodes ORDER BY name ASC
        `).all();
        return c.json({ 
            success: true, 
            nodes: results.map(n => ({ 
                ...n, 
                enabled: !!n.enabled,
                networkMonitorEnabled: !!n.networkMonitorEnabled,
                useGlobalTargets: !!n.useGlobalTargets,
                latest: n.lastReport ? JSON.parse(n.lastReport) : null 
            })) 
        });
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
        `).bind(id, body.name, body.tag || '', body.groupTag || 'Default', body.region || 'Global', body.enabled ? 1 : 0, secret).run();
        const apiOrigin = new URL(c.req.url).origin;
        return c.json({ success: true, node: { id, secret }, guide: buildGuide(apiOrigin, id, secret) });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

// 4. ADMIN: GET/PUT/DELETE /nodes/:id
vps.get('/nodes/:id', async (c) => {
    const db = c.env.MIPULSE_DB;
    const id = c.req.param('id');
    try {
        const node = await db.prepare(`
            SELECT *, group_tag AS groupTag, country_code AS countryCode, 
                   enabled, network_monitor_enabled AS networkMonitorEnabled,
                   use_global_targets AS useGlobalTargets,
                   total_rx AS totalRx, total_tx AS totalTx, 
                   last_seen_at AS lastSeenAt, last_report_json AS lastReport 
            FROM vps_nodes WHERE id = ?
        `).bind(id).first();
        if (!node) return c.json({ error: 'Not found' }, 404);
        const apiOrigin = new URL(c.req.url).origin;
        return c.json({ 
            success: true, 
            node: { 
                ...node, 
                enabled: !!node.enabled,
                networkMonitorEnabled: !!node.networkMonitorEnabled,
                useGlobalTargets: !!node.useGlobalTargets,
                latest: node.lastReport ? JSON.parse(node.lastReport) : null 
            }, 
            guide: buildGuide(apiOrigin, node.id, node.secret) 
        });
    } catch (err) { return c.json({ success: false, error: err.message }, 500); }
});

vps.put('/nodes/:id', async (c) => {
    const db = c.env.MIPULSE_DB;
    const id = c.req.param('id');
    const body = await c.req.json();
    const apiOrigin = new URL(c.req.url).origin;
    try {
        // Handle resetSecret as a separate operation
        if (body.resetSecret) {
            const newSecret = Math.random().toString(36).substring(2, 15);
            await db.prepare("UPDATE vps_nodes SET secret = ?, updated_at = datetime('now') WHERE id = ?").bind(newSecret, id).run();
            return c.json({ success: true, guide: buildGuide(apiOrigin, id, newSecret) });
        }
        // Full node update
        await db.prepare(`
            UPDATE vps_nodes SET 
                name = ?, tag = ?, group_tag = ?, region = ?, 
                enabled = ?, secret = ?, 
                network_monitor_enabled = ?, use_global_targets = ?,
                updated_at = datetime('now')
            WHERE id = ?
        `).bind(
            body.name, body.tag || '', body.groupTag || 'Default', body.region || 'Global', 
            body.enabled ? 1 : 0, body.secret,
            body.networkMonitorEnabled ? 1 : 0, body.useGlobalTargets ? 1 : 0,
            id
        ).run();
        const updatedNode = await db.prepare('SELECT secret FROM vps_nodes WHERE id = ?').bind(id).first();
        return c.json({ success: true, guide: buildGuide(apiOrigin, id, updatedNode?.secret || body.secret) });
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

// 8. PUBLIC: GET /install
vps.get('/install', async (c) => {
    const db = c.env.MIPULSE_DB;
    const nodeId = c.req.query('nodeId');
    const secret = c.req.query('secret');
    if (!nodeId || !secret) return c.json({ error: 'Missing params' }, 400);

    const node = await db.prepare('SELECT id, name, secret FROM vps_nodes WHERE id = ?').bind(nodeId).first();
    if (!node || node.secret !== secret) return c.json({ error: 'Invalid node or secret' }, 401);

    const apiOrigin = new URL(c.req.url).origin;

    // Build reporter script content - uses printf for JSON to avoid all escaping issues
    const reporterScript = [
        '#!/bin/bash',
        'LOG="/opt/mipulse/reporter.log"',
        'echo "[$(date)] MiPulse Reporter started. URL=$MIPULSE_URL ID=$MIPULSE_ID" > "$LOG"',
        '',
        'while true; do',
        '  cpu_percent=0',
        '  if [[ -f /proc/stat ]]; then',
        '    read -r _ a1 b1 c1 d1 e1 f1 g1 h1 i1 _ < /proc/stat',
        '    t1=$((a1+b1+c1+d1+e1+f1+g1+h1+i1)); idle1=$((d1+e1))',
        '    sleep 2',
        '    read -r _ a2 b2 c2 d2 e2 f2 g2 h2 i2 _ < /proc/stat',
        '    t2=$((a2+b2+c2+d2+e2+f2+g2+h2+i2)); idle2=$((d2+e2))',
        '    dt=$((t2-t1)); di=$((idle2-idle1))',
        '    [[ $dt -gt 0 ]] && cpu_percent=$((100*(dt-di)/dt))',
        '  fi',
        '',
        '  mem_percent=0',
        '  if [[ -f /proc/meminfo ]]; then',
        "    mt=$(awk '/^MemTotal:/{print $2}' /proc/meminfo)",
        "    ma=$(awk '/^MemAvailable:/{print $2}' /proc/meminfo)",
        '    [[ -z "$ma" ]] && ma=$(awk \'/^MemFree:/{print $2}\' /proc/meminfo)',
        '    [[ "$mt" -gt 0 ]] 2>/dev/null && mem_percent=$((100*(mt-ma)/mt))',
        '  fi',
        '',
        '  disk_percent=0',
        "  disk_percent=$(df / 2>/dev/null | awk 'NR==2{gsub(/%/,\"\",$5); print $5}') || true",
        '  [[ -z "$disk_percent" ]] && disk_percent=0',
        '',
        '  load1="0.00"; load5="0.00"; load15="0.00"',
        '  [[ -f /proc/loadavg ]] && read -r load1 load5 load15 _ _ < /proc/loadavg',
        '',
        '  uptime_sec=0',
        '  if [[ -f /proc/uptime ]]; then',
        '    read -r up _ < /proc/uptime',
        '    uptime_sec=$(echo "$up" | cut -d. -f1)',
        '  fi',
        '',
        '  rx=0; tx=0',
        '  if [[ -f /proc/net/dev ]]; then',
        "    rx=$(awk 'NR>2 && $1 !~ /lo:/{gsub(/:/,\" \",$1); sum+=$2} END{print int(sum)}' /proc/net/dev)",
        "    tx=$(awk 'NR>2 && $1 !~ /lo:/{gsub(/:/,\" \",$1); sum+=$10} END{print int(sum)}' /proc/net/dev)",
        '  fi',
        '',
        '  os_info="Linux"',
        '  [[ -f /etc/os-release ]] && os_info=$(. /etc/os-release && echo "$PRETTY_NAME")',
        "  os_info=$(echo \"$os_info\" | tr -d '\"' | head -c 64)",
        '  kernel_info=$(uname -r 2>/dev/null || echo "unknown")',
        '',
        "  json=$(printf '{\"cpuPercent\":%d,\"memPercent\":%d,\"diskPercent\":%d,\"uptimeSec\":%d,\"load1\":%s,\"load5\":%s,\"load15\":%s,\"traffic\":{\"rx\":%s,\"tx\":%s},\"meta\":{\"os\":\"%s\",\"kernel\":\"%s\",\"version\":\"vBash-1.3\"}}' \"$cpu_percent\" \"$mem_percent\" \"$disk_percent\" \"$uptime_sec\" \"$load1\" \"$load5\" \"$load15\" \"$rx\" \"$tx\" \"$os_info\" \"$kernel_info\")",
        '',
        '  resp=$(curl -sS -w "HTTP_%{http_code}" -X POST "$MIPULSE_URL/api/vps/report" -H "Content-Type: application/json" -H "x-node-id: $MIPULSE_ID" -H "x-node-secret: $MIPULSE_SECRET" -d "$json" 2>&1) || true',
        '',
        '  echo "[$(date)] CPU=$cpu_percent MEM=$mem_percent DSK=$disk_percent LOAD=$load1 UP=$uptime_sec $resp" >> "$LOG"',
        '  tail -100 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG" 2>/dev/null',
        '',
        '  sleep 58',
        'done',
    ].join('\n');

    const script = `#!/bin/bash
# MiPulse Probe Universal Installer (Bash v1.4)
echo "====================================="
echo "  MiPulse Universal Bash Probe v1.4"
echo "====================================="

if [[ $EUID -ne 0 ]]; then echo "Error: must be root"; exit 1; fi

mkdir -p /opt/mipulse && cd /opt/mipulse

echo ">> Creating reporter script..."
cat > /opt/mipulse/reporter.sh << 'REPORTER_EOF'
${reporterScript}
REPORTER_EOF

chmod +x /opt/mipulse/reporter.sh

echo ">> Configuring systemd service..."
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

echo ">> Sending initial report..."
curl -sS -X POST "${apiOrigin}/api/vps/report" \\
  -H "Content-Type: application/json" \\
  -H "x-node-id: ${nodeId}" \\
  -H "x-node-secret: ${secret}" \\
  -d '{"cpuPercent":0,"memPercent":0,"diskPercent":0,"load1":0,"traffic":{"rx":0,"tx":0},"meta":{"os":"Starting...","kernel":"Connecting...","version":"vLauncher"}}' > /dev/null 2>&1 || true

echo ""
echo "====================================="
echo "  MiPulse Bash Probe v1.4 installed!"
echo "  Debug log: cat /opt/mipulse/reporter.log"
echo "  Status: systemctl status mipulse-probe"
echo "====================================="
`;
    return c.text(script);
});

// 9. PUBLIC: GET /api/vps/uninstall
vps.get('/uninstall', async (c) => {
    const script = `#!/bin/bash
echo "Uninstalling MiPulse Probe..."
systemctl stop mipulse-probe || true
systemctl disable mipulse-probe || true
rm -f /etc/systemd/system/mipulse-probe.service
rm -rf /opt/mipulse
systemctl daemon-reload
systemctl reset-failed || true
echo "MiPulse Probe removed successfully."
`;
    return c.text(script);
});

export default vps;
