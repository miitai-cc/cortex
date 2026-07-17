import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { env, API_BASE_URL, isSsoLogin } from '../config/env';
import {
  redirectToKeycloakLogin,
  redirectToKeycloakLogout,
  extractAuthCode,
  buildCallbackPayload,
  isKeycloakCallback,
} from 'eiva-fe-sso';
import type { SsoUser } from 'eiva-fe-sso';

export type { SsoUser as User };

interface AuthState {
  user: SsoUser | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  ssoLogin: () => void;
  handleSsoCallback: () => Promise<boolean>;
  logout: () => void;
  setUser: (user: SsoUser) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (username: string, password: string) => {
        try {
          const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });
          if (!response.ok) return false;
          const data = await response.json();
          set({ user: data.user, token: data.token, isAuthenticated: true });
          return true;
        } catch {
          return false;
        }
      },

      ssoLogin: () => {
        redirectToKeycloakLogin({
          enabled: true,
          provider: 'keycloak',
          url: env.KEYCLOAK_URL,
          realm: env.KEYCLOAK_REALM,
          clientId: env.KEYCLOAK_CLIENT_ID,
          redirectUri: `${window.location.origin}/login`,
          logoutRedirectUri: window.location.origin,
          scope: 'openid profile email',
        });
      },

      handleSsoCallback: async () => {
        if (!isKeycloakCallback()) return false;
        const code = extractAuthCode();
        if (!code) return false;

        try {
          const resp = await fetch(`${API_BASE_URL}/auth/sso/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildCallbackPayload(code, `${window.location.origin}/login`)),
          });
          if (!resp.ok) return false;
          const data = await resp.json();
          set({ user: data.user, token: data.token, isAuthenticated: true });
          window.history.replaceState({}, '', '/login');
          return true;
        } catch {
          return false;
        }
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false });
        if (isSsoLogin()) {
          redirectToKeycloakLogout({
            enabled: true,
            provider: 'keycloak',
            url: env.KEYCLOAK_URL,
            realm: env.KEYCLOAK_REALM,
            clientId: env.KEYCLOAK_CLIENT_ID,
            redirectUri: `${window.location.origin}/login`,
            logoutRedirectUri: window.location.origin,
            scope: 'openid profile email',
          });
        }
      },

      setUser: (user: SsoUser) => set({ user }),
    }),
    {
      name: 'cortex-auth',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);
