window.__ENV__ = {
  // Backend API
  BACKEND_HOST: '0.0.0.0',
  BACKEND_PORT: '8080',
  API_PREFIX: '/cortex/api/v0.85',

  // Login type: mock | normal | sso
  LOGIN_TYPE: 'mock',

  // Keycloak SSO (used when LOGIN_TYPE=sso)
  KEYCLOAK_URL: 'http://localhost:8080',
  KEYCLOAK_REALM: 'cortex',
  KEYCLOAK_CLIENT_ID: 'cortex-frontend',
};
