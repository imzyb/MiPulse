<script setup>
import { computed, ref, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from './stores/auth';
import { LayoutDashboard, LogOut, Activity, Bell, Monitor, Globe, Menu, X } from 'lucide-vue-next';
import ToastStack from './components/ui/ToastStack.vue';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const isLoginPage = computed(() => route.path === '/login');
const isPublicPage = computed(() => route.path === '/');
const showSidebar = computed(() => auth.isAuthenticated && !isLoginPage.value && !isPublicPage.value);

const isMobileMenuOpen = ref(false);
const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
};

// Close mobile menu on navigation
watch(() => route.path, () => {
  isMobileMenuOpen.value = false;
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
    <header v-if="showSidebar" class="sticky top-0 z-[60] bg-white/80 dark:bg-gray-950/80 backdrop-blur-3xl border-b border-black/5 dark:border-white/5 transition-all">
      <div class="max-w-[1440px] mx-auto px-6 lg:px-12 h-20 flex items-center justify-between">
        <div class="flex items-center gap-12">
          <div @click="router.push('/admin')" class="flex items-center gap-3 cursor-pointer group">
            <div class="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center shadow-lg shadow-primary-500/30 group-hover:scale-110 transition-transform">
              <Activity :size="24" />
            </div>
            <span class="text-2xl font-black text-gray-900 dark:text-white tracking-widest leading-none">MiPulse</span>
          </div>

          <!-- Mobile Toggle (Wait, let's put it on the right? No, standard is left or next to logo) -->
          <button @click="toggleMobileMenu" class="md:hidden p-2 rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white transition-all ml-[-8px]">
             <Menu v-if="!isMobileMenuOpen" :size="24" />
             <X v-else :size="24" />
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
          <!-- Public Page Link - To the left of Notifications -->
          <router-link to="/" class="p-3 rounded-2xl text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all" title="查看公开页">
            <Globe :size="20" />
          </router-link>

          <!-- Notifications -->
          <button class="p-3 rounded-2xl text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all relative">
            <Bell :size="20" />
            <span class="absolute top-3 right-3 w-2 h-2 bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.5)]"></span>
          </button>

          <div class="w-px h-6 bg-gray-200 dark:bg-white/10 mx-2"></div>

          <!-- Logout -->
          <button @click="handleLogout" class="flex items-center gap-2 pl-4 pr-2 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-rose-500 hover:bg-rose-500/10 transition-all">
            <LogOut :size="18" />
            <span class="hidden sm:inline">Logout</span>
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
          <nav class="flex flex-col gap-4">
            <router-link 
              v-for="item in adminNavItems" 
              :key="item.path"
              :to="item.path"
              class="flex items-center justify-between p-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
              :class="route.path === item.path ? 'bg-primary-600/10 text-primary-600 border border-primary-500/20' : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/5'"
              @click="isMobileMenuOpen = false"
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
            <span>Logout Account</span>
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
