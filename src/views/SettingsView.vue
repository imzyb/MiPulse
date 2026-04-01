<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useToastStore } from '../stores/toast.js';
import { fetchSettings, saveSettings } from '../lib/api.js';
import { Globe, Save, RefreshCw, ChevronDown } from 'lucide-vue-next';

const { showToast } = useToastStore();
const isLoading = ref(true);
const isSaving = ref(false);
const showPresetMenu = ref(false);
const presetMenuRef = ref(null);
const presetOptions = [
  { value: 'default', label: 'Default' },
  { value: 'fresh', label: 'Fresh' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'tech', label: 'Tech' },
  { value: 'glass', label: 'Glass' }
];
const config = ref({
  vpsMonitor: {}
});

const selectedPresetLabel = () => {
  const selected = config.value?.vpsMonitor?.publicThemePreset;
  return presetOptions.find(item => item.value === selected)?.label || 'Default';
};

const selectPreset = (value) => {
  config.value.vpsMonitor.publicThemePreset = value;
  showPresetMenu.value = false;
};

const handleClickOutside = (event) => {
  if (!presetMenuRef.value) return;
  if (!presetMenuRef.value.contains(event.target)) {
    showPresetMenu.value = false;
  }
};

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
    showToast('Failed to load settings', 'error');
  } finally {
    isLoading.value = false;
  }
};

const handleSave = async () => {
  isSaving.value = true;
  try {
    const result = await saveSettings(config.value);
    if (result.success) {
      if (result.data) {
        config.value = {
          ...result.data,
          vpsMonitor: {
            ...result.data.vpsMonitor
          }
        };
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
  window.addEventListener('click', handleClickOutside);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', handleClickOutside);
});
</script>

<template>
  <div class="admin-page relative">
      <div v-if="isLoading" class="admin-loading">
        <RefreshCw :size="48" class="animate-spin text-primary-500/20" />
        <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">Loading System Protocol...</span>
      </div>

      <div v-else class="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">

      <section id="theme" class="scroll-mt-24 grid grid-cols-1 gap-6">
        <div class="admin-section-header">
          <div class="admin-title-wrap">
            <div class="admin-title-icon">
              <Globe :size="18" />
            </div>
            <div>
              <h2 class="admin-title">Theme</h2>
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
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="space-y-1">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">主题预设</label>
                <div ref="presetMenuRef" class="relative">
                  <button
                    type="button"
                    class="admin-select flex items-center justify-between"
                    @click.stop="showPresetMenu = !showPresetMenu"
                  >
                    <span>{{ selectedPresetLabel() }}</span>
                    <ChevronDown :size="16" class="text-gray-400" />
                  </button>
                  <div
                    v-if="showPresetMenu"
                    class="absolute z-20 mt-2 w-full rounded-lg border border-gray-700 bg-gray-900 shadow-xl overflow-hidden"
                  >
                    <button
                      v-for="item in presetOptions"
                      :key="item.value"
                      type="button"
                      class="w-full px-4 py-3 text-left text-sm font-bold text-gray-200 hover:bg-white/10 transition-colors"
                      @click="selectPreset(item.value)"
                    >
                      {{ item.label }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div class="grid grid-cols-1 gap-4">
              <div class="space-y-1">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">公开页 Logo URL</label>
                <input v-model="config.vpsMonitor.publicThemeLogo" type="text" class="admin-input" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">背景图 URL</label>
                <input v-model="config.vpsMonitor.publicThemeBackgroundImage" type="text" class="admin-input" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">公开页标题</label>
                <input v-model="config.vpsMonitor.publicThemeTitle" type="text" class="admin-input" />
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">公开页副标题</label>
                <textarea v-model="config.vpsMonitor.publicThemeSubtitle" rows="2" class="admin-textarea"></textarea>
              </div>
              <div class="space-y-1">
                <label class="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">公开页页脚文案</label>
                <input v-model="config.vpsMonitor.publicThemeFooterText" type="text" class="admin-input" />
              </div>
            </div>
          </div>
          <div class="p-6 rounded-xl bg-gradient-to-br from-primary-500/10 to-blue-500/5 border border-primary-500/20 shadow-lg space-y-4">
            <div class="text-xs font-black uppercase tracking-widest text-primary-500">主题提示</div>
            <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">主题区域用于控制公开页风格。建议先选预设，再补充 Logo 与背景图。</p>
            <p class="text-xs text-gray-500">公开页无需 Token 即可访问。</p>
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
