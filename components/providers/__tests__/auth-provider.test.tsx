import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React, { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '../AuthProvider';
import { useApiClient } from '../../../hooks/useApiClient';
import { API_BASE_URL } from '../../../lib/config';
import type { SessionUser } from '../../../lib/types';

const STORAGE_KEY = 'language-app-admin-session';

type MockFetchResponse = {
  ok: boolean;
  status: number;
  headers: {
    get: (name: string) => string | null;
  };
  json: () => Promise<unknown>;
};

function createJsonResponse(status: number, body: unknown): MockFetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name: string) {
        return name.toLowerCase() === 'content-type' ? 'application/json' : null;
      },
    },
    json: async () => body,
  };
}

function createNoContentResponse(status = 204): MockFetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get() {
        return null;
      },
    },
    json: async () => ({}),
  };
}

const TEST_USER: SessionUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  name: 'Admin',
  role: 'admin',
};

function AuthProbe() {
  const { user, isLoading, login, logout } = useAuth();

  return (
    <div>
      <p data-testid="auth-state">{isLoading ? 'loading' : user ? user.email : 'guest'}</p>
      <button
        onClick={() => {
          void login(TEST_USER.email, 'admin123');
        }}>
        Login
      </button>
      <button
        onClick={() => {
          void logout();
        }}>
        Logout
      </button>
    </div>
  );
}

function ApiClientProbe() {
  const { request } = useApiClient();
  const { user, isLoading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    void request<{ ok: boolean }>('/lessons').catch((err) => {
      setError(err instanceof Error ? err.message : 'Request failed');
    });
  }, [isLoading, request]);

  return (
    <div>
      <p data-testid="api-auth-state">{isLoading ? 'loading' : user ? user.email : 'guest'}</p>
      <p data-testid="api-error">{error ?? ''}</p>
    </div>
  );
}

describe('AuthProvider', () => {
  const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    window.localStorage.clear();
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it('hydrates session from localStorage on mount', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: TEST_USER, token: 'token-1' }));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent(TEST_USER.email);
    });
  });

  it('logs in and persists session payload', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(200, { user: TEST_USER, token: 'token-login' }) as unknown as Response,
    );

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('guest');
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Login'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent(TEST_USER.email);
    });

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: TEST_USER.email, password: 'admin123' }),
    });

    const stored = window.localStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(stored).toContain('token-login');
  });

  it('logs out, clears storage, and calls backend logout endpoint', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: TEST_USER, token: 'token-logout' }));
    fetchMock.mockResolvedValueOnce(createNoContentResponse(204) as unknown as Response);

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent(TEST_USER.email);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Logout'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-state')).toHaveTextContent('guest');
    });

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token-logout',
      },
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('forces logout when api client receives 401 Invalid or expired token', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: TEST_USER, token: 'token-expired' }));
    fetchMock
      .mockResolvedValueOnce(
        createJsonResponse(401, { message: 'Invalid or expired token' }) as unknown as Response,
      )
      .mockResolvedValueOnce(createNoContentResponse(204) as unknown as Response);

    render(
      <AuthProvider>
        <ApiClientProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('api-auth-state')).toHaveTextContent('guest');
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `${API_BASE_URL}/lessons`,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-expired',
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `${API_BASE_URL}/auth/logout`,
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(screen.getByTestId('api-error')).toHaveTextContent('Invalid or expired token');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
