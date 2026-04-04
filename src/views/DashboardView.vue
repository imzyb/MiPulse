<script setup>
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { 
  Plus, RefreshCw, Settings, Trash2, Cpu, HardDrive, 
  ChevronRight, Gauge, Activity, Radio, AlertTriangle,
  Monitor, ShieldCheck, Globe
} from 'lucide-vue-next';
import { 
  fetchVpsNodes, createVpsNode, updateVpsNode, deleteVpsNode, 
  fetchVpsAlerts, clearVpsAlerts 
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

const refreshCountdown = ref(30);
let refreshTimer = null;
let countdownTimer = null;

const showCreateModal = ref(false);
const showDeleteModal = ref(false);
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
  { key: 'groupTag', title: '分组', sortable: true },
  { key: 'status', title: '状态', align: 'center' },
  { key: 'metrics', title: '资源利用' },
  { key: 'lastSeenAt', title: '最后上报' },
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

const formatTime = (iso) => {
  if (!iso) return '从未';
  return new Date(iso).toLocaleString();
};

const totalTraffic = computed(() => {
    const sum = nodes.value.reduce((acc, node) => acc + (node.totalRx || 0) + (node.totalTx || 0), 0);
    return formatBytes(sum);
});

onMounted(loadData);
</script>

<template>
  <div class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
    <!-- Stats Overview -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div class="mipulse-card p-6 flex items-center gap-4 border-l-4 border-l-primary-500">
        <div class="w-12 h-12 rounded-2xl bg-primary-100/50 dark:bg-primary-900/20 text-primary-600 flex items-center justify-center">
          <Monitor :size="24" />
        </div>
        <div>
          <p class="text-xs font-bold text-gray-400 uppercase tracking-widest">节点总数</p>
          <p class="text-2xl font-bold dark:text-white">{{ nodes.length }}</p>
        </div>
      </div>
      <div class="mipulse-card p-6 flex items-center gap-4 border-l-4 border-l-emerald-500">
        <div class="w-12 h-12 rounded-2xl bg-emerald-100/50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center">
          <Radio :size="24" />
        </div>
        <div>
          <p class="text-xs font-bold text-gray-400 uppercase tracking-widest">在线节点</p>
           <p class="text-2xl font-bold dark:text-white">{{ nodes.filter(n => n.status === 'online').length }}</p>
        </div>
      </div>
      <div class="mipulse-card p-6 flex items-center gap-4 border-l-4 border-l-amber-500">
        <div class="w-12 h-12 rounded-2xl bg-amber-100/50 dark:bg-amber-900/20 text-amber-600 flex items-center justify-center">
          <Activity :size="24" />
        </div>
        <div>
          <p class="text-xs font-bold text-gray-400 uppercase tracking-widest">全球累计流量</p>
          <p class="text-2xl font-bold dark:text-white">{{ totalTraffic }}</p>
        </div>
      </div>
      <div class="mipulse-card p-6 flex items-center gap-4 border-l-4 border-l-rose-500">
        <div class="w-12 h-12 rounded-2xl bg-rose-100/50 dark:bg-rose-900/20 text-rose-600 flex items-center justify-center">
          <AlertTriangle :size="24" />
        </div>
        <div>
          <p class="text-xs font-bold text-gray-400 uppercase tracking-widest">活动告警</p>
          <p class="text-2xl font-bold dark:text-white">{{ alerts.length }}</p>
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
              <button class="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl transition-all">
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
                <span class="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">{{ formatTime(alert.created_at) }}</span>
              </div>
            </div>
            <div v-if="!alerts.length" class="text-center py-12">
              <div class="w-16 h-16 rounded-full bg-emerald-50 dark:bg-emerald-900/10 text-emerald-500 flex items-center justify-center mx-auto mb-4">
                 <ShieldCheck :size="32" />
              </div>
              <p class="text-xs font-bold text-gray-400 uppercase tracking-widest">No Alerts Found</p>
              <p class="text-[10px] text-gray-300 dark:text-gray-600 mt-1">All systems functional</p>
            </div>
          </div>

          <button v-if="alerts.length" @click="handleClearAlerts" class="w-full mt-6 py-3 border border-gray-100 dark:border-gray-800 rounded-2xl text-xs font-bold text-gray-400 hover:text-rose-500 transition-all uppercase tracking-widest">
            Clear All Alerts
          </button>
        </div>
      </div>
    </div>

    <!-- Create Node Modal -->
    <Modal v-model:show="showCreateModal" title="新增监控节点" size="md">
      <template #body>
        <div class="space-y-6">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">节点名称</label>
              <input v-model="formState.name" class="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all dark:text-white" placeholder="My-Node-01" />
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">分组标签</label>
              <input v-model="formState.groupTag" class="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all dark:text-white" placeholder="Default" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">描述信息</label>
            <textarea v-model="formState.description" class="w-full px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all dark:text-white" rows="3" placeholder="节点的详细描述..."></textarea>
          </div>
          <Switch v-model="formState.enabled" label="启用监控" />
        </div>
      </template>
      <template #footer>
        <button @click="showCreateModal = false" class="px-6 py-3 text-gray-400 font-bold text-sm">取消</button>
        <button @click="handleCreate" class="px-8 py-3 bg-primary-600 text-white font-bold text-sm rounded-2xl shadow-lg shadow-primary-500/30">创建节点</button>
      </template>
    </Modal>

    <!-- Delete Confirm -->
    <Modal v-model:show="showDeleteModal" title="确认删除" size="sm">
      <template #body>
        <p class="text-gray-500">您确定要删除节点 <span class="font-bold text-gray-900 dark:text-white">{{ selectedNode?.name }}</span> 吗？这将清除所有历史监控数据。</p>
      </template>
      <template #footer>
        <button @click="showDeleteModal = false" class="px-6 py-3 text-gray-400 font-bold text-sm">取消</button>
        <button @click="handleDelete" class="px-8 py-3 bg-rose-500 text-white font-bold text-sm rounded-2xl shadow-lg shadow-rose-500/30">确认删除</button>
      </template>
    </Modal>
  </div>
</template>
