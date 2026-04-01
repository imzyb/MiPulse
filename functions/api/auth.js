import { SignJWT, jwtVerify } from 'jose';

const DEFAULT_ADMIN_PASSWORD = 'admin';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function sha256(input) {
  const data = new TextEncoder().encode(input || '');
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = Array.from(new Uint8Array(hash));
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateRandomSecret(length = 64) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, length);
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

async function getOrCreateJwtSecret(env) {
  if (!env?.MIPULSE_DB) return 'dev-fallback-secret-not-configured';
  await ensureSettingsTable(env);
  const row = await env.MIPULSE_DB.prepare('SELECT value FROM settings WHERE key = ?').bind('jwt_secret').first();
  if (row?.value) return row.value;
  const newSecret = generateRandomSecret(64);
  const now = new Date().toISOString();
  await env.MIPULSE_DB.prepare(
    'INSERT INTO settings (key, value, created_at, updated_at) VALUES (?, ?, ?, ?)'
  ).bind('jwt_secret', newSecret, now, now).run();
  return newSecret;
}

async function ensureAuthSchema(env) {
  if (!env?.MIPULSE_DB) return;
  await env.MIPULSE_DB.prepare(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();
}

async function ensureDefaultAdmin(env) {
  if (!env?.MIPULSE_DB) return;
  await ensureAuthSchema(env);
  const row = await env.MIPULSE_DB.prepare('SELECT id FROM users ORDER BY id ASC LIMIT 1').first();
  if (row?.id) return;
  const username = 'admin';
  const passwordHash = await sha256(DEFAULT_ADMIN_PASSWORD);
  await env.MIPULSE_DB.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .bind(username, passwordHash, 'admin')
    .run();
}

async function issueToken(env, user) {
  const secret = new TextEncoder().encode(await getOrCreateJwtSecret(env));
  return new SignJWT({ uid: user.id, username: user.username, role: user.role || 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);
}

export async function login(request, env) {
  try {
    const { username, password } = await request.json();

    if (env?.MIPULSE_DB) {
      await ensureDefaultAdmin(env);
      const user = await env.MIPULSE_DB.prepare('SELECT * FROM users WHERE username = ? LIMIT 1')
        .bind((username || '').trim())
        .first();
      if (!user) return jsonResponse({ success: false, error: 'Invalid credentials' }, 401);
      const passwordHash = await sha256(password || '');
      if (passwordHash !== user.password_hash) {
        return jsonResponse({ success: false, error: 'Invalid credentials' }, 401);
      }
      const token = await issueToken(env, user);
      return jsonResponse({ success: true, token, user: { id: user.id, username: user.username, role: user.role } });
    }

    if (username === 'admin' && password === DEFAULT_ADMIN_PASSWORD) {
      const token = await issueToken(env, { id: 0, username, role: 'admin' });
      return jsonResponse({ success: true, token, user: { id: 0, username, role: 'admin' } });
    }

    return jsonResponse({ success: false, error: 'Invalid credentials' }, 401);
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

export async function verifyAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = new TextEncoder().encode(await getOrCreateJwtSecret(env));
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch (error) {
    return null;
  }
}

export async function getProfile(request, env, auth) {
  if (!auth) return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  if (!env?.MIPULSE_DB) {
    return jsonResponse({ success: true, data: { username: auth.username || 'admin' } });
  }
  await ensureDefaultAdmin(env);
  let user = null;
  if (auth.uid !== undefined && auth.uid !== null) {
    user = await env.MIPULSE_DB.prepare('SELECT id, username, role FROM users WHERE id = ? LIMIT 1').bind(auth.uid).first();
  }
  if (!user && auth.username) {
    user = await env.MIPULSE_DB.prepare('SELECT id, username, role FROM users WHERE username = ? LIMIT 1').bind(auth.username).first();
  }
  if (!user) return jsonResponse({ success: false, error: 'User not found' }, 404);
  return jsonResponse({ success: true, data: { id: user.id, username: user.username, role: user.role } });
}

export async function updateProfile(request, env, auth) {
  if (!auth) return jsonResponse({ success: false, error: 'Unauthorized' }, 401);
  if (!env?.MIPULSE_DB) return jsonResponse({ success: false, error: 'Database not available' }, 500);

  await ensureDefaultAdmin(env);
  const body = await request.json();
  const currentPassword = String(body.currentPassword || '');
  const newUsername = String(body.newUsername || '').trim();
  const newPassword = String(body.newPassword || '');

  if (!currentPassword) return jsonResponse({ success: false, error: 'Current password is required' }, 400);
  if (!newUsername && !newPassword) return jsonResponse({ success: false, error: 'No changes provided' }, 400);

  let user = null;
  if (auth.uid !== undefined && auth.uid !== null) {
    user = await env.MIPULSE_DB.prepare('SELECT * FROM users WHERE id = ? LIMIT 1').bind(auth.uid).first();
  }
  if (!user && auth.username) {
    user = await env.MIPULSE_DB.prepare('SELECT * FROM users WHERE username = ? LIMIT 1').bind(auth.username).first();
  }
  if (!user) return jsonResponse({ success: false, error: 'User not found' }, 404);

  const currentHash = await sha256(currentPassword);
  if (currentHash !== user.password_hash) {
    return jsonResponse({ success: false, error: 'Current password is incorrect' }, 401);
  }

  const targetUsername = newUsername || user.username;
  if (targetUsername !== user.username) {
    const exists = await env.MIPULSE_DB.prepare('SELECT id FROM users WHERE username = ? AND id != ? LIMIT 1')
      .bind(targetUsername, user.id)
      .first();
    if (exists?.id) return jsonResponse({ success: false, error: 'Username already exists' }, 409);
  }

  const targetHash = newPassword ? await sha256(newPassword) : user.password_hash;
  await env.MIPULSE_DB.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?')
    .bind(targetUsername, targetHash, user.id)
    .run();

  const updated = { id: user.id, username: targetUsername, role: user.role || 'admin' };
  const token = await issueToken(env, updated);
  return jsonResponse({ success: true, token, data: updated });
}
