import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useToastStore = defineStore('toast', () => {
    const toasts = ref([]);
    const timers = new Map();
    let seed = 0;

    function showToast(message, type = 'info', duration = 3000) {
        const id = `${Date.now()}-${++seed}`;
        toasts.value.unshift({ id, message, type });

        if (toasts.value.length > 5) {
            const dropped = toasts.value.pop();
            if (dropped?.id) removeToast(dropped.id);
        }

        if (duration > 0) {
            const timer = setTimeout(() => removeToast(id), duration);
            timers.set(id, timer);
        }
        return id;
    }

    function removeToast(id) {
        const timer = timers.get(id);
        if (timer) {
            clearTimeout(timer);
            timers.delete(id);
        }
        toasts.value = toasts.value.filter(t => t.id !== id);
    }

    return { toasts, showToast, removeToast };
});
