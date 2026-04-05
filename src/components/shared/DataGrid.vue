<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  },
  columns: {
    type: Array,
    required: true
  },
  loading: {
    type: Boolean,
    default: false
  },
  height: {
    type: String,
    default: 'auto'
  },
  maxHeight: {
    type: String,
    default: ''
  },
  striped: {
    type: Boolean,
    default: true
  },
  bordered: {
    type: Boolean,
    default: false
  },
  hoverable: {
    type: Boolean,
    default: true
  },
  compact: {
    type: Boolean,
    default: false
  },
  emptyText: {
    type: String,
    default: '暂无数据'
  },
  showHeader: {
    type: Boolean,
    default: true
  },
  selectable: {
    type: Boolean,
    default: false
  },
  selectedRows: {
    type: Array,
    default: () => []
  },
  rowKey: {
    type: String,
    default: 'id'
  },
  pagination: {
    type: [Boolean, Object],
    default: false
  },
  pageSize: {
    type: Number,
    default: 10
  },
  currentPage: {
    type: Number,
    default: 1
  },
  total: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['update:selectedRows', 'rowClick', 'rowDblClick', 'selectionChange', 'pageChange', 'sortChange', 'filterChange']);

const selectedKeys = ref([]);
const sortField = ref('');
const sortOrder = ref(''); // 'asc', 'desc', ''

const paginatedData = computed(() => {
  if (!props.pagination) return props.data;
  if (typeof props.pagination === 'object' && props.pagination.server) return props.data;
  const start = (props.currentPage - 1) * props.pageSize;
  const end = start + props.pageSize;
  return props.data.slice(start, end);
});

const totalPages = computed(() => {
  if (typeof props.pagination === 'object' && props.pagination.server) return Math.ceil(props.total / props.pageSize);
  return Math.ceil(props.data.length / props.pageSize);
});

const tableClasses = computed(() => [
  'w-full',
  {
    'divide-y divide-gray-200/60 dark:divide-gray-800/60': props.bordered,
    'border border-gray-200/60 dark:border-gray-800/60': props.bordered
  }
]);

const headerClasses = computed(() => [
  'bg-gray-50 dark:bg-gray-900/50',
  {
    'sticky top-0 z-10': props.maxHeight || props.height !== 'auto'
  }
]);

const rowClasses = computed(() => (index) => [
  {
    'bg-white dark:bg-gray-900': !props.striped || index % 2 === 0,
    'bg-gray-50/40 dark:bg-gray-800/20': props.striped && index % 2 === 1,
    'hover:bg-primary-50/40 dark:hover:bg-primary-900/15': props.hoverable,
    'cursor-pointer': props.selectable
  }
]);

const isRowSelected = (row) => {
  const key = row[props.rowKey];
  return selectedKeys.value.includes(key);
};

const toggleRowSelection = (row) => {
  if (!props.selectable) return;
  const key = row[props.rowKey];
  const index = selectedKeys.value.indexOf(key);
  if (index > -1) {
    selectedKeys.value.splice(index, 1);
  } else {
    selectedKeys.value.push(key);
  }
  const selectedRows = props.data.filter(row => selectedKeys.value.includes(row[props.rowKey]));
  emit('update:selectedRows', selectedRows);
  emit('selectionChange', selectedRows);
};

const toggleAllSelection = () => {
  if (selectedKeys.value.length === paginatedData.value.length) {
    selectedKeys.value = [];
  } else {
    selectedKeys.value = paginatedData.value.map(row => row[props.rowKey]);
  }
  const selectedRows = props.data.filter(row => selectedKeys.value.includes(row[props.rowKey]));
  emit('update:selectedRows', selectedRows);
  emit('selectionChange', selectedRows);
};

const handleSort = (column) => {
  if (!column.sortable) return;
  if (sortField.value === column.key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : '';
    sortField.value = sortOrder.value ? column.key : '';
  } else {
    sortField.value = column.key;
    sortOrder.value = 'asc';
  }
  emit('sortChange', { field: sortField.value, order: sortOrder.value });
};

const getColumnValue = (row, column) => {
  return column.render ? column.render(row) : row[column.key];
};

watch(() => props.selectedRows, (newVal) => {
  selectedKeys.value = newVal.map(row => row[props.rowKey]);
}, { immediate: true });

const handlePageChange = (page) => {
  emit('pageChange', page);
};
</script>

<template>
  <div class="data-grid w-full overflow-hidden">
    <div class="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm" :style="{ height, maxHeight }">
      <div class="overflow-x-auto">
        <table :class="tableClasses">
          <thead v-if="showHeader" :class="headerClasses">
            <tr class="border-b border-gray-200 dark:border-gray-800">
              <th v-if="selectable" :class="['px-4 sm:px-6 text-left w-10', compact ? 'py-2' : 'py-4']">
                <input type="checkbox" :checked="selectedKeys.length === paginatedData.length && paginatedData.length > 0" :indeterminate="selectedKeys.length > 0 && selectedKeys.length < paginatedData.length" class="h-4 w-4 rounded border-gray-300 dark:border-gray-700 text-primary-600 focus:ring-primary-500" @change="toggleAllSelection" />
              </th>
               <th v-for="column in columns" :key="column.key" :class="['px-4 sm:px-6 text-left font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider', compact ? 'py-2 text-[10px]' : 'py-4 text-xs', column.align === 'center' ? 'text-center' : '', column.align === 'right' ? 'text-right' : '', column.sticky === 'right' ? 'sticky right-0 z-20 bg-gray-50/95 dark:bg-gray-900/95' : '', column.hideOn === 'sm' ? 'hidden sm:table-cell' : '', column.hideOn === 'md' ? 'hidden md:table-cell' : '', column.hideOn === 'lg' ? 'hidden lg:table-cell' : '']">
                <div class="flex items-center space-x-1" :class="{'justify-center': column.align === 'center', 'justify-end': column.align === 'right'}">
                  <span>{{ column.title }}</span>
                  <button v-if="column.sortable" class="text-gray-400 hover:text-primary-500 transition-colors" @click="handleSort(column)">
                    <svg v-if="sortField === column.key && sortOrder === 'asc'" class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M5 12l5-5 5 5H5z"/></svg>
                    <svg v-else-if="sortField === column.key && sortOrder === 'desc'" class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M15 8l-5 5-5-5h10z"/></svg>
                    <svg v-else class="w-3 h-3 opacity-30" fill="currentColor" viewBox="0 0 20 20"><path d="M5 12l5-5 5 5H5zM15 8l-5 5-5-5h10z"/></svg>
                  </button>
                </div>
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200/50 dark:divide-gray-800/50">
            <tr v-if="loading">
               <td :colspan="columns.length + (selectable ? 1 : 0)" class="px-4 sm:px-6 py-12 text-center text-gray-400">
                <div class="flex items-center justify-center gap-2">
                  <div class="w-5 h-5 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin"></div>
                  <span>读取中...</span>
                </div>
              </td>
            </tr>
            <tr v-else-if="paginatedData.length === 0">
               <td :colspan="columns.length + (selectable ? 1 : 0)" class="px-4 sm:px-6 py-12 text-center text-gray-400 italic">
                {{ emptyText }}
              </td>
            </tr>
            <tr v-else v-for="(row, index) in paginatedData" :key="row[rowKey]" :class="rowClasses(index)" @click="toggleRowSelection(row)" @dblclick="$emit('rowDblClick', row)">
               <td v-if="selectable" class="px-4 sm:px-6 py-4">
                <input type="checkbox" :checked="isRowSelected(row)" class="h-4 w-4 rounded border-gray-300 dark:border-gray-700 text-primary-600 focus:ring-primary-500" @click.stop @change="toggleRowSelection(row)" />
              </td>
               <td v-for="column in columns" :key="column.key" :class="['px-4 sm:px-6 whitespace-nowrap text-gray-700 dark:text-gray-300 transition-all', column.align === 'center' ? 'text-center' : '', column.align === 'right' ? 'text-right' : '', compact ? 'py-1 text-xs' : 'py-4 text-sm', column.sticky === 'right' ? 'sticky right-0 z-10 bg-inherit backdrop-blur-sm' : '', column.hideOn === 'sm' ? 'hidden sm:table-cell' : '', column.hideOn === 'md' ? 'hidden md:table-cell' : '', column.hideOn === 'lg' ? 'hidden lg:table-cell' : '']">
                <slot :name="`column-${column.key}`" :row="row" :column="column" :value="getColumnValue(row, column)">
                  {{ getColumnValue(row, column) }}
                </slot>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div v-if="pagination && totalPages > 1" class="mt-6 flex items-center justify-between px-2">
      <div class="text-xs text-gray-500">
        共 {{ total || data.length }} 项数据
      </div>
      <div class="flex items-center gap-1">
        <button :disabled="currentPage <= 1" class="p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 disabled:opacity-30 hover:bg-gray-50" @click="handlePageChange(currentPage - 1)">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
        </button>
        <span class="px-4 text-sm font-medium">{{ currentPage }} / {{ totalPages }}</span>
        <button :disabled="currentPage >= totalPages" class="p-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 disabled:opacity-30 hover:bg-gray-50" @click="handlePageChange(currentPage + 1)">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
        </button>
      </div>
    </div>
  </div>
</template>
