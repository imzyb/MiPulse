<script setup>
/**
 * LoadingOverlay 加载遮罩组件
 * 用于页面或区域加载时的全屏/局部遮罩显示
 */
const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  // 全屏模式或局部模式
  fullscreen: {
    type: Boolean,
    default: true
  },
  // 加载提示文字
  message: {
    type: String,
    default: '加载中...'
  },
  // 是否显示半透明背景
  overlay: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['update:show']);
</script>

<template>
  <Teleport to="body">
    <transition name="fade" appear>
      <div
        v-if="show"
        class="fixed inset-0 z-[9999] flex items-center justify-center"
        :class="{ 'bg-black/40 backdrop-blur-sm': overlay && fullscreen }"
        role="status"
        aria-live="polite"
      >
        <div 
          class="flex flex-col items-center gap-4 p-8 rounded-3xl bg-white dark:bg-gray-900 shadow-2xl"
          :class="{ 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2': !fullscreen }"
        >
          <!-- Spinner -->
          <div class="relative">
            <div class="w-16 h-16 rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
            <div class="absolute top-0 left-0 w-16 h-16 rounded-full border-4 border-primary-600 border-t-transparent animate-spin"></div>
          </div>
          
          <!-- Message -->
          <p class="text-sm font-bold text-gray-600 dark:text-gray-300 tracking-wide">
            {{ message }}
          </p>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
