import axios from 'axios';
import { useAuthStore } from '../stores/auth';
import { useToastStore } from '../stores/toast';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for auth
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mipulse_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const toastStore = useToastStore();
    const authStore = useAuthStore();
    
    // Network errors
    if (!error.response) {
      toastStore?.showToast('网络连接失败，请检查网络设置', 'error', 5000);
      return Promise.reject(error);
    }
    
    // HTTP errors
    const { status, data } = error.response;
    
    switch (status) {
      case 401:
        // Token expired or invalid
        authStore?.logout();
        toastStore?.showToast('登录已过期，请重新登录', 'error', 3000);
        setTimeout(() => {
          window.location.href = '/login';
        }, 1000);
        break;
        
      case 403:
        toastStore?.showToast('无权访问此资源', 'error');
        break;
        
      case 404:
        toastStore?.showToast('请求的资源不存在', 'error');
        break;
        
      case 422:
        // Validation error
        if (data?.errors) {
          const messages = Object.values(data.errors).flat().join('\n');
          toastStore?.showToast(messages, 'error', 5000);
        } else {
          toastStore?.showToast(data?.message || '输入数据无效', 'error');
        }
        break;
        
      case 500:
        toastStore?.showToast('服务器内部错误', 'error', 5000);
        break;
        
      default:
        toastStore?.showToast(data?.message || '操作失败，请稍后重试', 'error');
    }
    
    return Promise.reject(error);
  }
);

export const fetchVpsNodes = () => api.get('/vps/nodes').then(res => res.data);
export const createVpsNode = (data) => api.post('/vps/nodes', data).then(res => res.data);
export const updateVpsNode = (id, data) => api.put(`/vps/nodes/${id}`, data).then(res => res.data);
export const deleteVpsNode = (id) => api.delete(`/vps/nodes/${id}`).then(res => res.data);
export const fetchVpsNodeDetail = (id) => api.get(`/vps/nodes/${id}`).then(res => res.data);
export const fetchVpsAlerts = () => api.get('/vps/alerts').then(res => res.data);
export const clearVpsAlerts = () => api.delete('/vps/alerts').then(res => res.data);
export const requestVpsNetworkCheck = (nodeId, targetId) => api.post(`/vps/targets/check`, { nodeId, targetId }).then(res => res.data);
export const fetchPublicNodes = () => api.get('/vps/public').then(res => res.data);
export const fetchPublicNodeDetail = (id) => api.get(`/vps/public/nodes/${id}`).then(res => res.data);
export const createVpsNetworkTarget = (nodeId, data) => api.post('/vps/targets', { ...data, nodeId }).then(res => res.data);
export const fetchVpsNetworkTargets = (nodeId) => api.get('/vps/targets', { params: { nodeId } }).then(res => res.data);
export const updateVpsNetworkTarget = (id, data) => api.put(`/vps/targets/${id}`, data).then(res => res.data);
export const deleteVpsNetworkTarget = (id) => api.delete(`/vps/targets/${id}`).then(res => res.data);

export const saveSettings = (data) => api.post('/vps/settings', data).then(res => res.data);
export const fetchSettings = () => api.get('/vps/settings').then(res => res.data);
export const testNotifications = () => api.post('/vps/notifications/test').then(res => res.data);
export const fetchProfile = () => api.get('/auth/profile').then(res => res.data);
export const updateProfile = (data) => api.put('/auth/profile', data).then(res => res.data);
export const resetVpsTraffic = (id) => api.post(`/vps/nodes/${id}/reset-traffic`).then(res => res.data);

export default api;
