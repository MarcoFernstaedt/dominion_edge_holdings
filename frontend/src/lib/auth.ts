/**
 * auth.ts — Client-side auth utilities.
 *
 * Auth state is stored in sessionStorage only (cleared on tab/browser close).
 * The actual session token lives in an HttpOnly cookie managed by the backend.
 * We only cache the user profile here for UI display.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface AuthUser {
  id:        string;
  email:     string | null;
  name:      string;
  role:      string;
  avatarUrl: string | null;
}

export interface AuthStatus {
  authEnabled:   boolean;
  jwtConfigured: boolean;
  setupRequired: boolean;
  userCount:     number | null;
}

// ─── API calls ────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method:      'POST',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify({ email, password }),
    credentials: 'include', // send/receive cookies
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || 'Login failed');
  }

  const data = await res.json();
  return data.user as AuthUser;
}

export async function logout(): Promise<void> {
  await fetch(`${API_URL}/api/auth/logout`, {
    method:      'POST',
    credentials: 'include',
  }).catch(() => {});
}

export async function getMe(): Promise<AuthUser | null> {
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user as AuthUser;
  } catch {
    return null;
  }
}

export async function getAuthStatus(): Promise<AuthStatus | null> {
  try {
    const res  = await fetch(`${API_URL}/api/auth/status`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function setup(email: string, password: string, name: string): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/api/auth/setup`, {
    method:      'POST',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify({ email, password, name }),
    credentials: 'include',
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error?.message || 'Setup failed');
  }

  const data = await res.json();
  return data.user as AuthUser;
}
