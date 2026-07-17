export interface EnvConfig {
  // Backend
  BACKEND_HOST: string;
  BACKEND_PORT: string;
  API_PREFIX: string;

  // Keycloak
  KEYCLOAK_ENABLED: boolean;
  KEYCLOAK_URL: string;
  KEYCLOAK_REALM: string;
  KEYCLOAK_CLIENT_ID: string;
}

function readEnv(): EnvConfig {
  const w = (typeof window !== 'undefined' ? (window as any).__ENV__ : {}) as Partial<EnvConfig>;

  return {
    BACKEND_HOST: w.BACKEND_HOST || '0.0.0.0',
    BACKEND_PORT: w.BACKEND_PORT || '8080',
    API_PREFIX: w.API_PREFIX || '/cortex/api/v0.85',
    KEYCLOAK_ENABLED: w.KEYCLOAK_ENABLED === true || w.KEYCLOAK_ENABLED === 'true',
    KEYCLOAK_URL: w.KEYCLOAK_URL || 'http://localhost:8080',
    KEYCLOAK_REALM: w.KEYCLOAK_REALM || 'cortex',
    KEYCLOAK_CLIENT_ID: w.KEYCLOAK_CLIENT_ID || 'cortex-frontend',
  };
}

export const env: EnvConfig = readEnv();

export const API_BASE_URL = `http://${env.BACKEND_HOST}:${env.BACKEND_PORT}${env.API_PREFIX}`;
export const WS_BASE_URL = `ws://${env.BACKEND_HOST}:${env.BACKEND_PORT}${env.API_PREFIX}`;
