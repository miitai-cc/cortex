import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserProfile } from '../services/authService';

interface AuthState {
  isAuthenticated: boolean;
  user: UserProfile | null;
  token: string | null;
  setAuth: (user: UserProfile, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      setAuth: (user, token) => set({ isAuthenticated: true, user, token }),
      logout: () => set({ isAuthenticated: false, user: null, token: null }),
    }),
    { name: 'cortex-auth' },
  ),
);
