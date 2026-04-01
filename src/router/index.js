import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { public: true }
    },
    {
      path: '/admin',
      name: 'vps-admin',
      component: () => import('../views/VpsMonitorView.vue')
    },
    {
      path: '/admin/themes',
      name: 'theme-settings',
      component: () => import('../views/ThemeSettingsView.vue')
    },
    {
      path: '/admin/network-targets',
      name: 'network-targets',
      component: () => import('../views/NetworkTargetsView.vue')
    },
    {
      path: '/admin/report-params',
      name: 'report-params',
      component: () => import('../views/ReportParametersView.vue')
    },
    {
      path: '/admin/settings',
      name: 'system-settings',
      component: () => import('../views/SystemSettingsView.vue')
    },
    {
      path: '/',
      name: 'vps-live',
      component: () => import('../views/PublicVpsMonitorView.vue'),
      meta: { public: true }
    }
  ]
});

router.beforeEach((to, from, next) => {
  const auth = useAuthStore();
  if (!to.meta.public && !auth.isAuthenticated) {
    next('/login');
  } else {
    next();
  }
});

export default router;
