<script setup>
import { onMounted, ref } from 'vue';
import { RefreshCw, Radar, Save } from 'lucide-vue-next';
import { useToastStore } from '../stores/toast.js';
import { fetchSettings, fetchVpsNetworkTargets, saveSettings } from '../lib/api.js';
import VpsNetworkTargets from '../components/vps/VpsNetworkTargets.vue';

const { showToast } = useToastStore();

const isLoading = ref(true);
const isSaving = ref(false);
const targets = ref([]);
const limit = ref(10);
const config = ref({ vpsMonitor: {} });

const loadData = async ({ notify = false } = {}) => {
  isLoading.value = true;
  try {
    const [targetsRes, settingsRes] = await Promise.all([
      fetchVpsNetworkTargets('global'),
      fetchSettings()
    ]);

    if (targetsRes?.success) {
      targets.value = targetsRes.data || [];
    }

    if (settingsRes?.success) {
      config.value = {
        ...settingsRes,
        vpsMonitor: {
          ...settingsRes.vpsMonitor
        }
      };
      limit.value = settingsRes?.vpsMonitor?.networkTargetsLimit || 10;
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
    const result = await saveSettings(config.value);
    if (result.success && result.data) {
      config.value = {
        ...result.data,
        vpsMonitor: {
          ...result.data.vpsMonitor
        }
      };
      limit.value = result?.data?.vpsMonitor?.networkTargetsLimit || limit.value;
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
            <h2 class="admin-title">Network Monitor</h2>
            <p class="admin-subtitle">网络监测</p>
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
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="space-y-1">
              <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">拨测间隔 (分钟)</label>
              <input v-model.number="config.vpsMonitor.networkSampleIntervalMinutes" type="number" min="1" max="60" class="admin-input" />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">目标上限</label>
              <input v-model.number="config.vpsMonitor.networkTargetsLimit" type="number" min="1" max="10" class="admin-input" />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">网络采样保留 (天)</label>
              <input v-model.number="config.vpsMonitor.reportRetentionDays" type="number" min="1" max="180" class="admin-input" />
            </div>
          </div>
        </div>
        <div class="p-6 rounded-xl bg-gradient-to-br from-primary-500/10 to-blue-500/5 border border-primary-500/20 shadow-lg space-y-4">
          <div class="text-xs font-black uppercase tracking-widest text-primary-500">拨测说明</div>
          <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">节点会按配置间隔对 ICMP / TCP / HTTP 目标进行拨测并回传指标。</p>
          <p class="text-xs text-gray-500">目标上限用于保护节点开销，建议保持 3-5 个。</p>
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
        :allowCheck="false"
        :hideHeader="true"
        @refresh="loadData"
      />

      <div class="flex justify-end pt-6">
        <button @click="handleSave" :disabled="isSaving" class="admin-primary-btn px-10 py-4">
          <Save v-if="!isSaving" :size="18" />
          <RefreshCw v-else :size="18" class="animate-spin" />
          {{ isSaving ? 'COMMITING...' : 'SAVE PROTOCOL' }}
        </button>
      </div>
    </section>
  </div>
</template>
