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
const isFirstLogin = ref(false); // 标记是否首次登录
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
    
    // 检查是否是首次登录（通过检查是否有 mustChangePassword 字段）
    if (profileRes.success && profileRes.user) {
      isFirstLogin.value = !!profileRes.user.must_change_password;
    }
    
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

    <div v-else class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <section class="grid grid-cols-1 gap-6">
        <div class="admin-section-header">
          <div class="admin-title-wrap">
            <div class="admin-title-icon">
              <Bell :size="18" />
            </div>
            <div>
              <h2 class="admin-title">通知设置</h2>
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
            <div class="admin-subsection">
              <div>
                <h3 class="admin-subsection-title">推送开关</h3>
                <p class="admin-subsection-desc">先决定是否启用通知，再选择需要接入的推送渠道。</p>
              </div>
              <Switch v-model="config.notifications.enabled" label="启用通知推送" sublabel="总开关，关闭后不触发外部推送。" />
              <Switch v-model="config.notifications.telegram.enabled" label="启用 Telegram 推送" sublabel="使用 Bot Token + Chat ID 发送告警。" />
              <Switch v-model="config.notifications.webhook.enabled" label="启用 Webhook 推送" sublabel="将告警 POST 到指定 URL。" />
              <Switch v-model="config.notifications.pushplus.enabled" label="启用 PushPlus 推送" sublabel="通过 PushPlus Token 发送测试通知。" />
            </div>

            <div class="admin-subsection">
              <div>
                <h3 class="admin-subsection-title">渠道凭据</h3>
                <p class="admin-subsection-desc">只有对应渠道启用后，下面的凭据才会真正参与通知发送。</p>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="admin-field">
                  <label class="admin-label">Telegram Bot Token</label>
                  <input v-model="config.notifications.telegram.botToken" type="text" class="admin-input" />
                </div>
                <div class="admin-field">
                  <label class="admin-label">Telegram Chat ID</label>
                  <input v-model="config.notifications.telegram.chatId" type="text" class="admin-input" />
                </div>
                <div class="admin-field">
                  <label class="admin-label">Webhook URL</label>
                  <input v-model="config.notifications.webhook.url" type="text" class="admin-input" />
                </div>
                <div class="admin-field">
                  <label class="admin-label">PushPlus Token</label>
                  <input v-model="config.notifications.pushplus.token" type="text" class="admin-input" />
                </div>
              </div>
            </div>

            <div class="flex justify-end">
              <button @click="handleTestNotify" :disabled="isTestingNotify" class="admin-secondary-btn px-6 py-3">
                <RefreshCw :size="16" :class="{ 'animate-spin': isTestingNotify }" />
                {{ isTestingNotify ? '测试中...' : '发送测试通知' }}
              </button>
            </div>
          </div>
          <div class="admin-aside-card space-y-4">
            <div class="admin-aside-title">通知提示</div>
            <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">建议至少开启一种通知渠道，避免重要告警遗漏。</p>
            <p class="text-xs text-gray-500">敏感字段仅用于发送通知，不会在公开页展示。</p>
          </div>
        </div>
      </section>

      <div class="admin-divider"></div>

      <section class="grid grid-cols-1 gap-6">
        <!-- 首次登录提示横幅 -->
        <div v-if="isFirstLogin" class="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 flex items-start gap-4">
          <div class="flex-shrink-0 w-12 h-12 bg-amber-100 dark:bg-amber-900/50 rounded-xl flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-bold text-amber-900 dark:text-amber-100 mb-1">⚠️ 首次登录安全提示</h3>
            <p class="text-sm text-amber-800 dark:text-amber-200 mb-3">
              检测到您是首次登录系统。为了保障账户安全，请立即修改默认密码（当前为 <code class="px-2 py-0.5 bg-amber-200 dark:bg-amber-800 rounded text-xs font-mono">admin</code>）。
            </p>
            <ul class="text-xs text-amber-700 dark:text-amber-300 space-y-1 list-disc list-inside">
              <li>建议使用至少 8 位包含大小写字母和数字的强密码</li>
              <li>修改密码后，此提示将自动消失</li>
            </ul>
          </div>
        </div>
        
        <div class="admin-section-header">
          <div class="admin-title-wrap">
            <div class="admin-title-icon">
              <UserCog :size="18" />
            </div>
            <div>
              <h2 class="admin-title">账户设置</h2>
              <p class="admin-subtitle">修改控制台登录用户名和密码。</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div class="admin-panel xl:col-span-2 p-8 space-y-6">
            <div class="admin-subsection">
              <div>
                <h3 class="admin-subsection-title">身份信息</h3>
                <p class="admin-subsection-desc">修改后台登录名时，建议保持与实际用途一致，方便团队协作识别。</p>
              </div>
              <div class="admin-field">
                <label class="admin-label">当前用户名</label>
                <input :value="profile.username" type="text" class="admin-input" disabled />
              </div>
              <div class="admin-field">
                <label class="admin-label">新用户名（可选）</label>
                <input v-model="profile.newUsername" type="text" class="admin-input" />
              </div>
            </div>
            <div class="admin-subsection">
              <div>
                <h3 class="admin-subsection-title">安全校验</h3>
                <p class="admin-subsection-desc">保存账户修改前，需要先输入当前密码完成身份校验。</p>
              </div>
              <div class="admin-field">
                <label class="admin-label">当前密码（必填）</label>
                <input v-model="profile.currentPassword" type="password" class="admin-input" />
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="admin-field">
                  <label class="admin-label">新密码（可选）</label>
                  <input v-model="profile.newPassword" type="password" class="admin-input" />
                </div>
                <div class="admin-field">
                  <label class="admin-label">确认新密码</label>
                  <input v-model="profile.confirmPassword" type="password" class="admin-input" />
                </div>
              </div>
            </div>

            <button @click="handleSaveProfile" :disabled="isSavingProfile" class="admin-primary-btn px-10 py-4">
              <Save v-if="!isSavingProfile" :size="18" />
              <RefreshCw v-else :size="18" class="animate-spin" />
              {{ isSavingProfile ? '保存中...' : '保存账户设置' }}
            </button>
          </div>
          <div class="admin-aside-card space-y-4">
            <div class="admin-aside-title">账号建议</div>
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
          {{ isSaving ? '保存中...' : '保存通知设置' }}
        </button>
      </div>
    </div>
  </div>
</template>
