import assert from 'node:assert/strict';
import { summarizeNode } from '../functions/api/vps.js';

// 1. 当 networkMonitorEnabled 为 false 时, 应返回 false
{
  const node = {
    id: 'n1',
    name: 'test',
    status: 'online',
    enabled: true,
    networkMonitorEnabled: false,
    useGlobalTargets: false,
    totalRx: 1,
    totalTx: 1,
    trafficLimitGb: 0,
    lastSeenAt: '2026-04-02T00:00:00.000Z',
    updatedAt: '2026-04-02T00:00:00.000Z',
    lastReport: { at: '2026-04-02T00:00:00.000Z' }
  };

  const summary = summarizeNode(node, node.lastReport, { vpsMonitor: {} });
  assert.equal(summary.networkMonitorEnabled, false);
  assert.equal(summary.enabled, true);
}

// 2. 当 networkMonitorEnabled 未设置时, 默认为 true
{
  const node = {
    id: 'n2',
    name: 'test2',
    status: 'offline',
    enabled: true,
    useGlobalTargets: true,
    totalRx: 0,
    totalTx: 0,
    trafficLimitGb: 0,
    lastSeenAt: null,
    updatedAt: '2026-04-02T00:00:00.000Z',
    lastReport: null
  };

  const summary = summarizeNode(node, null, { vpsMonitor: {} });
  assert.equal(summary.networkMonitorEnabled, true);
  assert.equal(summary.status, 'offline');
}

console.log('✅ summarizeNode tests passed');
