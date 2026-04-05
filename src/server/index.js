import { Hono } from 'hono';
import { cors } from 'hono/cors';
import vps from './routes/vps.js';
import auth from './routes/auth.js';
import { authMiddleware } from './middleware/auth.js';

const app = new Hono();

// Global Middleware
app.use('*', cors());

// Error Handling
app.onError((err, c) => {
    console.error('[Hono Error]', err.message);
    const authErrors = [
        'JwtTokenInvalid', 'JwtTokenExpired', 'JwtTokenNotBefore', 
        'Unauthorized', 'JwtTokenMissing', 'no authorization included in request'
    ];
    if (authErrors.includes(err.name) || authErrors.includes(err.message)) {
        return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    return c.json({ success: false, error: err.message }, 500);
});

// Middleware for Protected routes
app.use('/api/vps/*', async (c, next) => {
    const path = c.req.path;
    const allowed = ['/api/vps/public', '/api/vps/report', '/api/vps/install', '/api/vps/uninstall', '/api/vps/probe/targets', '/api/vps/probe/checks', '/api/vps/probe/checks.txt', '/api/vps/probe/check-results'];
    
    // Explicitly allow any path starting with /api/vps/public/
    if (allowed.includes(path) || path.startsWith('/api/vps/public/')) {
        return next();
    }
    return authMiddleware(c, next);
});

app.use('/api/auth/profile', authMiddleware);

// Mount routers
app.route('/api/vps', vps);
app.route('/api/auth', auth);

// --- Robust SPA Entry Point ---
// Force Cloudflare to serve index.html for any non-API and non-asset route.
app.get('*', async (c) => {
    const path = c.req.path;
    
    // 1. API: Let Hono handle 404
    if (path.startsWith('/api/')) return c.notFound();
    
    // 2. Static File: If it has an extension (and isn't .html), treat as asset
    if (path.includes('.') && !path.endsWith('.html')) {
        return c.env.ASSETS.fetch(c.req.raw);
    }
    
    // 3. SPA Shell: Fetch the root '/' from assets (which returns index.html as 200).
    //    IMPORTANT: Do NOT fetch '/index.html' - Cloudflare's asset engine will 307 redirect it to '/'.
    //    Use a clean Request with only the root URL to avoid header contamination.
    const rootUrl = new URL('/', c.req.url).toString();
    const assetResponse = await c.env.ASSETS.fetch(new Request(rootUrl));
    
    // Return the HTML content but preserve the original URL in the browser
    return new Response(assetResponse.body, {
        status: 200,
        headers: assetResponse.headers,
    });
});

// --- Scheduled Task (Cron) ---
function parseSettingsValue(rows, key, fallback = {}) {
    const row = (rows.results || []).find((item) => item.key === key);
    if (!row?.value) return fallback;
    try {
        return JSON.parse(row.value);
    } catch {
        return fallback;
    }
}

async function loadMonitorSettings(db) {
    const rows = await db.prepare('SELECT key, value FROM settings WHERE key IN (?, ?)')
        .bind('vps_monitor_json', 'network_monitor_json')
        .all();
    const settings = parseSettingsValue(rows, 'vps_monitor_json', {});
    const networkSettings = parseSettingsValue(rows, 'network_monitor_json', {});
    return {
        offlineThresholdMinutes: Math.max(1, Number(settings.offlineThresholdMinutes) || 5),
        reportRetentionDays: Math.max(1, Number(settings.reportRetentionDays) || 7),
        alertCooldownMinutes: Math.max(1, Number(settings.alertCooldownMinutes) || 30),
        networkKeepHistoryDays: Math.max(1, Number(networkSettings.keepHistoryDays) || 3)
    };
}

async function cleanupOldReports(db, reportRetentionDays) {
    await db.prepare(`DELETE FROM vps_reports WHERE reported_at < datetime('now', ?)`) 
        .bind(`-${reportRetentionDays} days`)
        .run();
}

async function cleanupOldNetworkSamples(db, keepHistoryDays) {
    await db.prepare(`DELETE FROM vps_network_samples WHERE reported_at < datetime('now', ?)`) 
        .bind(`-${keepHistoryDays} days`)
        .run();
}

async function shouldCreateOfflineAlert(db, nodeId, alertCooldownMinutes) {
    const row = await db.prepare(`
        SELECT id, created_at AS createdAt FROM vps_alerts
        WHERE node_id = ? AND type = 'offline'
        ORDER BY created_at DESC
        LIMIT 1
    `).bind(nodeId).first();
    if (!row?.createdAt) return true;
    const lastCreatedAt = new Date(row.createdAt).getTime();
    if (!Number.isFinite(lastCreatedAt)) return true;
    return Date.now() - lastCreatedAt >= alertCooldownMinutes * 60 * 1000;
}

async function handleScheduled(event, env, ctx) {
    console.log('[MiPulse Cron] Running offline detection...');
    const db = env.MIPULSE_DB;
    
    try {
        const settings = await loadMonitorSettings(db);
        await cleanupOldReports(db, settings.reportRetentionDays);
        await cleanupOldNetworkSamples(db, settings.networkKeepHistoryDays);

        // Find nodes that are 'online' but haven't reported within threshold
        const { results: deadNodes } = await db.prepare(`
            SELECT id, name FROM vps_nodes 
            WHERE status = 'online' 
            AND last_seen_at < datetime('now', ?)
        `).bind(`-${settings.offlineThresholdMinutes} minutes`).all();

        if (deadNodes.length > 0) {
            console.log(`[MiPulse Cron] Found ${deadNodes.length} offline nodes.`);
            
            for (const node of deadNodes) {
                const statements = [
                    db.prepare("UPDATE vps_nodes SET status = 'offline' WHERE id = ?").bind(node.id)
                ];
                if (await shouldCreateOfflineAlert(db, node.id, settings.alertCooldownMinutes)) {
                    statements.push(db.prepare(`
                        INSERT INTO vps_alerts (id, node_id, type, message, created_at)
                        VALUES (?, ?, ?, ?, ?)
                    `).bind(
                        crypto.randomUUID(), 
                        node.id, 
                        'offline', 
                        `Node ${node.name} is offline (Heartbeat missed)`, 
                        new Date().toISOString()
                    ));
                }
                await db.batch(statements);
            }
        }
    } catch (err) {
        console.error('[MiPulse Cron] Error:', err.message);
    }
}

// Export the Worker
export default {
    async fetch(request, env, ctx) {
        return app.fetch(request, env, ctx);
    },
    async scheduled(event, env, ctx) {
        await handleScheduled(event, env, ctx);
    }
};

export { handleScheduled };
