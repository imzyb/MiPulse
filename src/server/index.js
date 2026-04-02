import { Hono } from 'hono';
import { cors } from 'hono/cors';
import auth from './routes/auth';

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
    if (path === '/api/vps/public' || path === '/api/vps/report') {
        return next();
    }
    return authMiddleware(c, next);
});

app.use('/api/auth/profile', authMiddleware);

// Mount routers
app.route('/api/vps', vps);
app.route('/api/auth', auth);

// Root / Health check
app.get('/', (c) => c.text('MiPulse API is running on Hono!'));

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
    fetch: app.fetch,
    scheduled: handleScheduled
};
