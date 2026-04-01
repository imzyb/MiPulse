<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { LogIn, ShieldCheck, AlertCircle } from 'lucide-vue-next';

const router = useRouter();
const auth = useAuthStore();

const username = ref('admin');
const password = ref('');
const error = ref('');
const isLoading = ref(false);

const handleLogin = async () => {
  if (!password.value) {
    error.value = '请输入密码';
    return;
  }
  
  isLoading.value = true;
  error.value = '';
  
  const success = await auth.login(username.value, password.value);
  if (success) {
    router.push('/admin');
  } else {
    error.value = '登录失败，请检查密码';
  }
  isLoading.value = false;
};
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-6">
    <div class="max-w-md w-full">
      <div class="text-center mb-10">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600/10 text-primary-600 mb-4">
          <ShieldCheck :size="32" />
        </div>
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">MiPulse</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-2">独立高性能 VPS 探针系统</p>
      </div>

      <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl p-8 shadow-xl shadow-gray-200/50 dark:shadow-none">
        <form @submit.prevent="handleLogin" class="space-y-6">
          <div v-if="error" class="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 p-4 rounded-xl flex items-center gap-3 text-sm animate-pulse">
            <AlertCircle :size="18" />
            {{ error }}
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">用户名</label>
            <input 
              v-model="username"
              type="text" 
              class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all dark:text-white"
              placeholder="admin"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">密码</label>
            <input 
              v-model="password"
              type="password" 
              class="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all dark:text-white"
              placeholder="••••••••"
              required
            />
          </div>

          <button 
            type="submit"
            :disabled="isLoading"
            class="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogIn v-if="!isLoading" :size="20" />
            <span v-if="isLoading" class="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            {{ isLoading ? '登录中...' : '进入控制面板' }}
          </button>
        </form>
      </div>

      <p class="text-center text-gray-400 dark:text-gray-600 text-xs mt-8">
        &copy; 2024 MiPulse. Designed by Antigravity.
      </p>
    </div>
  </div>
</template>

<style scoped>
.bg-primary-600 {
  background-color: #2563eb;
}
.text-primary-600 {
  color: #2563eb;
}
</style>
