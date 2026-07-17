export type LoginType = 'mock' | 'normal' | 'sso';

export interface EnvConfig {
  // Backend
  BACKEND_HOST: string;
  BACKEND_PORT: string;
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
    API_PREFIX: w.API_PREFIX || '/cortex/api/v0.85',
    LOGIN_TYPE: loginType,
    KEYCLOAK_URL: w.KEYCLOAK_URL || 'http://localhost:8080',
    KEYCLOAK_REALM: w.KEYCLOAK_REALM || 'cortex',
    KEYCLOAK_CLIENT_ID: w.KEYCLOAK_CLIENT_ID || 'cortex-frontend',
  };
}

export const env: EnvConfig = readEnv();

export const API_BASE_URL = `http://${env.BACKEND_HOST}:${env.BACKEND_PORT}${env.API_PREFIX}`;
export const WS_BASE_URL = `ws://${env.BACKEND_HOST}:${env.BACKEND_PORT}${env.API_PREFIX}`;

export const isMockLogin = () => env.LOGIN_TYPE === 'mock';
export const isSsoLogin = () => env.LOGIN_TYPE === 'sso';
export const isNormalLogin = () => env.LOGIN_TYPE === 'normal';
