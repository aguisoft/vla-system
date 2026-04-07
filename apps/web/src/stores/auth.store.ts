import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthUser } from '@vla/shared';
import api from '@/lib/api';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  setUser: (user: AuthUser, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),

      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        localStorage.setItem('vla_token', data.access_token);
        set({ user: data.user, token: data.access_token, isAuthenticated: true });
      },

      setUser: (user, token) => {
        set({ user, token, isAuthenticated: true });
      },

      logout: () => {
        localStorage.removeItem('vla_token');
        localStorage.removeItem('vla_user');
        set({ user: null, token: null, isAuthenticated: false });
      },
    }),
    {
      name: 'vla_auth',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
