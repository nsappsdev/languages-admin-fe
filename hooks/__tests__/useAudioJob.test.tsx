import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider } from '../../components/providers/AuthProvider';
import { useAudioJob } from '../useAudioJob';

function createJsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => body,
  } as unknown as Response;
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AuthProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </AuthProvider>
    );
  };
}

describe('useAudioJob', () => {
  const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it('does not fetch when jobId is null', () => {
    renderHook(() => useAudioJob(null), { wrapper: createWrapper() });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a terminal SUCCEEDED job without further polling required to observe it', async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        job: { id: 'job-1', textId: 't1', kind: 'GENERATE_NARRATION', status: 'SUCCEEDED', attempt: 1, resultAssetId: 'a1', resultId: 'al1', error: null },
      }),
    );

    const { result } = renderHook(() => useAudioJob('job-1'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.data?.job.status).toBe('SUCCEEDED');
    });
  });

  it('surfaces a job error without pretending success', async () => {
    fetchMock.mockResolvedValue(
      createJsonResponse({
        job: {
          id: 'job-2',
          textId: 't1',
          kind: 'GENERATE_NARRATION',
          status: 'FAILED',
          attempt: 1,
          resultAssetId: null,
          resultId: null,
          error: { code: 'PROVIDER_AUTH_FAILED', message: 'bad key', retryable: false },
        },
      }),
    );

    const { result } = renderHook(() => useAudioJob('job-2'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.data?.job.status).toBe('FAILED');
    });
    expect(result.current.data?.job.error?.code).toBe('PROVIDER_AUTH_FAILED');
  });
});
