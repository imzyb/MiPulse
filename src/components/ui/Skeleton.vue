<script setup>
/**
 * Skeleton 骨架屏组件
 * 用于数据加载时的占位显示，提升用户体验
 */
const props = defineProps({
  // 骨架类型：text, circle, rect, rounded
  type: {
    type: String,
    default: 'text',
    validator: (value) => ['text', 'circle', 'rect', 'rounded'].includes(value)
  },
  // 宽度：可以是具体像素值或百分比
  width: {
    type: String,
    default: '100%'
  },
  // 高度：可以是具体像素值或类名
  height: {
    type: String,
    default: '1em'
  },
  // 圆角大小（仅当 type 为 rect 时使用）
  radius: {
    type: String,
    default: '0.5rem'
  },
  // 是否显示动画
  animated: {
    type: Boolean,
    default: true
  },
  // 行数（仅当 type 为 text 时使用）
  lines: {
    type: Number,
    default: 1
  }
});

const shapeClasses = {
  text: 'h-4 rounded-md',
  circle: 'rounded-full',
  rect: 'rounded-lg',
  rounded: 'rounded-xl'
};
</script>

<template>
  <div v-if="type === 'text' && lines > 1" class="space-y-2">
    <div
      v-for="i in lines"
      :key="i"
      class="skeleton-base"
      :class="[shapeClasses[type], animated ? 'skeleton-loading' : '']"
      :style="{ width: i === lines && lines > 1 ? '60%' : width, height: height }"
    />
  </div>
  
  <div
    v-else
    class="skeleton-base"
    :class="[shapeClasses[type], animated ? 'skeleton-loading' : '']"
    :style="{ width, height, borderRadius: type === 'rect' ? radius : undefined }"
  />
</template>

<style scoped>
.skeleton-base {
  @apply bg-gray-200 dark:bg-gray-700;
}

.skeleton-loading {
  @apply relative overflow-hidden;
}

.skeleton-loading::after {
  content: '';
  @apply absolute inset-0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.4),
    transparent
  );
  transform: translateX(-100%);
  animation: skeleton-loading 1.5s infinite;
}

@keyframes skeleton-loading {
  100% {
    transform: translateX(100%);
  }
}

.dark .skeleton-loading::after {
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.1),
    transparent
  );
}
</style>
