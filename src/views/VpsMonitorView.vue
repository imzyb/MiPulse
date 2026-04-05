<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useToastStore } from '../stores/toast.js';
import {
  fetchVpsNodes, createVpsNode, updateVpsNode, deleteVpsNode,
  fetchVpsAlerts, clearVpsAlerts, fetchVpsNodeDetail,
  fetchSettings
} from '../lib/api.js';
import { formatNetworkSpeed, formatUptime } from '../lib/utils.js';
import {
  RefreshCw, Settings, Trash2,
  Activity, ShieldCheck,
  Copy
} from 'lucide-vue-next';
import DataGrid from '../components/shared/DataGrid.vue';
import Modal from '../components/forms/Modal.vue';
import Switch from '../components/ui/Switch.vue';

const { showToast } = useToastStore();
const config = ref({ vpsMonitor: {} });

const baseOrigin = window.location.origin;
const isRefreshing = ref(false);
const isLoading = ref(false);
const nodes = ref([]);
const lastRefreshError = ref(null);
const selectedGroup = ref('全部');
const isCompact = ref(localStorage.getItem('mipulse_vps_compact') === 'true');

const refreshCountdown = ref(60);
let refreshTimer = null;
let countdownTimer = null;

const groups = computed(() => {
  const g = new Set(['全部']);
  nodes.value.forEach(n => {
    if (n.groupTag) g.add(n.groupTag);
  });
  return Array.from(g);
});

const filteredNodes = computed(() => {
  if (selectedGroup.value === '全部') return nodes.value;
  return nodes.value.filter(n => n.groupTag === selectedGroup.value);
});

// Modal States
const showCreateModal = ref(false);
const showEditModal = ref(false);
const showDeleteConfirm = ref(false);
const showDetailModal = ref(false);
const showGuideModal = ref(false);

const isCreatingNode = ref(false);
const isUpdatingNode = ref(false);
const isDeletingNode = ref(false);
const isDetailLoading = ref(false);
const isResettingSecret = ref(false);

const selectedNode = ref(null);
const detailPayload = ref(null);
const detailReports = ref([]);
const detailTargets = ref([]);
const guidePayload = ref(null);

const formState = ref({
  name: '',
  tag: '',
  groupTag: 'Default',
  region: '',
  description: '',
  enabled: true,
  secret: '',
  useGlobalTargets: false,
  networkMonitorEnabled: true,
  trafficLimitGb: 0
});

const columns = [
  { key: 'name', title: '节点', sortable: false, align: 'center' },
  { key: 'groupTag', title: '分组', sortable: false, align: 'center', hideOn: 'sm' },
  { key: 'bandwidth', title: '实时带宽', sortable: false, align: 'center' },
  { key: 'status', title: '状态', sortable: false, align: 'center' },
  { key: 'networkMonitor', title: '网络监测', sortable: false, align: 'center', hideOn: 'md' },
  { key: 'ipAddress', title: 'IP 地址', sortable: false, align: 'center', hideOn: 'md' },
  { key: 'actions', title: '管理节点', sortable: false, align: 'center' }
];

const loadData = async ({ notify = false, silent = false } = {}) => {
  if (!silent) {
    isLoading.value = true;
  }
  isRefreshing.value = true;
  
  try {
    const [nodesRes, settingsRes] = await Promise.all([fetchVpsNodes(), fetchSettings()]);
    if (nodesRes && nodesRes.success) {
      nodes.value = nodesRes.nodes || [];
      lastRefreshError.value = null;
    } else {
      const errMsg = nodesRes?.error || '无法获取服务器数据';
      if (!silent) showToast(errMsg, 'error');
      lastRefreshError.value = errMsg;
    }
    
    if (settingsRes && settingsRes.success) {
      config.value = settingsRes.data || settingsRes.settings || { vpsMonitor: {} };
    }
    
    if (notify) {
      showToast('已完成同步', 'success');
    }
  } catch (err) {
    const errMsg = err?.message || '网络通讯异常';
    if (!silent) showToast(errMsg, 'error');
    lastRefreshError.value = errMsg;
  } finally {
    isLoading.value = false;
    isRefreshing.value = false;
    refreshCountdown.value = 60;
  }
};

onMounted(() => {
    loadData();
    countdownTimer = setInterval(() => {
        if (refreshCountdown.value > 0) refreshCountdown.value--;
    }, 1000);
    refreshTimer = setInterval(() => loadData({ silent: true }), 60000);
});

onUnmounted(() => {
    if (countdownTimer) clearInterval(countdownTimer);
    if (refreshTimer) clearInterval(refreshTimer);
});

const toggleCompact = () => {
    isCompact.value = !isCompact.value;
    localStorage.setItem('mipulse_vps_compact', isCompact.value);
};

const handleRefresh = async () => {
  await loadData({ notify: true });
};

const handleCreate = async () => {
  if (isCreatingNode.value) return;
  isCreatingNode.value = true;
  try {
    if (!formState.value.name?.trim()) {
      showToast('请输入节点名称', 'warning');
      return;
    }
    const result = await createVpsNode(formState.value);
    if (result.success) {
      showToast('节点已创建', 'success');
      showCreateModal.value = false;
      await loadData();
      if (result.guide) {
        guidePayload.value = result.guide;
        showGuideModal.value = true;
      }
    } else {
      showToast(result?.error || '创建失败', 'error');
    }
  } catch (error) {
    showToast(error?.message || '创建失败', 'error');
  } finally {
    isCreatingNode.value = false;
  }
};

const openEdit = (node) => {
  selectedNode.value = node;
  formState.value = { ...node };
  showEditModal.value = true;
};

const handleUpdate = async () => {
  if (isUpdatingNode.value) return;
  isUpdatingNode.value = true;
  try {
    // 1. 构建 payload，显式确保布尔值被正确转换
    // 这样可以避免 formState 中某些字段为 undefined 导致的后端更新失效
    const payload = {
      ...formState.value,
      // 强制转换 networkMonitorEnabled 为布尔值 (true/false)
      // 解决后端收到 null 或 undefined 时可能产生的逻辑歧义
      networkMonitorEnabled: !!formState.value.networkMonitorEnabled,
      enabled: !!formState.value.enabled,
      useGlobalTargets: !!formState.value.useGlobalTargets
    };

    // 2. 调用 API
    const result = await updateVpsNode(selectedNode.value.id, payload);
    
    if (result.success) {
      showToast('更新成功', 'success');
      showEditModal.value = false;
      
      // 3. 优化体验：立即更新本地数据，而不是等待 loadData 刷新
      // 这能解决因 D1 数据库写入延迟或 KV 缓存未刷新导致的视觉状态回退
      const index = nodes.value.findIndex(n => n.id === selectedNode.value.id);
      if (index !== -1) {
        nodes.value[index] = { ...nodes.value[index], ...payload };
      }
      await loadData({ silent: true }); // 静默刷新同步最终状态
    } else {
      showToast(result.error || '更新失败', 'error');
    }
  } catch (error) {
    showToast(error.message || '网络请求失败', 'error');
  } finally {
    isUpdatingNode.value = false;
  }
};

const openDelete = (node) => {
  selectedNode.value = node;
  showDeleteConfirm.value = true;
};

const handleDelete = async () => {
  if (isDeletingNode.value) return;
  isDeletingNode.value = true;
  try {
    const result = await deleteVpsNode(selectedNode.value.id);
    if (result.success) {
      showToast('节点已从集群中移除', 'success');
      showDeleteConfirm.value = false;
      await loadData();
    }
  } finally {
    isDeletingNode.value = false;
  }
};

const openDetail = async (node) => {
  selectedNode.value = node;
  showDetailModal.value = true;
  isDetailLoading.value = true;
  try {
    const result = await fetchVpsNodeDetail(node.id);
    if (result.success) {
      detailPayload.value = result.node;
      detailReports.value = result.reports || [];
      detailTargets.value = result.targets || [];
    }
  } finally {
    isDetailLoading.value = false;
  }
};

const getMetricValue = (row, metric) => {
  if (!row?.latest) return 0;
  const report = row.latest;
  if (metric === 'cpu') return report.cpu?.usage ?? report.cpuPercent ?? 0;
  if (metric === 'mem') return report.mem?.usage ?? report.memPercent ?? 0;
  if (metric === 'disk') return report.disk?.usage ?? report.diskPercent ?? 0;
  return 0;
};

const resetForm = () => {
  formState.value = {
    name: '', tag: '', groupTag: 'Default', region: '',
    description: '', enabled: true, secret: '',
    useGlobalTargets: false, networkMonitorEnabled: true, trafficLimitGb: 0
  };
};

const openCreate = () => {
  resetForm();
  showCreateModal.value = true;
};

const copyCommand = () => {
  const cmd = guidePayload.value?.installCommand || '';
  if (!cmd) return;
  navigator.clipboard.writeText(cmd).then(() => {
    showToast('命令已复制到剪贴板', 'success');
  });
};

const copyUninstallCommand = () => {
  const cmd = guidePayload.value?.uninstallCommand || '';
  if (!cmd) return;
  navigator.clipboard.writeText(cmd).then(() => {
    showToast('命令已复制到剪贴板', 'success');
  });
};

const openInstallGuide = async (node) => {
  selectedNode.value = node;
  try {
    const result = await fetchVpsNodeDetail(node.id);
    if (result.success && result.guide) {
      guidePayload.value = result.guide;
      showGuideModal.value = true;
    } else {
      showToast('获取安装信息失败', 'error');
    }
  } catch (error) {
    showToast(error?.message || '获取安装信息失败', 'error');
  }
};

const handleResetConnection = async () => {
  if (!selectedNode.value?.id || isResettingSecret.value) return;
  isResettingSecret.value = true;
  try {
    const result = await updateVpsNode(selectedNode.value.id, { resetSecret: true });
    if (result.success && result.guide) {
      guidePayload.value = result.guide;
      showToast('连接信息已重置并生成新脚本', 'success');
      await loadData();
    } else {
      showToast(result?.error || '重置连接信息失败', 'error');
    }
  } catch (error) {
    showToast(error?.message || '重置连接信息失败', 'error');
  } finally {
    isResettingSecret.value = false;
  }
};

// Final load logic removed as it is now in onMounted
</script>

<template>
  <div class="admin-page">
    <section class="grid grid-cols-1 gap-6">
      <div class="admin-section-header">
        <div class="admin-title-wrap">
          <div class="admin-title-icon">
            <Activity :size="20" />
          </div>
          <div>
            <h2 class="admin-title">Cluster Monitor</h2>
            <p class="admin-subtitle">集群监测</p>
          </div>
        </div>
        <div class="flex items-center gap-3 w-full xl:w-auto">
          <button @click="toggleCompact" class="admin-secondary-btn px-4 py-4 flex items-center gap-2" :title="isCompact ? '切换到常规模式' : '切换到紧凑模式'">
            <div class="flex flex-col gap-0.5 items-center justify-center w-5 h-5">
                <div class="w-4 h-0.5 bg-gray-400 rounded-full" :class="{'w-2': isCompact}"></div>
                <div class="w-4 h-0.5 bg-gray-400 rounded-full"></div>
                <div class="w-4 h-0.5 bg-gray-400 rounded-full" :class="{'w-2': isCompact}"></div>
            </div>
            <span class="hidden sm:inline">{{ isCompact ? '常规' : '紧凑' }}</span>
          </button>
          <button @click="handleRefresh" class="admin-secondary-btn px-6 py-4 flex items-center gap-2 group relative overflow-hidden" :class="{'border-rose-500/20 text-rose-500': lastRefreshError}">
            <div v-if="isRefreshing" class="absolute inset-0 bg-primary-500/5 animate-pulse"></div>
            <RefreshCw :size="16" :class="{'animate-spin text-primary-500': isRefreshing, 'text-rose-500': lastRefreshError}" class="text-gray-500 transition-colors" />
            <div class="flex flex-col items-start leading-none gap-1">
                <span class="text-[9px] font-black uppercase tracking-widest" :class="lastRefreshError ? 'text-rose-500' : 'text-gray-400'">
                    {{ lastRefreshError ? 'Sync Error' : (isRefreshing ? 'Syncing...' : `Next Sync: ${refreshCountdown}s`) }}
                </span>
                <span class="text-[10px] font-black">{{ lastRefreshError ? '重试中' : '刷新数据' }}</span>
            </div>
          </button>
          <button @click="openCreate" class="admin-primary-btn flex-1 xl:flex-none whitespace-nowrap">
            部署新探针
          </button>
        </div>
      </div>

      <div class="admin-panel p-5 lg:p-6 space-y-4">
        <div class="flex flex-wrap items-center justify-start gap-2 overflow-x-auto no-scrollbar">
          <button v-for="g in groups" :key="g" @click="selectedGroup = g"
            :class="selectedGroup === g ? 'bg-primary-600 text-white shadow-xl font-black' : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/5'"
            class="px-3 py-1.5 rounded-lg text-[10px] uppercase tracking-widest transition-all whitespace-nowrap">
            {{ g }}
          </button>
        </div>

        <DataGrid :data="filteredNodes" :columns="columns" :loading="isLoading" :compact="isCompact">
          <template #column-name="{ row }">
            <div class="text-sm font-black text-gray-900 dark:text-white text-center">
              {{ row.name }}
            </div>
          </template>

          <template #column-bandwidth="{ row }">
            <div class="flex flex-col items-center">
              <span class="text-[10px] font-bold text-emerald-500">↑ {{ formatNetworkSpeed(row.latest?.traffic?.txSpeed || 0) }}</span>
              <span class="text-[10px] font-bold text-indigo-500">↓ {{ formatNetworkSpeed(row.latest?.traffic?.rxSpeed || 0) }}</span>
            </div>
          </template>

          <template #column-status="{ row }">
             <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase"
               :class="row.status === 'online' ? 'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/30' : 'bg-rose-500/10 text-rose-500 ring-1 ring-rose-500/30'">
               <span class="h-1.5 w-1.5 rounded-full" :class="row.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'"></span>
               {{ row.status === 'online' ? '在线' : '离线' }}
             </div>
           </template>

          <template #column-networkMonitor="{ row }">
             <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase"
               :class="row.networkMonitorEnabled !== false ? 'bg-sky-500/10 text-sky-500 ring-1 ring-sky-500/30' : 'bg-gray-500/10 text-gray-500 ring-1 ring-gray-500/30'">
               <span class="h-1.5 w-1.5 rounded-full" :class="row.networkMonitorEnabled !== false ? 'bg-sky-500' : 'bg-gray-400'"></span>
               {{ row.networkMonitorEnabled !== false ? '已开启' : '已关闭' }}
             </div>
           </template>

          <template #column-ipAddress="{ row }">
            <span class="text-xs font-mono text-gray-700 dark:text-gray-300">
              {{ row.latest?.publicIp || row.latest?.ip || row.latest?.meta?.publicIp || '--' }}
            </span>
          </template>

         <template #column-actions="{ row }">
            <div class="flex items-center justify-center gap-2">
              <button @click="openInstallGuide(row)" class="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 px-3 text-[11px] font-bold transition-all">安装</button>
              <button @click="openDetail(row)" class="p-2 rounded-lg bg-primary-500/10 text-primary-600 hover:bg-primary-500/20 px-3 text-[11px] font-bold transition-all">指标详情</button>
              <button @click="openEdit(row)" class="p-2 rounded-lg bg-gray-500/10 text-gray-500 hover:bg-gray-500/20 transition-all"><Settings :size="16" /></button>
              <button @click="openDelete(row)" class="p-2 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all"><Trash2 :size="16" /></button>
            </div>
          </template>
        </DataGrid>
      </div>
    </section>

    <!-- Modals -->
    
    <!-- Create/Edit Modal -->
    <Modal v-model:show="showCreateModal" title="配置新探针" size="md">
      <template #body>
        <div class="space-y-6">
           <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div class="space-y-2">
               <label class="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">节点名称</label>
               <input v-model="formState.name" placeholder="服务器 A" class="admin-input focus:ring-2 ring-primary-500 transition-all" />
             </div>
             <div class="space-y-2">
               <label class="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">分组标签</label>
               <input v-model="formState.groupTag" placeholder="Default" class="admin-input focus:ring-2 ring-primary-500 transition-all" />
             </div>
             <div class="space-y-2">
               <label class="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">地区</label>
               <input v-model="formState.region" placeholder="Tokyo / Singapore" class="admin-input focus:ring-2 ring-primary-500 transition-all" />
             </div>
           </div>
          <div class="space-y-2">
            <label class="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">节点说明</label>
            <textarea v-model="formState.description" rows="2" class="admin-textarea focus:ring-2 ring-primary-500 transition-all"></textarea>
          </div>
           <Switch v-model="formState.enabled" label="启用此节点的实时监控" />
           <Switch v-model="formState.networkMonitorEnabled" label="启用网络监测（ICMP/TCP/HTTP 拨测）" />
        </div>
      </template>
      <template #footer>
        <button @click="handleCreate" :disabled="isCreatingNode" class="w-full py-4 rounded-xl bg-primary-600 text-white font-black uppercase tracking-widest shadow-xl shadow-primary-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50">
          {{ isCreatingNode ? '处理中...' : '启动监控节点' }}
        </button>
      </template>
    </Modal>

    <Modal v-model:show="showEditModal" title="编辑节点配置" size="md">
      <template #body>
        <div class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">节点名称</label>
              <input v-model="formState.name" class="admin-input" />
            </div>
            <div class="space-y-2">
              <label class="text-xs font-black text-gray-500 uppercase tracking-widest ml-1">分组标签</label>
              <input v-model="formState.groupTag" class="admin-input" />
            </div>
          </div>
          <Switch v-model="formState.enabled" label="监控状态" />
          <Switch v-model="formState.networkMonitorEnabled" label="启用网络监测（ICMP/TCP/HTTP 拨测）" />
        </div>
      </template>
      <template #footer>
        <button @click="handleUpdate" :disabled="isUpdatingNode" class="w-full py-4 rounded-xl bg-primary-600 text-white font-black uppercase tracking-widest transition-all">
          {{ isUpdatingNode ? '保存中...' : '提交更改' }}
        </button>
      </template>
    </Modal>

    <Modal v-model:show="showDeleteConfirm" title="安全警告" size="sm">
      <template #body>
        <p class="text-gray-500 leading-relaxed">
          您确定要永久移除节点 <span class="font-bold text-gray-900 dark:text-white">{{ selectedNode?.name }}</span> 吗？
          所有关联的监控历史报表都将被物理清除。
        </p>
      </template>
      <template #footer>
        <button @click="handleDelete" :disabled="isDeletingNode" class="admin-danger-btn w-full">
          {{ isDeletingNode ? '移除中...' : '确认销毁' }}
        </button>
      </template>
    </Modal>

    <Modal v-model:show="showDetailModal" :title="selectedNode?.name + ' 指标分析中心'" size="4xl">
       <template #body>
         <div v-if="isDetailLoading" class="flex items-center justify-center py-20">
           <RefreshCw :size="48" class="animate-spin text-primary-500/20" />
         </div>
         <div v-else class="space-y-8 py-4">
           <div class="grid grid-cols-1 lg:grid-cols-6 gap-4">
            <div class="p-4 rounded-xl bg-white/60 dark:bg-white/5 border border-black/5 dark:border-white/5">
              <div class="text-[10px] font-black uppercase tracking-widest text-gray-500">上报周期</div>
              <div class="text-sm font-bold text-gray-900 dark:text-white mt-1">每 {{ config?.vpsMonitor?.reportIntervalMinutes || 1 }} 分钟</div>
            </div>
            <div class="p-4 rounded-xl bg-white/60 dark:bg-white/5 border border-black/5 dark:border-white/5">
              <div class="text-[10px] font-black uppercase tracking-widest text-gray-500">拨测间隔</div>
              <div class="text-sm font-bold text-gray-900 dark:text-white mt-1">每 {{ config?.vpsMonitor?.networkSampleIntervalMinutes || 5 }} 分钟</div>
            </div>
            <div class="p-4 rounded-xl bg-white/60 dark:bg-white/5 border border-black/5 dark:border-white/5">
              <div class="text-[10px] font-black uppercase tracking-widest text-gray-500">目标上限</div>
              <div class="text-sm font-bold text-gray-900 dark:text-white mt-1">{{ config?.vpsMonitor?.networkTargetsLimit || 3 }} 个</div>
            </div>
            <div class="p-4 rounded-xl bg-white/60 dark:bg-white/5 border border-black/5 dark:border-white/5">
              <div class="text-[10px] font-black uppercase tracking-widest text-gray-500">最近上报</div>
              <div class="text-sm font-bold text-gray-900 dark:text-white mt-1">{{ selectedNode?.lastSeenAt ? new Date(selectedNode.lastSeenAt).toLocaleString() : '未上报' }}</div>
            </div>
            <div class="p-4 rounded-xl bg-white/60 dark:bg-white/5 border border-black/5 dark:border-white/5">
              <div class="text-[10px] font-black uppercase tracking-widest text-gray-500">系统/内核</div>
              <div class="text-xs font-bold text-gray-900 dark:text-white mt-1 truncate">
                {{ detailPayload?.latest?.meta?.os || 'unknown' }} / {{ detailPayload?.latest?.meta?.kernel || 'unknown' }}
              </div>
            </div>
            <div class="p-4 rounded-xl bg-white/60 dark:bg-white/5 border border-black/5 dark:border-white/5">
              <div class="text-[10px] font-black uppercase tracking-widest text-gray-500">探针版本</div>
              <div class="text-sm font-bold text-gray-900 dark:text-white mt-1">v{{ detailPayload?.latest?.meta?.probeVersion || detailPayload?.latest?.meta?.version || 'unknown' }}</div>
            </div>
            <div v-if="detailPayload?.latest?.uptimeSec" class="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
              <div class="text-[10px] font-black uppercase tracking-widest text-emerald-500">持续运行 (Uptime)</div>
              <div class="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1">{{ formatUptime(detailPayload.latest.uptimeSec) }}</div>
            </div>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <VpsMetricChart title="CPU 负载" :points="detailReports.map(r => r.cpu?.usage || r.cpuPercent || 0)" unit="%" color="#6366f1" :max="100" />
            <VpsMetricChart title="内存占用" :points="detailReports.map(r => r.mem?.usage || r.memPercent || 0)" unit="%" color="#a855f7" :max="100" />
            <VpsMetricChart title="磁盘空间" :points="detailReports.map(r => r.disk?.usage || r.diskPercent || 0)" unit="%" color="#ec4899" :max="100" />
          </div>
         </div>
       </template>
     </Modal>

    <!-- Node Deployment Guide -->
    <Modal v-model:show="showGuideModal" title="节点部署指南" size="lg">
      <template #body>
        <div class="space-y-6">
          <div class="p-6 bg-primary-500/10 border border-primary-500/20 rounded-xl flex items-start gap-4">
            <ShieldCheck class="text-emerald-500 shrink-0 mt-1" :size="24" />
            <div>
              <p class="text-sm font-bold text-primary-600 dark:text-primary-400">安装与卸载脚本</p>
              <p class="text-xs text-primary-600/70 dark:text-primary-400/60 mt-1">可随时重新获取脚本；重置连接信息后会生成新的安装命令。</p>
            </div>
          </div>

          <div class="flex justify-end">
            <button @click="handleResetConnection" :disabled="isResettingSecret" class="admin-secondary-btn px-6 py-3">
              <RefreshCw :size="16" :class="{ 'animate-spin': isResettingSecret }" />
              {{ isResettingSecret ? '重置中...' : '重置连接信息' }}
            </button>
          </div>

          <div class="space-y-3">
             <div class="flex items-center justify-between px-1">
               <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">一键安装命令 (推荐)</span>
               <span class="text-[10px] font-bold text-indigo-500 bg-indigo-500/10 px-2 py-0.5 rounded-md">Bash</span>
             </div>
             <div class="relative group">
                 <pre class="p-6 bg-gray-900 rounded-xl text-xs font-mono text-indigo-300 overflow-x-auto border border-white/5 break-all leading-relaxed whitespace-pre-wrap">{{ guidePayload?.installCommand || `curl -fsSL "${baseOrigin}/api/vps/install?nodeId=${guidePayload?.id}&secret=${guidePayload?.secret}" | bash` }}</pre>
                 <button @click="copyCommand" class="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-xl border border-white/10 transition-all opacity-0 group-hover:opacity-100">
                  <Copy :size="16" />
                </button>
             </div>
          </div>

          <div class="space-y-3">
             <div class="flex items-center justify-between px-1">
               <span class="text-[10px] font-black text-gray-500 uppercase tracking-widest">一键卸载命令</span>
               <span class="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-md">Bash</span>
             </div>
             <div class="relative group">
                <pre class="p-6 bg-gray-900 rounded-xl text-xs font-mono text-rose-300 overflow-x-auto border border-white/5 break-all leading-relaxed whitespace-pre-wrap">{{ guidePayload?.uninstallCommand || `curl -fsSL "${baseOrigin}/api/vps/uninstall?nodeId=${guidePayload?.id}&secret=${guidePayload?.secret}" | bash` }}</pre>
                <button @click="copyUninstallCommand" class="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-xl border border-white/10 transition-all opacity-0 group-hover:opacity-100">
                  <Copy :size="16" />
                </button>
             </div>
          </div>

             <div class="grid grid-cols-2 gap-4">
               <div class="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                 <p class="text-[10px] font-black text-gray-500 uppercase mb-2">系统依赖</p>
                 <p class="text-xs font-bold text-gray-700 dark:text-gray-300">Debian/Ubuntu/CentOS</p>
               </div>
              <div class="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                <p class="text-[10px] font-black text-gray-500 uppercase mb-2">节点 ID</p>
                <p class="text-xs font-bold text-gray-700 dark:text-gray-300 break-all">{{ guidePayload?.id }}</p>
              </div>
            </div>
        </div>
      </template>
      <template #footer>
        <button @click="showGuideModal = false" class="w-full py-4 rounded-xl bg-gray-900 text-white font-black uppercase tracking-widest hover:bg-gray-800 transition-all">
          我已完成部署
        </button>
      </template>
    </Modal>
  </div>
</template>

<style>
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
