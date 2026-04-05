import { create } from 'zustand';
import api from '../api/client';

const useAuthStore = create((set, get) => ({
  user: null,
  organization: null,
  sidebarItems: [],
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('access_token', res.data.access_token);
    localStorage.setItem('refresh_token', res.data.refresh_token);
    await get().fetchMe();
  },

  register: async (orgName, email, password, fullName) => {
    const res = await api.post('/auth/register', {
      org_name: orgName,
      email,
      password,
      full_name: fullName,
    });
    localStorage.setItem('access_token', res.data.access_token);
    localStorage.setItem('refresh_token', res.data.refresh_token);
    await get().fetchMe();
  },

  fetchMe: async () => {
    try {
      const res = await api.get('/auth/me');
      set({
        user: res.data.user,
        organization: res.data.organization,
        sidebarItems: res.data.user.sidebar_items || [],
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      set({ user: null, organization: null, sidebarItems: [], isAuthenticated: false, isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ user: null, organization: null, sidebarItems: [], isAuthenticated: false, isLoading: false });
  },

  initialize: async () => {
    const token = localStorage.getItem('access_token');
    if (token) {
      await get().fetchMe();
    } else {
      set({ isLoading: false });
    }
  },
}));

export default useAuthStore;
