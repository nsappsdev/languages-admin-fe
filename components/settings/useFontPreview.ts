'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { API_BASE_URL } from '../../lib/config';
import type { ReaderFont } from '../../lib/apiTypes';

const loaded = new Map<string, Promise<string>>();
export function useFontPreview(font: ReaderFont | undefined) {
  const { token } = useAuth();
  const [value, setValue] = useState<{ id?: string; family?: string; error?: boolean }>({});
  useEffect(() => {
    if (!font || !token) return;
    let active = true;
    const key = `${API_BASE_URL}:${font.id}:${font.sha256}`;
    let promise = loaded.get(key);
    if (!promise) {
      promise = (async () => {
        const response = await fetch(`${API_BASE_URL}/reader-fonts/${font.id}/content`, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error('Font unavailable');
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength !== font.byteLength) throw new Error('Incomplete font');
        const family = `reader-preview-${font.id}-${font.sha256.slice(0,8)}`;
        const face = new FontFace(family, bytes);
        await face.load(); document.fonts.add(face);
        return family;
      })();
      loaded.set(key, promise);
      promise.catch(() => loaded.delete(key));
    }
    promise.then(family => { if (active) setValue({ id: font.id, family }); })
      .catch(() => { if (active) setValue({ id: font.id, error: true }); });
    return () => { active = false; };
  }, [font, token]);
  return { family: value.id === font?.id ? value.family : undefined, error: value.id === font?.id && value.error,
    loading: !!font && (value.id !== font.id || (!value.family && !value.error)) };
}
