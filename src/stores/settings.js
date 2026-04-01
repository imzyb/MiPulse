import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useSettingsStore = defineStore('settings', () => {
    const config = ref({
        vpsMonitor: {
            offlineThresholdMinutes: 10,
            reportRetentionDays: 30
        }
    });

    function updateConfig(newConfig) {
        config.value = { ...config.value, ...newConfig };
    }

    return { config, updateConfig };
});
