export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  roles: string[];
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
}

type RuntimeAuthConfig = {
  API_ORIGIN?: string;
  API_PREFIX?: string;
  LOGIN_TYPE?: string;
};

function loginEndpoint(runtime: RuntimeAuthConfig): string {
  const origin = runtime.API_ORIGIN?.trim().replace(/\/+$/, '') || '';
  const rawPrefix = runtime.API_PREFIX?.trim() || '/cortex/api/v0.85';
  const prefix = `/${rawPrefix.replace(/^\/+|\/+$/g, '')}`;
  return `${origin}${prefix}/auth/login`;
}

async function loginErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error?: unknown; message?: unknown };
    const message = payload.error ?? payload.message;
    if (typeof message === 'string' && message.trim()) return message;
  } catch {
    // The response may not be JSON (for example, an upstream proxy error page).
  }
  return `${response.status} ${response.statusText}`.trim();
}

export const loginWithCredentials = async (username: string, password: string): Promise<AuthResponse> => {
  // @ts-ignore
  const runtime = (window.__ENV__ || {}) as RuntimeAuthConfig;
  const loginType = runtime.LOGIN_TYPE || 'mock';

  if (loginType === 'sso') {
    throw new Error('SSO login should be handled by Keycloak redirect, not credentials.');
  }

  // Mock mode still asks the backend for a signed JWT. Using the same-origin
  // endpoint keeps login working through Vite/Nginx and from non-localhost URLs.
  const endpoint = loginEndpoint(runtime);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  } catch {
    throw new Error(`Cannot reach the Cortex login API (${endpoint})`);
  }

  if (!response.ok) {
    throw new Error(`Authentication failed: ${await loginErrorMessage(response)}`);
  }

  const payload = await response.json();
  const rawUser = payload.user || {};
  if (typeof payload.token !== 'string' || !payload.token || !rawUser.id || !rawUser.username) {
    throw new Error('The Cortex login API returned an invalid response');
  }
  return {
    token: payload.token,
    user: {
      id: rawUser.id,
      username: rawUser.username,
      email: rawUser.email,
      roles: Array.isArray(rawUser.roles) ? rawUser.roles : rawUser.role ? [rawUser.role] : [],
    },
  };
};
