export {};

declare global {
  interface Window {
    __ENV__?: {
      BACKEND_HOST?: string;
      BACKEND_PORT?: string;
      API_ORIGIN?: string;
      API_PREFIX?: string;
      LOGIN_TYPE?: string;
      KEYCLOAK_URL?: string;
      KEYCLOAK_REALM?: string;
      KEYCLOAK_CLIENT_ID?: string;
    };
  }
}
