<script setup>
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { 
  Plus, RefreshCw, Settings, Trash2, Cpu, HardDrive, 
  ChevronRight, Gauge, Activity, Radio, AlertTriangle,
  Monitor, ShieldCheck, Globe
} from 'lucide-vue-next';
import { 
  fetchVpsNodes, createVpsNode, updateVpsNode, deleteVpsNode, 
  fetchVpsAlerts, clearVpsAlerts, resetVpsTraffic
} from '../lib/api.js';
import { formatBytes } from '../lib/utils.js';
import DataGrid from '../components/shared/DataGrid.vue';
import Modal from '../components/forms/Modal.vue';
import VpsMetricChart from '../components/vps/VpsMetricChart.vue';
import Switch from '../components/ui/Switch.vue';

const nodes = ref([]);
const alerts = ref([]);
const isLoading = ref(false);
const isRefreshing = ref(false);
const router = useRouter();

const refreshCountdown = ref(30);
let refreshTimer = null;
let countdownTimer = null;

const showCreateModal = ref(false);
const showEditModal = ref(false);
const showDeleteModal = ref(false);
const isResetting = ref(false);
const selectedNode = ref(null);

const formState = ref({
  name: '',
  tag: '',
  groupTag: 'Default',
  region: '',
  description: '',
  enabled: true
});

const columns = [
  { key: 'name', title: '节点名称', sortable: true },
  { key: 'groupTag', title: '分组', sortable: true, hideOn: 'sm' },
  { key: 'status', title: '状态', align: 'center' },
  { key: 'metrics', title: '资源利用', hideOn: 'md' },
  { key: 'lastSeenAt', title: '最后上报', hideOn: 'md' },
  { key: 'actions', title: '操作', align: 'right' }
];

const loadData = async (silent = false) => {
  if (!silent) isRefreshing.value = true;
  try {
    const [nodesRes, alertsRes] = await Promise.all([fetchVpsNodes(), fetchVpsAlerts()]);
    nodes.value = nodesRes.data || nodesRes.nodes || [];
    alerts.value = alertsRes.data || alertsRes.alerts || [];
  } catch (err) {
    console.error('Failed to load data:', err);
  } finally {
    if (!silent) isRefreshing.value = false;
    refreshCountdown.value = 30;
  }
};

onMounted(() => {
    loadData();
    countdownTimer = setInterval(() => {
        if (refreshCountdown.value > 0) refreshCountdown.value--;
    }, 1000);
    refreshTimer = setInterval(() => loadData(true), 30000);
});

onUnmounted(() => {
    if (countdownTimer) clearInterval(countdownTimer);
    if (refreshTimer) clearInterval(refreshTimer);
});

const handleCreate = async () => {
  await createVpsNode(formState.value);
  showCreateModal.value = false;
  loadData();
};

const handleDelete = async () => {
  if (selectedNode.value) {
    await deleteVpsNode(selectedNode.value.id);
    showDeleteModal.value = false;
    loadData();
  }
};

const handleClearAlerts = async () => {
  await clearVpsAlerts();
  loadData();
};

const openDelete = (node) => {
  selectedNode.value = node;
  showDeleteModal.value = true;
};

const openNodeSettings = (node) => {
  selectedNode.value = node;
  formState.value = {
    name: node.name || '',
    tag: node.tag || '',
    groupTag: node.groupTag || 'Default',
    region: node.region || '',
    description: node.description || '',
    enabled: node.enabled !== false,
    secret: node.secret || '',
    networkMonitorEnabled: node.networkMonitorEnabled !== false
  };
  showEditModal.value = true;
};

const handleUpdate = async () => {
  if (!selectedNode.value) return;
  await updateVpsNode(selectedNode.value.id, {
    ...formState.value,
    enabled: !!formState.value.enabled,
    networkMonitorEnabled: !!formState.value.networkMonitorEnabled
  });
  showEditModal.value = false;
  await loadData();
};

const onlineCount = computed(() => nodes.value.filter(n => n.status === 'online').length);

const formatTime = (iso) => {
  if (!iso) return '从未';
  return new Date(iso).toLocaleString();
};

const totalTraffic = computed(() => {
    const sum = nodes.value.reduce((acc, node) => acc + (node.totalRx || 0) + (node.totalTx || 0), 0);
    return formatBytes(sum);
});

const handleResetTraffic = async () => {
    if (!selectedNode.value || isResetting.value) return;
    if (!confirm('确定要重置该节点的累计流量统计吗？此操作不可撤销。')) return;
    
    isResetting.value = true;
    try {
        await resetVpsTraffic(selectedNode.value.id);
        await loadData(true);
        // 更新当前选中的节点数据以同步 UI
        const updated = nodes.value.find(n => n.id === selectedNode.value.id);
        if (updated) selectedNode.value = updated;
    } catch (err) {
        alert('重置失败: ' + (err.message || '未知错误'));
    } finally {
        isResetting.value = false;
    }
};

</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      <div class="admin-stat-card">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="admin-stat-label">节点总数</p>
            <p class="admin-stat-value">{{ nodes.length }}</p>
            <p class="admin-stat-meta">当前接入后台的全部监测节点</p>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-primary-100/70 dark:bg-primary-900/20 text-primary-600 flex items-center justify-center">
            <Monitor :size="24" />
          </div>
        </div>
      </div>
      <div class="admin-stat-card">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="admin-stat-label">在线节点</p>
            <p class="admin-stat-value">{{ onlineCount }}</p>
            <p class="admin-stat-meta">{{ nodes.length ? `${Math.round((onlineCount / nodes.length) * 100)}% 在线率` : '等待首个节点接入' }}</p>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-emerald-100/70 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center">
            <Radio :size="24" />
          </div>
        </div>
      </div>
      <div class="admin-stat-card">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="admin-stat-label">全球累计流量</p>
            <p class="admin-stat-value">{{ totalTraffic }}</p>
            <p class="admin-stat-meta">按节点累计接收与发送总量汇总</p>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-amber-100/70 dark:bg-amber-900/20 text-amber-600 flex items-center justify-center">
            <Activity :size="24" />
          </div>
        </div>
      </div>
      <div class="admin-stat-card">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="admin-stat-label">活动告警</p>
            <p class="admin-stat-value">{{ alerts.length }}</p>
            <p class="admin-stat-meta">{{ alerts.length ? '建议尽快检查并处理异常' : '当前没有需要处理的告警' }}</p>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-rose-100/70 dark:bg-rose-900/20 text-rose-600 flex items-center justify-center">
            <AlertTriangle :size="24" />
          </div>
        </div>
      </div>
    </div>

    <div v-if="!nodes.length" class="admin-hero border border-dashed border-primary-500/20 bg-primary-500/[0.03]">
      <div class="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div class="space-y-3 max-w-2xl">
          <p class="text-[11px] font-black uppercase tracking-[0.28em] text-primary-600">Getting Started</p>
          <div>
            <h2 class="text-2xl font-black tracking-tight text-gray-900 dark:text-white">还没有任何监测节点</h2>
            <p class="mt-2 text-sm leading-6 text-gray-500 dark:text-gray-400">先创建一个节点，复制安装命令到服务器执行，几分钟后这里就会开始显示状态、流量和告警信息。</p>
          </div>
        </div>
        <div class="flex flex-wrap gap-3">
          <button @click="showCreateModal = true" class="admin-primary-btn">
            <Plus :size="18" />
            创建第一个节点
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex flex-col lg:flex-row gap-8">
      <div class="flex-1 space-y-6">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-4">
            <h3 class="text-xl font-bold text-gray-900 dark:text-white">节点列表</h3>
            <button @click="loadData()" :disabled="isRefreshing" class="p-2 text-gray-400 hover:text-primary-600 transition-all rounded-xl hover:bg-white dark:hover:bg-gray-900 flex items-center gap-2">
              <RefreshCw :size="18" :class="{'animate-spin': isRefreshing}" />
              <span class="text-[10px] font-bold text-gray-400">{{ refreshCountdown }}s</span>
            </button>
          </div>
          <button @click="showCreateModal = true" class="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-2xl shadow-lg shadow-primary-500/30 transition-all">
            <Plus :size="18" />
            新增节点
          </button>
        </div>

        <DataGrid :data="nodes" :columns="columns" :loading="isRefreshing" compact>
          <template #column-status="{ row }">
            <span v-if="row.status === 'online'" class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100/50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              在线 Online
            </span>
            <span v-else class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100/50 dark:bg-gray-800 text-gray-400 text-xs font-bold">
              <span class="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
              离线 Offline
            </span>
          </template>

          <template #column-metrics="{ row }">
            <div class="flex items-center gap-4 text-xs font-bold text-gray-500">
              <div class="flex items-center gap-1.5" title="CPU">
                <Cpu :size="14" class="text-primary-500" />
                {{ row.latest?.cpu?.usage ?? row.latest?.cpuPercent ?? 0 }}%
              </div>
              <div class="flex items-center gap-1.5" title="Memory">
                <Gauge :size="14" class="text-primary-500" />
                {{ row.latest?.mem?.usage ?? row.latest?.memPercent ?? 0 }}%
              </div>
              <div class="flex items-center gap-1.5" title="Disk">
                <HardDrive :size="14" class="text-primary-500" />
                {{ row.latest?.disk?.usage ?? row.latest?.diskPercent ?? 0 }}%
              </div>
            </div>
          </template>

          <template #column-lastSeenAt="{ value }">
            <span class="text-xs text-gray-400 font-medium italic">{{ formatTime(value) }}</span>
          </template>

          <template #column-actions="{ row }">
            <div class="flex items-center justify-end gap-2">
              <button @click="openNodeSettings(row)" class="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl transition-all" title="查看节点详情">
                <Settings :size="16" />
              </button>
              <button @click="openDelete(row)" class="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl transition-all">
                <Trash2 :size="16" />
              </button>
            </div>
          </template>
        </DataGrid>
      </div>

      <!-- Right Sidebar: Alerts & Activity -->
      <div class="w-full lg:w-96 space-y-8">
        <div class="mipulse-card p-8">
          <div class="flex items-center justify-between mb-8">
            <h4 class="text-lg font-bold text-gray-900 dark:text-white">最近告警</h4>
            <div class="flex items-center gap-2 px-2 py-1 bg-primary-100/50 dark:bg-primary-900/30 rounded-lg">
                <span class="w-1.5 h-1.5 rounded-full bg-primary-500 animate-ping"></span>
                <span class="text-[10px] font-bold text-primary-600">实时广播</span>
            </div>
          </div>
          
          <div class="space-y-6">
            <div v-for="alert in alerts.slice(0, 5)" :key="alert.id" class="flex gap-4 relative">
              <div class="shrink-0 flex flex-col items-center">
                <div class="w-2.5 h-2.5 rounded-full ring-4 ring-rose-100 dark:ring-rose-900/20 bg-rose-500 z-10"></div>
                <div class="w-px h-full bg-gray-100 dark:bg-gray-800 -mb-6 mt-1"></div>
              </div>
              <div class="pb-6">
                <p class="text-sm font-bold text-gray-900 dark:text-white mb-1 leading-tight">{{ alert.message }}</p>
                <span class="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{{ formatTime(alert.createdAt) }}</span>
              </div>
            </div>
            <div v-if="!alerts.length" class="admin-empty-state">
              <div class="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/10 text-emerald-500 flex items-center justify-center mx-auto mb-4">
                 <ShieldCheck :size="32" />
              </div>
              <p class="admin-empty-title">暂无告警</p>
              <p class="admin-empty-subtitle">当前所有节点运行正常</p>
            </div>
          </div>

          <button v-if="alerts.length" @click="handleClearAlerts" class="w-full mt-6 py-3 border border-gray-100 dark:border-gray-800 rounded-2xl text-xs font-bold text-gray-400 hover:text-rose-500 transition-all uppercase tracking-widest">
            清空所有告警
          </button>
        </div>
      </div>
    </div>

    <!-- Create Node Modal -->
    <Modal v-model:show="showCreateModal" title="新增监控节点" size="md">
      <template #body>
        <div class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="admin-field">
              <label class="admin-label">节点名称</label>
              <input v-model="formState.name" class="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all dark:text-white" placeholder="My-Node-01" />
              <p class="admin-help">用于后台展示和识别节点，建议填写业务可读名称。</p>
            </div>
            <div class="admin-field">
              <label class="admin-label">分组标签</label>
              <input v-model="formState.groupTag" class="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all dark:text-white" placeholder="Default" />
            </div>
            <div class="admin-field">
              <label class="admin-label">节点标识</label>
              <input v-model="formState.tag" class="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all dark:text-white" placeholder="hk-prod-01" />
            </div>
            <div class="admin-field">
              <label class="admin-label">区域</label>
              <input v-model="formState.region" class="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all dark:text-white" placeholder="Tokyo / Singapore" />
            </div>
          </div>
          <div class="admin-field">
            <label class="admin-label">描述信息</label>
            <textarea v-model="formState.description" class="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all dark:text-white" rows="3" placeholder="节点的详细描述..."></textarea>
          </div>
          <Switch v-model="formState.enabled" label="启用监控" sublabel="关闭后节点仍会保留，但不会参与公开页展示和状态统计。" />
        </div>
      </template>
      <template #footer>
        <button @click="showCreateModal = false" class="px-6 py-3 text-gray-400 font-bold text-sm">取消</button>
        <button @click="handleCreate" class="px-8 py-3 bg-primary-600 text-white font-bold text-sm rounded-2xl shadow-lg shadow-primary-500/30">创建节点</button>
      </template>
    </Modal>

    <Modal v-model:show="showEditModal" title="编辑节点" size="md">
      <template #body>
        <div class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="admin-field">
              <label class="admin-label">节点名称</label>
              <input v-model="formState.name" class="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all dark:text-white" />
            </div>
            <div class="admin-field">
              <label class="admin-label">分组标签</label>
              <input v-model="formState.groupTag" class="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all dark:text-white" />
            </div>
            <div class="admin-field">
              <label class="admin-label">区域</label>
              <input v-model="formState.region" class="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all dark:text-white" />
            </div>
            <div class="admin-field">
              <label class="admin-label">节点密钥</label>
              <input v-model="formState.secret" class="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all dark:text-white" />
              <p class="admin-help">如需重装探针，可在这里直接替换节点密钥。</p>
            </div>
          </div>
          <Switch v-model="formState.enabled" label="启用实时监控" sublabel="关闭后节点不会继续参与状态统计。" />
          <Switch v-model="formState.networkMonitorEnabled" label="启用网络监测" sublabel="控制该节点是否执行 ICMP / TCP / HTTP 拨测任务。" />
        </div>
      </template>
      <template #footer>
        <button v-if="selectedNode" @click="handleResetTraffic" :disabled="isResetting" class="mr-auto px-4 py-2 border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 text-rose-500 text-xs font-bold rounded-xl transition-all">
          {{ isResetting ? '正在重置...' : '重置流量统计' }}
        </button>
        <button @click="showEditModal = false" class="px-6 py-3 text-gray-400 font-bold text-sm">取消</button>
        <button @click="handleUpdate" class="px-8 py-3 bg-primary-600 text-white font-bold text-sm rounded-2xl shadow-lg shadow-primary-500/30">保存节点设置</button>
      </template>
    </Modal>

    <!-- Delete Confirm -->
    <Modal v-model:show="showDeleteModal" title="确认删除" size="sm">
      <template #body>
        <p class="text-gray-500">您确定要删除节点 <span class="font-bold text-gray-900 dark:text-white">{{ selectedNode?.name }}</span> 吗？这将清除所有历史监控数据。</p>
      </template>
      <template #footer>
        <button @click="showDeleteModal = false" class="px-6 py-3 text-gray-400 font-bold text-sm">取消</button>
        <button @click="handleDelete" class="admin-danger-btn">确认删除</button>
      </template>
    </Modal>
  </div>
</template>
