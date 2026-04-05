<script setup>
import { onMounted, ref } from 'vue';
import { RefreshCw, Radar, Save } from 'lucide-vue-next';
import { useToastStore } from '../stores/toast.js';
import { fetchSettings, fetchVpsNetworkTargets, requestVpsNetworkCheck, saveSettings } from '../lib/api.js';
import Switch from '../components/ui/Switch.vue';
import VpsNetworkTargets from '../components/vps/VpsNetworkTargets.vue';

const { showToast } = useToastStore();

const isLoading = ref(true);
const isSaving = ref(false);
const targets = ref([]);
const limit = ref(10);
const checkingTargets = ref({});
const config = ref({ networkMonitor: { globalEnabled: true, intervalMin: 5, targetLimit: 10, keepHistoryDays: 3 } });

const loadData = async ({ notify = false } = {}) => {
  isLoading.value = true;
  try {
    const [targetsRes, settingsRes] = await Promise.all([
      fetchVpsNetworkTargets('global'),
      fetchSettings()
    ]);

    if (targetsRes?.success) {
      targets.value = targetsRes.data || targetsRes.targets || [];
    }

    if (settingsRes?.success) {
      const settingsData = settingsRes.data || settingsRes.settings || {};
      const net = settingsData.network_monitor_json || {};
      config.value = {
        networkMonitor: {
          globalEnabled: net.globalEnabled ?? true,
          intervalMin: net.intervalMin ?? 5,
          targetLimit: net.targetLimit ?? 10,
          keepHistoryDays: net.keepHistoryDays ?? 3
        }
      };
      limit.value = net.targetLimit || 10;
    }
    if (notify) {
      showToast('已刷新', 'success');
    }
  } catch (error) {
    showToast(error?.message || '加载网络监测配置失败', 'error');
  } finally {
    isLoading.value = false;
  }
};

const handleRefresh = async () => {
  await loadData({ notify: true });
};

const handleSave = async () => {
  isSaving.value = true;
  try {
    const payload = {
      network_monitor_json: config.value.networkMonitor
    };
    const result = await saveSettings(payload);
    if (result.success) {
      const settingsData = result.data || result.settings || {};
      if (settingsData.network_monitor_json) {
        config.value.networkMonitor = {
          globalEnabled: settingsData.network_monitor_json.globalEnabled ?? true,
          intervalMin: settingsData.network_monitor_json.intervalMin ?? 5,
          targetLimit: settingsData.network_monitor_json.targetLimit ?? limit.value,
          keepHistoryDays: settingsData.network_monitor_json.keepHistoryDays ?? 3
        };
        limit.value = settingsData.network_monitor_json.targetLimit || limit.value;
      }
      showToast('已保存', 'success');
    } else {
      showToast(result?.error || '保存失败', 'error');
    }
  } catch (error) {
    showToast('保存失败', 'error');
  } finally {
    isSaving.value = false;
  }
};

const handleCheck = async (target) => {
  checkingTargets.value = {
    ...checkingTargets.value,
    [target.id]: true
  };

  try {
    const result = await requestVpsNetworkCheck('global', target.id);
    if (result?.success) {
      const status = result.data?.status === 'reachable' ? '可达' : '不可达';
      const latency = result.data?.latencyMs ? `，延迟 ${result.data.latencyMs}ms` : '';
      showToast(`检测完成：${status}${latency}`, result.data?.status === 'reachable' ? 'success' : 'warning');
      await loadData();
    } else {
      showToast(result?.error || '检测失败', 'error');
    }
  } catch (error) {
    showToast(error?.response?.data?.error || '检测失败', 'error');
  } finally {
    checkingTargets.value = {
      ...checkingTargets.value,
      [target.id]: false
    };
  }
};

onMounted(loadData);
</script>

<template>
  <div class="admin-page">
    <section class="grid grid-cols-1 gap-6">
      <div class="admin-section-header">
        <div class="admin-title-wrap">
          <div class="admin-title-icon">
            <Radar :size="20" />
          </div>
          <div>
              <h2 class="admin-title">网络监测</h2>
              <p class="admin-subtitle">统一配置全局拨测开关、频率、目标上限与样本保留时间。</p>
          </div>
        </div>
        <button
          @click="handleRefresh"
          :disabled="isLoading"
          class="admin-secondary-btn px-10 py-4"
        >
          <RefreshCw :size="16" :class="{ 'animate-spin': isLoading }" />
          刷新
        </button>
      </div>

        <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div class="admin-panel xl:col-span-2 p-6 space-y-6">
          <div class="admin-subsection">
            <div>
              <h3 class="admin-subsection-title">全局开关</h3>
              <p class="admin-subsection-desc">用于控制是否允许节点继续执行拨测任务并回传结果。</p>
            </div>
            <Switch v-model="config.networkMonitor.globalEnabled" label="全局启用网络监测" sublabel="关闭后将暂停全局拨测和结果回传。" />
          </div>
          <div class="admin-subsection">
            <div>
              <h3 class="admin-subsection-title">采样策略</h3>
              <p class="admin-subsection-desc">控制拨测频率、可创建的目标数量，以及样本在 D1 中的保留时间。</p>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div class="admin-field">
                <label class="admin-label">拨测间隔 (分钟)</label>
                <input v-model.number="config.networkMonitor.intervalMin" type="number" min="1" max="60" class="admin-input" />
              </div>
              <div class="admin-field">
                <label class="admin-label">目标上限</label>
                <input v-model.number="config.networkMonitor.targetLimit" type="number" min="1" max="10" class="admin-input" />
              </div>
              <div class="admin-field">
                <label class="admin-label">网络采样保留 (天)</label>
                <input v-model.number="config.networkMonitor.keepHistoryDays" type="number" min="1" max="180" class="admin-input" />
              </div>
            </div>
          </div>
        </div>
        <div class="admin-aside-card space-y-4">
          <div class="admin-aside-title">拨测说明</div>
          <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">所有节点共享同一套全局拨测配置。建议将拨测间隔保持在 3-5 分钟，避免不必要的 D1 写入与节点开销。</p>
          <p class="text-xs text-gray-500">目标上限用于控制拨测成本，样本保留时间越长，占用的 D1 配额也越多。</p>
        </div>
      </div>

      <div class="admin-divider"></div>

      <div v-if="isLoading" class="admin-loading admin-panel">
        <RefreshCw :size="40" class="animate-spin text-primary-500/30" />
        <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading Network Targets...</span>
      </div>

      <VpsNetworkTargets
        v-else
        nodeId="global"
        :targets="targets"
        :limit="limit"
        :checkingTargets="checkingTargets"
        :allowCheck="true"
        :hideHeader="true"
        @refresh="loadData"
        @check="handleCheck"
      />

      <div class="flex justify-end pt-6">
        <button @click="handleSave" :disabled="isSaving" class="admin-primary-btn px-10 py-4">
          <Save v-if="!isSaving" :size="18" />
          <RefreshCw v-else :size="18" class="animate-spin" />
          {{ isSaving ? '保存中...' : '保存网络监测设置' }}
        </button>
      </div>
    </section>
  </div>
</template>
