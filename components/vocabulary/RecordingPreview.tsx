'use client';
import { useState } from 'react';
import { useAudioAsset } from '../../hooks/useAudioAsset';

export function RecordingPreview({ assetId, word }: { assetId: string; word: string }) {
  const { url, isLoading, error } = useAudioAsset(assetId);
  const [failed, setFailed] = useState(false);
  return <div className="mt-3 min-w-0">
    {isLoading ? <p role="status" className="text-sm text-slate-500">Loading recording…</p> : null}
    {url ? <audio controls autoPlay src={url} aria-label={`Recording of ${word}`} className="h-10 w-full min-w-0" onError={() => setFailed(true)} /> : null}
    {error || failed ? <p role="alert" className="text-sm text-rose-700">Unable to play this recording. Close the preview and try again.</p> : null}
  </div>;
}
