<script setup>
import { ref, watch, nextTick, onUnmounted } from 'vue';

const props = defineProps({
  show: Boolean,
  confirmKeyword: String,
  size: {
    type: String,
    default: 'sm',
  },
  confirmDisabled: {
    type: Boolean,
    default: false,
  },
  confirmButtonTitle: {
    type: String,
    default: '确认'
  },
  confirmText: {
    type: String,
    default: '确认'
  },
  cancelText: {
    type: String,
    default: '取消'
  },
  glass: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:show', 'confirm']);

const confirmInput = ref('');
const modalPanelRef = ref(null);
const titleId = `modal-title-${Math.random().toString(36).slice(2, 10)}`;

let previouslyFocused = null;

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getFocusableElements() {
  return modalPanelRef.value
    ? Array.from(modalPanelRef.value.querySelectorAll(FOCUSABLE))
    : [];
}

const handleKeydown = (e) => {
  if (e.key === 'Escape') {
    emit('update:show', false);
    return;
  }
  if (e.key !== 'Tab') return;
  const focusable = getFocusableElements();
  if (!focusable.length) { e.preventDefault(); return; }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
};

watch(() => props.show, async (val) => {
  if (val) {
    previouslyFocused = document.activeElement;
    window.addEventListener('keydown', handleKeydown);
    await nextTick();
    const focusable = getFocusableElements();
    if (focusable.length) {
      focusable[0].focus();
    } else {
      modalPanelRef.value?.focus();
    }
  } else {
    window.removeEventListener('keydown', handleKeydown);
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
      previouslyFocused = null;
    }
  }
});

onUnmounted(() => window.removeEventListener('keydown', handleKeydown));

const handleConfirm = () => {
  emit('confirm');
  emit('update:show', false);
};
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="show" class="fixed inset-0 bg-slate-400/20 dark:bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 lg:p-8"
      @click="emit('update:show', false)" role="dialog" aria-modal="true" :aria-labelledby="titleId">
      <Transition name="modal-inner">
        <div v-if="show"
          ref="modalPanelRef"
          tabindex="-1"
          class="rounded-[2rem] shadow-2xl w-full text-left flex flex-col max-h-[90vh] focus:outline-none overflow-hidden transition-all duration-500 text-slate-900 dark:text-white"
          :class="[
            glass 
              ? 'bg-white/95 dark:bg-white/[0.05] backdrop-blur-3xl border border-white/20 dark:border-white/10 ring-1 ring-white/10' 
              : 'bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 ring-1 ring-black/5 dark:ring-white/10',
            {
              'max-w-sm': size === 'sm',
              'max-w-md': size === 'md',
              'max-w-lg': size === 'lg',
              'max-w-xl': size === 'xl',
              'max-w-2xl': size === '2xl',
              'max-w-4xl': size === '4xl',
              'max-w-6xl': size === '6xl',
            }
          ]" @click.stop>
          
          <div class="p-8 pb-4 shrink-0 flex items-center justify-between">
            <div :id="titleId">
              <slot name="title">
                <h3 class="text-xl font-bold text-gray-900 dark:text-white">确认操作</h3>
              </slot>
            </div>
            <button @click="emit('update:show', false)" class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="px-8 pb-8 grow overflow-y-auto custom-scrollbar">
            <slot name="body">
              <p class="text-gray-500 dark:text-gray-400 leading-relaxed">你确定要继续吗？</p>
            </slot>
          </div>

          <div class="p-8 pt-4 flex justify-end gap-3 shrink-0 border-t"
               :class="glass 
                 ? 'bg-transparent border-white/10' 
                 : 'bg-gray-50/50 dark:bg-gray-950/30 border-gray-100 dark:border-gray-800'">
            <slot name="footer">
              <button @click="emit('update:show', false)"
                class="px-6 py-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-sm rounded-lg transition-all shadow-sm">{{
                cancelText }}</button>
              <button @click="handleConfirm"
                :disabled="confirmDisabled || (confirmKeyword && confirmInput !== confirmKeyword)"
                class="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm rounded-lg transition-all shadow-lg shadow-primary-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
                {{ confirmText }}
              </button>
            </slot>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
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

.modal-inner-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-inner-leave-active {
  transition: all 0.25s ease-in;
}

.modal-inner-enter-from {
  opacity: 0;
  transform: scale(0.9) translateY(20px);
}
.modal-inner-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.2);
  border-radius: 3px;
}
</style>
