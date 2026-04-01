<script setup>
import { storeToRefs } from 'pinia';
import { useToastStore } from '../../stores/toast.js';

const toastStore = useToastStore();
const { toasts } = storeToRefs(toastStore);

const typeClasses = {
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  error: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-200'
};
</script>

<template>
  <div class="fixed top-24 right-4 z-[100] flex w-[min(92vw,24rem)] flex-col gap-2 pointer-events-none">
    <transition-group name="toast" tag="div" class="space-y-2">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto rounded-lg border px-4 py-3 text-sm font-bold shadow-xl backdrop-blur"
        :class="typeClasses[toast.type] || typeClasses.info"
      >
        <div class="flex items-start justify-between gap-3">
          <p class="leading-relaxed">{{ toast.message }}</p>
          <button
            type="button"
            class="text-xs opacity-70 hover:opacity-100"
            @click="toastStore.removeToast(toast.id)"
          >
            关闭
          </button>
        </div>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.22s ease;
}

.toast-move {
  transition: transform 0.22s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
