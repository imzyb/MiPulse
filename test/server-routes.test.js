import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { jwt } from 'hono/jwt';
import { sign } from 'hono/jwt';
import worker, { handleScheduled } from '../src/server/index.js';
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
    alerts: [],
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
    if (sql.includes('SELECT id, name, tag, group_tag AS groupTag, region, country_code AS countryCode, secret, status, enabled, network_monitor_enabled AS networkMonitorEnabled, last_report_json AS lastReport, total_rx AS totalRx, total_tx AS totalTx FROM vps_nodes') && method === 'all') {
      return {
        results: state.nodes.map((node) => ({
          id: node.id,
          name: node.name,
          tag: node.tag,
          groupTag: node.group_tag,
          region: node.region,
          countryCode: node.country_code,
          secret: node.secret,
          status: node.status,
          enabled: node.enabled,
          networkMonitorEnabled: node.network_monitor_enabled,
          lastReport: node.last_report_json,
          totalRx: node.total_rx,
          totalTx: node.total_tx
        }))
      };
    }
    if (sql.includes("UPDATE vps_nodes SET status = 'offline' WHERE id = ?") && method === 'run') {
      const node = state.nodes.find((item) => item.id === args[0]);
      if (node) node.status = 'offline';
      return {};
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
    if (sql.includes("DELETE FROM vps_reports WHERE reported_at < datetime('now', ?)") && method === 'run') {
      const daysArg = String(args[0] || '-7 days');
      const match = daysArg.match(/-(\d+)\s+days/);
      const retentionDays = match ? Number(match[1]) : 7;
      const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      state.reports = state.reports.filter((item) => new Date(item.reported_at).getTime() >= cutoff);
      return {};
    }
    if (sql.includes("DELETE FROM vps_network_samples WHERE reported_at < datetime('now', ?)") && method === 'run') {
      const daysArg = String(args[0] || '-3 days');
      const match = daysArg.match(/-(\d+)\s+days/);
      const retentionDays = match ? Number(match[1]) : 3;
      const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
      state.networkSamples = state.networkSamples.filter((item) => new Date(item.reported_at).getTime() >= cutoff);
      return {};
    }
    if (sql.includes('SELECT key, value FROM settings') && method === 'all') {
      return {
        results: Object.entries(state.settings).map(([key, value]) => ({ key, value }))
      };
    }
    if (sql.includes('SELECT id, node_id AS nodeId, type, message, created_at AS createdAt FROM vps_alerts ORDER BY created_at DESC LIMIT 100') && method === 'all') {
      return {
        results: state.alerts
          .slice()
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 100)
          .map((item) => ({
            id: item.id,
            nodeId: item.node_id,
            type: item.type,
            message: item.message,
            createdAt: item.created_at
          }))
      };
    }
    if (sql.includes("SELECT id, created_at AS createdAt FROM vps_alerts") && method === 'first') {
      const items = state.alerts
        .filter((item) => item.node_id === args[0] && item.type === 'offline')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const alert = items[0];
      return alert ? { id: alert.id, createdAt: alert.created_at } : null;
    }
    if (sql.includes('INSERT INTO vps_alerts') && method === 'run') {
      state.alerts.push({ id: args[0], node_id: args[1], type: args[2], message: args[3], created_at: args[4] });
      return {};
    }
    if (sql.includes('DELETE FROM vps_alerts') && method === 'run') {
      state.alerts = [];
      return {};
    }
    if (sql.includes("SELECT id, name FROM vps_nodes") && sql.includes("last_seen_at < datetime('now', ?)") && method === 'all') {
      const minutesArg = String(args[0] || '-5 minutes');
      const match = minutesArg.match(/-(\d+)\s+minutes/);
      const thresholdMinutes = match ? Number(match[1]) : 5;
      const cutoff = Date.now() - thresholdMinutes * 60 * 1000;
      return {
        results: state.nodes
          .filter((item) => item.status === 'online' && item.last_seen_at && new Date(item.last_seen_at).getTime() < cutoff)
          .map((item) => ({ id: item.id, name: item.name }))
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
    if (sql.includes('INSERT INTO vps_network_targets (id, node_id, type, target, name, enabled)') && method === 'run') {
      state.networkTargets.push({ id: args[0], node_id: args[1], type: args[2], target: args[3], name: args[4], enabled: 1, scheme: '', port: null, path: '', force_check_at: null });
      return {};
    }
    if (sql.includes('DELETE FROM vps_network_targets WHERE id = ?') && method === 'run') {
      state.networkTargets = state.networkTargets.filter((item) => item.id !== args[0]);
      return {};
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
  assert.equal(db.state.nodes[0].total_rx, 0);
  assert.equal(db.state.nodes[0].total_tx, 0);
});

test('nodes endpoint returns accumulated traffic fields', async () => {
  const db = createDb();
  db.state.nodes[0].total_rx = 1024;
  db.state.nodes[0].total_tx = 2048;
  const env = { JWT_SECRET: 'jwt-secret', MIPULSE_DB: db };
  const app = createApp(env);

  const response = await app.request('http://localhost/api/vps/nodes', {}, env);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(payload.data[0].totalRx, 1024);
  assert.equal(payload.data[0].totalTx, 2048);
});

test('report endpoint treats counter reset as new baseline traffic delta', async () => {
  const db = createDb();
  db.state.nodes[0].last_seen_at = '2026-01-01T00:00:00.000Z';
  db.state.nodes[0].last_report_json = JSON.stringify({ traffic: { rx: 5000, tx: 7000 } });
  db.state.nodes[0].total_rx = 100;
  db.state.nodes[0].total_tx = 200;
  const env = { JWT_SECRET: 'jwt-secret', MIPULSE_DB: db };
  const app = createApp(env);

  const response = await app.request('http://localhost/api/vps/report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-node-id': 'node-1',
      'x-node-secret': 'node-secret'
    },
    body: JSON.stringify({ timestamp: '2026-01-01T00:01:00.000Z', traffic: { rx: 50, tx: 80 } })
  }, env);
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.success, true);
  assert.equal(db.state.nodes[0].total_rx, 150);
  assert.equal(db.state.nodes[0].total_tx, 280);
});

test('scheduled task cleans old reports and suppresses duplicate offline alerts within cooldown', async () => {
  const db = createDb();
  db.state.settings.vps_monitor_json = JSON.stringify({
    offlineThresholdMinutes: 5,
    reportRetentionDays: 3,
    alertCooldownMinutes: 30
  });
  db.state.settings.network_monitor_json = JSON.stringify({ keepHistoryDays: 2 });
  db.state.nodes[0].status = 'online';
  db.state.nodes[0].last_seen_at = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  db.state.reports.push(
    { id: 'old-report', node_id: 'node-1', reported_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), data: '{}' },
    { id: 'new-report', node_id: 'node-1', reported_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), data: '{}' }
  );
  db.state.networkSamples.push(
    { id: 'old-sample', node_id: 'node-1', reported_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), data: '{}' },
    { id: 'new-sample', node_id: 'node-1', reported_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), data: '{}' }
  );
  db.state.alerts.push({
    id: 'alert-1',
    node_id: 'node-1',
    type: 'offline',
    message: 'Node Node 1 is offline (Heartbeat missed)',
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString()
  });

  await handleScheduled({}, { MIPULSE_DB: db }, {});

  assert.equal(db.state.nodes[0].status, 'offline');
  assert.equal(db.state.reports.some((item) => item.id === 'old-report'), false);
  assert.equal(db.state.reports.some((item) => item.id === 'new-report'), true);
  assert.equal(db.state.networkSamples.some((item) => item.id === 'old-sample'), false);
  assert.equal(db.state.networkSamples.some((item) => item.id === 'new-sample'), true);
  assert.equal(db.state.alerts.length, 1);
});

test('scheduled task creates offline alert after cooldown window', async () => {
  const db = createDb();
  db.state.settings.vps_monitor_json = JSON.stringify({
    offlineThresholdMinutes: 5,
    reportRetentionDays: 7,
    alertCooldownMinutes: 30
  });
  db.state.nodes[0].status = 'online';
  db.state.nodes[0].last_seen_at = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  db.state.alerts.push({
    id: 'alert-1',
    node_id: 'node-1',
    type: 'offline',
    message: 'Node Node 1 is offline (Heartbeat missed)',
    created_at: new Date(Date.now() - 31 * 60 * 1000).toISOString()
  });

  await worker.scheduled({}, { MIPULSE_DB: db }, {});

  assert.equal(db.state.nodes[0].status, 'offline');
  assert.equal(db.state.alerts.length, 2);
});

test('alerts endpoint uses cache until invalidated by clear', async () => {
  const db = createDb();
  db.state.alerts.push({
    id: 'alert-1',
    node_id: 'node-1',
    type: 'offline',
    message: 'Node Node 1 is offline (Heartbeat missed)',
    created_at: new Date().toISOString()
  });
  const env = { JWT_SECRET: 'jwt-secret', MIPULSE_DB: db };
  const app = createApp(env);

  const firstResponse = await app.request('http://localhost/api/vps/alerts', {}, env);
  const firstPayload = await firstResponse.json();
  assert.equal(firstPayload.data.length, 1);

  db.state.alerts.push({
    id: 'alert-2',
    node_id: 'node-1',
    type: 'offline',
    message: 'Another alert',
    created_at: new Date(Date.now() + 1000).toISOString()
  });

  const secondResponse = await app.request('http://localhost/api/vps/alerts', {}, env);
  const secondPayload = await secondResponse.json();
  assert.equal(secondPayload.data.length, 1);

  const clearResponse = await app.request('http://localhost/api/vps/alerts', { method: 'DELETE' }, env);
  const clearPayload = await clearResponse.json();
  assert.equal(clearPayload.success, true);

  const thirdResponse = await app.request('http://localhost/api/vps/alerts', {}, env);
  const thirdPayload = await thirdResponse.json();
  assert.equal(thirdPayload.data.length, 0);
});

test('targets endpoint uses cache until target mutation invalidates it', async () => {
  const db = createDb();
  const env = { JWT_SECRET: 'jwt-secret', MIPULSE_DB: db };
  const app = createApp(env);

  const firstResponse = await app.request('http://localhost/api/vps/targets?nodeId=global', {}, env);
  const firstPayload = await firstResponse.json();
  assert.equal(firstPayload.data.length, 1);

  db.state.networkTargets.push({ id: 'target-2', node_id: 'global', type: 'http', target: 'two.example.com', name: 'Two', scheme: 'https', port: null, path: '/', enabled: 1, force_check_at: null });

  const secondResponse = await app.request('http://localhost/api/vps/targets?nodeId=global', {}, env);
  const secondPayload = await secondResponse.json();
  assert.equal(secondPayload.data.length, 1);

  await app.request('http://localhost/api/vps/targets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodeId: 'global', type: 'http', target: 'three.example.com', name: 'Three' })
  }, env);

  const thirdResponse = await app.request('http://localhost/api/vps/targets?nodeId=global', {}, env);
  const thirdPayload = await thirdResponse.json();
  assert.equal(thirdPayload.data.length >= 2, true);
});

test('probe check results throttle network sample writes', async () => {
  const db = createDb();
  db.state.settings.network_monitor_json = JSON.stringify({ intervalMin: 5, keepHistoryDays: 3 });
  db.state.networkTargets.push({ id: 'target-2', node_id: 'node-1', type: 'http', target: 'node.local', name: 'Local', scheme: 'https', port: null, path: '/', enabled: 1, force_check_at: null });
  const env = { JWT_SECRET: 'jwt-secret', MIPULSE_DB: db };
  const app = createApp(env);

  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-node-id': 'node-1',
      'x-node-secret': 'node-secret'
    }
  };

  await app.request('http://localhost/api/vps/probe/check-results', {
    ...requestOptions,
    body: JSON.stringify({ checks: [{ targetId: 'target-2', nodeId: 'node-1', ok: true, latencyMs: 12, checkedAt: '2026-01-01T00:00:00.000Z' }] })
  }, env);

  await app.request('http://localhost/api/vps/probe/check-results', {
    ...requestOptions,
    body: JSON.stringify({ checks: [{ targetId: 'target-2', nodeId: 'node-1', ok: true, latencyMs: 10, checkedAt: '2026-01-01T00:02:00.000Z' }] })
  }, env);

  assert.equal(db.state.networkSamples.length, 1);
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
