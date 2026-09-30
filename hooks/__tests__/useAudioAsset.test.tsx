import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider } from '../../components/providers/AuthProvider';
import { useAudioAsset } from '../useAudioAsset';
import { API_BASE_URL } from '../../lib/config';

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe('useAudioAsset', () => {
  const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
  const createObjectUrlMock = jest.fn(() => 'blob:mock-url');
  const revokeObjectUrlMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    createObjectUrlMock.mockClear();
    revokeObjectUrlMock.mockClear();
    global.fetch = fetchMock;
    // jsdom does not implement these.
    (global.URL as unknown as { createObjectURL: typeof createObjectUrlMock }).createObjectURL = createObjectUrlMock;
    (global.URL as unknown as { revokeObjectURL: typeof revokeObjectUrlMock }).revokeObjectURL = revokeObjectUrlMock;
  });

  it('fetches authorized bytes into a blob object URL', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      blob: async () => new Blob(['audio bytes']),
    } as unknown as Response);

    const { result } = renderHook(() => useAudioAsset('asset-1'), { wrapper });

    await waitFor(() => {
      expect(result.current.url).toBe('blob:mock-url');
    });

    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE_URL}/admin/audio-assets/asset-1/content`, expect.any(Object));
    expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
  });

  it('revokes the previous object URL when the asset id changes', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(['bytes']),
    } as unknown as Response);

    const { result, rerender } = renderHook(({ assetId }) => useAudioAsset(assetId), {
      wrapper,
      initialProps: { assetId: 'asset-1' as string | null },
    });

    await waitFor(() => expect(result.current.url).toBe('blob:mock-url'));

    rerender({ assetId: 'asset-2' });

    await waitFor(() => expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:mock-url'));
  });

  it('surfaces an error message instead of throwing when the fetch fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 } as unknown as Response);

    const { result } = renderHook(() => useAudioAsset('missing-asset'), { wrapper });

    await waitFor(() => {
      expect(result.current.error).toMatch(/404/);
    });
    expect(result.current.url).toBeNull();
  });

  it('does nothing when assetId is null', () => {
    const { result } = renderHook(() => useAudioAsset(null), { wrapper });
    expect(result.current.url).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
