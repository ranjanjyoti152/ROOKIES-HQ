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
    const authenticated = await get().fetchMe();
    if (!authenticated) {
      throw new Error('Signed in, but failed to load your profile. Please try again.');
    }
  },

  changePassword: async (newPassword, options = {}) => {
    await api.post('/auth/change-password', {
      current_password: options.currentPassword ?? null,
      new_password: newPassword,
      skip_current_password_check: Boolean(options.skipCurrentCheck),
    });
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
      const orgServices = res.data.organization?.services || {};
      const rawSidebar = res.data.user.sidebar_items || [];
      const sidebarItems = rawSidebar.filter((item) => {
        if (item?.key === 'ai_assistant' && orgServices.ai_assistant === false) return false;
        return true;
      });
      set({
        user: res.data.user,
        organization: res.data.organization,
        sidebarItems,
        isAuthenticated: true,
        isLoading: false,
      });
      return true;
    } catch {
      set({ user: null, organization: null, sidebarItems: [], isAuthenticated: false, isLoading: false });
      return false;
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
