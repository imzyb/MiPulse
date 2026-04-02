import { Hono } from 'hono';
import { sign } from 'hono/jwt';

const auth = new Hono();

// --- Utilities ---
const JWT_SECRET = 'mipulse-secret-key'; // Should ideally be in env

// 1. POST /api/auth/login
auth.post('/login', async (c) => {
    const db = c.env.MIPULSE_DB;
    const body = await c.req.json();
    const { username, password } = body;

    if (!username || !password) {
        return c.json({ success: false, error: 'Missing credentials' }, 400);
    }

    try {
        let user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
        
        // First-run logic: if no user exists and using 'admin', allow default password
        if (!user && username === 'admin') {
            const { count } = await db.prepare('SELECT COUNT(*) as count FROM users').first();
            if (count === 0 && password === 'mipulse-secret') {
                user = { id: 'admin', username: 'admin', role: 'admin' };
            }
        }

        if (user && (user.password_hash === password || (user.id === 'admin' && password === 'mipulse-secret'))) {
            const token = await sign({
                id: user.id,
                username: user.username,
                role: user.role || 'admin',
                exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 days
            }, JWT_SECRET);
            
            return c.json({ success: true, token });
        }

        return c.json({ success: false, error: 'Invalid username or password' }, 401);
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

// 2. GET /api/auth/profile (Requires Auth)
auth.get('/profile', async (c) => {
    const payload = c.get('jwtPayload');
    return c.json({ success: true, user: payload });
});

// 3. PUT /api/auth/profile (Requires Auth)
auth.put('/profile', async (c) => {
    const db = c.env.MIPULSE_DB;
    const payload = c.get('jwtPayload');
    const body = await c.req.json();
    const { username, password } = body;

    try {
        if (password) {
            await db.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?')
                .bind(username || payload.username, password, payload.id).run();
        } else {
            await db.prepare('UPDATE users SET username = ? WHERE id = ?')
                .bind(username || payload.username, payload.id).run();
        }
        return c.json({ success: true });
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

export default auth;
