<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { Activity } from 'lucide-vue-next';

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  // Multi-series support
  series: {
    type: Array, // [{ label, color, points: [number | null] }]
    default: () => []
  },
  // Single series fallback (legacy)
  color: {
    type: String,
    default: '#06b6d4'
  },
  points: {
    type: Array,
    default: () => []
  },
  labels: {
    type: Array,
    default: () => []
  },
  unit: {
    type: String,
    default: 'ms'
  },
  max: {
    type: Number,
    default: 100
  },
  height: {
    type: Number,
    default: 200
  }
});

// Normalized series computation
const computedSeries = computed(() => {
  if (props.series && props.series.length > 0) {
    return props.series;
  }
  // Fallback to points-based single series
  return [{
    label: 'Average Latency',
    color: props.color || '#06b6d4',
    points: props.points || []
  }];
});

const visibleSeries = ref([]);
watch(computedSeries, (newVal) => {
  visibleSeries.value = newVal.filter(s => s.points.some(p => p !== null)).map(s => s.label);
  // If still empty, just show all
  if (visibleSeries.value.length === 0) {
    visibleSeries.value = newVal.map(s => s.label);
  }
}, { immediate: true });

const toggleSeries = (label) => {
  if (visibleSeries.value.includes(label)) {
    if (visibleSeries.value.length > 1) {
      visibleSeries.value = visibleSeries.value.filter(l => l !== label);
    }
  } else {
    visibleSeries.value.push(label);
  }
};

// UI Helpers
const maxValue = computed(() => {
  let peak = props.max;
  computedSeries.value.forEach(s => {
    s.points.forEach(p => {
      if (p !== null && p > peak) peak = p;
    });
  });
  return Math.ceil(peak / 20) * 20 || 20;
});

const gridLines = computed(() => {
  const steps = 4;
  const lines = [];
  for (let i = 0; i <= steps; i++) {
    const val = (maxValue.value / steps) * i;
    lines.push({
      label: Math.round(val),
      y: 160 - (val / maxValue.value) * 120,
      x: 35
    });
  }
  return lines;
});

const xAxisLabels = computed(() => {
  if (!props.labels.length) return [];
  const indices = [0, Math.floor(props.labels.length / 2), props.labels.length - 1];
  return indices.map(idx => ({
    text: props.labels[idx] ? new Date(props.labels[idx]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
    x: 45 + (idx / (props.labels.length - 1 || 1)) * 190
  }));
});

// Line Path generation with Gap Support (Breaking on null)
const getPath = (points) => {
  if (!points.length) return '';
  let path = '';
  let inSegment = false;
  
  points.forEach((p, i) => {
    const x = 45 + (i / (points.length - 1 || 1)) * 190;
    if (p === null || p === undefined) {
      inSegment = false;
    } else {
      const y = 160 - (p / maxValue.value) * 120;
      if (!inSegment) {
        path += ` M ${x} ${y}`;
        inSegment = true;
      } else {
        path += ` L ${x} ${y}`;
      }
    }
  });
  return path;
};

// Interaction
const hoverIdx = ref(null);
const handleMouseMove = (e) => {
  const svg = e.currentTarget;
  const rect = svg.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const normX = (x / rect.width) * 240;
  if (normX < 45 || normX > 235) {
    hoverIdx.value = null;
    return;
  }
  const count = props.labels.length || 1;
  const idx = Math.round(((normX - 45) / 190) * (count - 1));
  hoverIdx.value = (idx >= 0 && idx < count) ? idx : null;
};

const getHoverData = computed(() => {
  if (hoverIdx.value === null) return null;
  const ts = props.labels[hoverIdx.value];
  const items = computedSeries.value
    .filter(s => visibleSeries.includes(s.label))
    .map(s => ({
      label: s.label,
      color: s.color,
      value: s.points[hoverIdx.value]
    }));
  return { timestamp: ts ? new Date(ts).toLocaleTimeString() : 'N/A', items };
});
</script>

<template>
  <div class="vps-metric-chart group/chart relative flex flex-col gap-4 p-6 rounded-[2.5rem] border transition-all duration-700 bg-[#020617]/40 border-white/[0.05] hover:border-white/10 shadow-2xl backdrop-blur-md">
    <!-- Header -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex items-center gap-3">
        <div class="flex flex-col">
            <div class="flex items-center gap-2">
                <h3 class="text-xs font-black uppercase tracking-[0.2em] opacity-40">{{ title }}</h3>
                <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                    <span class="text-[9px] font-black text-emerald-500/80 tracking-tighter">REAL-TIME</span>
                </div>
            </div>
        </div>
      </div>
      
      <!-- MiSub Style Dot Legend -->
      <div class="flex flex-wrap gap-x-5 gap-y-2 justify-start md:justify-end">
          <div 
            v-for="s in computedSeries" 
            :key="s.label"
            @click="toggleSeries(s.label)"
            :class="['flex items-center gap-2 cursor-pointer transition-all hover:opacity-100', visibleSeries.includes(s.label) ? 'opacity-100' : 'opacity-20 grayscale']"
          >
            <div class="w-2.5 h-2.5 rounded-full shadow-sm" :style="{ backgroundColor: s.color, border: '2px solid rgba(0,0,0,0.1)' }"></div>
            <span class="text-[11px] font-bold whitespace-nowrap opacity-60 group-hover:opacity-100">{{ s.label }}</span>
          </div>
      </div>
    </div>

    <!-- Chart Body -->
    <div class="relative overflow-visible" :style="{ height: height + 'px' }">
      <svg viewBox="0 0 240 180" class="w-full h-full overflow-visible" @mousemove="handleMouseMove" @mouseleave="hoverIdx = null">
        <!-- Guidelines -->
        <g class="grid-lines">
          <template v-for="(line, idx) in gridLines" :key="line.y">
            <line x1="45" :y1="line.y" x2="235" :y2="line.y" stroke="rgba(255,255,255,0.03)" stroke-width="0.8" stroke-dasharray="3,3" />
            <text :x="line.x" :y="line.y + 3" text-anchor="end" class="fill-white/20 text-[10px] font-bold tabular-nums">
              {{ line.label }}
              <tspan v-if="idx === gridLines.length - 1" class="text-[7px] opacity-40 ml-1 uppercase font-black">{{ unit }}</tspan>
            </text>
          </template>
        </g>

        <!-- X Axis Labels -->
        <g class="x-axis">
           <text v-for="lb in xAxisLabels" :key="lb.text" :x="lb.x" y="176" text-anchor="middle" class="fill-white/10 text-[9px] font-bold tracking-tighter">{{ lb.text }}</text>
        </g>

        <!-- Curves -->
        <g class="curves">
          <template v-for="s in computedSeries" :key="s.label">
            <path 
              v-if="visibleSeries.includes(s.label)"
              :d="getPath(s.points)" 
              fill="none" 
              :stroke="s.color" 
              stroke-width="2.5" 
              stroke-linecap="round" 
              stroke-linejoin="round"
              class="transition-all duration-300 drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
            />
          </template>
        </g>

        <!-- Hover Indicator -->
        <g v-if="hoverIdx !== null" class="hover-intel pointer-events-none">
            <line 
                :x1="45 + (hoverIdx / (labels.length - 1 || 1)) * 190" 
                y1="40" 
                :x2="45 + (hoverIdx / (labels.length - 1 || 1)) * 190" 
                y2="160" 
                stroke="rgba(255,255,255,0.08)" 
                stroke-width="1.2"
                stroke-dasharray="2,2"
            />
            <circle 
                v-for="s in computedSeries" 
                :key="s.label"
                v-show="visibleSeries.includes(s.label) && s.points[hoverIdx] !== null"
                :cx="45 + (hoverIdx / (labels.length - 1 || 1)) * 190"
                :cy="160 - (s.points[hoverIdx] / maxValue) * 120"
                r="3.5"
                :fill="s.color"
                stroke="rgba(255,255,255,0.6)"
                stroke-width="1"
            />
        </g>
      </svg>

      <!-- MiSub Style Tooltip -->
      <div 
        v-if="hoverIdx !== null && getHoverData" 
        class="absolute top-0 pointer-events-none z-50 flex flex-col gap-3 p-4 rounded-3xl bg-slate-900/95 backdrop-blur-2xl border border-white/10 shadow-2xl min-w-[160px] animate-in fade-in zoom-in duration-200"
        :style="{ 
            left: (45 + (hoverIdx / (labels.length - 1 || 1)) * 190) > 120 ? 'auto' : (45 + (hoverIdx / (labels.length - 1 || 1)) * 190) / 240 * 100 + '%',
            right: (45 + (hoverIdx / (labels.length - 1 || 1)) * 190) > 120 ? (240 - (45 + (hoverIdx / (labels.length - 1 || 1)) * 190)) / 240 * 100 + '%' : 'auto',
            marginTop: '-20px'
        }"
      >
        <div class="text-[11px] font-black tracking-widest text-white/30 border-b border-white/5 pb-2 uppercase">{{ getHoverData.timestamp }}</div>
        <div class="space-y-2">
          <div v-for="item in getHoverData.items" :key="item.label" class="flex items-center justify-between gap-6">
            <div class="flex items-center gap-2.5">
              <div class="w-2 h-2 rounded-full shadow-sm" :style="{ backgroundColor: item.color }"></div>
              <span class="text-[11px] font-bold text-white/60">{{ item.label }}</span>
            </div>
            <span class="text-[12px] font-black text-white tabular-nums">{{ item.value?.toFixed(2) || '--' }}<span class="text-[8px] opacity-30 ml-1 uppercase">{{ unit }}</span></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vps-metric-chart {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
}
</style>
