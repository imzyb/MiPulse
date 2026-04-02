#!/bin/bash

# MiPulse Cloudflare Pages 部署配置脚本
# 使用方式: ./deploy.sh
# 此脚本将帮助配置 Cloudflare Pages 连接到您的 GitHub 仓库

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

# 部署到 Cloudflare Pages (GitHub 集成)
deploy_to_cloudflare() {
    print_section "Cloudflare Pages 部署配置"
    
    print_info "此脚本配置完成后，请按以下步骤操作："
    echo ""
    echo "1. 访问 Cloudflare Dashboard:"
    echo "   https://dash.cloudflare.com → Pages"
    echo ""
    echo "2. 点击 'Create a project' → 'Connect to Git'"
    echo ""
    echo "3. 选择您的 GitHub 账户和 fork 的仓库"
    echo ""
    echo "4. 配置构建设置:"
    echo "   - Production branch: main (或您的主分支)"
    echo "   - Build command: npm run build"
    echo "   - Build output directory: dist"
    echo "   - Root directory: / (留空)"
    echo ""
    echo "5. 添加环境变量 (Settings → Environment variables):"
    echo "   - ENVIRONMENT: production"
    echo ""
    echo "6. 配置 D1 和 KV 绑定 (Settings → Functions → D1/KV namespace bindings)"
    echo ""
    
    print_step "配置指导已显示"
    print_info "按照上述步骤在 Cloudflare Dashboard 中完成配置"
}

# 显示帮助信息
show_help() {
    echo "使用方式: $0"
    echo ""
    echo "功能:"
    echo "  配置 Cloudflare Pages 连接到您的 GitHub 仓库"
    echo "  提供自动部署的配置指导"
    echo ""
    echo "优势:"
    echo "  ✓ 推送代码自动部署"
    echo "  ✓ 支持分支预览"
    echo "  ✓ 便于后续更新"
    echo ""
}

# 主流程
main() {
    print_banner
    
    print_info "此脚本将帮助您配置 Cloudflare Pages 连接到 GitHub 仓库"
    print_info "部署将通过 GitHub 集成自动进行"
    echo ""
    
    # 执行配置步骤
    check_prerequisites
    check_git_status
    install_dependencies
    build_project
    
    deploy_to_cloudflare
    
    print_section "配置完成！"
    echo -e "${GREEN}✓ MiPulse Cloudflare Pages 配置完成${NC}"
    echo ""
    echo "下一步操作:"
    echo "  1. 按照上述指导在 Cloudflare Dashboard 中连接您的 GitHub 仓库"
    echo "  2. 配置 D1 数据库和 KV 命名空间绑定"
    echo "  3. 推送代码到 GitHub 将自动触发部署"
    echo ""
    echo "自动部署优势:"
    echo "  ✓ 推送代码自动部署"
    echo "  ✓ 支持分支预览"
    echo "  ✓ 便于后续更新"
    echo "  ✓ 团队协作友好"
    echo ""
}

# 错误处理
trap 'print_error "部署失败，退出代码: $?"; exit 1' ERR

main "$@"
