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
      const settingsData = result.data || result.settings || {};
      // Map vps_monitor_json from backend to vpsMonitor for UI
      config.value = {
        vpsMonitor: settingsData.vps_monitor_json || {}
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
    // Map vpsMonitor back to vps_monitor_json for backend
    const payload = {
      vps_monitor_json: config.value.vpsMonitor
    };
    const result = await saveSettings(payload);
    if (result.success) {
      showToast('已保存', 'success');
      // If backend returns updated settings, sync them
      const settingsData = result.data || result.settings || {};
      if (settingsData.vps_monitor_json) {
        config.value.vpsMonitor = settingsData.vps_monitor_json;
      }
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

    <div v-else class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <section class="grid grid-cols-1 gap-6">
        <div class="admin-section-header">
          <div class="admin-title-wrap">
            <div class="admin-title-icon">
              <Shield :size="18" />
            </div>
            <div>
              <h2 class="admin-title">上报安全</h2>
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
            <div class="admin-subsection">
              <div>
                <h3 class="admin-subsection-title">鉴权策略</h3>
                <p class="admin-subsection-desc">用于控制节点上报时的身份校验和签名校验要求。</p>
              </div>
              <Switch v-model="config.vpsMonitor.requireSecret" label="启用节点密钥校验" sublabel="强制每次上报携带节点密钥。" />
              <Switch v-model="config.vpsMonitor.requireSignature" label="启用 HMAC 签名校验" sublabel="对上报内容进行签名校验以防止篡改。" />
            </div>

            <div class="admin-subsection">
              <div>
                <h3 class="admin-subsection-title">上报时序</h3>
                <p class="admin-subsection-desc">控制节点心跳、离线判定和历史存档写入的时间窗口。</p>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="admin-field">
                  <label class="admin-label">签名时钟偏差 (分钟)</label>
                  <input v-model.number="config.vpsMonitor.signatureClockSkewMinutes" type="number" min="1" max="60" class="admin-input" />
                </div>
                <div class="admin-field">
                  <label class="admin-label">离线判定 (分钟)</label>
                  <input v-model.number="config.vpsMonitor.offlineThresholdMinutes" type="number" min="1" max="1440" class="admin-input" />
                </div>
                <div class="admin-field">
                  <label class="admin-label">上报周期 (分钟)</label>
                  <input v-model.number="config.vpsMonitor.reportIntervalMinutes" type="number" min="1" max="60" class="admin-input" />
                </div>
                <div class="admin-field">
                  <label class="admin-label">上报存档周期 (分钟)</label>
                  <input v-model.number="config.vpsMonitor.reportStoreIntervalMinutes" type="number" min="1" max="60" class="admin-input" />
                </div>
              </div>
            </div>
          </div>
          <div class="admin-aside-card space-y-4">
            <div class="admin-aside-title">安全提示</div>
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
              <h2 class="admin-title">告警规则</h2>
              <p class="admin-subtitle">统一告警触发阈值与冷却策略。</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div class="admin-panel xl:col-span-2 p-8 space-y-8">
            <div class="admin-subsection">
              <div>
                <h3 class="admin-subsection-title">告警类型</h3>
                <p class="admin-subsection-desc">决定系统是否记录告警，以及哪些事件需要进入告警流转。</p>
              </div>
              <Switch v-model="config.vpsMonitor.alertsEnabled" label="启用告警" sublabel="自动生成告警记录并触发通知。" />
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Switch v-model="config.vpsMonitor.notifyOffline" label="离线告警" />
                <Switch v-model="config.vpsMonitor.notifyRecovery" label="恢复告警" />
                <Switch v-model="config.vpsMonitor.notifyOverload" label="过载告警" />
              </div>
              <p class="text-[11px] text-gray-500">当前阈值会用于生成过载告警，并同步影响公开页异常状态展示。</p>
            </div>

            <div class="admin-subsection">
              <div>
                <h3 class="admin-subsection-title">阈值与冷却</h3>
                <p class="admin-subsection-desc">控制资源占用告警的触发阈值、确认次数和重复告警的冷却时间。</p>
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="admin-field">
                  <label class="admin-label">CPU 阈值 (%)</label>
                  <input v-model.number="config.vpsMonitor.cpuWarnPercent" type="number" min="1" max="100" class="admin-input" />
                </div>
                <div class="admin-field">
                  <label class="admin-label">内存阈值 (%)</label>
                  <input v-model.number="config.vpsMonitor.memWarnPercent" type="number" min="1" max="100" class="admin-input" />
                </div>
                <div class="admin-field">
                  <label class="admin-label">磁盘阈值 (%)</label>
                  <input v-model.number="config.vpsMonitor.diskWarnPercent" type="number" min="1" max="100" class="admin-input" />
                </div>
                <div class="admin-field">
                  <label class="admin-label">告警冷却 (分钟)</label>
                  <input v-model.number="config.vpsMonitor.alertCooldownMinutes" type="number" min="1" max="1440" class="admin-input" />
                </div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="admin-field">
                  <label class="admin-label">过载确认次数</label>
                  <input v-model.number="config.vpsMonitor.overloadConfirmCount" type="number" min="1" max="10" class="admin-input" />
                </div>
                <div class="admin-field">
                  <label class="admin-label">记录保留 (天)</label>
                  <input v-model.number="config.vpsMonitor.reportRetentionDays" type="number" min="1" max="180" class="admin-input" />
                </div>
              </div>
            </div>
          </div>
          <div class="admin-aside-card space-y-4">
            <div class="admin-aside-title">告警建议</div>
            <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">建议将 CPU/内存/磁盘阈值保持在 80%-90%，避免频繁抖动。</p>
            <p class="text-xs text-gray-500">冷却时间用于防止重复告警，可按业务容忍度调整。</p>
          </div>
        </div>
      </section>

      <div class="flex justify-end pt-6">
        <button @click="handleSave" :disabled="isSaving" class="admin-primary-btn px-10 py-4">
          <Save v-if="!isSaving" :size="18" />
          <RefreshCw v-else :size="18" class="animate-spin" />
          {{ isSaving ? '保存中...' : '保存上报参数' }}
        </button>
      </div>
    </div>
  </div>
</template>
