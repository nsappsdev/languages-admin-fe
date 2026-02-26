import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider } from '../../components/providers/AuthProvider';
import { useVocabulary, useVocabularyEntry } from '../useVocabulary';
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

describe('useVocabulary', () => {
  const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it('loads vocabulary entries', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(200, {
        entries: [
          {
            id: 'v1',
            englishText: 'hello',
            kind: 'WORD',
            tags: [],
            translations: [],
          },
        ],
      }) as unknown as Response,
    );

    const { result } = renderHook(() => useVocabulary(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/vocabulary`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(result.current.data?.entries[0].englishText).toBe('hello');
  });

  it('does not request entry when entryId is missing', async () => {
    renderHook(() => useVocabularyEntry(undefined), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  it('loads a specific entry when entryId exists', async () => {
    fetchMock.mockResolvedValueOnce(
      createJsonResponse(200, {
        entry: {
          id: 'v2',
          englishText: 'world',
          kind: 'WORD',
          tags: [],
          translations: [],
        },
      }) as unknown as Response,
    );

    const { result } = renderHook(() => useVocabularyEntry('v2'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_BASE_URL}/vocabulary/v2`,
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
    expect(result.current.data?.entry.englishText).toBe('world');
  });
});
