<script setup>
import { computed, onMounted, ref } from 'vue';

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  color: {
    type: String,
    default: '#4f46e5'
  },
  unit: {
    type: String,
    default: ''
  },
  points: {
    type: Array,
    default: () => []
  },
  max: {
    type: Number,
    default: 100
  },
  height: {
    type: Number,
    default: 90
  }
});

const isFirstLoad = ref(true);
onMounted(() => {
  setTimeout(() => {
    isFirstLoad.value = false;
  }, 100);
});

const dynamicMax = computed(() => {
  const raw = Array.isArray(props.points) ? props.points : [];
  const maxVal = raw.reduce((acc, val) => {
    if (val === null || val === undefined) return acc;
    const num = Number(val);
    return (Number.isFinite(num) && num > acc) ? num : acc;
  }, props.max);
  return maxVal || 1; // Ensure not zero
});

const normalizedPoints = computed(() => {
  const raw = Array.isArray(props.points) ? props.points : [];
  return raw.map((val) => {
    if (val === null || val === undefined) return null;
    const num = Number(val);
    return Number.isFinite(num) ? Math.max(0, Math.min(dynamicMax.value, num)) : null;
  });
});

const lastValue = computed(() => {
  const data = Array.isArray(props.points) ? props.points : [];
  for (let i = data.length - 1; i >= 0; i -= 1) {
    if (data[i] !== null && data[i] !== undefined) return data[i];
  }
  return null;
});

const polylinePoints = computed(() => {
  const data = normalizedPoints.value;
  if (!data.length) return '';
  const width = 200;
  const height = props.height;
  
  if (data.length === 1) {
    const y = data[0] === null ? height : Math.round(height - (data[0] / dynamicMax.value) * height);
    return `0,${y} ${width},${y}`;
  }

  const step = width / (data.length - 1);
  return data
    .map((val, index) => {
      const x = Math.round(index * step);
      const y = val === null ? height : Math.round(height - (val / dynamicMax.value) * height);
      return `${x},${y}`;
    })
    .join(' ');
});

const areaPath = computed(() => {
  const polyline = polylinePoints.value;
  if (!polyline) return '';
  const width = 200;
  const height = props.height;
  const segments = polyline.split(' ');
  const first = segments[0];
  const last = segments[segments.length - 1];
  
  // Use a smooth quadratic curve approximation if we have enough points, 
  // but for simplicity and performance in a small sparkline, a clean poly-path is often better.
  // We'll keep the poly-path but ensure it closes correctly.
  return `M${first} L${segments.join(' L')} L${last.split(',')[0]},${height} L${first.split(',')[0]},${height} Z`;
});

const hasData = computed(() => normalizedPoints.value.some((val) => val !== null));

const gradientId = computed(() => {
  const source = `${props.title}-${props.color}-${props.unit}`;
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(i);
    hash |= 0;
  }
  const safeId = Math.abs(hash).toString(36);
  return `metric-${safeId || 'chart'}`;
});
</script>

<template>
  <div class="rounded-2xl border border-white/20 dark:border-white/10 bg-white/40 dark:bg-gray-900/40 backdrop-blur-xl p-4 shadow-xl transition-all hover:scale-[1.02] hover:bg-white/50 dark:hover:bg-gray-900/50 group">
    <div class="flex items-center justify-between">
      <div>
        <p class="text-[10px] font-bold uppercase tracking-wider text-gray-500/80 dark:text-gray-400/80">{{ title }}</p>
        <p class="text-2xl font-black text-gray-900 dark:text-white mt-0.5">
          <span v-if="lastValue !== null" class="bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">{{ lastValue }}</span>
          <span v-if="lastValue !== null" class="text-xs font-medium ml-0.5 text-gray-500">{{ unit }}</span>
          <span v-else class="text-gray-400">--</span>
        </p>
      </div>
      <div class="text-[10px] font-mono text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
        PEAK: {{ dynamicMax.toFixed(dynamicMax < 1 ? 2 : 1) }}{{ unit }}
      </div>
    </div>

    <div class="mt-4 relative h-[90px]">
      <svg viewBox="0 0 200 90" :height="height" class="w-full h-full drop-shadow-sm" preserveAspectRatio="none">
        <defs>
          <linearGradient :id="gradientId" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" :stop-color="color" stop-opacity="0.4" />
            <stop offset="100%" :stop-color="color" stop-opacity="0" />
          </linearGradient>
          <filter :id="`blur-${gradientId}`">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1" />
          </filter>
        </defs>
        <path v-if="hasData" :d="areaPath" :fill="`url(#${gradientId})`" class="transition-all duration-1000" />
        <polyline 
          v-if="hasData" 
          :points="polylinePoints" 
          fill="none" 
          :stroke="color" 
          stroke-width="2.5" 
          stroke-linecap="round" 
          stroke-linejoin="round" 
          class="vps-metric-chart-line transition-all duration-1000 ease-in-out" 
          :style="{ strokeDasharray: 400, strokeDashoffset: isFirstLoad ? 400 : 0 }"
        />
        <text v-if="!hasData" x="100" y="45" text-anchor="middle" class="fill-gray-400/50 text-[10px] font-medium tracking-widest uppercase">No Data</text>
      </svg>
    </div>
  </div>
</template>

<style scoped>
@keyframes draw {
  to {
    stroke-dashoffset: 0;
  }
}
.vps-metric-chart-line {
  filter: drop-shadow(0 4px 6px v-bind('color + "44"'));
  animation: draw 1.5s ease-out forwards;
}
</style>
