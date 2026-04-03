import { Hono } from 'hono';
import { cors } from 'hono/cors';
import vps from './routes/vps';
import auth from './routes/auth';
import { authMiddleware } from './middleware/auth';

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
    const allowed = ['/api/vps/public', '/api/vps/report', '/api/vps/install', '/api/vps/uninstall'];
    if (allowed.includes(path)) {
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
async function handleScheduled(event, env, ctx) {
    console.log('[MiPulse Cron] Running offline detection...');
    const db = env.MIPULSE_DB;
    
    try {
        // Find nodes that are 'online' but haven't reported in 5 minutes
        const { results: deadNodes } = await db.prepare(`
            SELECT id, name FROM vps_nodes 
            WHERE status = 'online' 
            AND last_seen_at < datetime('now', '-5 minutes')
        `).all();

        if (deadNodes.length > 0) {
            console.log(`[MiPulse Cron] Found ${deadNodes.length} offline nodes.`);
            
            for (const node of deadNodes) {
                await db.batch([
                    db.prepare("UPDATE vps_nodes SET status = 'offline' WHERE id = ?").bind(node.id),
                    db.prepare(`
                        INSERT INTO vps_alerts (id, node_id, type, message, created_at)
                        VALUES (?, ?, ?, ?, ?)
                    `).bind(
                        crypto.randomUUID(), 
                        node.id, 
                        'offline', 
                        `Node ${node.name} is offline (Heartbeat missed)`, 
                        new Date().toISOString()
                    )
                ]);
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
