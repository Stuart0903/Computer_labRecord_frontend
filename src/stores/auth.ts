import { create } from 'zustand';
import { api, FetchError } from '@/lib/api';
import type { Teacher } from '@/lib/types';

interface AuthState {
  teacher: Teacher | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  teacher: null,
  isLoading: true,
  isAuthenticated: false,

  login: async (username: string, password: string) => {
    const data = await api<{ teacher: Teacher }>('/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    set({ teacher: data.teacher, isAuthenticated: true });
  },

  logout: async () => {
    await api('/auth/logout', { method: 'POST' });
    set({ teacher: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    try {
      const teacher = await api<Teacher>('/auth/me');
      set({ teacher, isAuthenticated: true, isLoading: false });
    } catch (error) {
      if (error instanceof FetchError && error.status === 401) {
        set({ teacher: null, isAuthenticated: false, isLoading: false });
      } else {
        set({ teacher: null, isAuthenticated: false, isLoading: false });
      }
    }
  },
}));