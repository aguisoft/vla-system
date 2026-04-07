import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthUser } from '@vla/shared';
import api from '@/lib/api';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  login: (email: string, password: string) => Promise<void>;
  setUser: (user: AuthUser) => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      _hasHydrated: false,
      setHasHydrated: (value) => set({ _hasHydrated: value }),

      login: async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        // cookie is set by the server (httpOnly) — just store user in state
        set({ user: data.user, isAuthenticated: true });
      },

      setUser: (user) => {
        set({ user, isAuthenticated: true });
      },

      logout: async () => {
        await api.post('/auth/logout').catch(() => {});
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'vla_auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
