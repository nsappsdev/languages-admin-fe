'use client';

import { useAudioAsset } from '../../hooks/useAudioAsset';
import { AudioJob, TextNarrationSummary } from '../../lib/textAuthoringTypes';

interface NarrationControlsProps {
  narration: TextNarrationSummary | null;
  audioGenerationConfigured: boolean;
  hasUnsavedTextChanges: boolean;
  hasSavedRevision: boolean;
  isGenerating: boolean;
  activeJob: AudioJob | null | undefined;
  onGenerate: () => void;
  onRetry: () => void;
}

export function NarrationControls({
  narration,
  audioGenerationConfigured,
  hasUnsavedTextChanges,
  hasSavedRevision,
  isGenerating,
  activeJob,
  onGenerate,
  onRetry,
}: NarrationControlsProps) {
  const { url: narrationUrl, error: narrationLoadError } = useAudioAsset(narration?.assetId ?? null);

  const disabledReason = !audioGenerationConfigured
    ? 'Narration generation is not configured on this server (missing ELEVENLABS_API_KEY).'
    : !hasSavedRevision
      ? 'Save the text before generating narration.'
      : hasUnsavedTextChanges
        ? 'Save your text edits before generating narration.'
        : isGenerating
          ? 'A narration generation job is already in progress.'
          : null;

  return (
    <div className="space-y-2 rounded-lg bg-slate-50 px-3 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="shrink-0">
          <p className="text-sm font-semibold text-slate-800">Full narration</p>
          <p className="text-[11px] text-slate-400">Source for all word clips</p>
        </div>
        {narrationUrl ? <audio controls preload="metadata" className="h-9 min-w-0 flex-1 basis-56" src={narrationUrl} data-testid="narration-player" /> : null}
        <button
          type="button"
          onClick={onGenerate}
          disabled={Boolean(disabledReason)}
          title={disabledReason ?? undefined}
          className={`ml-auto shrink-0 rounded-md px-2.5 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50 ${narration ? 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100' : 'bg-slate-900 text-white'}`}
        >
          {isGenerating ? 'Generating…' : narration ? 'Regenerate narration' : 'Generate narration'}
        </button>
      </div>

      {disabledReason && !isGenerating ? <p className="text-xs text-amber-700">{disabledReason}</p> : null}
      {activeJob?.status === 'QUEUED' ? <p role="status" className="text-xs text-amber-700">Narration queued. Waiting for the audio worker.</p> : null}
      {activeJob?.status === 'RUNNING' ? <p role="status" className="text-xs text-slate-600">Generating narration…</p> : null}

      {activeJob?.status === 'FAILED' ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
          <p>
            Generation failed: {activeJob.error?.message ?? 'Unknown error'}
            {activeJob.error?.code ? ` (${activeJob.error.code})` : ''}
          </p>
          {activeJob.error?.retryable ? (
            <button type="button" onClick={onRetry} className="mt-1 font-semibold underline">
              Refresh job status
            </button>
          ) : (
            <p className="mt-1 text-rose-500">This error requires configuration changes before retrying.</p>
          )}
        </div>
      ) : null}

      {narration ? (
        <div className="space-y-1">
          {narrationLoadError ? (
            <p className="text-xs text-rose-600">Failed to load narration audio: {narrationLoadError}</p>
          ) : !narrationUrl ? (
            <p className="text-xs text-slate-500">Loading narration audio…</p>
          ) : null}
          <details className="text-[11px] text-slate-400">
            <summary className="cursor-pointer">Recording details</summary>
            <p className="mt-2 break-words">Voice {narration.voiceId} · {narration.model} · generated {new Date(narration.createdAt).toLocaleString()}</p>
          </details>
        </div>
      ) : (
        <p className="text-xs text-slate-500">No narration generated yet.</p>
      )}
    </div>
  );
}
