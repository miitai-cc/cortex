export const LOGIN_PATH = '/cortex/login';
export const DEFAULT_AUTHENTICATED_PATH = '/cortex/ai-document-query';

const RETURN_PATH_STORAGE_KEY = 'cortex-return-path';

type HttpError = {
  response?: {
    status?: number;
    data?: unknown;
  };
};

function getErrorMessage(data: unknown): string {
  if (typeof data === 'string') return data;
  if (!data || typeof data !== 'object') return '';

  const payload = data as { error?: unknown; message?: unknown; detail?: unknown };
  const message = payload.error ?? payload.message ?? payload.detail;
  return typeof message === 'string' ? message : '';
}

function isCurrentJwt(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const encodedPayload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = encodedPayload.padEnd(
      Math.ceil(encodedPayload.length / 4) * 4,
      '=',
    );
    const payload = JSON.parse(window.atob(paddedPayload)) as { exp?: unknown };

    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export function hasValidAuthentication(
  isAuthenticated: boolean,
  token: string | null,
): boolean {
  return isAuthenticated && token !== null && isCurrentJwt(token);
}

export function sanitizeReturnPath(path: string | null | undefined): string | null {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return null;

  const pathname = path.split('?')[0];
  if (pathname === '/' || pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`)) {
    return null;
  }

  return path;
}

export function rememberReturnPath(path: string): void {
  const safePath = sanitizeReturnPath(path);
  if (!safePath) return;

  try {
    window.sessionStorage.setItem(RETURN_PATH_STORAGE_KEY, safePath);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function getRememberedReturnPath(): string | null {
  try {
    return sanitizeReturnPath(window.sessionStorage.getItem(RETURN_PATH_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function clearRememberedReturnPath(): void {
  try {
    window.sessionStorage.removeItem(RETURN_PATH_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function rememberCurrentHashRoute(): void {
  const hashRoute = window.location.hash.replace(/^#/, '');
  const safePath = sanitizeReturnPath(hashRoute);
  if (safePath) rememberReturnPath(safePath);
}

export function shouldRedirectToLogin(error: unknown, token: string | null): boolean {
  const response = (error as HttpError | null)?.response;
  if (response?.status !== 401) return false;

  if (!token || !isCurrentJwt(token)) return true;

  const message = getErrorMessage(response.data).toLowerCase();
  return [
    'invalid or expired token',
    'invalid token',
    'token expired',
    'missing authorization header',
    'invalid authorization header',
    'invalid authorization format',
    'not authenticated',
    'authentication required',
  ].some((authenticationError) => message.includes(authenticationError));
}
