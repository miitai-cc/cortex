window.__ENV__ = {
  // Backend API
  BACKEND_HOST: 'localhost',
  BACKEND_PORT: '54322',
  // Keep empty for same-origin Vite/Nginx proxying. Set an absolute origin only
  // when the API is intentionally deployed on a different public origin.
  API_ORIGIN: '',
  API_PREFIX: '/cortex/api/v0.85',

  // Login type: mock | normal | sso
  LOGIN_TYPE: 'mock',

  // Keycloak SSO (used when LOGIN_TYPE=sso)
  KEYCLOAK_URL: 'http://localhost:54323',
  KEYCLOAK_REALM: 'cortex',
  KEYCLOAK_CLIENT_ID: 'cortex-frontend',
};
