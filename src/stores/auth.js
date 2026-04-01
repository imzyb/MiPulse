import { defineStore } from 'pinia';
import axios from 'axios';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('mipulse_token') || null,
    user: null,
  }),
  getters: {
    isAuthenticated: (state) => !!state.token,
  },
  actions: {
    async login(username, password) {
      try {
        const response = await axios.post('/api/auth/login', { username, password });
        if (response.data.success) {
          this.token = response.data.token;
          localStorage.setItem('mipulse_token', this.token);
          axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
          return true;
        }
        return false;
      } catch (error) {
        console.error('Login failed:', error);
        return false;
      }
    },
    logout() {
      this.token = null;
      this.user = null;
      localStorage.removeItem('mipulse_token');
      delete axios.defaults.headers.common['Authorization'];
    }
  }
});
