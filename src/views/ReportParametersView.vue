<script setup>
import { ref, onMounted } from 'vue';
import { useToastStore } from '../stores/toast.js';
import { fetchSettings, saveSettings } from '../lib/api.js';
import { Shield, Bell, Save, RefreshCw } from 'lucide-vue-next';
import Switch from '../components/ui/Switch.vue';

const { showToast } = useToastStore();
const isLoading = ref(true);
const isSaving = ref(false);
const config = ref({ vpsMonitor: {} });

const loadData = async () => {
  isLoading.value = true;
  try {
    const result = await fetchSettings();
    if (result.success) {
      config.value = {
        ...result,
        vpsMonitor: {
          ...result.vpsMonitor
        }
      };
    }
  } catch (error) {
    showToast('加载失败', 'error');
  } finally {
    isLoading.value = false;
  }
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

const handleRefresh = async () => {
  await loadData();
  showToast('已刷新', 'success');
};

onMounted(loadData);
</script>

<template>
  <div class="admin-page">
    <div v-if="isLoading" class="admin-loading">
      <RefreshCw :size="48" class="animate-spin text-primary-500/20" />
      <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading System Protocol...</span>
    </div>

    <div v-else class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <section class="grid grid-cols-1 gap-6">
        <div class="admin-section-header">
          <div class="admin-title-wrap">
            <div class="admin-title-icon">
              <Shield :size="18" />
            </div>
            <div>
              <h2 class="admin-title">Reporting Security</h2>
              <p class="admin-subtitle">统一上报鉴权、签名与采样周期参数。</p>
            </div>
          </div>
          <button @click="handleRefresh" class="admin-secondary-btn px-10 py-4">
            <RefreshCw :size="18" class="text-gray-500" />
            刷新
          </button>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div class="admin-panel xl:col-span-2 p-6 space-y-6">
            <Switch v-model="config.vpsMonitor.requireSecret" label="启用节点密钥校验" sublabel="强制每次上报携带节点密钥。" />
            <Switch v-model="config.vpsMonitor.requireSignature" label="启用 HMAC 签名校验" sublabel="对上报内容进行签名校验以防止篡改。" />

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-black/5 dark:border-white/5">
              <div class="space-y-1">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">签名时钟偏差 (分钟)</label>
                <input v-model.number="config.vpsMonitor.signatureClockSkewMinutes" type="number" min="1" max="60" class="admin-input" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">离线判定 (分钟)</label>
                <input v-model.number="config.vpsMonitor.offlineThresholdMinutes" type="number" min="1" max="1440" class="admin-input" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">上报周期 (分钟)</label>
                <input v-model.number="config.vpsMonitor.reportIntervalMinutes" type="number" min="1" max="60" class="admin-input" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">上报存档周期 (分钟)</label>
                <input v-model.number="config.vpsMonitor.reportStoreIntervalMinutes" type="number" min="1" max="60" class="admin-input" />
              </div>
            </div>
          </div>
          <div class="p-6 rounded-xl bg-gradient-to-br from-primary-500/10 to-blue-500/5 border border-primary-500/20 shadow-lg space-y-4">
            <div class="text-xs font-black uppercase tracking-widest text-primary-500">安全提示</div>
            <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">签名开启时请确保探针节点安装了 openssl，否则上报将被拒绝。</p>
            <p class="text-xs text-gray-500">建议保持密钥校验开启，并定期更换节点密钥。</p>
          </div>
        </div>
      </section>

      <div class="admin-divider"></div>

      <section class="grid grid-cols-1 gap-6">
        <div class="admin-section-header">
          <div class="admin-title-wrap">
            <div class="admin-title-icon">
              <Bell :size="18" />
            </div>
            <div>
              <h2 class="admin-title">Alert Rules</h2>
              <p class="admin-subtitle">统一告警触发阈值与冷却策略。</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div class="admin-panel xl:col-span-2 p-8 space-y-8">
            <Switch v-model="config.vpsMonitor.alertsEnabled" label="启用告警" sublabel="自动生成告警记录并触发通知。" />
            <p class="text-[11px] text-gray-500">当前阈值会用于生成过载告警，并同步影响公开页异常状态展示。</p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Switch v-model="config.vpsMonitor.notifyOffline" label="离线告警" />
              <Switch v-model="config.vpsMonitor.notifyRecovery" label="恢复告警" />
              <Switch v-model="config.vpsMonitor.notifyOverload" label="过载告警" />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-black/5 dark:border-white/5">
              <div class="space-y-1">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">CPU 阈值 (%)</label>
                <input v-model.number="config.vpsMonitor.cpuWarnPercent" type="number" min="1" max="100" class="admin-input" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">内存阈值 (%)</label>
                <input v-model.number="config.vpsMonitor.memWarnPercent" type="number" min="1" max="100" class="admin-input" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">磁盘阈值 (%)</label>
                <input v-model.number="config.vpsMonitor.diskWarnPercent" type="number" min="1" max="100" class="admin-input" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">告警冷却 (分钟)</label>
                <input v-model.number="config.vpsMonitor.alertCooldownMinutes" type="number" min="1" max="1440" class="admin-input" />
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-1">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">过载确认次数</label>
                <input v-model.number="config.vpsMonitor.overloadConfirmCount" type="number" min="1" max="10" class="admin-input" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">记录保留 (天)</label>
                <input v-model.number="config.vpsMonitor.reportRetentionDays" type="number" min="1" max="180" class="admin-input" />
              </div>
            </div>
          </div>
          <div class="p-6 rounded-xl bg-gradient-to-br from-primary-500/10 to-blue-500/5 border border-primary-500/20 shadow-lg space-y-4">
            <div class="text-xs font-black uppercase tracking-widest text-primary-500">告警建议</div>
            <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">建议将 CPU/内存/磁盘阈值保持在 80%-90%，避免频繁抖动。</p>
            <p class="text-xs text-gray-500">冷却时间用于防止重复告警，可按业务容忍度调整。</p>
          </div>
        </div>
      </section>

      <div class="flex justify-end pt-6">
        <button @click="handleSave" :disabled="isSaving" class="admin-primary-btn px-10 py-4">
          <Save v-if="!isSaving" :size="18" />
          <RefreshCw v-else :size="18" class="animate-spin" />
          {{ isSaving ? 'COMMITING...' : 'SAVE PROTOCOL' }}
        </button>
      </div>
    </div>
  </div>
</template>
