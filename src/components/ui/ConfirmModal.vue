<script setup>
/**
 * ConfirmModal 确认对话框组件
 * 用于危险操作前的二次确认，提升 UX 安全性
 */
import { ref, watch } from 'vue';
import { AlertTriangle, X } from 'lucide-vue-next';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  title: {
    type: String,
    default: '确认操作'
  },
  message: {
    type: String,
    default: '确定要执行此操作吗？'
  },
  confirmText: {
    type: String,
    default: '确认'
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  type: {
    type: String,
    default: 'warning',
    validator: (value) => ['info', 'warning', 'danger'].includes(value)
  },
  loading: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:show', 'confirm', 'cancel']);

const localShow = ref(props.show);

watch(() => props.show, (newVal) => {
  localShow.value = newVal;
});

const handleClose = () => {
  if (props.loading) return;
  localShow.value = false;
  emit('update:show', false);
  emit('cancel');
};

const handleConfirm = () => {
  if (props.loading) return;
  emit('confirm');
};

const typeConfig = {
  info: {
    iconColor: 'text-sky-600',
    bgColor: 'bg-sky-100 dark:bg-sky-900/20',
    btnColor: 'bg-sky-600 hover:bg-sky-700',
    shadowColor: 'shadow-sky-500/30'
  },
  warning: {
    iconColor: 'text-amber-600',
    bgColor: 'bg-amber-100 dark:bg-amber-900/20',
    btnColor: 'bg-amber-600 hover:bg-amber-700',
    shadowColor: 'shadow-amber-500/30'
  },
  danger: {
    iconColor: 'text-rose-600',
    bgColor: 'bg-rose-100 dark:bg-rose-900/20',
    btnColor: 'bg-rose-600 hover:bg-rose-700',
    shadowColor: 'shadow-rose-500/30'
  }
};

const config = typeConfig[props.type];
</script>

<template>
  <Teleport to="body">
    <transition name="modal-fade" appear>
      <div v-if="localShow" class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
        <!-- Backdrop -->
        <div 
          class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          @click="handleClose"
        />
        
        <!-- Modal -->
        <transition name="modal-scale" appear>
          <div 
            class="relative w-full max-w-md transform overflow-hidden rounded-3xl bg-white dark:bg-gray-900 p-8 shadow-2xl transition-all"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="`${title}-title`"
          >
            <!-- Close Button -->
            <button
              v-if="!loading"
              @click="handleClose"
              class="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
              :disabled="loading"
            >
              <X :size="20" />
            </button>

            <!-- Icon -->
            <div class="flex items-center justify-center w-16 h-16 rounded-2xl mb-6 mx-auto" :class="config.bgColor">
              <AlertTriangle :size="32" :class="config.iconColor" />
            </div>

            <!-- Content -->
            <div class="text-center">
              <h3 :id="`${title}-title`" class="text-xl font-bold text-gray-900 dark:text-white mb-3">
                {{ title }}
              </h3>
              <p class="text-gray-500 dark:text-gray-400 leading-relaxed">
                {{ message }}
              </p>
            </div>

            <!-- Actions -->
            <div class="mt-8 flex flex-col gap-3">
              <button
                @click="handleConfirm"
                :disabled="loading"
                class="w-full py-3.5 px-6 rounded-2xl text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                :class="[config.btnColor, config.shadowColor, 'shadow-lg']"
              >
                <span v-if="loading" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                {{ loading ? '处理中...' : confirmText }}
              </button>
              
              <button
                @click="handleClose"
                :disabled="loading"
                class="w-full py-3.5 px-6 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {{ cancelText }}
              </button>
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-scale-enter-active,
.modal-scale-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-scale-enter-from,
.modal-scale-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}
</style>
