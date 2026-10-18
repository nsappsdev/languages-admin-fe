'use client';
import { useAudioAsset } from '../../hooks/useAudioAsset';
import { AudioJob, TextNarrationSummary } from '../../lib/textAuthoringTypes';
export function NarrationControls({ narration, activeJob }: { narration: TextNarrationSummary | null; activeJob?: AudioJob | null }) {
  const { url, error } = useAudioAsset(narration?.assetId ?? null);
  return <div className="min-w-0 space-y-2 rounded-lg bg-slate-50 p-3">
    <p className="text-sm font-semibold text-slate-800">ElevenLabs narration</p>
    {activeJob?.status === 'QUEUED' || activeJob?.status === 'RUNNING' ? <p role="status" className="text-sm text-slate-600">{activeJob.status === 'QUEUED' ? 'Narration queued…' : 'Generating narration…'}</p> : null}
    {activeJob?.status === 'FAILED' ? <p role="alert" className="text-sm text-rose-700">Narration failed: {activeJob.error?.message ?? 'Please try generating again.'}</p> : null}
    {url ? <audio controls preload="metadata" className="h-10 w-full min-w-0" src={url} data-testid="narration-player" /> : <p className="text-xs text-slate-500">{narration ? 'Loading narration…' : 'No current narration yet.'}</p>}
    {error ? <p role="alert" className="text-xs text-rose-700">Could not load narration: {error}</p> : null}
    <p className="text-xs text-slate-500">Full lesson narration. Prepare word and phrase audio from the vocabulary library below.</p>
  </div>;
}
