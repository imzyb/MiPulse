<script setup>
import { ref, onMounted } from 'vue';
import { useToastStore } from '../stores/toast.js';
import { fetchSettings, saveSettings, fetchProfile, updateProfile, testNotifications } from '../lib/api.js';
import { Bell, Save, RefreshCw, UserCog } from 'lucide-vue-next';
import Switch from '../components/ui/Switch.vue';
import { useAuthStore } from '../stores/auth.js';

const { showToast } = useToastStore();
const authStore = useAuthStore();
const isLoading = ref(true);
const isSaving = ref(false);
const isSavingProfile = ref(false);
const isTestingNotify = ref(false);
const config = ref({ vpsMonitor: {}, notifications: { enabled: false, telegram: {}, webhook: {}, pushplus: {} } });
const profile = ref({
  username: 'admin',
  currentPassword: '',
  newUsername: '',
  newPassword: '',
  confirmPassword: ''
});

const loadData = async () => {
  isLoading.value = true;
  try {
    const result = await fetchSettings();
    const profileRes = await fetchProfile();
    if (result.success) {
      const settingsData = result.data || result.settings || {};
      config.value = {
        vpsMonitor: {
          ...(settingsData.vps_monitor_json || {})
        },
        notifications: {
          enabled: settingsData.notification_json?.enabled || false,
          telegram: {
            enabled: settingsData.notification_json?.telegram?.enabled || false,
            botToken: settingsData.notification_json?.telegram?.botToken || '',
            chatId: settingsData.notification_json?.telegram?.chatId || ''
          },
          webhook: {
            enabled: settingsData.notification_json?.webhook?.enabled || false,
            url: settingsData.notification_json?.webhook?.url || ''
          },
          pushplus: {
            enabled: settingsData.notification_json?.pushplus?.enabled || false,
            token: settingsData.notification_json?.pushplus?.token || ''
          }
        }
      };
    }
    if (profileRes?.success && (profileRes?.user?.username || profileRes?.data?.username)) {
      profile.value.username = profileRes.user?.username || profileRes.data?.username;
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
    const result = await saveSettings({
      vps_monitor_json: config.value.vpsMonitor,
      notification_json: config.value.notifications
    });
    if (result.success) {
      const settingsData = result.data || result.settings || {};
      config.value = {
        vpsMonitor: {
          ...(settingsData.vps_monitor_json || settingsData.vpsMonitor || {})
        },
        notifications: {
          enabled: settingsData.notification_json?.enabled || false,
          telegram: {
            enabled: settingsData.notification_json?.telegram?.enabled || false,
            botToken: settingsData.notification_json?.telegram?.botToken || '',
            chatId: settingsData.notification_json?.telegram?.chatId || ''
          },
          webhook: {
            enabled: settingsData.notification_json?.webhook?.enabled || false,
            url: settingsData.notification_json?.webhook?.url || ''
          },
          pushplus: {
            enabled: settingsData.notification_json?.pushplus?.enabled || false,
            token: settingsData.notification_json?.pushplus?.token || ''
          }
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

const handleSaveProfile = async () => {
  if (!profile.value.currentPassword) {
    showToast('请输入当前密码', 'warning');
    return;
  }
  if (profile.value.newPassword && profile.value.newPassword !== profile.value.confirmPassword) {
    showToast('新密码两次输入不一致', 'warning');
    return;
  }

  isSavingProfile.value = true;
  try {
    const payload = {
      currentPassword: profile.value.currentPassword,
      newUsername: profile.value.newUsername?.trim() || undefined,
      newPassword: profile.value.newPassword || undefined
    };
    const result = await updateProfile(payload);
    if (result?.success) {
      if (result.token) {
        authStore.token = result.token;
        localStorage.setItem('mipulse_token', result.token);
      }
      profile.value.username = result?.data?.username || profile.value.newUsername || profile.value.username;
      profile.value.currentPassword = '';
      profile.value.newUsername = '';
      profile.value.newPassword = '';
      profile.value.confirmPassword = '';
      showToast('已保存', 'success');
    } else {
      showToast(result?.error || '保存失败', 'error');
    }
  } catch (error) {
    showToast(error?.response?.data?.error || '保存失败', 'error');
  } finally {
    isSavingProfile.value = false;
  }
};

const handleTestNotify = async () => {
  if (isTestingNotify.value) return;
  isTestingNotify.value = true;
  try {
    const result = await testNotifications();
    if (result?.success) {
      const successCount = Number(result?.data?.successCount || 0);
      const failureCount = Number(result?.data?.failureCount || 0);
      showToast(`测试已发送（成功 ${successCount}，失败 ${failureCount}）`, failureCount ? 'warning' : 'success');
    } else {
      showToast(result?.error || '测试失败', 'error');
    }
  } catch (error) {
    showToast(error?.response?.data?.error || '测试失败', 'error');
  } finally {
    isTestingNotify.value = false;
  }
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
              <Bell :size="18" />
            </div>
            <div>
              <h2 class="admin-title">Notification Settings</h2>
              <p class="admin-subtitle">配置告警通知推送渠道（Telegram / Webhook / PushPlus）。</p>
            </div>
          </div>
          <button @click="handleRefresh" class="admin-secondary-btn px-10 py-4">
            <RefreshCw :size="18" class="text-gray-500" />
            刷新
          </button>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div class="admin-panel xl:col-span-2 p-6 space-y-6">
            <Switch v-model="config.notifications.enabled" label="启用通知推送" sublabel="总开关，关闭后不触发外部推送。" />
            <Switch v-model="config.notifications.telegram.enabled" label="启用 Telegram 推送" sublabel="使用 Bot Token + Chat ID 发送告警。" />
            <Switch v-model="config.notifications.webhook.enabled" label="启用 Webhook 推送" sublabel="将告警 POST 到指定 URL。" />
            <Switch v-model="config.notifications.pushplus.enabled" label="启用 PushPlus 推送" sublabel="通过 PushPlus Token 发送测试通知。" />

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-black/5 dark:border-white/5">
              <div class="space-y-1">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Telegram Bot Token</label>
                <input v-model="config.notifications.telegram.botToken" type="text" class="admin-input" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Telegram Chat ID</label>
                <input v-model="config.notifications.telegram.chatId" type="text" class="admin-input" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Webhook URL</label>
                <input v-model="config.notifications.webhook.url" type="text" class="admin-input" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">PushPlus Token</label>
                <input v-model="config.notifications.pushplus.token" type="text" class="admin-input" />
              </div>
            </div>

            <div class="flex justify-end">
              <button @click="handleTestNotify" :disabled="isTestingNotify" class="admin-secondary-btn px-6 py-3">
                <RefreshCw :size="16" :class="{ 'animate-spin': isTestingNotify }" />
                {{ isTestingNotify ? '测试中...' : '发送测试通知' }}
              </button>
            </div>
          </div>
          <div class="p-6 rounded-xl bg-gradient-to-br from-primary-500/10 to-blue-500/5 border border-primary-500/20 shadow-lg space-y-4">
            <div class="text-xs font-black uppercase tracking-widest text-primary-500">通知提示</div>
            <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">建议至少开启一种通知渠道，避免重要告警遗漏。</p>
            <p class="text-xs text-gray-500">敏感字段仅用于发送通知，不会在公开页展示。</p>
          </div>
        </div>
      </section>

      <div class="admin-divider"></div>

      <section class="grid grid-cols-1 gap-6">
        <div class="admin-section-header">
          <div class="admin-title-wrap">
            <div class="admin-title-icon">
              <UserCog :size="18" />
            </div>
            <div>
              <h2 class="admin-title">User Profile</h2>
              <p class="admin-subtitle">修改控制台登录用户名和密码。</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div class="admin-panel xl:col-span-2 p-8 space-y-6">
            <div class="space-y-1">
              <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">当前用户名</label>
              <input :value="profile.username" type="text" class="admin-input" disabled />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">新用户名（可选）</label>
              <input v-model="profile.newUsername" type="text" class="admin-input" />
            </div>
            <div class="space-y-1">
              <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">当前密码（必填）</label>
              <input v-model="profile.currentPassword" type="password" class="admin-input" />
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-1">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">新密码（可选）</label>
                <input v-model="profile.newPassword" type="password" class="admin-input" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">确认新密码</label>
                <input v-model="profile.confirmPassword" type="password" class="admin-input" />
              </div>
            </div>

            <button @click="handleSaveProfile" :disabled="isSavingProfile" class="admin-primary-btn px-10 py-4">
              <Save v-if="!isSavingProfile" :size="18" />
              <RefreshCw v-else :size="18" class="animate-spin" />
              {{ isSavingProfile ? 'COMMITING...' : 'SAVE PROFILE' }}
            </button>
          </div>
          <div class="p-6 rounded-xl bg-gradient-to-br from-primary-500/10 to-blue-500/5 border border-primary-500/20 shadow-lg space-y-4">
            <div class="text-xs font-black uppercase tracking-widest text-primary-500">账号建议</div>
            <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">建议定期轮换密码并避免在多个系统复用同一密码。</p>
            <p class="text-xs text-gray-500">修改成功后会下发新 Token，无需重新登录。</p>
          </div>
        </div>
      </section>

      <div class="flex justify-end pt-6">
        <button 
          @click="handleSave"
          :disabled="isSaving"
          class="admin-primary-btn px-10 py-4"
        >
          <Save v-if="!isSaving" :size="18" />
          <RefreshCw v-else :size="18" class="animate-spin" />
          {{ isSaving ? 'COMMITING...' : 'SAVE PROTOCOL' }}
        </button>
      </div>
    </div>
  </div>
</template>
