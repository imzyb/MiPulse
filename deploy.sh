#!/bin/bash

# MiPulse 一键部署脚本
# 使用方式: ./deploy.sh
# 示例: ./deploy.sh

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 打印彩色输出
print_banner() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  MiPulse 部署脚本                                          ║${NC}"
    echo -e "${BLUE}║  Deploy to Cloudflare Workers & Pages                      ║${NC}"
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

# 检查前置条件
check_prerequisites() {
    print_section "检查前置条件"
    
    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        print_error "未找到 Node.js，请先安装"
        exit 1
    fi
    print_step "Node.js 已安装: $(node --version)"
    
    # 检查 npm
    if ! command -v npm &> /dev/null; then
        print_error "未找到 npm，请先安装"
        exit 1
    fi
    print_step "npm 已安装: $(npm --version)"
    
    # 检查 wrangler
    if ! command -v wrangler &> /dev/null; then
        print_error "未找到 wrangler CLI"
        read -p "是否安装全局 wrangler? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            npm install -g wrangler
            print_step "wrangler 已安装"
        else
            exit 1
        fi
    else
        print_step "wrangler 已安装: $(wrangler --version)"
    fi
    
    # 检查 git
    if ! command -v git &> /dev/null; then
        print_error "未找到 git"
        exit 1
    fi
    print_step "git 已安装"
    
    # 检查 wrangler.toml
    if [ ! -f "wrangler.toml" ]; then
        print_error "wrangler.toml 不存在"
        read -p "是否运行自动配置脚本? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if [ -x "./setup.sh" ]; then
                ./setup.sh
            else
                chmod +x ./setup.sh
                ./setup.sh
            fi
        else
            print_info "请先配置 wrangler.toml"
            print_info "您可以:"
            echo "  1. 复制 wrangler.toml.example 到 wrangler.toml"
            echo "  2. 运行 ./setup.sh"
            exit 1
        fi
    fi
    print_step "wrangler.toml 已配置"
}

# 检查本地改动
check_git_status() {
    print_section "检查 git 状态"
    
    if [ -z "$(git status --porcelain)" ]; then
        print_step "工作目录清洁"
    else
        echo -e "${YELLOW}变更列表:${NC}"
        git status --short
        echo ""
        read -p "继续部署? (y/n) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "中止部署"
            exit 0
        fi
    fi
}

# 安装依赖
install_dependencies() {
    print_section "安装依赖"
    
    if [ -d "node_modules" ]; then
        print_info "node_modules 已存在，跳过 npm install"
        read -p "是否重新安装依赖? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            npm install
            print_step "依赖已安装"
        fi
    else
        npm install
        print_step "依赖已安装"
    fi
}

# 构建项目
build_project() {
    print_section "构建项目"
    
    print_info "运行: npm run build"
    npm run build
    
    if [ -d "dist" ]; then
        local file_count=$(find dist -type f | wc -l)
        print_step "项目构建成功 ($file_count 个文件)"
    else
        print_error "构建失败，dist 目录不存在"
        exit 1
    fi
}

# 部署到 Cloudflare
deploy_to_cloudflare() {
    local env=$1
    
    print_section "部署到 Cloudflare ($env 环境)"
    
    print_info "正在部署..."
    print_info "命令: wrangler pages deploy dist --env $env"
    
    if wrangler pages deploy dist --env "$env"; then
        print_step "部署成功!"
    else
        print_error "部署失败"
        exit 1
    fi
}

# 运行部署后检查
post_deploy_checks() {
    local env=$1
    
    print_section "部署后检查"
    
    print_info "验证 KV 绑定..."
    if wrangler kv:key list --binding MIPULSE_KV --env "$env" &> /dev/null; then
        print_step "KV 绑定正常"
    else
        print_error "KV 绑定检查失败"
    fi
    
    print_info "查看部署日志..."
    if command -v wrangler &> /dev/null; then
        wrangler tail --env "$env" --format json 2>/dev/null | head -20 || true
    fi
}

# 显示帮助信息
show_help() {
    echo "使用方式: $0"    echo ""
    echo "参数:"
    echo "  (无参数)    部署到生产环境"
    echo ""
    echo "示例:"
    echo "  $0                # 部署到生产环境"
    echo ""
}

# 主流程
main() {
    print_banner
    
    # 获取环境参数
    local ENVIRONMENT="${1:-production}"
    
    if [ "$ENVIRONMENT" = "--help" ] || [ "$ENVIRONMENT" = "-h" ]; then
        show_help
        exit 0
    fi
    
    # 验证环境参数
    if [ "$ENVIRONMENT" != "production" ]; then
        print_error "无效的环境: $ENVIRONMENT"
        show_help
        exit 1
    fi
    
    print_info "目标环境: $ENVIRONMENT"
    echo ""
    
    # 执行部署步骤
    check_prerequisites
    check_git_status
    install_dependencies
    build_project
    
    read -p "继续部署到 $ENVIRONMENT 环境? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "中止部署"
        exit 0
    fi
    
    deploy_to_cloudflare "$ENVIRONMENT"
    post_deploy_checks "$ENVIRONMENT"
    
    print_section "部署完成！"
    echo -e "${GREEN}✓ MiPulse 已部署到 $ENVIRONMENT 环境${NC}"
    echo ""
    echo "后续步骤:"
    echo "  1. 访问您的应用"
    echo "  2. 监控 Cloudflare Dashboard:"
    echo "     - Workers Logs"
    echo "     - D1 Analytics (应该看到 Rows Read 大幅下降)"
    echo "     - KV Analytics"
    echo ""
    echo "需要帮助?"
    echo "  - 查看部署指南: QUICK_DEPLOY_GUIDE.md"
    echo "  - 查看优化指南: OPTIMIZATION_GUIDE.md"
    echo ""
}

# 错误处理
trap 'print_error "部署失败，退出代码: $?"; exit 1' ERR

main "$@"
