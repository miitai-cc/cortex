export type LoginType = 'mock' | 'normal' | 'sso';

export interface EnvConfig {
  // Backend
  BACKEND_HOST: string;
  BACKEND_PORT: string;
  API_ORIGIN: string;
  API_PREFIX: string;

  // Login
  LOGIN_TYPE: LoginType;

  // Keycloak
  KEYCLOAK_URL: string;
  KEYCLOAK_REALM: string;
  KEYCLOAK_CLIENT_ID: string;
}

const VALID_LOGIN_TYPES: LoginType[] = ['mock', 'normal', 'sso'];

function readEnv(): EnvConfig {
  const w = (typeof window !== 'undefined' ? (window as any).__ENV__ : {}) as Partial<EnvConfig>;
  const rawLoginType = (w.LOGIN_TYPE || 'mock') as string;
  const loginType: LoginType = VALID_LOGIN_TYPES.includes(rawLoginType as LoginType)
    ? (rawLoginType as LoginType)
    : 'mock';

  return {
    BACKEND_HOST: w.BACKEND_HOST || 'localhost',
    BACKEND_PORT: w.BACKEND_PORT || '8080',
    API_ORIGIN: typeof w.API_ORIGIN === 'string' ? w.API_ORIGIN.trim().replace(/\/+$/, '') : '',
    API_PREFIX: w.API_PREFIX || '/cortex/api/v0.85',
    LOGIN_TYPE: loginType,
    KEYCLOAK_URL: w.KEYCLOAK_URL || 'http://localhost:8080',
    KEYCLOAK_REALM: w.KEYCLOAK_REALM || 'cortex',
    KEYCLOAK_CLIENT_ID: w.KEYCLOAK_CLIENT_ID || 'cortex-frontend',
  };
}

export const env: EnvConfig = readEnv();

// Same-origin URLs work for Vite, Nginx, Docker/Kubernetes and remote browsers.
// API_ORIGIN remains available for an explicitly cross-origin deployment.
export const API_BASE_URL = `${env.API_ORIGIN}${env.API_PREFIX}`;

const httpOrigin = env.API_ORIGIN || (
  typeof window !== 'undefined'
    ? window.location.origin
    : `http://${env.BACKEND_HOST}:${env.BACKEND_PORT}`
);
const wsOrigin = httpOrigin.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
export const WS_BASE_URL = `${wsOrigin}${env.API_PREFIX}`;

export const isMockLogin = () => env.LOGIN_TYPE === 'mock';
export const isSsoLogin = () => env.LOGIN_TYPE === 'sso';
export const isNormalLogin = () => env.LOGIN_TYPE === 'normal';
