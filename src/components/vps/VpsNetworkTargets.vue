<script setup>
import { computed, ref } from 'vue';
import { createVpsNetworkTarget, updateVpsNetworkTarget, deleteVpsNetworkTarget } from '../../lib/api.js';
import { useToastStore } from '../../stores/toast.js';

const props = defineProps({
  nodeId: {
    type: String,
    required: true
  },
  targets: {
    type: Array,
    default: () => []
  },
  checkingTargets: {
    type: Object,
    default: () => ({})
  },
  allowCheck: {
    type: Boolean,
    default: true
  },
  limit: {
    type: Number,
    default: 10
  },
  hideHeader: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['refresh', 'check']);
const { showToast } = useToastStore();

const formState = ref({
  name: '',
  type: 'icmp',
  target: '',
  port: '',
  path: '/',
  scheme: 'https'
});

const sortKey = ref('type');
const sortDir = ref('asc');
const filterType = ref('all');
const filterQuery = ref('');
const isCreating = ref(false);
const pendingTargetIds = ref({});

const setPending = (targetId, pending) => {
  pendingTargetIds.value = {
    ...pendingTargetIds.value,
    [targetId]: pending
  };
};

const canAddMore = computed(() => props.targets.length < props.limit);

const filteredTargets = computed(() => {
  const keyword = filterQuery.value.trim().toLowerCase();
  return props.targets.filter((item) => {
    if (filterType.value !== 'all' && item.type !== filterType.value) return false;
    if (!keyword) return true;
    const text = `${item.name || ''} ${item.type} ${item.target} ${item.path || ''} ${item.port || ''}`.toLowerCase();
    return text.includes(keyword);
  });
});

const sortedTargets = computed(() => {
  const list = [...filteredTargets.value];
  const dir = sortDir.value === 'asc' ? 1 : -1;
  list.sort((a, b) => {
    if (sortKey.value === 'status') {
      const av = a.enabled ? 1 : 0;
      const bv = b.enabled ? 1 : 0;
      return (av - bv) * dir;
    }
    if (sortKey.value === 'target') {
      return (a.target || '').localeCompare(b.target || '') * dir;
    }
    return (a.type || '').localeCompare(b.type || '') * dir;
  });
  return list;
});

const resetForm = () => {
  formState.value = { name: '', type: 'icmp', target: '', port: '', path: '/', scheme: 'https' };
};

const handleCreate = async () => {
  if (isCreating.value) return;
  if (!formState.value.target.trim()) {
    showToast('请输入目标地址', 'warning');
    return;
  }
  const payload = {
    name: formState.value.name,
    type: formState.value.type,
    target: formState.value.target,
    port: formState.value.type === 'tcp' ? Number(formState.value.port) : undefined,
    path: formState.value.type === 'http' ? formState.value.path || '/' : undefined,
    scheme: formState.value.type === 'http' ? formState.value.scheme || 'https' : undefined
  };
  isCreating.value = true;
  try {
    const result = await createVpsNetworkTarget(props.nodeId, payload);
    if (result.success) {
      showToast('目标已添加', 'success');
      resetForm();
      emit('refresh');
    } else {
      showToast(result.error || '添加失败', 'error');
    }
  } finally {
    isCreating.value = false;
  }
};

const handleToggle = async (target) => {
  if (pendingTargetIds.value[target.id]) return;
  setPending(target.id, true);
  try {
    const result = await updateVpsNetworkTarget(target.id, { enabled: !target.enabled });
    if (result.success) {
      emit('refresh');
    } else {
      showToast(result.error || '更新失败', 'error');
    }
  } finally {
    setPending(target.id, false);
  }
};

const handleDelete = async (target) => {
  if (pendingTargetIds.value[target.id]) return;
  setPending(target.id, true);
  try {
    const result = await deleteVpsNetworkTarget(target.id);
    if (result.success) {
      showToast('目标已删除', 'success');
      emit('refresh');
    } else {
      showToast(result.error || '删除失败', 'error');
    }
  } finally {
    setPending(target.id, false);
  }
};

const handleCheck = (target) => {
  if (!props.allowCheck) return;
  emit('check', target);
};

const isChecking = (target) => Boolean(props.checkingTargets?.[target.id]);
const isPending = (target) => Boolean(pendingTargetIds.value?.[target.id]);
const supportsCheck = computed(() => props.allowCheck);
</script>

<template>
  <div class="admin-panel p-6 space-y-6">
    <div v-if="!hideHeader" class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="p-2.5 rounded-lg bg-primary-500/10 text-primary-500 ring-1 ring-primary-500/20">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <h4 class="text-base font-bold text-gray-900 dark:text-white">网络监测目标</h4>
          <p class="text-xs font-medium text-gray-500/70">支持深度 ICMP / TCP / HTTP 拨测分析</p>
        </div>
      </div>
      <div class="px-3 py-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 text-[10px] font-bold text-gray-400">
        {{ targets.length }} / {{ limit }}
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-3" v-if="targets.length">
      <div class="flex items-center gap-2 px-1.5 py-1.5 bg-black/5 dark:bg-white/5 rounded-lg border border-black/5 dark:border-white/10">
        <select v-model="filterType" class="px-3 py-1 text-xs font-bold bg-transparent text-gray-700 dark:text-gray-300 focus:outline-none cursor-pointer">
          <option value="all">全部类型</option>
          <option value="icmp">ICMP</option>
          <option value="tcp">TCP</option>
          <option value="http">HTTP</option>
        </select>
        <div class="w-px h-4 bg-gray-300/30"></div>
        <input v-model="filterQuery" placeholder="过滤目标..." class="px-3 py-1 text-xs bg-transparent text-gray-700 dark:text-gray-300 placeholder:text-gray-500/50 focus:outline-none w-32" />
      </div>
      
      <div class="flex items-center gap-2">
        <button 
          @click="sortDir = sortDir === 'asc' ? 'desc' : 'asc'"
          class="p-2 rounded-lg bg-white dark:bg-white/5 border border-black/5 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" :class="{'rotate-180': sortDir === 'desc'}" class="h-4 w-4 text-gray-500 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4" v-if="sortedTargets.length">
      <div
        v-for="item in sortedTargets"
        :key="item.id"
        class="group relative flex flex-col gap-4 rounded-lg border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-5 transition-all hover:bg-black/[0.02] dark:hover:bg-white/[0.06]"
      >
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-1.5">
              <span class="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-tighter" 
                :class="{
                  'bg-sky-500/10 text-sky-500 ring-1 ring-sky-500/20': item.type === 'icmp',
                  'bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20': item.type === 'tcp',
                  'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20': item.type === 'http'
                }"
              >
                {{ item.type }}
              </span>
              <h5 class="text-sm font-bold text-gray-900 dark:text-white truncate" v-if="item.name">{{ item.name }}</h5>
            </div>
            <div class="text-xs font-mono text-gray-600 dark:text-gray-400 break-all opacity-80">
              <span v-if="item.scheme" class="text-gray-500/70">{{ item.scheme }}://</span>{{ item.target }}<span v-if="item.port" class="text-gray-500">:{{ item.port }}</span><span v-if="item.path" class="text-gray-500 italic">{{ item.path }}</span>
            </div>
          </div>
          <div class="flex items-center">
            <div :class="item.enabled ? 'bg-emerald-500' : 'bg-gray-400'" class="h-2 w-2 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" v-if="item.enabled"></div>
            <div class="h-2 w-2 rounded-full bg-gray-400/30" v-else></div>
          </div>
        </div>

        <div class="flex items-center gap-2 pt-2 border-t border-white/10">
          <button
            v-if="supportsCheck"
            class="flex-1 py-2 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 rounded-lg transition-all disabled:opacity-30"
            @click="handleCheck(item)"
            :disabled="isChecking(item) || isPending(item)"
          >
            {{ isChecking(item) ? 'Checking...' : 'Retest' }}
          </button>
          <button
            class="p-2 text-gray-500 hover:text-gray-900 dark:hover:text-white bg-white/10 rounded-lg transition-all"
            @click="handleToggle(item)"
            :disabled="isPending(item)"
            :title="item.enabled ? 'Pause Monitor' : 'Resume Monitor'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" v-if="item.enabled" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" v-else />
            </svg>
          </button>
          <button
            class="p-2 text-rose-500 hover:text-rose-600 bg-rose-500/5 hover:bg-rose-500/10 rounded-lg transition-all"
            @click="handleDelete(item)"
            :disabled="isPending(item)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div class="relative group/form" v-if="canAddMore">
      <div class="relative rounded-lg p-5 border border-black/5 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="space-y-1">
            <label class="text-[10px] font-bold text-gray-500 ml-1 uppercase">Name</label>
            <input v-model="formState.name" placeholder="Optional name" class="w-full px-4 py-2.5 text-xs bg-white dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-lg focus:ring-2 focus:ring-primary-500/50 outline-none transition-all" />
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-bold text-gray-500 ml-1 uppercase">Type</label>
            <select v-model="formState.type" class="w-full px-4 py-2.5 text-xs bg-white dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-lg focus:ring-2 focus:ring-primary-500/50 outline-none transition-all cursor-pointer">
              <option value="icmp">ICMP (Ping)</option>
              <option value="tcp">TCP (Port)</option>
              <option value="http">HTTP (Web)</option>
            </select>
          </div>
          <div class="sm:col-span-2 space-y-1">
            <label class="text-[10px] font-bold text-gray-500 ml-1 uppercase">Target</label>
            <div class="flex items-center gap-2">
               <input v-model="formState.target" placeholder="1.2.3.4 or example.com" class="flex-1 px-4 py-2.5 text-xs bg-white dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-lg focus:ring-2 focus:ring-primary-500/50 outline-none transition-all" />
               <input v-if="formState.type === 'tcp'" v-model="formState.port" placeholder="Port" class="w-20 px-4 py-2.5 text-xs bg-white/20 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-xl focus:ring-2 focus:ring-amber-500/50 outline-none transition-all" />
            </div>
          </div>
        </div>

        <div v-if="formState.type === 'http'" class="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
           <div class="space-y-1">
            <label class="text-[10px] font-bold text-gray-500 ml-1 uppercase">Scheme</label>
            <select v-model="formState.scheme" class="w-full px-4 py-2.5 text-xs bg-white dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-lg outline-none transition-all">
              <option value="https">https</option>
              <option value="http">http</option>
            </select>
          </div>
          <div class="col-span-1 lg:col-span-3 space-y-1">
            <label class="text-[10px] font-bold text-gray-500 ml-1 uppercase">Path</label>
            <input v-model="formState.path" placeholder="/health" class="w-full px-4 py-2.5 text-xs bg-white dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-lg outline-none transition-all" />
          </div>
        </div>

        <button
          @click="handleCreate"
          :disabled="isCreating"
          class="w-full mt-6 py-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-primary-500/25 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50"
        >
          {{ isCreating ? 'Processing...' : 'Add Monitor Target' }}
        </button>
      </div>
    </div>
    <div v-else class="text-center py-4 rounded-lg border border-dashed border-gray-300 dark:border-white/10 text-xs font-bold text-gray-400 uppercase tracking-widest bg-black/5">
      Monitor target limit reached ({{ limit }})
    </div>
  </div>
</template>
