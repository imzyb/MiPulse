CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin',
  must_change_password INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vps_nodes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tag TEXT,
    group_tag TEXT,
    region TEXT,
    country_code TEXT,
    description TEXT,
    secret TEXT NOT NULL,
    status TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    use_global_targets INTEGER DEFAULT 0,
    network_monitor_enabled INTEGER DEFAULT 1,
    total_rx INTEGER DEFAULT 0,
    total_tx INTEGER DEFAULT 0,
    traffic_limit_gb INTEGER DEFAULT 0,
    last_seen_at DATETIME,
    last_report_json TEXT,
    overload_state_json TEXT,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vps_reports (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    reported_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vps_alerts (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vps_network_targets (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    type TEXT NOT NULL,
    target TEXT NOT NULL,
    name TEXT,
    scheme TEXT,
    port INTEGER,
    path TEXT,
    enabled INTEGER DEFAULT 1,
    force_check_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vps_network_samples (
    id TEXT PRIMARY KEY,
    node_id TEXT NOT NULL,
    reported_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vps_nodes_updated_at ON vps_nodes(updated_at);
CREATE INDEX IF NOT EXISTS idx_vps_nodes_deleted_at ON vps_nodes(deleted_at);
CREATE INDEX IF NOT EXISTS idx_vps_reports_node_time ON vps_reports(node_id, reported_at);
CREATE INDEX IF NOT EXISTS idx_vps_alerts_node_time ON vps_alerts(node_id, created_at);
CREATE INDEX IF NOT EXISTS idx_vps_network_targets_node ON vps_network_targets(node_id, created_at);
CREATE INDEX IF NOT EXISTS idx_vps_network_samples_node_time ON vps_network_samples(node_id, reported_at);
CREATE INDEX IF NOT EXISTS idx_settings_updated_at ON settings(updated_at);

-- Audit Logs Table for Security & Compliance
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    old_value TEXT,
    new_value TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);

-- Default Settings Initialization
INSERT OR IGNORE INTO settings (key, value) VALUES ('vps_monitor_json', '{"requireSecret":true,"requireSignature":false,"signatureClockSkewMinutes":5,"offlineThresholdMinutes":5,"reportIntervalMinutes":1,"reportStoreIntervalMinutes":5,"alertsEnabled":false,"notifyOffline":true,"notifyRecovery":true,"notifyOverload":true,"cpuWarnPercent":90,"memWarnPercent":90,"diskWarnPercent":90,"alertCooldownMinutes":30,"overloadConfirmCount":3,"reportRetentionDays":7}');
INSERT OR IGNORE INTO settings (key, value) VALUES ('notification_json', '{"enabled":false,"telegram":{"enabled":false,"botToken":"","chatId":""},"webhook":{"enabled":false,"url":""},"pushplus":{"enabled":false,"token":""}}');
INSERT OR IGNORE INTO settings (key, value) VALUES ('theme_json', '{"publicThemePreset":"tech","publicThemeTitle":"MiPulse","publicThemeSubtitle":"Real-time monitoring of our global infrastructure. Transparency by default.","publicThemeFooterText":"Powered by MiPulse & Cloudflare"}');
INSERT OR IGNORE INTO settings (key, value) VALUES ('layout_json', '{"showCharts":true,"showTraffic":true}');
INSERT OR IGNORE INTO settings (key, value) VALUES ('network_monitor_json', '{"globalEnabled":true,"intervalMin":5,"targetLimit":5,"keepHistoryDays":3}');
