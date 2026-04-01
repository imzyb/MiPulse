<script setup>
const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  label: {
    type: String,
    default: ''
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['update:modelValue', 'change']);

const toggle = () => {
  if (props.disabled) return;
  const newValue = !props.modelValue;
  emit('update:modelValue', newValue);
  emit('change', newValue);
};
</script>

<template>
  <label class="relative inline-flex items-center cursor-pointer select-none group" :class="{ 'opacity-50 cursor-not-allowed': disabled }">
    <input 
      type="checkbox" 
      class="sr-only peer" 
      :checked="modelValue" 
      :disabled="disabled"
      @change="toggle"
    >
    <div 
      class="w-12 h-6 bg-gray-200 dark:bg-gray-800 rounded-full peer 
             transition-all duration-300 ease-in-out
             after:content-[''] after:absolute after:top-[4px] after:left-[4px] 
             after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all 
             after:shadow-sm after:duration-300
             peer-checked:after:translate-x-6 peer-checked:bg-primary-600 
             group-hover:after:scale-110"
    ></div>
    <span v-if="label" class="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
      {{ label }}
    </span>
  </label>
</template>
