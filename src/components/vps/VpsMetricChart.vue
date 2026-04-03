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
  height: { type: Number, default: 200 }
});

const VW = 800;
const VH = 200;
const PAD_TOP = 10;
const PAD_BOTTOM = 25;
const PAD_LEFT = 35;
const PAD_RIGHT = 5;
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

const maxValue = computed(() => {
  let peak = props.max;
  computedSeries.value.forEach(s => {
    s.points.forEach(p => { if (p !== null && p > peak) peak = p; });
  });
  return Math.ceil(peak / 20) * 20 || 20;
});

const gridLines = computed(() => {
  const steps = 8;
  const lines = [];
  for (let i = 0; i <= steps; i++) {
    const val = (maxValue.value / steps) * i;
    lines.push({ label: Math.round(val), y: PAD_TOP + PLOT_H - (val / maxValue.value) * PLOT_H });
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
      x: PAD_LEFT + (i / (count - 1 || 1)) * PLOT_W
    });
  }
  if (labels.length === 0 || labels[labels.length - 1].x < VW - PAD_RIGHT - 2) {
    labels.push({
      text: new Date(props.labels[count - 1]).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      x: VW - PAD_RIGHT
    });
  }
  return labels;
});

const xForIdx = (i, len) => PAD_LEFT + (i / (len - 1 || 1)) * PLOT_W;

const getPath = (points) => {
  if (!points.length) return '';
  let path = '';
  let inSegment = false;
  points.forEach((p, i) => {
    const val = (p === null || p === undefined) ? maxValue.value : p;
    const x = xForIdx(i, points.length);
    const y = PAD_TOP + PLOT_H - (val / maxValue.value) * PLOT_H;
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
  const normX = (x / rect.width) * VW;
  if (normX < PAD_LEFT || normX > VW - PAD_RIGHT) { hoverIdx.value = null; return; }
  const count = props.labels.length || 1;
  const idx = Math.round(((normX - PAD_LEFT) / PLOT_W) * (count - 1));
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

const TOOLTIP_W = 140;
const TOOLTIP_PAD = 8;

const tooltipX = computed(() => {
  if (hoverIdx.value === null) return 0;
  return xForIdx(hoverIdx.value, props.labels.length || 1);
});

const tooltipPos = computed(() => {
  let x = tooltipX.value + TOOLTIP_PAD;
  if (x + TOOLTIP_W > VW - PAD_RIGHT) {
    x = tooltipX.value - TOOLTIP_W - TOOLTIP_PAD;
  }
  if (x < PAD_LEFT) x = PAD_LEFT;
  return { x };
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
</script>

<template>
  <div
    class="vps-metric-chart group/chart relative flex flex-col gap-3 p-5 rounded-[2rem] border transition-colors duration-300 bg-[#020617]/40 border-white/[0.05] hover:border-white/10 shadow-2xl backdrop-blur-md"
    @mousemove="handleMouseMove"
    @mouseleave="hoverIdx = null"
  >
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="flex items-center gap-2.5">
        <h3 class="text-[11px] font-black uppercase tracking-[0.15em] opacity-50">{{ title }}</h3>
        <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
          <span class="text-[8px] font-black text-emerald-500/80 tracking-tighter">LIVE</span>
        </div>
      </div>
      <div class="flex flex-wrap gap-x-4 gap-y-1.5">
        <div
          v-for="s in computedSeries"
          :key="s.label"
          @click="toggleSeries(s.label)"
          :class="['flex items-center gap-1.5 cursor-pointer transition-all hover:opacity-100', visibleSeries.includes(s.label) ? 'opacity-100' : 'opacity-20 grayscale']"
        >
          <div class="w-2 h-2 rounded-full" :style="{ backgroundColor: s.color }"></div>
          <span class="text-[10px] font-bold whitespace-nowrap opacity-60 group-hover:opacity-100">{{ s.label }}</span>
        </div>
      </div>
    </div>

    <!-- Stats Row -->
    <div class="flex flex-wrap gap-4 px-1">
      <div v-for="stat in currentValues" :key="stat.label" class="flex items-center gap-3">
        <div class="flex items-center gap-1.5">
          <div class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: stat.color }"></div>
          <span class="text-[9px] font-bold opacity-30 uppercase tracking-wider">{{ stat.label }}</span>
        </div>
        <div class="flex gap-3 text-[10px] font-mono">
          <span class="text-white/70 font-bold">{{ stat.current?.toFixed(0) || '--' }}<span class="text-[7px] opacity-30 ml-0.5">{{ unit }}</span></span>
          <span class="text-white/20">avg {{ stat.avg?.toFixed(0) }}</span>
          <span class="text-white/20">min {{ stat.min?.toFixed(0) }}</span>
        </div>
      </div>
    </div>

    <!-- Chart Body -->
    <div class="relative" :style="{ height: height + 'px' }">
      <svg :viewBox="`0 0 ${VW} ${VH}`" class="w-full h-full" preserveAspectRatio="none">
        <!-- Y Axis Labels -->
        <g>
          <template v-for="line in gridLines" :key="line.y">
            <line x1="30" :y1="line.y" :x2="VW" :y2="line.y" stroke="rgba(255,255,255,0.03)" stroke-width="1" vector-effect="non-scaling-stroke" />
            <text x="28" :y="line.y + 3" text-anchor="end" fill="rgba(255,255,255,0.15)" font-size="8" font-weight="600">{{ line.label }}</text>
          </template>
          <text x="28" y="12" text-anchor="end" fill="rgba(255,255,255,0.08)" font-size="7" font-weight="600">{{ unit }}</text>
        </g>

        <!-- X Axis Labels -->
        <g>
          <text v-for="lb in xAxisLabels" :key="lb.text" :x="lb.x" :y="VH - 4" text-anchor="middle" fill="rgba(255,255,255,0.08)" font-size="8" font-weight="600">{{ lb.text }}</text>
        </g>

        <!-- Curves -->
        <g>
          <template v-for="s in computedSeries" :key="s.label">
            <path v-if="visibleSeries.includes(s.label)" :d="getPath(s.points)" fill="none" :stroke="s.color" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
          </template>
        </g>

        <!-- Hover Crosshair -->
        <g v-if="hoverIdx !== null" pointer-events="none">
          <line :x1="tooltipX" :y1="PAD_TOP" :x2="tooltipX" :y2="PAD_TOP + PLOT_H" stroke="rgba(255,255,255,0.1)" stroke-width="1" stroke-dasharray="3,3" vector-effect="non-scaling-stroke" />
          <circle
            v-for="s in computedSeries" :key="s.label"
            v-show="visibleSeries.includes(s.label) && s.points[hoverIdx] !== null"
            :cx="tooltipX"
            :cy="PAD_TOP + PLOT_H - (s.points[hoverIdx] / maxValue) * PLOT_H"
            r="3" :fill="s.color" stroke="rgba(15,23,42,0.9)" stroke-width="2" vector-effect="non-scaling-stroke"
          />
        </g>

        <!-- Tooltip -->
        <g v-if="hoverIdx !== null && getHoverData" pointer-events="none">
          <foreignObject :x="tooltipPos.x" y="2" :width="TOOLTIP_W" height="100">
            <div xmlns="http://www.w3.org/1999/xhtml" class="flex flex-col gap-1.5 p-2.5 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-white/10 shadow-xl">
              <div class="text-[8px] font-black tracking-widest text-white/25 border-b border-white/5 pb-1 uppercase">{{ getHoverData.timestamp }}</div>
              <div class="space-y-1">
                <div v-for="item in getHoverData.items" :key="item.label" class="flex items-center justify-between gap-3">
                  <div class="flex items-center gap-1.5">
                    <div class="w-1.5 h-1.5 rounded-full flex-shrink-0" :style="{ backgroundColor: item.color }"></div>
                    <span class="text-[8px] font-bold text-white/50 truncate max-w-[60px]">{{ item.label }}</span>
                  </div>
                  <span class="text-[9px] font-black text-white tabular-nums flex-shrink-0">{{ item.value?.toFixed(1) || '--' }}<span class="text-[6px] opacity-25 ml-0.5">{{ unit }}</span></span>
                </div>
              </div>
            </div>
          </foreignObject>
        </g>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.vps-metric-chart {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}
</style>
