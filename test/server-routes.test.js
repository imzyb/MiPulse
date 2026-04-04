import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { sign } from 'hono/jwt';
import auth, { hashPassword, verifyPassword } from '../src/server/routes/auth.js';
import vps, { normalizeReportTimestamp, safeJsonParse, executeTargetCheck, sendTestNotifications } from '../src/server/routes/vps.js';

class MockStatement {
  constructor(handler, sql) {
    this.handler = handler;
    this.sql = sql;
    this.args = [];
  }

  bind(...args) {
    this.args = args;
    return this;
  }

  first() {
    return Promise.resolve(this.handler(this.sql, this.args, 'first'));
  }

  all() {
    return Promise.resolve(this.handler(this.sql, this.args, 'all'));
  }

  run() {
    return Promise.resolve(this.handler(this.sql, this.args, 'run'));
  }
}

function createDb() {
  const state = {
    users: [
      { id: 1, username: 'admin', password_hash: '', role: 'admin' }
    ],
    nodes: [
      { id: 'node-1', name: 'Node 1', secret: 'node-secret', status: 'offline', enabled: 1, network_monitor_enabled: 1, last_seen_at: null, last_report_json: null, total_rx: 0, total_tx: 0, country_code: null, group_tag: 'Default', tag: '', region: 'Global' }
    ],
    reports: [],
    settings: {},
    networkTargets: [
      { id: 'target-1', node_id: 'global', type: 'http', target: 'example.com', name: 'Example', scheme: 'https', port: null, path: '/', enabled: 1, force_check_at: null }
    ],
    networkSamples: []
  };

  const handler = (sql, args, method) => {
    if (sql.includes('SELECT * FROM users WHERE username = ?') && method === 'first') {
      return state.users.find((item) => item.username === args[0]) || null;
    }
    if (sql.includes('SELECT COUNT(*) as count FROM users') && method === 'first') {
      return { count: state.users.length };
    }
    if (sql.includes('SELECT * FROM users WHERE id = ?') && method === 'first') {
      return state.users.find((item) => String(item.id) === String(args[0])) || null;
    }
    if (sql.includes('SELECT id, username, role FROM users WHERE id = ?') && method === 'first') {
      const user = state.users.find((item) => String(item.id) === String(args[0]));
      return user ? { id: user.id, username: user.username, role: user.role } : null;
    }
    if (sql.includes('INSERT INTO users') && method === 'run') {
      const nextId = state.users.length + 1;
      state.users.push({ id: nextId, username: args[0], password_hash: args[1], role: args[2] });
      return { meta: { last_row_id: nextId } };
    }
    if (sql.includes('SELECT id, username, role FROM users WHERE rowid = last_insert_rowid()') && method === 'first') {
      const user = state.users[state.users.length - 1];
      return { id: user.id, username: user.username, role: user.role };
    }
    if (sql.includes('UPDATE users SET password_hash = ? WHERE id = ?') && method === 'run') {
      const user = state.users.find((item) => String(item.id) === String(args[1]));
      if (user) user.password_hash = args[0];
      return {};
    }
    if (sql.includes('UPDATE users SET username = ?, password_hash = ? WHERE id = ?') && method === 'run') {
      const user = state.users.find((item) => String(item.id) === String(args[2]));
      if (user) {
        user.username = args[0];
        user.password_hash = args[1];
      }
      return {};
    }
    if (sql.includes('SELECT id, secret, last_seen_at AS lastSeenAt, last_report_json AS lastReport FROM vps_nodes') && method === 'first') {
      const node = state.nodes.find((item) => item.id.toLowerCase() === String(args[0]).toLowerCase());
      return node ? { id: node.id, secret: node.secret, lastSeenAt: node.last_seen_at, lastReport: node.last_report_json } : null;
    }
    if (sql.includes('UPDATE vps_nodes SET status =') && method === 'run') {
      const node = state.nodes.find((item) => item.id === args[5]);
      if (node) {
        node.status = 'online';
        node.last_seen_at = args[0];
        node.last_report_json = args[1];
        node.total_rx += Number(args[2]);
        node.total_tx += Number(args[3]);
        node.country_code = args[4] || node.country_code;
      }
      return {};
    }
    if (sql.includes('INSERT INTO vps_reports') && method === 'run') {
      state.reports.push({ id: args[0], node_id: args[1], data: args[2], reported_at: args[3] });
      return {};
    }
    if (sql.includes('SELECT key, value FROM settings') && method === 'all') {
      return {
        results: Object.entries(state.settings).map(([key, value]) => ({ key, value }))
      };
    }
    if (sql.includes('INSERT OR REPLACE INTO settings') && method === 'run') {
      state.settings[args[0]] = args[1];
      return {};
    }
    if (sql.includes('SELECT key, value FROM settings WHERE key IN') && method === 'all') {
      return {
        results: args.map((key) => state.settings[key] === undefined ? null : ({ key, value: state.settings[key] })).filter(Boolean)
      };
    }
    if (sql.includes('SELECT * FROM vps_network_targets WHERE id = ? AND node_id = ?') && method === 'first') {
      return state.networkTargets.find((item) => item.id === args[0] && item.node_id === args[1]) || null;
    }
    if (sql.includes('SELECT id, secret, network_monitor_enabled FROM vps_nodes') && method === 'first') {
      const node = state.nodes.find((item) => item.id.toLowerCase() === String(args[0]).toLowerCase());
      return node ? { id: node.id, secret: node.secret, network_monitor_enabled: node.network_monitor_enabled } : null;
    }
    if (sql.includes('SELECT id, node_id AS nodeId, type, target, name, scheme, port, path, force_check_at AS forceCheckAt FROM vps_network_targets') && method === 'all') {
      return {
        results: state.networkTargets.map((item) => ({
          id: item.id,
          nodeId: item.node_id,
          type: item.type,
          target: item.target,
          name: item.name,
          scheme: item.scheme,
          port: item.port,
          path: item.path,
          forceCheckAt: item.force_check_at
        }))
      };
    }
    if (sql.includes('SELECT data FROM vps_network_samples WHERE node_id = ?') && method === 'all') {
      return {
        results: state.networkSamples
          .filter((item) => item.node_id === args[0])
          .map((item) => ({ data: item.data }))
      };
    }
    if (sql.includes('SELECT * FROM vps_network_targets WHERE node_id = ? ORDER BY created_at DESC') && method === 'all') {
      return {
        results: state.networkTargets.filter((item) => item.node_id === args[0])
      };
    }
    if (sql.includes('UPDATE vps_network_targets SET force_check_at = datetime("now")') && method === 'run') {
      const target = state.networkTargets.find((item) => item.id === args[0]);
      if (target) target.force_check_at = new Date().toISOString();
      return {};
    }
    if (sql.includes('UPDATE vps_network_targets SET force_check_at = NULL') && method === 'run') {
      const target = state.networkTargets.find((item) => item.id === args[0]);
      if (target) target.force_check_at = null;
      return {};
    }
    if (sql.includes('INSERT INTO vps_network_samples') && method === 'run') {
      state.networkSamples.push({ id: args[0], node_id: args[1], reported_at: args[2], data: args[3] });
      return {};
    }
    throw new Error(`Unhandled SQL: ${sql}`);
  };

  return {
    state,
    prepare(sql) {
      return new MockStatement(handler, sql);
    },
    async batch(statements) {
      for (const statement of statements) {
        await statement.run();
      }
      return [];
    }
  };
}

function createApp(env) {
  const app = new Hono();
  app.use('/api/auth/profile', jwt({ secret: env.JWT_SECRET, alg: 'HS256' }));
  app.route('/api/auth', auth);
  app.route('/api/vps', vps);
  return app;
}

test('hashPassword prefixes sha256 and verifyPassword matches', async () => {
  const hashed = await hashPassword('secret-123');
  assert.match(hashed, /^sha256:/);
  assert.equal(await verifyPassword(hashed, 'secret-123'), true);
  assert.equal(await verifyPassword(hashed, 'wrong'), false);
});

test('normalizeReportTimestamp supports seconds timestamps', () => {
  const iso = normalizeReportTimestamp(1710000000, 'fallback');
  assert.equal(typeof iso, 'string');
  assert.notEqual(iso, 'fallback');
  assert.match(iso, /^\d{4}-\d{2}-\d{2}T/);
});

test('safeJsonParse returns fallback for invalid json', () => {
  assert.deepEqual(safeJsonParse('{bad', { ok: false }), { ok: false });
  assert.deepEqual(safeJsonParse('{"ok":true}', {}), { ok: true });
});

test('executeTargetCheck reports reachable target via fetch', async () => {
  const result = await executeTargetCheck(
    { type: 'http', target: 'example.com', scheme: 'https', path: '/' },
    async () => ({ ok: true, status: 204 })
  );
  assert.equal(result.ok, true);
  assert.equal(result.status, 204);
  assert.equal(result.mode, 'http');
});

test('sendTestNotifications aggregates channel results', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({ code: 200 })
    };
  };

  const result = await sendTestNotifications({
    notificationEnabled: true,
    telegram: { enabled: true, botToken: 'token', chatId: 'chat' },
    webhook: { enabled: true, url: 'https://example.com/hook' },
    pushplus: { enabled: true, token: 'push-key' }
  }, fetchImpl);

  assert.equal(result.successCount, 3);
  assert.equal(result.failureCount, 0);
  assert.equal(calls.length, 3);
});

test('auth login succeeds and migrates plain password hash', async () => {
  const db = createDb();
  db.state.users[0].password_hash = 'plain-secret';
  const env = { JWT_SECRET: 'jwt-secret', MIPULSE_DB: db };
  const app = createApp(env);
  const response = await app.request('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'plain-secret' })
  }, env);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.match(db.state.users[0].password_hash, /^sha256:/);
});

test('settings endpoints persist and read normalized settings', async () => {
  const db = createDb();
  const env = { JWT_SECRET: 'jwt-secret', MIPULSE_DB: db, MIPULSE_KV: { delete: async () => {} } };
  const app = createApp(env);

  const saveResponse = await app.request('http://localhost/api/vps/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vps_monitor_json: { reportIntervalMinutes: 1 },
      notification_json: { enabled: true, webhook: { enabled: true, url: 'https://example.com/hook' } }
    })
  }, env);
  const savePayload = await saveResponse.json();
  assert.equal(savePayload.success, true);

  const readResponse = await app.request('http://localhost/api/vps/settings', {}, env);
  const readPayload = await readResponse.json();
  assert.equal(readPayload.success, true);
  assert.equal(readPayload.data.vps_monitor_json.reportIntervalMinutes, 1);
  assert.equal(readPayload.data.notification_json.enabled, true);
});

test('report endpoint updates node and stores report', async () => {
  const db = createDb();
  const env = { JWT_SECRET: 'jwt-secret', MIPULSE_DB: db };
  const app = createApp(env);

  const response = await app.request('http://localhost/api/vps/report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-node-id': 'node-1',
      'x-node-secret': 'node-secret'
    },
    body: JSON.stringify({ cpuPercent: 10, traffic: { rx: 100, tx: 200 } })
  }, env);
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(db.state.nodes[0].status, 'online');
  assert.equal(db.state.reports.length, 1);
});

test('probe check queue and result submission work for remote node', async () => {
  const db = createDb();
  db.state.networkTargets.push({ id: 'target-2', node_id: 'node-1', type: 'http', target: 'node.local', name: 'Local', scheme: 'https', port: null, path: '/', enabled: 1, force_check_at: null });
  const env = { JWT_SECRET: 'jwt-secret', MIPULSE_DB: db };
  const app = createApp(env);

  const token = await sign({ id: 1, username: 'admin', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 }, env.JWT_SECRET);

  const queueResponse = await app.request('http://localhost/api/vps/targets/check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ nodeId: 'node-1', targetId: 'target-2' })
  }, env);
  const queuePayload = await queueResponse.json();
  assert.equal(queuePayload.success, true);
  assert.equal(queuePayload.data.status, 'queued');

  const fetchChecksResponse = await app.request('http://localhost/api/vps/probe/checks?nodeId=node-1&secret=node-secret', {}, env);
  const fetchChecksPayload = await fetchChecksResponse.json();
  assert.equal(fetchChecksPayload.success, true);
  assert.equal(fetchChecksPayload.data.length, 1);

  const submitResponse = await app.request('http://localhost/api/vps/probe/check-results', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-node-id': 'node-1',
      'x-node-secret': 'node-secret'
    },
    body: JSON.stringify({ checks: [{ targetId: 'target-2', ok: true, latencyMs: 12 }] })
  }, env);
  const submitPayload = await submitResponse.json();
  assert.equal(submitPayload.success, true);
  assert.equal(db.state.networkSamples.length, 1);
  assert.equal(db.state.networkTargets.find((item) => item.id === 'target-2').force_check_at, null);

  const targetsResponse = await app.request('http://localhost/api/vps/targets?nodeId=node-1', {}, env);
  const targetsPayload = await targetsResponse.json();
  assert.equal(targetsPayload.success, true);
  assert.equal(targetsPayload.data[0].latestSample.latencyMs, 12);
});

test('probe checks text endpoint exposes typed check rows', async () => {
  const db = createDb();
  db.state.networkTargets.push({ id: 'icmp-1', node_id: 'node-1', type: 'icmp', target: '1.1.1.1', name: 'Ping', scheme: '', port: null, path: '', enabled: 1, force_check_at: '2026-01-01T00:00:00Z' });
  db.state.networkTargets.push({ id: 'tcp-1', node_id: 'node-1', type: 'tcp', target: 'example.com', name: 'Port 443', scheme: '', port: 443, path: '', enabled: 1, force_check_at: '2026-01-01T00:00:00Z' });
  const env = { JWT_SECRET: 'jwt-secret', MIPULSE_DB: db };
  const app = createApp(env);

  const response = await app.request('http://localhost/api/vps/probe/checks.txt?nodeId=node-1&secret=node-secret', {}, env);
  const text = await response.text();
  assert.equal(response.status, 200);
  assert.match(text, /icmp-1\|icmp\|1\.1\.1\.1\|\|\|/);
  assert.match(text, /tcp-1\|tcp\|example\.com\|\|443\|/);
});
