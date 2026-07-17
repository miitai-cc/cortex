export {};

declare global {
  interface Window {
    __ENV__?: {
      BACKEND_HOST?: string;
      BACKEND_PORT?: string;
      API_PREFIX?: string;
      KEYCLOAK_ENABLED?: boolean | string;
      KEYCLOAK_URL?: string;
      KEYCLOAK_REALM?: string;
      KEYCLOAK_CLIENT_ID?: string;
    };
  }
}
