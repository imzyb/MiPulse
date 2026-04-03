<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { fetchPublicNodes, fetchPublicNodeDetail } from '../lib/api.js';
import { formatNetworkSpeed, formatUptime, formatBytes } from '../lib/utils.js';
import { LayoutDashboard, ShieldCheck, Activity, Globe, Search, LayoutGrid, List, Sun, Moon, ChevronDown, ChevronUp, Server, HardDrive, Cpu, Clock, Network, ArrowUp, ArrowDown } from 'lucide-vue-next';
import VpsMetricChart from '../components/vps/VpsMetricChart.vue';
import Modal from '../components/forms/Modal.vue';

const router = useRouter();
const auth = useAuthStore();
const nodes = ref([]);
const defaultTheme = {
    preset: 'default',
    title: 'MiPulse',
    subtitle: 'Real-time monitoring of our global infrastructure. Transparency by default.',
    logo: '',
    backgroundImage: '',
    showStats: true,
    footerText: 'Powered by MiPulse Monitoring System'
};
const theme = ref({ ...defaultTheme });
const layout = ref({ headerEnabled: true, footerEnabled: true });
const isLoading = ref(true);
const error = ref('');
const errorStatus = ref(null);

const refreshCountdown = ref(60);
const searchQuery = ref('');
const viewMode = ref(localStorage.getItem('mipulse_public_view_mode') || 'list');
const darkMode = ref(localStorage.getItem('mipulse_public_dark_mode') !== 'false');
const nodeHistoryMap = ref({});
const expandedNodes = ref(new Set());
let countdownTimer = null;
let refreshTimer = null;
const isRefreshing = ref(false);
const lastRefreshError = ref(null);
const showNodeDetailModal = ref(false);
const selectedNodeForModal = ref(null);

const loadNodeDetail = async (nodeId) => {
    if (nodeHistoryMap.value[nodeId]) return;
    try {
        const result = await fetchPublicNodeDetail(nodeId);
        if (result && result.success) {
            nodeHistoryMap.value[nodeId] = {
                latencySamples: result.networkSamples || [],
                targetNames: result.targetNames || {}
            };
        }
    } catch (err) {
        console.error('Failed to load node detail:', err);
    }
};

const toggleExpand = (nodeId) => {
    if (expandedNodes.value.has(nodeId)) {
        expandedNodes.value.delete(nodeId);
    } else {
        expandedNodes.value.add(nodeId);
        loadNodeDetail(nodeId);
    }
};

const handleNodeClick = (node) => {
    if (viewMode.value === 'grid') {
        selectedNodeForModal.value = node;
        showNodeDetailModal.value = true;
        loadNodeDetail(node.id);
    } else {
        toggleExpand(node.id);
    }
};

const loadNodes = async (silent = false) => {
    if (!silent) {
        isLoading.value = true;
        error.value = '';
    }
    isRefreshing.value = true;
    
    try {
        const result = await fetchPublicNodes();
        if (result && result.success) {
            nodes.value = result.nodes || [];
            const rawTheme = result.theme || {};
            theme.value = {
                ...defaultTheme,
                ...rawTheme,
                // Map the explicit admin fields to the internal theme keys if they exist
                title: rawTheme.publicThemeTitle || rawTheme.title || defaultTheme.title,
                subtitle: rawTheme.publicThemeSubtitle || rawTheme.subtitle || defaultTheme.subtitle,
                logo: rawTheme.publicThemeLogo || rawTheme.logo || defaultTheme.logo,
                backgroundImage: rawTheme.publicThemeBackgroundImage || rawTheme.backgroundImage || defaultTheme.backgroundImage,
                footerText: rawTheme.publicThemeFooterText || rawTheme.footerText || defaultTheme.footerText,
                preset: rawTheme.publicThemePreset || rawTheme.preset || defaultTheme.preset
            };
            
            layout.value = { ...{ headerEnabled: true, footerEnabled: true }, ...(result.layout || {}) };
            lastRefreshError.value = null;
            
            // Set document title
            const customTitle = theme.value.title !== 'MiPulse' ? theme.value.title : 'MiPulse';
            document.title = `${customTitle} - MiPulse Status`;
        } else {
            const errMsg = result?.error || '无法接入集群';
            if (!silent || nodes.value.length === 0) {
                error.value = errMsg;
            }
            lastRefreshError.value = errMsg;
        }
    } catch (err) {
        const errMsg = err?.response?.data?.error || err.message || '集群离线';
        if (!silent || nodes.value.length === 0) {
            error.value = errMsg;
        }
        lastRefreshError.value = errMsg;
    } finally {
        if (!silent) isLoading.value = false;
        isRefreshing.value = false;
        refreshCountdown.value = 60; // 重置倒计时
        
        // 自动刷新已展开节点的详情
        if (silent && expandedNodes.value.size > 0) {
            expandedNodes.value.forEach(id => {
                fetchPublicNodeDetail(id).then(result => {
                    if (result && result.success) {
                        nodeHistoryMap.value[id] = {
                            latencySamples: result.networkSamples || [],
                            targetNames: result.targetNames || {}
                        };
                    }
                });
            });
        }
    }
};

onMounted(() => {
    // Initial theme sync
    if (darkMode.value) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    loadNodes();
    countdownTimer = setInterval(() => {
        if (refreshCountdown.value > 0) {
            refreshCountdown.value--;
        }
    }, 1000);
    refreshTimer = setInterval(() => loadNodes(true), 60000);
});

const setViewMode = (mode) => {
    viewMode.value = mode;
    localStorage.setItem('mipulse_public_view_mode', mode);
};

const toggleDarkMode = () => {
    darkMode.value = !darkMode.value;
    document.documentElement.classList.toggle('dark', darkMode.value);
    localStorage.setItem('mipulse_public_dark_mode', darkMode.value);
};

onUnmounted(() => {
    if (countdownTimer) clearInterval(countdownTimer);
    if (refreshTimer) clearInterval(refreshTimer);
});

const onlineCount = computed(() => nodes.value.filter(n => n.status === 'online').length);
const totalCount = computed(() => nodes.value.length);
const onlineRate = computed(() => totalCount.value > 0 ? Math.round((onlineCount.value / totalCount.value) * 100) : 0);

const activeTag = ref('All');

const filteredNodes = computed(() => {
    let result = nodes.value;
    if (searchQuery.value.trim()) {
        const query = searchQuery.value.toLowerCase();
        result = result.filter(node => 
            node.name?.toLowerCase().includes(query) ||
            node.region?.toLowerCase().includes(query) ||
            node.groupTag?.toLowerCase().includes(query)
        );
    }
    if (activeTag.value !== 'All') {
        result = result.filter(node => (node.groupTag || 'Default') === activeTag.value);
    }
    return result;
});

const tags = computed(() => {
    const list = new Set(['All']);
    nodes.value.forEach(n => list.add(n.groupTag || 'Default'));
    return Array.from(list);
});

const globalStats = computed(() => {
    let rxSpeed = 0, txSpeed = 0, rxTotal = 0, txTotal = 0;
    nodes.value.forEach(n => {
        if (n.status === 'online') {
            rxSpeed += (n.latest?.traffic?.rx || 0);
            txSpeed += (n.latest?.traffic?.tx || 0);
        }
        rxTotal += (n.totalRx || 0);
        txTotal += (n.totalTx || 0);
    });
    return { 
        rxSpeed, txSpeed, rxTotal, txTotal,
        totalNodes: nodes.value.length,
        onlineNodes: nodes.value.filter(n => n.status === 'online').length,
        offlineNodes: nodes.value.filter(n => n.status === 'offline').length
    };
});

const getMetricValue = (node, metric) => {
    if (!node?.latest) return 0;
    const report = node.latest;
    if (metric === 'cpu') {
        const val = report.cpu?.usage ?? report.cpuPercent ?? 0;
        return typeof val === 'string' ? parseFloat(val).toFixed(2) : Number(val).toFixed(2);
    }
    if (metric === 'mem') return report.mem?.usage ?? report.memPercent ?? 0;
    if (metric === 'disk') return report.disk?.usage ?? report.diskPercent ?? 0;
    return 0;
};

const groupList = computed(() => {
    if (!nodes.value || nodes.value.length === 0) return [];
    const groups = new Map();
    filteredNodes.value.forEach((node) => {
        const key = node.groupTag || 'Default';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(node);
    });
    return Array.from(groups.entries()).map(([name, items], index) => ({
        name,
        nodes: items,
        index
    }));
});

const groupAccent = (index) => {
    const colors = ['#6366f1', '#a855f7', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#06b6d4'];
    return colors[index % colors.length];
};

const getLatencyPoints = (nodeId) => {
    const nodeData = nodeHistoryMap.value[nodeId];
    const samples = nodeData?.latencySamples || [];
    if (!samples.length) return [];
    return samples.map(s => {
        const checks = s.checks || [];
        if (!checks.length) return null;

        // 首选使用已命名的探测项再取首个有效延迟
        const namedCheck = checks.find(c => c.name && c.latencyMs !== null && c.latencyMs !== undefined && c.latencyMs > 0);
        if (namedCheck) return namedCheck.latencyMs;

        const nonZeroCheck = checks.find(c => c.latencyMs !== null && c.latencyMs !== undefined && c.latencyMs > 0);
        if (nonZeroCheck) return nonZeroCheck.latencyMs;

        const firstCheck = checks[0];
        return (firstCheck?.latencyMs !== null && firstCheck?.latencyMs !== undefined) ? firstCheck.latencyMs : null;
    });
};

// 按协议类型分组获取延迟数据 (v1.6.4 支持全屏拉伸与冗余项剔除)
const getLatencyByProtocol = (nodeId) => {
    const nodeData = nodeHistoryMap.value[nodeId];
    const allSamples = nodeData?.latencySamples || [];
    const targetNames = nodeData?.targetNames || {};
    
    // 1. 自动剪裁：找到第一个有【真实探测记录】（非平均值且延迟 > 0）的点
    const firstValidIdx = allSamples.findIndex(s => 
        (s.checks || []).some(c => !String(c.name || '').includes('Average') && c.latencyMs > 0)
    );
    // 强制截断前面的“静默期”，确保曲线从 0 轴开始生长
    const samples = firstValidIdx === -1 ? [] : allSamples.slice(firstValidIdx);
    
    if (!samples.length) return {};
    
    const protocols = {}; 
    const colors = ['#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
    
    // 提取剪裁后的时间戳用于 X 轴
    const timestamps = samples.map(s => s.timestamp);

    // 2. 提取所有唯一的目标名称及其协议
    const targets = [];
    samples.forEach(s => {
        (s.checks || []).forEach(c => {
            const type = (c.type || 'ICMP').toUpperCase();
            const rawName = c.name || c.target || 'Average';
            
            // 只有在当前有效的监控目标列表中的项才显示
            // 解决用户删除监控目标后，其历史数据依然显示在图表上的问题
            if (!targetNames[rawName]) return;
            
            const name = targetNames[rawName] || rawName;
            const key = `${type}:${name}`;
            if (!targets.some(t => t.key === key)) {
                targets.push({ key, type, name, rawName });
            }
        });
    });

    // 3. 构建多系列数据，确保点对点匹配
    targets.forEach((t, idx) => {
        if (!protocols[t.type]) protocols[t.type] = { type: t.type, series: [], timestamps };
        const series = { label: t.name, color: colors[idx % colors.length], points: [] };
        
        // 为每个样本点填充数据
        samples.forEach(s => {
            const check = (s.checks || []).find(c => {
                const cType = (c.type || 'ICMP').toUpperCase();
                const cName = c.name || c.target;
                return cType === t.type && cName === t.rawName;
            });
            series.points.push(check ? check.latencyMs : null);
        });
        protocols[t.type].series.push(series);
    });

    return protocols;
};

const protocolColors = { ICMP: '#06b6d4', TCP: '#f59e0b', HTTP: '#10b981', HTTPS: '#10b981' };

const getStatusColor = (percent) => {
    if (percent >= 90) return '#ef4444'; // Red (High usage)
    if (percent >= 70) return '#f59e0b'; // Amber
    return '#10b981'; // Emerald
};

const getHealthColor = (health) => {
    if (health >= 90) return '#10b981'; // Green (Healthy)
    if (health >= 40) return '#f59e0b'; // Amber (Warning)
    return '#f43f5e'; // Red (Critical)
};

const getLoadColor = (load, cores) => {
    if (!cores || cores <= 0) return 'text-gray-400';
    const ratio = load / cores;
    if (ratio >= 1) return 'text-red-500';
    if (ratio >= 0.7) return 'text-amber-500';
    return 'text-emerald-500 font-bold';
};

const presetVars = computed(() => {
    const preset = String(theme.value.preset || 'default').toLowerCase();
    switch (preset) {
        case 'fresh':
            return {
                '--accent': '#22c55e',
                '--accent-strong': '#16a34a',
                '--accent-soft': 'rgba(34, 197, 94, 0.18)',
                '--glow-1': 'rgba(34, 197, 94, 0.18)',
                '--glow-2': 'rgba(14, 165, 233, 0.16)',
                '--glow-3': 'rgba(20, 83, 45, 0.12)',
                '--pill-bg': 'rgba(34, 197, 94, 0.12)',
                '--pill-border': 'rgba(34, 197, 94, 0.3)',
                '--pill-text': '#4ade80'
            };
        case 'minimal':
            return {
                '--accent': '#94a3b8',
                '--accent-strong': '#e2e8f0',
                '--accent-soft': 'rgba(148, 163, 184, 0.16)',
                '--glow-1': 'rgba(148, 163, 184, 0.08)',
                '--glow-2': 'rgba(15, 23, 42, 0.2)',
                '--glow-3': 'rgba(71, 85, 105, 0.1)',
                '--pill-bg': 'rgba(148, 163, 184, 0.08)',
                '--pill-border': 'rgba(148, 163, 184, 0.2)',
                '--pill-text': '#cbd5f5'
            };
        case 'tech':
            return {
                '--accent': '#06b6d4',
                '--accent-strong': '#0891b2',
                '--accent-soft': 'rgba(6, 182, 212, 0.2)',
                '--glow-1': 'rgba(6, 182, 212, 0.18)',
                '--glow-2': 'rgba(59, 130, 246, 0.16)',
                '--glow-3': 'rgba(15, 23, 42, 0.18)',
                '--pill-bg': 'rgba(6, 182, 212, 0.12)',
                '--pill-border': 'rgba(6, 182, 212, 0.3)',
                '--pill-text': '#67e8f9'
            };
        case 'glass':
            return {
                '--accent': '#f97316',
                '--accent-strong': '#ea580c',
                '--accent-soft': 'rgba(249, 115, 22, 0.2)',
                '--glow-1': 'rgba(249, 115, 22, 0.16)',
                '--glow-2': 'rgba(236, 72, 153, 0.16)',
                '--glow-3': 'rgba(30, 41, 59, 0.2)',
                '--pill-bg': 'rgba(249, 115, 22, 0.12)',
                '--pill-border': 'rgba(249, 115, 22, 0.3)',
                '--pill-text': '#fdba74'
            };
        default:
            return {
                '--accent': '#6366f1',
                '--accent-strong': '#4f46e5',
                '--accent-soft': 'rgba(99, 102, 241, 0.2)',
                '--glow-1': 'rgba(99, 102, 241, 0.18)',
                '--glow-2': 'rgba(147, 51, 234, 0.16)',
                '--glow-3': 'rgba(37, 99, 235, 0.12)',
                '--pill-bg': 'rgba(99, 102, 241, 0.12)',
                '--pill-border': 'rgba(99, 102, 241, 0.3)',
                '--pill-text': '#a5b4fc'
            };
    }
});

const pageBg = computed(() => darkMode.value ? 'bg-[#020617]' : 'bg-[#f8fafc]');
const pageText = computed(() => darkMode.value ? 'text-white' : 'text-slate-900');
const cardBg = computed(() => darkMode.value ? 'bg-white/[0.03] backdrop-blur-3xl' : 'bg-white/70 backdrop-blur-3xl shadow-[0_32px_64px_-16px_rgba(15,23,42,0.1)]');
const cardBorder = computed(() => darkMode.value ? 'border-white/10 ring-1 ring-white/5' : 'border-white/40 ring-1 ring-white/20');
const statsBg = computed(() => darkMode.value ? 'bg-white/[0.03] backdrop-blur-3xl' : 'bg-white/60 shadow-[0_20px_40px_rgba(15,23,42,0.05)] backdrop-blur-xl');
const labelColor = computed(() => darkMode.value ? 'text-gray-500' : 'text-slate-500');
const dividerColor = computed(() => darkMode.value ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)');
</script>

<template>
  <div :class="['min-h-screen selection:bg-indigo-500/30 overflow-x-hidden transition-colors duration-500', pageBg, pageText]" :style="presetVars">
    <div class="fixed inset-0 overflow-hidden pointer-events-none">
        <div class="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full blur-[160px] opacity-60" :style="{ backgroundColor: 'var(--glow-1)' }"></div>
        <div class="absolute top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full blur-[140px] opacity-40" :style="{ backgroundColor: 'var(--glow-2)' }"></div>
        <div class="absolute -bottom-[15%] left-[15%] w-[70%] h-[70%] rounded-full blur-[180px] opacity-30" :style="{ backgroundColor: 'var(--glow-3)' }"></div>
        <div v-if="theme.backgroundImage" class="absolute inset-0 z-0">
            <div class="absolute inset-0 bg-cover bg-center transition-opacity duration-1000" :style="{ backgroundImage: `url(${theme.backgroundImage})`, opacity: darkMode ? 0.4 : 0.15 }"></div>
            <!-- Gradient Overlay to ensure text readability -->
            <div class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#020617]/80" v-if="darkMode"></div>
        </div>
        <div class="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] brightness-100 contrast-150 mix-blend-overlay z-10"></div>
    </div>



    <div class="relative z-10 max-w-7xl mx-auto px-6 py-8 lg:py-16">
        <header v-if="layout && layout.headerEnabled && theme" class="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8 mb-10">
            <div class="space-y-3">
                <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all" :style="{ backgroundColor: 'var(--pill-bg)', borderColor: lastRefreshError ? 'rgba(244,63,94,0.3)' : 'var(--pill-border)', color: lastRefreshError ? '#fb7185' : 'var(--pill-text)', boxShadow: '0 8px 24px var(--pill-bg)' }">
                    <span v-if="isRefreshing" class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>
                    <span v-else-if="lastRefreshError" class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                    <span v-else class="w-1.5 h-1.5 rounded-full relative" :style="{ backgroundColor: 'var(--accent)' }">
                        <span class="absolute inset-0 rounded-full animate-ping opacity-75" :style="{ backgroundColor: 'var(--accent)' }"></span>
                    </span>
                    <span v-if="lastRefreshError">连接异常 · 自动重试中</span>
                    <span v-else-if="isRefreshing">同步中...</span>
                    <span v-else>运行状态概览 · {{ refreshCountdown }}s</span>
                </div>
                <h1 class="text-4xl lg:text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b" :class="darkMode ? 'from-white to-white/40' : 'from-gray-900 to-gray-600'" :style="{ textShadow: darkMode ? '0 12px 40px rgba(0,0,0,0.35)' : 'none' }">
                    <span v-if="theme.logo" class="inline-flex items-center gap-4">
                      <img :src="theme.logo" alt="logo" class="h-12 w-12 lg:h-16 lg:w-16 rounded-[1.2rem] object-cover shadow-2xl ring-2 ring-white/10" />
                      <span class="leading-tight">{{ theme.title || 'MiPulse' }}</span>
                    </span>
                    <span v-else>{{ theme.title || 'MiPulse' }}</span>
                </h1>
                <p class="text-base text-gray-500 font-medium max-w-lg leading-relaxed">
                    {{ theme.subtitle || 'Real-time monitoring of our global infrastructure. Transparency by default.' }}
                </p>
            </div>
            
            <div v-if="theme.showStats !== false" class="z-10 grid grid-cols-2 gap-3 w-auto">
                 <div :class="['backdrop-blur-3xl rounded-xl p-3 lg:p-4 border transition-all flex flex-col justify-center min-w-[130px]', statsBg, cardBorder]" :style="{ boxShadow: darkMode ? '0 8px 30px rgba(0,0,0,0.3)' : '0 6px 20px rgba(0,0,0,0.04)' }">
                     <div class="flex items-center justify-between mb-1">
                        <div class="text-xl font-black" :style="{ color: 'var(--accent)' }">{{ onlineCount }} <span class="text-[10px] text-gray-500 font-bold">/ {{ totalCount }}</span></div>
                        <Activity :size="14" class="opacity-20" />
                     </div>
                     <div class="text-[9px] font-black uppercase tracking-widest" :class="labelColor">节点在线</div>
                     <div class="mt-1.5 h-1 w-full bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                        <div :style="{ width: `${onlineRate}%`, backgroundColor: 'var(--accent)' }" class="h-full transition-all"></div>
                     </div>
                 </div>
                 <div :class="['backdrop-blur-3xl rounded-xl p-3 lg:p-4 border transition-all flex flex-col justify-center min-w-[130px]', statsBg, cardBorder]" :style="{ boxShadow: darkMode ? '0 8px 30px rgba(0,0,0,0.3)' : '0 6px 20px rgba(0,0,0,0.04)' }">
                    <div class="text-2xl font-black text-amber-500 flex items-baseline gap-0.5">
                        {{ onlineRate }}<span class="text-[9px] opacity-50 font-black">%</span>
                    </div>
                    <div class="text-[9px] font-black uppercase tracking-widest" :class="labelColor">健康指数</div>
                    <div class="mt-1.5 flex gap-0.5">
                        <div v-for="i in 5" :key="i" class="h-1 flex-1 rounded-full" :style="{ backgroundColor: i <= (onlineRate/20) ? '#f59e0b' : dividerColor }"></div>
                    </div>
                </div>
            </div>
        </header>

        <!-- TAG FILTERS row -->
        <div v-if="nodes.length" class="mb-6 flex flex-wrap gap-2">
            <button 
                v-for="tag in tags" 
                :key="tag" 
                @click="activeTag = tag"
                :class="[
                  'px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border',
                  activeTag === tag 
                    ? (darkMode ? 'bg-white/10 border-white/20 text-white ring-2 ring-white/10' : 'bg-slate-800 border-slate-700 text-white')
                    : (darkMode ? 'bg-white/[0.03] border-white/5 text-gray-500 hover:bg-white/5' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50')
                ]"
            >
                {{ tag }}
            </button>
        </div>

        <div v-if="nodes.length" class="mb-6 flex items-center justify-end gap-1.5">
            <router-link v-if="auth.isAuthenticated" to="/admin" :class="['flex items-center gap-1.5 px-3 py-1.5 backdrop-blur-2xl border rounded-lg transition-all hover:scale-105 active:scale-95 group text-[10px] font-black uppercase tracking-widest', darkMode ? 'bg-white/5 border-white/10 text-gray-400 hover:text-white' : 'bg-white border-gray-200 text-gray-500 hover:text-gray-900']">
                <LayoutDashboard :size="13" :class="darkMode ? 'text-indigo-400' : 'text-indigo-600'" />
                <span>控制台</span>
            </router-link>
            <div v-if="auth.isAuthenticated" class="w-px h-5 mx-1" :class="darkMode ? 'bg-white/10' : 'bg-gray-200'"></div>
            <button @click="setViewMode('grid')" class="p-1.5 rounded-lg border transition-all" :class="viewMode === 'grid' ? (darkMode ? 'bg-white/10 ring-1 ring-white/20' : 'bg-gray-200 ring-1 ring-gray-300') : (darkMode ? 'bg-white/[0.03] border-white/10 text-gray-500' : 'bg-white border-gray-200 text-gray-400')">
                <LayoutGrid :size="15" />
            </button>
            <button @click="setViewMode('list')" class="p-1.5 rounded-lg border transition-all" :class="viewMode === 'list' ? (darkMode ? 'bg-white/10 ring-1 ring-white/20' : 'bg-gray-200 ring-1 ring-gray-300') : (darkMode ? 'bg-white/[0.03] border-white/10 text-gray-500' : 'bg-white border-gray-200 text-gray-400')">
                <List :size="15" />
            </button>
            <div class="w-px h-5 mx-1" :class="darkMode ? 'bg-white/10' : 'bg-gray-200'"></div>
            <button @click="toggleDarkMode" class="p-1.5 rounded-lg border transition-all flex items-center justify-center" :class="darkMode ? 'bg-white/[0.03] border-white/10 hover:bg-white/10' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'">
                <Sun v-if="darkMode" :size="15" class="text-amber-400" />
                <Moon v-else :size="15" class="text-indigo-400" />
            </button>
        </div>

        <div v-if="isLoading" class="space-y-12 animate-in fade-in duration-700">
            <div v-for="i in 2" :key="i" class="space-y-6">
                <!-- Group Title Skeleton -->
                <div class="flex items-center gap-4">
                    <div class="h-px flex-1 bg-black/5 dark:bg-white/5"></div>
                    <div class="w-32 h-6 skeleton"></div>
                    <div class="h-px flex-1 bg-black/5 dark:bg-white/5"></div>
                </div>
                <!-- Card/List Skeleton -->
                <div :class="viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8' : 'flex flex-col gap-4'">
                    <div v-for="j in 3" :key="j" :class="[
                        'border transition-all overflow-hidden',
                        viewMode === 'grid' ? 'rounded-[2rem] p-8 flex flex-col gap-6 h-[400px]' : 'rounded-2xl p-4 h-20',
                        cardBg, cardBorder
                    ]">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-2xl skeleton"></div>
                            <div class="space-y-2 flex-1">
                                <div class="h-4 w-24 skeleton"></div>
                                <div class="h-3 w-32 skeleton opacity-50"></div>
                            </div>
                        </div>
                        <div v-if="viewMode === 'grid'" class="space-y-4 mt-auto">
                            <div v-for="k in 3" :key="k" class="h-2 w-full skeleton"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div v-else-if="error" class="flex flex-col items-center justify-center py-24 text-center space-y-6">
            <div class="w-16 h-16 rounded-3xl flex items-center justify-center" :style="{ backgroundColor: 'var(--accent-soft)' }">
                <ShieldCheck :size="32" :style="{ color: 'var(--accent)' }" />
            </div>
            <div class="space-y-2">
                <p class="text-lg font-black">无法加载公开监控</p>
                <p class="text-sm text-gray-500">
                    {{ errorStatus === 401 ? '访问被拒绝，请确认 Token 是否正确。' : error }}
                </p>
            </div>
            <button @click="loadNodes" class="px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                :style="{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }">
                重新尝试
            </button>
        </div>

        <div v-else-if="nodes.length" class="space-y-12">
            <section v-for="group in groupList" :key="group.name" class="space-y-6">
                <div class="flex items-center gap-4">
                    <div class="h-px flex-1" :style="{ backgroundColor: dividerColor }"></div>
                    <div class="px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.3em]"
                        :style="{ color: groupAccent(group.index), backgroundColor: darkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', border: `1px solid ${dividerColor}` }">
                        {{ group.name }}
                    </div>
                    <div class="h-px flex-1" :style="{ backgroundColor: dividerColor }"></div>
                </div>

                <div :class="viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start' : 'flex flex-col gap-4'">
                    <div v-for="node in group.nodes" :key="node.id" :class="[
                      'group relative transition-all duration-500 overflow-hidden border cursor-pointer',
                      viewMode === 'grid' ? 'rounded-[2rem] p-8 flex flex-col gap-6 items-start' : 'rounded-2xl p-4 flex flex-col',
                      cardBg, cardBorder,
                      node.status === 'offline' ? 'opacity-75 grayscale-[0.5]' : ''
                    ]" @click="handleNodeClick(node)">
                        
                        <!-- GRID MODE HEADER -->
                        <div v-if="viewMode === 'grid'" class="w-full flex items-start justify-between">
                            <div class="flex flex-col gap-3">
                                <div class="flex items-center gap-3">
                                    <div class="w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-lg border border-white/10 overflow-hidden" :style="{ backgroundColor: 'var(--accent)', color: 'white' }">
                                        <img v-if="node.countryCode" :src="`https://flagcdn.com/w80/${node.countryCode.toLowerCase()}.png`" class="w-full h-full object-cover" :alt="node.countryCode" />
                                        <Server v-else :size="20" />
                                    </div>
                                    <div class="flex flex-col">
                                        <div class="flex items-center gap-2">
                                            <Cpu :size="12" class="opacity-40" />
                                            <span class="text-[10px] font-black uppercase tracking-widest opacity-40">{{ node.tag || 'NODE' }}</span>
                                        </div>
                                        <h3 class="text-2xl font-black tracking-tight leading-none mt-1">{{ node.name }}</h3>
                                    </div>
                                </div>
                                <!-- Badges Area -->
                                <div class="flex items-center gap-2 mt-4">
                                    <template v-if="node.latest?.lossPercent > 0">
                                        <span class="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500 text-[10px] font-black border border-rose-500/20 animate-pulse">
                                            {{ node.latest.lossPercent }}% LOSS
                                        </span>
                                    </template>
                                    <template v-else-if="getLatencyPoints(node.id).length > 0 && getLatencyPoints(node.id)[0] !== null">
                                        <span class="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[10px] font-bold border border-emerald-500/20">
                                            {{ getLatencyPoints(node.id)[0] }}ms
                                        </span>
                                    </template>
                                </div>
                            </div>
                            <div class="relative w-3 h-3">
                                <div class="w-full h-full rounded-full animate-ping absolute opacity-50" :class="node.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'"></div>
                                <div class="w-full h-full rounded-full relative shadow-lg" :class="node.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'"></div>
                            </div>
                        </div>

                        <!-- GRID MODE PROGRESS BARS -->
                        <div v-if="viewMode === 'grid'" class="w-full space-y-5">
                            <!-- CPU -->
                            <div class="space-y-1.5">
                                <div class="flex justify-between items-baseline text-[11px] font-bold">
                                    <span>CPU 负载</span>
                                    <span>{{ getMetricValue(node, 'cpu') }}%</span>
                                </div>
                                <div class="h-2.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden border p-[1px]" :style="{ borderColor: dividerColor }">
                                    <div :style="{ width: `${getMetricValue(node, 'cpu')}%`, backgroundColor: getStatusColor(getMetricValue(node, 'cpu')) }" class="h-full rounded-full transition-all duration-1000 shadow-sm"></div>
                                </div>
                            </div>
                            <!-- RAM -->
                            <div class="space-y-1.5">
                                <div class="flex justify-between items-baseline text-[11px] font-bold">
                                    <div class="flex gap-2 items-center">
                                        <span class="opacity-60">内存</span>
                                        <span v-if="node.latest?.mem?.used" class="opacity-40 font-mono scale-90">{{ formatBytes(node.latest.mem.used) }} / {{ formatBytes(node.latest.mem.total) }}</span>
                                    </div>
                                    <span>{{ getMetricValue(node, 'mem') }}%</span>
                                </div>
                                <div class="h-2.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden border p-[1px]" :style="{ borderColor: dividerColor }">
                                    <div :style="{ width: `${getMetricValue(node, 'mem')}%`, backgroundColor: getStatusColor(getMetricValue(node, 'mem')) }" class="h-full rounded-full transition-all duration-1000 shadow-sm"></div>
                                </div>
                            </div>
                            <!-- DISK -->
                            <div class="space-y-1.5">
                                <div class="flex justify-between items-baseline text-[11px] font-bold">
                                    <div class="flex gap-2 items-center">
                                        <span class="opacity-60">硬盘</span>
                                        <span v-if="node.latest?.disk?.used" class="opacity-40 font-mono scale-90">{{ formatBytes(node.latest.disk.used) }} / {{ formatBytes(node.latest.disk.total) }}</span>
                                    </div>
                                    <span>{{ getMetricValue(node, 'disk') }}%</span>
                                </div>
                                <div class="h-2.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden border p-[1px]" :style="{ borderColor: dividerColor }">
                                    <div :style="{ width: `${getMetricValue(node, 'disk')}%`, backgroundColor: getStatusColor(getMetricValue(node, 'disk')) }" class="h-full rounded-full transition-all duration-1000 shadow-sm"></div>
                                </div>
                            </div>
                        </div>

                        <!-- LIST MODE ALTERNATIVE (NEZHA STYLE + MiPulse Unique) -->
                        <template v-if="viewMode === 'list'">
                          <div class="w-full grid grid-cols-12 gap-4 items-center">
                            <!-- Column 1-3: Identity & Uptime -->
                            <div class="col-span-12 md:col-span-3 flex items-center gap-3">
                                <div class="relative">
                                    <div class="w-10 h-10 rounded-2xl flex items-center justify-center text-sm shadow-inner overflow-hidden" :class="darkMode ? 'bg-white/5' : 'bg-slate-100'" :style="{ color: 'var(--accent)' }">
                                        <img v-if="node.countryCode" :src="`https://flagcdn.com/w80/${node.countryCode.toLowerCase()}.png`" class="w-full h-full object-cover opacity-80" :alt="node.countryCode" />
                                        <Server v-else :size="16" />
                                    </div>
                                    <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 p-0.5 flex items-center justify-center shadow-lg" :class="darkMode ? 'border-[#020617] bg-[#020617]' : 'border-white bg-white'">
                                        <div class="w-full h-full rounded-full" :class="node.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'"></div>
                                    </div>
                                </div>
                                <div class="flex flex-col min-w-0">
                                    <div class="flex items-center gap-2">
                                        <h4 class="text-sm font-black truncate tracking-tight">{{ node.name }}</h4>
                                        <span class="text-[9px] px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/5 border opacity-60" :style="{ borderColor: dividerColor }">{{ node.region || 'GLB' }}</span>
                                    </div>
                                    <div class="flex items-center gap-2 mt-0.5">
                                        <Clock :size="10" class="opacity-30" />
                                        <span class="text-[10px] font-mono opacity-40 font-bold uppercase">{{ formatUptime(node.latest?.uptimeSec || 0) }}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Column 4: System / Load -->
                            <div class="hidden md:flex col-span-1 flex-col gap-0.5 text-center px-2">
                                <span class="text-[9px] font-black opacity-30 uppercase tracking-widest">Load</span>
                                <span class="font-mono text-xs font-black" :class="getLoadColor(node.latest?.load1, node.latest?.cpu?.cores)">{{ node.latest?.load1 || '0.0' }}</span>
                            </div>

                            <!-- Column 5-8: Resource Bars -->
                            <div class="col-span-12 md:col-span-4 grid grid-cols-3 gap-6 px-4 border-x" :style="{ borderColor: dividerColor }">
                                <div class="flex flex-col gap-1.5">
                                    <div class="flex justify-between text-[9px] font-black uppercase tracking-tighter opacity-50">
                                        <span>CPU</span>
                                        <span :class="getStatusColor(getMetricValue(node, 'cpu')) === '#ef4444' ? 'text-rose-500' : ''">{{ getMetricValue(node, 'cpu') }}%</span>
                                    </div>
                                    <div class="h-1 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                                        <div :style="{ width: `${getMetricValue(node, 'cpu')}%`, backgroundColor: getStatusColor(getMetricValue(node, 'cpu')) }" class="h-full rounded-full transition-all duration-700"></div>
                                    </div>
                                </div>
                                <div class="flex flex-col gap-1.5">
                                    <div class="flex justify-between text-[9px] font-black uppercase tracking-tighter opacity-50">
                                        <span>MEM</span>
                                        <span>{{ getMetricValue(node, 'mem') }}%</span>
                                    </div>
                                    <div class="h-1 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                                        <div :style="{ width: `${getMetricValue(node, 'mem')}%`, backgroundColor: getStatusColor(getMetricValue(node, 'mem')) }" class="h-full rounded-full transition-all duration-700"></div>
                                    </div>
                                </div>
                                <div class="flex flex-col gap-1.5">
                                    <div class="flex justify-between text-[9px] font-black uppercase tracking-tighter opacity-50">
                                        <span>DSK</span>
                                        <span>{{ getMetricValue(node, 'disk') }}%</span>
                                    </div>
                                    <div class="h-1 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
                                        <div :style="{ width: `${getMetricValue(node, 'disk')}%`, backgroundColor: getStatusColor(getMetricValue(node, 'disk')) }" class="h-full rounded-full transition-all duration-700"></div>
                                    </div>
                                </div>
                            </div>

                            <!-- Column 9-10: Network Speed (Real-time Delta) -->
                            <div class="col-span-12 md:col-span-2 flex flex-col justify-center px-4">
                                <div class="flex flex-col font-mono font-black">
                                    <div class="flex items-center justify-between text-emerald-500">
                                        <div class="flex items-center gap-1"><ArrowUp :size="10" /> <span class="text-[8px] opacity-50">UP</span></div>
                                        <span class="text-[11px]">{{ formatNetworkSpeed(node.latest?.traffic?.txSpeed || 0) }}</span>
                                    </div>
                                    <div class="flex items-center justify-between text-indigo-500 mt-0.5">
                                        <div class="flex items-center gap-1"><ArrowDown :size="10" /> <span class="text-[8px] opacity-50">DOWN</span></div>
                                        <span class="text-[11px]">{{ formatNetworkSpeed(node.latest?.traffic?.rxSpeed || 0) }}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Column 11-12: Cumulative Stats & Quality -->
                            <div class="col-span-12 md:col-span-2 flex flex-col justify-center pl-4 border-l" :style="{ borderColor: dividerColor }">
                                <div class="flex justify-between items-center text-[10px] font-mono font-black">
                                    <span class="opacity-30 uppercase tracking-widest text-[8px]">Usage</span>
                                    <span class="opacity-60">{{ formatBytes((node.totalRx || 0) + (node.totalTx || 0)) }}</span>
                                </div>
                                <div class="flex justify-between items-center mt-1 text-[10px] font-mono font-black">
                                    <span class="opacity-30 uppercase tracking-widest text-[8px]">Network</span>
                                    <div class="flex items-center gap-2">
                                        <span v-if="node.latest?.lossPercent > 0" class="text-rose-500 text-[9px] font-black animate-pulse">
                                            {{ node.latest.lossPercent === 100 ? 'TIMEOUT' : node.latest.lossPercent + '% LOSS' }}
                                        </span>
                                        <span class="text-emerald-500" v-else-if="getLatencyPoints(node.id).length > 0 && getLatencyPoints(node.id)[0] !== null">
                                            {{ getLatencyPoints(node.id)[0] }}ms
                                        </span>
                                        <span class="opacity-40" v-else>--</span>
                                    </div>
                                </div>
                            </div>
                          </div>
                        </template>

                        <!-- SHARED OPERATIONAL STATS SECTION (ONLY GRID) -->
                        <div v-if="viewMode === 'grid'" class="w-full grid grid-cols-2 gap-4">
                            <div class="col-span-1 p-4 rounded-3xl border flex flex-col gap-2" :class="darkMode ? 'bg-white/[0.02]' : 'bg-gray-50/50'" :style="{ borderColor: dividerColor }">
                                <div class="flex justify-between items-center text-[10px] font-bold opacity-40 uppercase tracking-widest">
                                    <span>带宽 / 流量</span>
                                    <Globe :size="10" />
                                </div>
                                <div class="space-y-1.5 font-mono">
                                    <div class="flex justify-between items-center text-[11px]">
                                        <span class="flex items-center gap-1 text-emerald-500"><ArrowUp :size="10"/> Speed</span>
                                        <span class="font-bold">{{ formatNetworkSpeed(node.latest?.traffic?.txSpeed || 0) }}</span>
                                    </div>
                                    <div class="flex justify-between items-center text-[11px]">
                                        <span class="flex items-center gap-1 text-indigo-500"><ArrowDown :size="10"/> Speed</span>
                                        <span class="font-bold">{{ formatNetworkSpeed(node.latest?.traffic?.rxSpeed || 0) }}</span>
                                    </div>
                                </div>
                            </div>
                            <div class="col-span-1 p-4 rounded-3xl border flex flex-col gap-2" :class="darkMode ? 'bg-white/[0.02]' : 'bg-gray-50/50'" :style="{ borderColor: dividerColor }">
                                <div class="flex justify-between items-center text-[10px] font-bold opacity-40 uppercase tracking-widest">
                                    <span>负载 / Uptime</span>
                                    <Activity :size="10" />
                                </div>
                                <div class="space-y-1.5 font-mono">
                                    <div class="flex justify-between items-center text-[11px]">
                                        <span class="opacity-50 tracking-tighter">Load Average</span>
                                        <div class="flex gap-1.5">
                                            <span :class="getLoadColor(node.latest?.load1, node.latest?.cpu?.cores)">{{ node.latest?.load1 || '0.0' }}</span>
                                        </div>
                                    </div>
                                    <div class="flex justify-between items-center text-[11px]">
                                        <span class="opacity-50">Uptime</span>
                                        <span class="font-bold">{{ formatUptime(node.latest?.uptimeSec || 0) }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- EXPANDED CONTENT AREA -->
                        <transition name="expand">
                          <div v-show="expandedNodes.has(node.id)" class="w-full pt-5 mt-5 border-t" :style="{ borderColor: dividerColor }">
                            <div class="space-y-4">
                              <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2">
                                  <Activity :size="14" :style="{ color: 'var(--accent)' }" />
                                  <span class="text-xs font-black">网络延迟趋势</span>
                                  <span v-if="node.status === 'offline'" class="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-rose-500/20 text-rose-400">DISCONNECTED</span>
                                </div>
                                <div class="flex items-center gap-3 text-[10px] font-mono opacity-50">
                                  <span v-if="node.latest?.timestamp">最后同步: {{ new Date(node.latest.timestamp).toLocaleString() }}</span>
                                </div>
                              </div>
                              <!-- 多协议曲线图区域 (v1.5.8 支持多线合一) -->
                              <div :class="['rounded-xl border overflow-hidden', darkMode ? 'bg-black/20' : 'bg-slate-50/80 shadow-inner']" :style="{ borderColor: dividerColor }">
                                <template v-if="Object.keys(getLatencyByProtocol(node.id)).length">
                                  <div v-for="(proto, type) in getLatencyByProtocol(node.id)" :key="type" class="px-1 py-1">
                                    <VpsMetricChart
                                      :title="`${type} 网络延迟`"
                                      unit="ms"
                                      :series="proto.series"
                                      :labels="proto.timestamps"
                                      :height="280"
                                      :darkMode="darkMode"
                                      class="!border-none !bg-transparent !shadow-none !backdrop-blur-none py-4"
                                    />
                                  </div>
                                </template>
                                <template v-else>
                                  <VpsMetricChart
                                    title="NETWORK LATENCY"
                                    unit="ms"
                                    :points="getLatencyPoints(node.id)"
                                    color="var(--accent)"
                                    :height="280"
                                    :darkMode="darkMode"
                                    class="!border-none !bg-transparent !shadow-none !backdrop-blur-none"
                                  />
                                </template>
                              </div>
                              <!-- 底部摘要栏 (仅列表模式显示以节省空间) -->
                              <div v-if="viewMode === 'list'" class="flex flex-wrap gap-6 items-center text-[10px] font-mono opacity-50">
                                <span v-if="node.latest?.meta?.os" class="flex items-center gap-1"><Cpu :size="11" />{{ node.latest.meta.os }}</span>
                                <span class="flex items-center gap-1"><Clock :size="11" />{{ formatUptime(node.latest?.uptimeSec || 0) }}</span>
                                <span class="flex items-center gap-1"><HardDrive :size="11" />{{ getMetricValue(node, 'disk') }}% DISK</span>
                              </div>
                            </div>
                          </div>
                        </transition>
                    </div>
                </div>
            </section>

            <div v-if="filteredNodes.length === 0" class="text-center py-16">
                <Search :size="48" class="mx-auto mb-4 text-gray-600" />
                <p class="text-lg font-black text-gray-600">未找到匹配的节点</p>
                <p class="text-sm text-gray-500">请尝试其他搜索词</p>
            </div>
        </div>

        <div v-else class="text-center py-40 border-2 border-dashed border-white/5 rounded-[3rem]">
            <div class="text-3xl mb-4 font-black text-gray-800 uppercase tracking-widest opacity-20">暂无节点</div>
            <p class="text-gray-600 font-medium uppercase tracking-widest text-xs">等待全球集群接入中...</p>
        </div>

        <footer v-if="layout.footerEnabled" class="mt-32 pt-12 border-t flex flex-col md:flex-row justify-between items-center gap-8" :style="{ borderColor: dividerColor }">
            <p class="text-gray-600 text-xs font-bold uppercase tracking-[0.2em]">{{ theme.footerText || 'Powered by MiPulse Monitoring System' }}</p>
            <div class="flex items-center gap-6">
                 <a href="#" class="text-gray-500 hover:text-white transition-colors uppercase text-[10px] font-black tracking-widest">Network Map</a>
                 <a href="#" class="text-gray-500 hover:text-white transition-colors uppercase text-[10px] font-black tracking-widest">API v1</a>
                 <a href="#" class="text-gray-500 hover:text-white transition-colors uppercase text-[10px] font-black tracking-widest">Incident History</a>
            </div>
        </footer>

        <!-- Detail Modal [Suggestion 3] -->
        <Modal v-model:show="showNodeDetailModal" :title="selectedNodeForModal?.name" size="4xl" glass>
            <template #title>
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-lg overflow-hidden" :style="{ backgroundColor: 'var(--accent)', color: 'white' }">
                        <img v-if="selectedNodeForModal?.countryCode" :src="`https://flagcdn.com/w80/${selectedNodeForModal.countryCode.toLowerCase()}.png`" class="w-full h-full object-cover" :alt="selectedNodeForModal.countryCode" />
                        <Server v-else :size="18" />
                    </div>
                    <div>
                        <h3 class="text-xl font-black tracking-tight">{{ selectedNodeForModal?.name }}</h3>
                        <div class="flex items-center gap-2">
                             <div class="w-1.5 h-1.5 rounded-full" :class="selectedNodeForModal?.status === 'online' ? 'bg-emerald-500' : 'bg-rose-500'"></div>
                             <span class="text-[10px] font-black uppercase tracking-widest opacity-40">{{ selectedNodeForModal?.status === 'online' ? 'Online' : 'Offline' }}</span>
                        </div>
                    </div>
                </div>
            </template>
            <template #body>
                <div v-if="selectedNodeForModal" class="space-y-8 py-4">
                    <!-- Metadata Grid [Suggestion 3] -->
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div class="p-4 rounded-2xl border flex flex-col gap-1" :style="{ borderColor: dividerColor, backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.5)' }">
                            <div class="flex items-center gap-2 opacity-40">
                                <Cpu :size="12" />
                                <span class="text-[9px] font-black uppercase tracking-widest">OS / Kernel</span>
                            </div>
                            <div class="text-[11px] font-bold truncate">{{ selectedNodeForModal.latest?.meta?.os || 'Linux' }}</div>
                            <div class="text-[9px] opacity-40 truncate">{{ selectedNodeForModal.latest?.meta?.kernel || 'Unknown Kernel' }}</div>
                        </div>
                        <div class="p-4 rounded-2xl border flex flex-col gap-1" :style="{ borderColor: dividerColor, backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.5)' }">
                            <div class="flex items-center gap-2 opacity-40">
                                <Clock :size="12" />
                                <span class="text-[9px] font-black uppercase tracking-widest">Uptime</span>
                            </div>
                            <div class="text-[11px] font-bold">{{ formatUptime(selectedNodeForModal.latest?.uptimeSec || 0) }}</div>
                            <div class="text-[9px] opacity-40">Since Last Boot</div>
                        </div>
                        <div class="p-4 rounded-2xl border flex flex-col gap-1" :style="{ borderColor: dividerColor, backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.5)' }">
                            <div class="flex items-center gap-2 opacity-40">
                                <Network :size="12" />
                                <span class="text-[9px] font-black uppercase tracking-widest">Region / IP</span>
                            </div>
                            <div class="text-[11px] font-bold">{{ selectedNodeForModal.region || 'Global' }}</div>
                            <div class="text-[9px] opacity-40">{{ selectedNodeForModal.latest?.publicIp || 'Protected IP' }}</div>
                        </div>
                        <div class="p-4 rounded-2xl border flex flex-col gap-2" :style="{ borderColor: dividerColor, backgroundColor: darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.5)' }">
                            <div class="flex items-center gap-2 opacity-40">
                                <Activity :size="12" />
                                <span class="text-[9px] font-black uppercase tracking-widest">健康指数</span>
                            </div>
                            <div class="flex flex-col gap-1">
                                <div class="flex items-baseline gap-1" :style="{ color: getHealthColor(100 - (selectedNodeForModal.latest?.lossPercent || 0)) }">
                                    <span class="text-2xl font-black tabular-nums">{{ 100 - (selectedNodeForModal.latest?.lossPercent || 0) }}</span>
                                    <span class="text-[10px] font-bold opacity-60">%</span>
                                </div>
                                <div class="flex gap-1">
                                    <div v-for="i in 5" :key="i" class="h-1.5 w-full rounded-full transition-all duration-500" 
                                         :style="{ 
                                             backgroundColor: (100 - (selectedNodeForModal.latest?.lossPercent || 0)) >= (i * 20) 
                                                 ? getHealthColor(100 - (selectedNodeForModal.latest?.lossPercent || 0)) 
                                                 : (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')
                                         }">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Charts Section -->
                    <div class="space-y-6">
                        <div class="flex items-center gap-4">
                            <h4 class="text-sm font-black uppercase tracking-widest">Latency Analysis</h4>
                            <div class="h-px flex-1" :style="{ backgroundColor: dividerColor }"></div>
                        </div>
                        <div class="space-y-4">
                             <template v-if="Object.keys(getLatencyByProtocol(selectedNodeForModal.id)).length">
                                <div v-for="(proto, type) in getLatencyByProtocol(selectedNodeForModal.id)" :key="type" class="p-4 rounded-2xl border" :style="{ borderColor: dividerColor }">
                                    <VpsMetricChart
                                        :title="`${type} 网络延迟 (ms)`"
                                        unit="ms"
                                        :series="proto.series"
                                        :labels="proto.timestamps"
                                        :height="200"
                                        :darkMode="darkMode"
                                        class="!border-none !bg-transparent !shadow-none !backdrop-blur-none"
                                    />
                                </div>
                             </template>
                             <div v-else class="py-20 text-center opacity-30">
                                <Activity :size="48" class="mx-auto mb-4" />
                                <p class="text-xs font-black uppercase tracking-widest">No detailed history available</p>
                             </div>
                        </div>
                    </div>
                </div>
            </template>
            <template #footer>
                <div class="w-full flex items-center justify-between">
                    <span class="text-[10px] font-mono opacity-40 uppercase">Last Sync: {{ selectedNodeForModal?.latest?.timestamp ? new Date(selectedNodeForModal.latest.timestamp).toLocaleString() : 'N/A' }}</span>
                    <button @click="showNodeDetailModal = false" class="px-8 py-2.5 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-black font-black text-xs uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-xl">
                        Close Report
                    </button>
                </div>
            </template>
        </Modal>
    </div>
  </div>
</template>

<style scoped>
.expand-enter-active, .expand-leave-active { transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1); max-height: 1000px; opacity: 1; overflow: hidden; }
.expand-enter-from, .expand-leave-to { max-height: 0; opacity: 0; transform: translateY(-10px); }

/* Skeleton Styles [Suggestion 1] */
.skeleton { position: relative; overflow: hidden; background: rgba(156, 163, 175, 0.1); border-radius: 0.8rem; }
.skeleton::after { content: ""; position: absolute; top: 0; right: 0; bottom: 0; left: 0; transform: translateX(-100%); background-image: linear-gradient(90deg, rgba(255,255,255,0) 0, rgba(255,255,255,0.05) 20%, rgba(255,255,255,0.1) 60%, rgba(255,255,255,0)); animation: shimmer 2s infinite; }
@keyframes shimmer { 100% { transform: translateX(100%); } }
.dark .skeleton { background: rgba(255, 255, 255, 0.05); }

/* Responsive Polishing [Suggestion 5] */
@media (max-width: 640px) {
    .grid { gap: 1rem !important; }
    .rounded-\[2rem\] { border-radius: 1.5rem !important; }
}

.node-expand-container {
    min-height: 420px !important;
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: visible !important;
}
</style>
