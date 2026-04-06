import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
});

// Add a request interceptor for auth
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('mipulse_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
