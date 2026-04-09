<script setup>
/**
 * InputField 增强型输入框组件
 * 支持实时验证、错误提示、字符计数等功能
 */
import { computed, ref, watch } from 'vue';
import { AlertCircle, CheckCircle } from 'lucide-vue-next';

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  type: {
    type: String,
    default: 'text'
  },
  label: {
    type: String,
    required: true
  },
  placeholder: {
    type: String,
    default: ''
  },
  helpText: {
    type: String,
    default: ''
  },
  error: {
    type: String,
    default: ''
  },
  required: {
    type: Boolean,
    default: false
  },
  maxLength: {
    type: Number,
    default: null
  },
  disabled: {
    type: Boolean,
    default: false
  },
  // 实时验证函数，接收 value 返回错误信息或 null
  validate: {
    type: Function,
    default: null
  }
});

const emit = defineEmits(['update:modelValue', 'blur', 'focus']);

const localValue = ref(props.modelValue);
const isFocused = ref(false);
const localError = ref('');

watch(() => props.modelValue, (newVal) => {
  localValue.value = newVal;
});

watch(localValue, (newVal) => {
  emit('update:modelValue', newVal);
  
  // 实时验证
  if (props.validate && !isFocused.value) {
    localError.value = props.validate(newVal) || '';
  }
});

const hasError = computed(() => props.error || localError.value);
const charCount = computed(() => props.maxLength ? localValue.value.length : null);
const isOverLimit = computed(() => props.maxLength && localValue.value.length > props.maxLength);

const handleFocus = () => {
  isFocused.value = true;
  localError.value = '';
  emit('focus');
};

const handleBlur = () => {
  isFocused.value = false;
  // 失焦时验证
  if (props.validate) {
    localError.value = props.validate(localValue.value) || '';
  }
  emit('blur');
};

const inputClasses = computed(() => [
  'w-full px-4 py-3 rounded-xl border outline-none transition-all dark:text-white',
  hasError.value 
    ? 'border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-900/10 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500'
    : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
  props.disabled && 'opacity-50 cursor-not-allowed'
]);
</script>

<template>
  <div class="space-y-2">
    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
      {{ label }}
      <span v-if="required" class="text-rose-500 ml-1">*</span>
    </label>
    
    <div class="relative">
      <input
        v-model="localValue"
        :type="type"
        :placeholder="placeholder"
        :maxlength="maxLength"
        :disabled="disabled"
        :class="inputClasses"
        @focus="handleFocus"
        @blur="handleBlur"
      />
      
      <!-- Status Icon -->
      <div class="absolute right-3 top-1/2 -translate-y-1/2">
        <CheckCircle v-if="!hasError && localValue && validate" :size="18" class="text-emerald-500" />
        <AlertCircle v-else-if="hasError" :size="18" class="text-rose-500" />
      </div>
    </div>
    
    <!-- Help / Error Text -->
    <div class="flex items-center justify-between min-h-[1.25rem]">
      <p v-if="hasError" class="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
        <AlertCircle :size="12" />
        {{ hasError }}
      </p>
      <p v-else-if="helpText" class="text-xs text-gray-500 dark:text-gray-400">
        {{ helpText }}
      </p>
      
      <!-- Character Counter -->
      <p 
        v-if="charCount !== null" 
        class="text-xs ml-auto"
        :class="isOverLimit ? 'text-rose-600 font-bold' : 'text-gray-400'"
      >
        {{ charCount }}/{{ maxLength }}
      </p>
    </div>
  </div>
</template>
