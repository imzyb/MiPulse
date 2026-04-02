#!/bin/bash

# MiPulse Cloudflare 配置向导
# 此脚本将交互式地帮助您配置 wrangler.toml
# 需要您提前在 Cloudflare Dashboard 创建 D1 数据库和 KV 命名空间

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印彩色输出
print_banner() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  MiPulse Cloudflare 配置向导                               ║${NC}"
    echo -e "${BLUE}║  请提前创建 D1 数据库和 KV 命名空间，然后输入 ID           ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

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

# 检查是否已存在 wrangler.toml
check_existing_config() {
    if [ -f "wrangler.toml" ]; then
        print_error "wrangler.toml 已存在！"
        echo ""
        read -p "是否重新配置? (y/n) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "跳过配置"
            exit 0
        fi
    fi
}

# 获取或验证 Account ID
get_account_id() {
    print_section "步骤 1: 获取 Cloudflare Account ID"
    
    print_info "从 https://dash.cloudflare.com → Settings → Account ID 复制"
    echo ""
    
    read -p "请输入您的 Account ID: " ACCOUNT_ID
    
    if [ -z "$ACCOUNT_ID" ]; then
        print_error "Account ID 不能为空"
        get_account_id
        return
    fi
    
    print_step "Account ID: $ACCOUNT_ID"
}

# 获取 D1 数据库 ID
get_d1_ids() {
    print_section "步骤 2: 输入 D1 数据库 ID"

    print_info "请先在 Cloudflare Dashboard 创建 D1 数据库"
    print_info "路径: Workers & Pages → D1 → Create database"
    echo ""

    read -p "请输入 D1 数据库 ID: " D1_ID

    if [ -z "$D1_ID" ]; then
        print_error "D1 ID 不能为空"
        get_d1_ids
        return
    fi

    print_step "D1 ID: $D1_ID"
}

# 获取 KV 命名空间 ID
get_kv_ids() {
    print_section "步骤 3: 输入 KV 命名空间 ID"

    print_info "请先在 Cloudflare Dashboard 创建 KV 命名空间"
    print_info "路径: Workers & Pages → KV → Create namespace"
    echo ""

    read -p "请输入 KV 命名空间 ID: " KV_ID

    if [ -z "$KV_ID" ]; then
        print_error "KV ID 不能为空"
        get_kv_ids
        return
    fi

    print_step "KV ID: $KV_ID"
}

# 获取可选配置
get_optional_config() {
    print_section "步骤 4: 可选配置"
    
    read -p "是否使用自定义域名? (y/n) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "请输入您的域名 (例如: example.com): " CUSTOM_DOMAIN
        read -p "请输入 Zone ID (从 Cloudflare Dashboard 获取): " ZONE_ID
        print_step "自定义域名: $CUSTOM_DOMAIN"
        print_step "Zone ID: $ZONE_ID"
    else
        CUSTOM_DOMAIN=""
        ZONE_ID=""
        print_info "使用 Cloudflare Pages 默认域名"
    fi
    
    read -p "是否启用 Cron 触发器 (离线检测)? (y/n) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ENABLE_CRON="yes"
        print_step "启用 Cron 触发器 (每5分钟检测一次离线节点)"
    else
        ENABLE_CRON="no"
        print_info "跳过 Cron 触发器配置"
    fi
}

# 生成 wrangler.toml 文件
generate_wrangler_toml() {
    print_section "步骤 4: 生成配置文件"
    
    # 确定路由配置
    if [ -n "$CUSTOM_DOMAIN" ]; then
        ROUTE_CONFIG="route = \"$CUSTOM_DOMAIN/api/*\""
        ZONE_CONFIG="zone_id = \"$ZONE_ID\""
    else
        ROUTE_CONFIG="# route = \"your-domain.com/api/*\""
        ZONE_CONFIG="# zone_id = \"your-zone-id\""
    fi
    
    # 确定 Cron 配置
    if [ "$ENABLE_CRON" = "yes" ]; then
        CRON_CONFIG='[[triggers.crons]]
crons = ["*/5 * * * *"]'
    else
        CRON_CONFIG='# [[triggers.crons]]
# crons = ["*/5 * * * *"]'
    fi
    
    cat > wrangler.toml << EOF
name = "mipulse"
main = "functions/api/[[path]].js"
type = "service"
compatibility_date = "2024-03-31"

account_id = "$ACCOUNT_ID"
workers_dev = true

[env.production]
$ROUTE_CONFIG
$ZONE_CONFIG
vars = { ENVIRONMENT = "production" }

[[env.production.d1_databases]]
binding = "MIPULSE_DB"
database_name = "mipulse"
database_id = "$D1_ID"

[[env.production.kv_namespaces]]
binding = "MIPULSE_KV"
id = "$KV_ID"

$CRON_CONFIG

[build]
command = "npm install && npm run build"
cwd = "./"
watch_paths = ["src/**/*.js", "src/**/*.vue", "functions/**/*.js"]

[build.upload]
format = "service-worker"
main = "./functions/api/[[path]].js"

[dev]
ip = "127.0.0.1"
port = 8787
local_protocol = "http"
EOF

    print_step "wrangler.toml 已生成"
}

# 验证配置
verify_config() {
    print_section "步骤 5: 验证配置"
    
    if command -v wrangler &> /dev/null; then
        print_info "验证 wrangler 配置..."
        if wrangler publish --dry-run --env production &> /dev/null; then
            print_step "配置验证成功"
        else
            print_error "配置验证失败，请检查您的 ID"
        fi
    else
        print_info "跳过自动验证 (未找到 wrangler CLI)"
    fi
}

# 主流程
main() {
    print_banner
    
    check_existing_config
    get_account_id
    get_d1_ids
    get_kv_ids
    get_optional_config
    generate_wrangler_toml
    verify_config
    
    print_section "配置完成！"
    echo -e "${GREEN}✓ wrangler.toml 已生成${NC}"
    echo ""
    echo "下一步:"
    echo "  1. 本地测试: npm run dev"
    echo "  2. 构建: npm run build"
    echo "  3. 部署: npm run deploy"
    echo ""
    echo "或者直接运行: ./deploy.sh"
    echo ""
}

main
