'use client';

import { useAuth } from '../components/providers/AuthProvider';
import { API_BASE_URL } from '../lib/config';

export function useApiClient() {
  const { token, logout } = useAuth();

  const request = async <T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> => {
    const isFormData =
      typeof FormData !== 'undefined' && options.body instanceof FormData;

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...(options ?? {}),
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers ?? {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    let payload: unknown = null;
    const isJson = response.headers.get('content-type')?.includes('application/json');
    if (response.status !== 204 && isJson) {
      payload = await response.json().catch(() => null);
    }

    if (!response.ok) {
      const message =
        typeof payload === 'object' && payload && 'message' in payload
          ? (payload as { message: string }).message
          : 'Request failed';

      if (response.status === 401 && message === 'Invalid or expired token') {
        logout();
      }

      throw new Error(message);
    }
    return payload as T;
  };

  return { request };
}
