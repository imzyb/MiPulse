<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth';
import { LayoutDashboard, LogOut, Activity, Monitor, Globe, Menu, X } from 'lucide-vue-next';
import ToastStack from './components/ui/ToastStack.vue';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const mobileMenuRef = ref(null);

const isLoginPage = computed(() => route.path === '/login');
const isPublicPage = computed(() => route.path === '/');
const showSidebar = computed(() => auth.isAuthenticated && !isLoginPage.value && !isPublicPage.value);
const currentPageTitle = computed(() => adminNavItems.find((item) => item.path === route.path)?.name || '管理后台');

const isMobileMenuOpen = ref(false);
const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
};

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false;
};

const handleDocumentClick = (event) => {
  if (!isMobileMenuOpen.value || !mobileMenuRef.value) return;
  if (!mobileMenuRef.value.contains(event.target)) {
    closeMobileMenu();
  }
};

// Close mobile menu on navigation
watch(() => route.path, () => {
  isMobileMenuOpen.value = false;
});

onMounted(() => {
  window.addEventListener('click', handleDocumentClick);
});

onBeforeUnmount(() => {
  window.removeEventListener('click', handleDocumentClick);
});

const handleLogout = () => {
  auth.logout();
  router.push('/login');
};

const navItems = [
  { name: '仪表盘', icon: Activity, path: '/admin' },
  { name: '公开展示页', icon: Globe, path: '/' }
];

const adminNavItems = [
  { name: '集群监测', path: '/admin' },
  { name: '主题设置', path: '/admin/themes' },
  { name: '网络监测', path: '/admin/network-targets' },
  { name: '上报参数', path: '/admin/report-params' },
  { name: '系统设置', path: '/admin/settings' }
];
</script>

<template>
  <div class="min-h-screen bg-white dark:bg-gray-950 transition-colors">
    <ToastStack />
    <!-- Top Navigation Header -->
    <header v-if="showSidebar" class="sticky top-0 z-[60] bg-white/40 dark:bg-gray-950/40 backdrop-blur-3xl border-b border-black/5 dark:border-white/5 transition-all">
      <div ref="mobileMenuRef" class="max-w-[1440px] mx-auto px-6 lg:px-12 h-20 flex items-center justify-between">
        <div class="flex items-center gap-12">
          <div @click="router.push('/admin')" class="flex items-center gap-3 cursor-pointer group">
            <div class="w-11 h-11 rounded-[14px] bg-gradient-to-br from-primary-500 to-indigo-600 text-white flex items-center justify-center shadow-xl shadow-primary-500/20 group-hover:scale-105 transition-all duration-500 relative overflow-hidden">
              <Activity :size="24" class="relative z-10" />
              <div class="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
            </div>
            <span class="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 dark:from-white dark:via-gray-300 dark:to-white tracking-tighter leading-none">MiPulse</span>
          </div>

          <button @click="toggleMobileMenu" class="md:hidden p-3 rounded-2xl bg-black/5 dark:bg-white/5 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-all">
             <Menu v-if="!isMobileMenuOpen" :size="22" />
             <X v-else :size="22" />
          </button>

            <nav class="hidden md:flex items-center gap-6">
              <router-link 
                v-for="item in adminNavItems" 
                :key="item.path"
                :to="item.path"
                class="px-2 py-1 text-sm font-black uppercase tracking-[0.2em] transition-all relative group"
                :class="route.path === item.path ? 'text-primary-600' : 'text-gray-400 hover:text-gray-900 dark:hover:text-white'"
              >
                {{ item.name }}
                <span v-if="route.path === item.path" class="absolute -bottom-1 left-2 right-2 h-0.5 bg-primary-600 rounded-full animate-in fade-in zoom-in duration-500"></span>
              </router-link>
            </nav>
        </div>

        <div class="flex items-center gap-4">
          <div class="hidden xl:flex flex-col items-end mr-4">
            <span class="text-[9px] font-black uppercase tracking-[0.3em] text-gray-400 opacity-70">Infrastructure Control</span>
            <span class="text-xs font-black text-gray-900 dark:text-white bg-black/5 dark:bg-white/5 px-3 py-1 rounded-lg mt-1 border border-black/5 dark:border-white/5">{{ currentPageTitle }}</span>
          </div>

          <router-link to="/" class="p-3.5 rounded-2xl text-gray-400 hover:text-primary-500 hover:bg-primary-500/10 transition-all group" title="View Public Status">
            <Globe :size="22" class="group-hover:rotate-12 transition-transform" />
          </router-link>

          <div class="w-px h-8 bg-gray-200 dark:bg-white/10 mx-2"></div>

          <!-- Logout -->
          <button @click="handleLogout" class="flex items-center gap-3 pl-5 pr-3 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all">
            <LogOut :size="18" />
            <span class="hidden sm:inline">Terminate</span>
          </button>
        </div>
      </div>

      <!-- Mobile Dropdown Menu -->
      <transition 
        enter-active-class="transition duration-300 ease-out" 
        enter-from-class="transform -translate-y-4 opacity-0" 
        enter-to-class="transform translate-y-0 opacity-100" 
        leave-active-class="transition duration-200 ease-in" 
        leave-from-class="transform translate-y-0 opacity-100" 
        leave-to-class="transform -translate-y-4 opacity-0"
      >
        <div v-if="isMobileMenuOpen" class="md:hidden absolute top-20 left-0 right-0 bg-white/95 dark:bg-gray-950/95 backdrop-blur-3xl border-b border-black/5 dark:border-white/5 py-6 px-6 shadow-2xl z-[55]">
          <div class="mb-5 pb-5 border-b border-black/5 dark:border-white/5">
            <p class="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">当前页面</p>
            <p class="mt-2 text-base font-bold text-gray-900 dark:text-white">{{ currentPageTitle }}</p>
          </div>
          <nav class="flex flex-col gap-4">
            <router-link 
              v-for="item in adminNavItems" 
              :key="item.path"
              :to="item.path"
              class="flex items-center justify-between p-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
              :class="route.path === item.path ? 'bg-primary-600/10 text-primary-600 border border-primary-500/20' : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/5'"
              @click="closeMobileMenu"
            >
              <span>{{ item.name }}</span>
              <div v-if="route.path === item.path" class="w-1.5 h-1.5 rounded-full bg-primary-600"></div>
            </router-link>
          </nav>

          <!-- Divider -->
          <div class="h-px bg-black/5 dark:bg-white/5 my-6"></div>

          <!-- Bottom Actions inside Mobile Menu (Optional but handy) -->
          <button @click="handleLogout" class="w-full flex items-center justify-center gap-3 p-4 rounded-2xl text-xs font-black uppercase tracking-widest text-rose-500 bg-rose-500/5 transition-all">
            <LogOut :size="16" />
            <span>退出当前账号</span>
          </button>
        </div>
      </transition>
    </header>

    <!-- Main Content -->
    <main :class="{'max-w-[1440px] mx-auto': showSidebar, 'p-6 lg:p-12': !isPublicPage, 'p-0': isPublicPage}" class="transition-all duration-300">

      <router-view v-slot="{ Component }">
        <transition 
          name="fade" 
          mode="out-in"
        >
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Custom styles for primary color if tailwind config not fully loaded */
.bg-primary-600 {
  background-color: #2563eb;
}
.text-primary-600 {
  color: #2563eb;
}
</style>
