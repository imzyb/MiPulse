import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { loginSchema, profileUpdateSchema, validateBody } from '../validators.js';
import { logAudit, AuditActions, ResourceTypes } from '../../services/audit.js';

const auth = new Hono();

function getJwtSecret(env) {
    if (!env.JWT_SECRET) {
        throw new Error('JWT_SECRET environment variable is required in production');
    }
    return env.JWT_SECRET;
}

function encodeHex(buffer) {
    return Array.from(new Uint8Array(buffer))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

export async function hashPassword(password) {
    const data = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return `sha256:${encodeHex(digest)}`;
}

export async function verifyPassword(storedPassword, candidatePassword) {
    if (!storedPassword || !candidatePassword) return false;
    if (storedPassword.startsWith('sha256:')) {
        return storedPassword === await hashPassword(candidatePassword);
    }
    return storedPassword === candidatePassword;
}

async function issueToken(env, user) {
    return sign({
        id: user.id,
        username: user.username,
        role: user.role || 'admin',
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
    }, getJwtSecret(env));
}

async function countUsers(db) {
    const row = await db.prepare('SELECT COUNT(*) as count FROM users').first();
    return Number(row?.count || 0);
}

async function ensureBootstrapAdmin(db, username, password) {
    if (username !== 'admin' || password !== 'admin') return null;
    if (await countUsers(db)) return null;
    return { id: 'bootstrap-admin', username: 'admin', role: 'admin', password_hash: null };
}

async function upsertUser(db, id, username, password, mustChangePassword = false) {
    const hashedPassword = await hashPassword(password);
    if (id === 'bootstrap-admin') {
        const result = await db.prepare('INSERT INTO users (username, password_hash, role, must_change_password) VALUES (?, ?, ?, ?)')
            .bind(username, hashedPassword, 'admin', mustChangePassword ? 1 : 0)
            .run();
        const user = await db.prepare('SELECT id, username, role, must_change_password FROM users WHERE rowid = last_insert_rowid()').first();
        return user || { id: result.meta?.last_row_id, username, role: 'admin', must_change_password: mustChangePassword ? 1 : 0 };
    }

    await db.prepare('UPDATE users SET username = ?, password_hash = ?, must_change_password = ? WHERE id = ?')
        .bind(username, hashedPassword, mustChangePassword ? 1 : 0, id)
        .run();
    return db.prepare('SELECT id, username, role, must_change_password FROM users WHERE id = ?').bind(id).first();
}

// 1. POST /api/auth/login
auth.post('/login', async (c) => {
    const db = c.env.MIPULSE_DB;
    const body = await c.req.json();
    
    // Validate request body
    const validation = validateBody(body, loginSchema);
    if (!validation.success) {
        return c.json({ 
            success: false, 
            error: 'Validation failed',
            details: validation.errors 
        }, 400);
    }
    
    const { username, password } = validation.data;

    try {
        let user = await db.prepare('SELECT * FROM users WHERE username = ?').bind(username).first();
        if (!user) {
            user = await ensureBootstrapAdmin(db, username, password);
        }

        const isValid = user && (user.id === 'bootstrap-admin'
            ? true
            : await verifyPassword(user.password_hash, password));

        if (isValid) {
            let userToReturn = user;
            
            // 如果是 bootstrap-admin 首次登录，创建用户并标记必须改密
            if (user.id === 'bootstrap-admin') {
                userToReturn = await upsertUser(db, user.id, user.username, password, true);
            } else if (user.password_hash && !String(user.password_hash).startsWith('sha256:')) {
                // 迁移旧版明文密码
                await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
                    .bind(await hashPassword(password), user.id)
                    .run();
            }

            const token = await issueToken(c.env, userToReturn);
            
            // Audit logging for successful login
            await logAudit(db, {
                userId: userToReturn.id,
                action: AuditActions.LOGIN,
                resourceType: ResourceTypes.USER,
                resourceId: String(userToReturn.id),
                ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
                userAgent: c.req.header('user-agent')
            });
            
            return c.json({ 
                success: true, 
                token,
                mustChangePassword: !!userToReturn.must_change_password
            });
        }

        return c.json({ success: false, error: 'Invalid username or password' }, 401);
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

// 2. GET /api/auth/profile (Requires Auth)
auth.get('/profile', async (c) => {
    const payload = c.get('jwtPayload');
    return c.json({ success: true, user: payload, data: payload });
});

// 3. PUT /api/auth/profile (Requires Auth)
auth.put('/profile', async (c) => {
    const db = c.env.MIPULSE_DB;
    const payload = c.get('jwtPayload');
    const body = await c.req.json();
    
    // Validate request body
    const validation = validateBody(body, profileUpdateSchema);
    if (!validation.success) {
        return c.json({ 
            success: false, 
            error: 'Validation failed',
            details: validation.errors 
        }, 400);
    }
    
    const currentPassword = validation.data.currentPassword || '';
    const nextUsername = (validation.data.newUsername || payload.username || '').trim();
    const nextPassword = validation.data.newPassword || '';

    try {
        if (!currentPassword) {
            return c.json({ success: false, error: 'Current password is required' }, 400);
        }

        let user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(payload.id).first();
        if (!user && payload.username === 'admin') {
            user = await ensureBootstrapAdmin(db, payload.username, currentPassword);
        }

        if (!user) {
            return c.json({ success: false, error: 'User not found' }, 404);
        }

        const oldUsername = user.username;
        
        const currentPasswordValid = user.id === 'bootstrap-admin'
            ? currentPassword === 'mipulse-secret'
            : await verifyPassword(user.password_hash, currentPassword);
        if (!currentPasswordValid) {
            return c.json({ success: false, error: 'Current password is incorrect' }, 401);
        }

        const passwordToSave = nextPassword || currentPassword;
        const shouldClearMustChange = !!nextPassword; // 如果设置了新密码，清除强制改密标志
        const updatedUser = await upsertUser(db, user.id, nextUsername, passwordToSave, false);
        const token = await issueToken(c.env, updatedUser);
        
        // Audit logging for profile update
        await logAudit(db, {
            userId: user.id,
            action: AuditActions.PROFILE_UPDATE,
            resourceType: ResourceTypes.USER,
            resourceId: String(user.id),
            oldValue: { username: oldUsername },
            newValue: { username: nextUsername, passwordChanged: !!nextPassword },
            ipAddress: c.req.header('x-forwarded-for') || c.req.header('x-real-ip'),
            userAgent: c.req.header('user-agent')
        });
        
        return c.json({ success: true, token, user: updatedUser, data: updatedUser });
    } catch (err) {
        return c.json({ success: false, error: err.message }, 500);
    }
});

export default auth;
