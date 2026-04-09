<script setup>
import { computed, ref, watch } from 'vue';

const props = defineProps({
  title: { type: String, required: true },
  series: { type: Array, default: () => [] },
  color: { type: String, default: '#06b6d4' },
  points: { type: Array, default: () => [] },
  labels: { type: Array, default: () => [] },
  unit: { type: String, default: 'ms' },
  max: { type: Number, default: 1000 },
  height: { type: Number, default: 200 },
  darkMode: { type: Boolean, default: true }
});

// Using the requested 800x200 base dimensions
const VW = 800;
const VH = 200;
const PAD_TOP = 15;
const PAD_BOTTOM = 35;
const PAD_LEFT = 50;
const PAD_RIGHT = 15;
const PLOT_W = VW - PAD_LEFT - PAD_RIGHT;
const PLOT_H = VH - PAD_TOP - PAD_BOTTOM;

const computedSeries = computed(() => {
  if (props.series && props.series.length > 0) return props.series;
  return [{ label: 'Average Latency', color: props.color || '#06b6d4', points: props.points || [] }];
});

const visibleSeries = ref([]);
watch(computedSeries, (newVal) => {
  visibleSeries.value = newVal.filter(s => s.points.some(p => p !== null)).map(s => s.label);
  if (visibleSeries.value.length === 0) visibleSeries.value = newVal.map(s => s.label);
}, { immediate: true });

const toggleSeries = (label) => {
  if (visibleSeries.value.includes(label)) {
    if (visibleSeries.value.length > 1) visibleSeries.value = visibleSeries.value.filter(l => l !== label);
  } else {
    visibleSeries.value.push(label);
  }
};

// Adaptive Max Scale Logic
const maxValue = computed(() => {
  let peak = 0;
  computedSeries.value.forEach(s => {
    s.points.forEach(p => { if (p !== null && p > peak) peak = p; });
  });
  
  // Snap to increments: 30, 100, 300, 800, 1500, 3000, 5000
  const thresholds = [30, 100, 300, 800, 1500, 3000, 5000];
  let snapped = thresholds.find(t => t >= peak) || 5000;
  
  return Math.max(snapped, props.max || 100);
});

const gridLines = computed(() => {
  const steps = 6;
  const lines = [];
  for (let i = 0; i <= steps; i++) {
    const val = (maxValue.value / steps) * i;
    const y = PAD_TOP + PLOT_H - (val / maxValue.value) * PLOT_H;
    const percentY = (val / maxValue.value) * (PLOT_H / VH * 100) + (PAD_BOTTOM / VH * 100);
    
    lines.push({ 
        label: Math.round(val), 
        y,
        percentY
    });
  }
  return lines;
});

const xAxisLabels = computed(() => {
  if (!props.labels.length) return [];
  const count = props.labels.length;
  const maxLabels = 8;
  const step = Math.max(1, Math.floor((count - 1) / (maxLabels - 1)));
  const labels = [];
  for (let i = 0; i < count; i += step) {
    labels.push({
      text: new Date(props.labels[i]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      percentX: (PAD_LEFT / VW * 100) + (i / (count - 1 || 1)) * (PLOT_W / VW * 100)
    });
  }
  return labels;
});

const getPath = (points) => {
  if (!points.length) return '';
  let path = '';
  let inSegment = false;
  points.forEach((p, i) => {
    // 跳过 null/undefined 值，断开路径而不是跳到最大值
    if (p === null || p === undefined) {
      inSegment = false;
      return;
    }
    const x = PAD_LEFT + (i / (points.length - 1 || 1)) * PLOT_W;
    const y = PAD_TOP + PLOT_H - (p / maxValue.value) * PLOT_H;
    path += inSegment ? ` L ${x} ${y}` : ` M ${x} ${y}`;
    inSegment = true;
  });
  return path;
};

const hoverIdx = ref(null);
const handleMouseMove = (e) => {
  const container = e.currentTarget;
  const rect = container.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const leftPx = (PAD_LEFT / VW) * rect.width;
  const rightPx = (1 - PAD_RIGHT / VW) * rect.width;
  if (x < leftPx || x > rightPx) { hoverIdx.value = null; return; }
  
  const count = props.labels.length || 1;
  const idx = Math.round(((x - leftPx) / (rightPx - leftPx)) * (count - 1));
  hoverIdx.value = (idx >= 0 && idx < count) ? idx : null;
};

const getHoverData = computed(() => {
  if (hoverIdx.value === null) return null;
  const ts = props.labels[hoverIdx.value];
  const items = computedSeries.value.filter(s => visibleSeries.value.includes(s.label)).map(s => ({
    label: s.label, color: s.color, value: s.points[hoverIdx.value]
  }));
  return { timestamp: ts ? new Date(ts).toLocaleTimeString() : 'N/A', items };
});

const currentValues = computed(() => {
  return computedSeries.value.filter(s => visibleSeries.value.includes(s.label)).map(s => {
    const pts = s.points.filter(p => p !== null);
    if (!pts.length) return { label: s.label, color: s.color, current: 0, avg: 0, min: 0 };
    return {
      label: s.label, color: s.color,
      current: s.points[s.points.length - 1] ?? 0,
      avg: pts.reduce((a, b) => a + b, 0) / pts.length,
      min: Math.min(...pts)
    };
  });
});

const tooltipXPercent = computed(() => {
  if (hoverIdx.value === null) return 0;
  return (PAD_LEFT / VW * 100) + (hoverIdx.value / (props.labels.length - 1 || 1)) * (PLOT_W / VW * 100);
});

const tooltipPos = computed(() => {
    const x = tooltipXPercent.value;
    const isRight = x > 70;
    return { 
        left: isRight ? 'auto' : (x + 1) + '%', 
        right: isRight ? (100 - x + 1) + '%' : 'auto' 
    };
});
</script>

<template>
  <div
    class="vps-metric-chart group/chart relative flex flex-col gap-4 p-6 rounded-[2.5rem] border transition-all duration-500 overflow-hidden"
    :class="darkMode 
      ? 'bg-[#020617]/40 border-white/[0.05] hover:border-white/10 shadow-2xl backdrop-blur-xl' 
      : 'bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.12)] border-slate-200'"
    @mousemove="handleMouseMove"
    @mouseleave="hoverIdx = null"
  >
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 z-10">
      <div class="flex items-center gap-3">
        <h3 class="text-[12px] font-black uppercase tracking-[0.2em]" :class="darkMode ? 'text-white opacity-40' : 'text-slate-400'">{{ title }}</h3>
        <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full" :class="darkMode ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50/50 border border-emerald-200'">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" :class="darkMode ? 'shadow-[0_0_8px_rgba(16,185,129,0.5)]' : ''"></span>
          <span class="text-[8px] font-black text-emerald-500 tracking-tighter uppercase">Live</span>
        </div>
      </div>
      <div class="flex flex-wrap gap-x-5 gap-y-2">
        <div
          v-for="s in computedSeries"
          :key="s.label"
          @click="toggleSeries(s.label)"
          :class="['flex items-center gap-2 cursor-pointer transition-all duration-300 hover:opacity-100', visibleSeries.includes(s.label) ? 'opacity-100' : 'opacity-20 grayscale scale-95']"
        >
          <div class="w-2.5 h-2.5 rounded-full shadow-lg" :style="{ backgroundColor: s.color, boxShadow: darkMode ? `0 0 10px ${s.color}44` : 'none' }"></div>
          <span class="text-[10px] font-black whitespace-nowrap transition-colors uppercase tracking-widest" :class="darkMode ? 'text-white/60 group-hover/chart:text-white/80' : 'text-slate-500 group-hover/chart:text-slate-700'">{{ s.label }}</span>
        </div>
      </div>
    </div>

    <!-- Stats Row -->
    <div class="flex flex-wrap gap-6 px-1 z-10">
      <div v-for="stat in currentValues" :key="stat.label" class="flex items-center gap-4">
        <div class="flex items-center gap-2">
          <div class="w-2 h-2 rounded-full" :style="{ backgroundColor: stat.color }"></div>
          <span class="text-[10px] font-black uppercase tracking-widest" :class="darkMode ? 'text-white/30' : 'text-slate-400'">{{ stat.label }}</span>
        </div>
        <div class="flex gap-4 text-[11px] font-mono">
          <div class="flex flex-col">
              <span class="font-black" :class="darkMode ? 'text-white' : 'text-slate-900'">{{ stat.current?.toFixed(0) || '--' }}<span class="text-[8px] ml-0.5" :class="darkMode ? 'opacity-30' : 'opacity-40'">{{ unit }}</span></span>
              <span class="text-[7px] uppercase tracking-tighter" :class="darkMode ? 'text-white/20' : 'text-slate-400'">Current</span>
          </div>
          <div class="flex flex-col border-l pl-4" :class="darkMode ? 'border-white/5' : 'border-slate-100'">
              <span class="font-bold tabular-nums" :class="darkMode ? 'text-white/40' : 'text-slate-500'">{{ stat.avg?.toFixed(0) }}</span>
              <span class="text-[7px] uppercase tracking-tighter" :class="darkMode ? 'text-white/10' : 'text-slate-400'">Avg</span>
          </div>
          <div class="flex flex-col border-l pl-4" :class="darkMode ? 'border-white/5' : 'border-slate-100'">
              <span class="font-bold tabular-nums" :class="darkMode ? 'text-white/40' : 'text-slate-500'">{{ stat.min?.toFixed(0) }}</span>
              <span class="text-[7px] uppercase tracking-tighter" :class="darkMode ? 'text-white/10' : 'text-slate-400'">Min</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Chart Body Container -->
    <div class="relative flex-1" :style="{ height: height + 'px' }">
      <!-- Y-Axis Labels -->
      <div class="absolute inset-0 pointer-events-none z-20">
          <div 
            v-for="line in gridLines" :key="line.label"
            class="absolute left-0 text-[10px] font-black transition-all duration-300"
            :class="darkMode ? 'text-white/20' : 'text-slate-400/60'"
            :style="{ bottom: `calc(${line.percentY}% - 5px)`, width: (PAD_LEFT / VW * 100) + '%' }"
            style="text-align: right; padding-right: 12px;"
          >
              {{ line.label }}
          </div>
          <div class="absolute left-0 text-[8px] font-black uppercase tracking-tighter" :class="darkMode ? 'text-white/10' : 'text-slate-300'" :style="{ top: '-10px', width: (PAD_LEFT / VW * 100) + '%' }" style="text-align: right; padding-right: 12px;">
              {{ unit }}
          </div>
      </div>

      <!-- X-Axis Labels -->
      <div class="absolute inset-0 pointer-events-none z-20">
          <div 
            v-for="lb in xAxisLabels" :key="lb.text"
            class="absolute bottom-0 text-[9px] font-bold transform -translate-x-1/2 whitespace-nowrap"
            :class="darkMode ? 'text-white/15' : 'text-slate-400/60'"
            :style="{ left: lb.percentX + '%' }"
          >
              {{ lb.text }}
          </div>
      </div>

      <!-- SVG Drawing Layer -->
      <svg :viewBox="`0 0 ${VW} ${VH}`" class="w-full h-full" preserveAspectRatio="none">
        <!-- Grid Lines -->
        <g>
          <line v-for="line in gridLines" :key="line.y"
            :x1="PAD_LEFT" :y1="line.y" :x2="VW - PAD_RIGHT" :y2="line.y" 
            :stroke="darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'" stroke-width="1" vector-effect="non-scaling-stroke" 
          />
        </g>

        <!-- Curves -->
        <g>
          <template v-for="s in computedSeries" :key="s.label">
            <path v-if="visibleSeries.includes(s.label)" 
              :d="getPath(s.points)" fill="none" :stroke="s.color" 
              stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" 
              vector-effect="non-scaling-stroke" 
              :style="{ filter: darkMode ? 'drop-shadow(0 0 4px rgba(0,0,0,0.5))' : 'none' }" 
            />
          </template>
        </g>

        <!-- Hover Line -->
        <line v-if="hoverIdx !== null" 
            :x1="PAD_LEFT + (hoverIdx / (labels.length - 1 || 1)) * PLOT_W" :y1="PAD_TOP" 
            :x2="PAD_LEFT + (hoverIdx / (labels.length - 1 || 1)) * PLOT_W" :y2="PAD_TOP + PLOT_H" 
            :stroke="darkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'" stroke-width="1" stroke-dasharray="4,4" vector-effect="non-scaling-stroke" 
        />
        
        <!-- Hover Points -->
        <circle 
            v-for="s in computedSeries" :key="s.label"
            v-show="hoverIdx !== null && visibleSeries.includes(s.label) && s.points[hoverIdx] !== null"
            :cx="PAD_LEFT + (hoverIdx / (labels.length - 1 || 1)) * PLOT_W"
            :cy="PAD_TOP + PLOT_H - (s.points[hoverIdx] / maxValue) * PLOT_H"
            r="4" :fill="s.color" :stroke="darkMode ? 'white' : 'white'" stroke-width="2" vector-effect="non-scaling-stroke"
            :class="darkMode ? '' : 'shadow-lg'"
        />
      </svg>

      <!-- HTML Tooltip -->
      <div v-if="hoverIdx !== null && getHoverData" 
        class="absolute top-2 z-30 transition-all duration-200 pointer-events-none"
        :style="tooltipPos"
      >
        <div class="flex flex-col gap-2 p-3 rounded-2xl transition-all duration-300"
          :class="darkMode 
            ? 'bg-black/80 backdrop-blur-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/5' 
            : 'bg-white/95 backdrop-blur-xl border border-slate-200 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] ring-1 ring-black/5'">
            <div class="text-[9px] font-black tracking-widest border-b pb-1.5 uppercase" :class="darkMode ? 'text-white/30 border-white/5' : 'text-slate-400 border-slate-100'">{{ getHoverData.timestamp }}</div>
            <div class="space-y-1.5 min-w-[120px]">
                <div v-for="item in getHoverData.items" :key="item.label" class="flex items-center justify-between gap-4">
                    <div class="flex items-center gap-2">
                        <div class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: item.color }"></div>
                        <span class="text-[9px] font-black truncate max-w-[80px] uppercase" :class="darkMode ? 'text-white/50' : 'text-slate-500'">{{ item.label }}</span>
                    </div>
                    <span class="text-[10px] font-mono font-black tabular-nums" :class="darkMode ? 'text-white' : 'text-slate-900'">{{ item.value?.toFixed(1) || '--' }}<span class="text-[7px] ml-0.5" :class="darkMode ? 'opacity-30' : 'opacity-40'">{{ unit }}</span></span>
                </div>
            </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vps-metric-chart {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.tabular-nums {
    font-variant-numeric: tabular-nums;
}
</style>
