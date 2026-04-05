<script setup>
import { ref, onMounted } from 'vue';
import { useToastStore } from '../stores/toast.js';
import { fetchSettings, saveSettings } from '../lib/api.js';
import { Globe, Save, RefreshCw } from 'lucide-vue-next';

const { showToast } = useToastStore();
const isLoading = ref(true);
const isSaving = ref(false);
const presetOptions = [
  { value: 'default', label: '默认' },
  { value: 'fresh', label: '清新' },
  { value: 'minimal', label: '极简' },
  { value: 'tech', label: '科技' },
  { value: 'glass', label: '玻璃' }
];
const config = ref({
  vpsMonitor: {}
});

const loadData = async () => {
  isLoading.value = true;
  try {
    const result = await fetchSettings();
    if (result.success) {
      const settingsData = result.data || result.settings || {};
      // Map theme_json from backend to vpsMonitor for this UI's usage
      config.value = {
        vpsMonitor: settingsData.theme_json || {}
      };
    }
  } catch (error) {
      showToast('加载主题设置失败', 'error');
  } finally {
    isLoading.value = false;
  }
};

const handleSave = async () => {
  isSaving.value = true;
  try {
    const payload = {
      theme_json: config.value.vpsMonitor
    };
    const result = await saveSettings(payload);
    if (result.success) {
      const settingsData = result.data || result.settings || {};
      if (settingsData.theme_json) {
        config.value.vpsMonitor = settingsData.theme_json;
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

const handleRefresh = async () => {
  await loadData();
  showToast('已刷新', 'success');
};

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="admin-page relative">
      <div v-if="isLoading" class="admin-loading">
        <RefreshCw :size="48" class="animate-spin text-primary-500/20" />
        <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading System Protocol...</span>
      </div>

      <div v-else class="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

      <section id="theme" class="scroll-mt-24 grid grid-cols-1 gap-6">
        <div class="admin-section-header">
          <div class="admin-title-wrap">
            <div class="admin-title-icon">
              <Globe :size="18" />
            </div>
            <div>
              <h2 class="admin-title">主题设置</h2>
              <p class="admin-subtitle">统一公开页视觉配置与文案。</p>
            </div>
          </div>
          <button @click="handleRefresh" class="admin-secondary-btn px-10 py-4">
            <RefreshCw :size="18" class="text-gray-500" />
            刷新
          </button>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <div class="admin-panel lg:col-span-2 p-8 space-y-6">
            <div class="admin-subsection">
              <div>
                <h3 class="admin-subsection-title">主题预设</h3>
                <p class="admin-subsection-desc">先确定整体视觉风格，再继续补充标题、Logo 和背景图等公开页素材。</p>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="admin-field">
                  <label class="admin-label">主题预设</label>
                  <select v-model="config.vpsMonitor.publicThemePreset" class="admin-select">
                    <option v-for="item in presetOptions" :key="item.value" :value="item.value">
                      {{ item.label }}
                    </option>
                  </select>
                </div>
              </div>
            </div>
            <div class="admin-subsection">
              <div>
                <h3 class="admin-subsection-title">页面内容</h3>
                <p class="admin-subsection-desc">这部分内容会直接影响公开页访客看到的主视觉、标题和页脚文案。</p>
              </div>
              <div class="grid grid-cols-1 gap-4">
                <div class="admin-field">
                  <label class="admin-label">公开页 Logo URL</label>
                  <input v-model="config.vpsMonitor.publicThemeLogo" type="text" class="admin-input" />
                </div>
                <div class="admin-field">
                  <label class="admin-label">背景图 URL</label>
                  <input v-model="config.vpsMonitor.publicThemeBackgroundImage" type="text" class="admin-input" />
                </div>
                <div class="admin-field">
                  <label class="admin-label">公开页标题</label>
                  <input v-model="config.vpsMonitor.publicThemeTitle" type="text" class="admin-input" />
                </div>
                <div class="admin-field">
                  <label class="admin-label">公开页副标题</label>
                  <textarea v-model="config.vpsMonitor.publicThemeSubtitle" rows="2" class="admin-textarea"></textarea>
                </div>
                <div class="admin-field">
                  <label class="admin-label">公开页页脚文案</label>
                  <input v-model="config.vpsMonitor.publicThemeFooterText" type="text" class="admin-input" />
                </div>
              </div>
            </div>
          </div>
          <div class="admin-aside-card space-y-4">
            <div class="admin-aside-title">主题提示</div>
            <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">主题区域用于控制公开页风格。建议先选预设，再补充 Logo 与背景图。</p>
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
          {{ isSaving ? '保存中...' : '保存主题设置' }}
        </button>
      </div>
    </div>
  </div>
</template>
