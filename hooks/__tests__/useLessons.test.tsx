import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider } from '../../components/providers/AuthProvider';
import { useLessons } from '../useLessons';
import { API_BASE_URL } from '../../lib/config';

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

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AuthProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </AuthProvider>
    );
  };
}

describe('useLessons', () => {
  const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it('loads lessons data using /lessons endpoint', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(200, {
        lessons: [{ id: 'l1', title: 'Lesson 1', status: 'PUBLISHED', tasks: [] }],
      }) as unknown as Response,
    );

    const { result } = renderHook(() => useLessons(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/lessons`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(result.current.data?.lessons).toHaveLength(1);
    expect(result.current.data?.lessons[0].id).toBe('l1');
  });

  it('exposes error state when request fails', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(500, {
        message: 'failed to fetch lessons',
      }) as unknown as Response,
    );

    const { result } = renderHook(() => useLessons(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error?.message).toBe('failed to fetch lessons');
  });
});
