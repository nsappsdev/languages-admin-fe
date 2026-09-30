'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '../components/providers/AuthProvider';
import { API_BASE_URL } from '../lib/config';

/**
 * An HTML <audio> element can't attach a bearer token, and these assets are
 * private (never served by the public /media route). This hook fetches the
 * authorized bytes into a blob object URL, and revokes the previous URL on
 * every replacement/unmount so we never leak memory across asset switches.
 */
export function useAudioAsset(assetId: string | null | undefined) {
  const { token } = useAuth();
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId) {
      setUrl(null);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setIsLoading(true);
    setError(null);

    fetch(`${API_BASE_URL}/admin/audio-assets/${assetId}/content`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Failed to load audio asset (${response.status})`);
        }
        const blob = await response.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load audio asset');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [assetId, token]);

  return { url, isLoading, error };
}
