#!/bin/bash

# MiPulse Database Migration Script
# 执行数据库迁移以添加缺失的列

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() {
    echo -e "${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_section() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# 检查参数
if [ $# -lt 1 ]; then
    echo "用法: $0 <database_id>"
    echo "示例: $0 12345678-1234-1234-1234-123456789012"
    exit 1
fi

DATABASE_ID="$1"

print_section "MiPulse 数据库迁移"
print_info "数据库 ID: $DATABASE_ID"
print_info "迁移内容: 添加 network_monitor_enabled 列到 vps_nodes 表"

# 检查 wrangler 是否可用
if ! command -v wrangler &> /dev/null; then
    print_error "未找到 wrangler CLI，请先安装"
    exit 1
fi

print_step "wrangler CLI 已找到"

# 执行迁移
print_info "执行数据库迁移..."

if wrangler d1 execute "$DATABASE_ID" --file=migration_add_network_monitor.sql; then
    print_step "数据库迁移成功完成！"
    echo ""
    echo "迁移内容:"
    echo "  ✓ 添加了 network_monitor_enabled 列到 vps_nodes 表"
    echo "  ✓ 默认值为 1 (启用网络监控)"
    echo ""
    print_info "现在您可以正常访问 MiPulse 应用了"
else
    print_error "数据库迁移失败"
    echo ""
    echo "可能的解决方案:"
    echo "  1. 检查数据库 ID 是否正确"
    echo "  2. 确认您有数据库的访问权限"
    echo "  3. 检查 wrangler 认证状态: wrangler auth login"
    echo "  4. 手动执行迁移 SQL:"
    echo "     ALTER TABLE vps_nodes ADD COLUMN network_monitor_enabled INTEGER DEFAULT 1;"
    echo "     UPDATE vps_nodes SET network_monitor_enabled = 1 WHERE network_monitor_enabled IS NULL;"
    exit 1
fi