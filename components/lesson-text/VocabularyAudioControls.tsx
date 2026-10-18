'use client';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../hooks/useApiClient';
import { useAudioJob } from '../../hooks/useAudioJob';
import { AudioJob } from '../../lib/textAuthoringTypes';
import { RecordingPreview } from '../vocabulary/RecordingPreview';

interface AudioPlan {
  draftVersion: number; reuseCount: number; generateCount: number; audioGenerationConfigured: boolean;
  entries: { entryId: string; text: string; translation: string; recordingId: string | null; assetId: string | null }[];
}
const createKey = () => typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `audio-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export function VocabularyAudioControls({ lessonId, textId, draftVersion, activeJobId, disabled, onBusyChange }: {
  lessonId: string; textId: string; draftVersion: number; activeJobId?: string | null; disabled: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const { request } = useApiClient();
  const queries = useQueryClient();
  const [open, setOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const key = useRef({ version: draftVersion, value: createKey() });
  const base = `/admin/lessons/${lessonId}/texts/${textId}/vocabulary`;
  const plan = useQuery({ queryKey: ['vocabulary-audio-plan', lessonId, textId, draftVersion], queryFn: () => request<AudioPlan>(base + '/audio-plan'), enabled: open && !disabled });
  const mutation = useMutation({ mutationFn: () => {
    if (key.current.version !== draftVersion) key.current = { version: draftVersion, value: createKey() };
    return request<{ job: AudioJob }>(base + '/audio-jobs', { method: 'POST', headers: { 'Idempotency-Key': key.current.value },
      body: JSON.stringify({ expectedDraftVersion: plan.data!.draftVersion }) });
  } });
  const jobQuery = useAudioJob(activeJobId ?? jobId);
  const job = jobQuery.data?.job;
  const busy = mutation.isPending || (!!(activeJobId ?? jobId) && !job) || job?.status === 'QUEUED' || job?.status === 'RUNNING';
  useEffect(() => { onBusyChange(busy); return () => onBusyChange(false); }, [busy, onBusyChange]);
  useEffect(() => {
    if (job?.status !== 'SUCCEEDED' && job?.status !== 'FAILED') return;
    if (job.status === 'FAILED') key.current.version = -1;
    for (const queryKey of [['text-workspace', lessonId, textId], ['text-occurrences', lessonId, textId], ['text-readiness', lessonId, textId],
      ['lesson', lessonId], ['vocabulary-library'], ['vocabulary-term'], ['vocabulary-audio-plan', lessonId, textId]]) void queries.invalidateQueries({ queryKey });
  }, [job?.id, job?.status, lessonId, textId, queries]);
  async function prepare() {
    setError('');
    try { const result = await mutation.mutateAsync(); setJobId(result.job.id); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to prepare word audio.'); }
  }
  const data = plan.data;
  let outcome: { reusedCount: number; generatedCount: number } | null = null;
  try { if (job?.status === 'SUCCEEDED' && job.resultId) outcome = JSON.parse(job.resultId); } catch { /* Older jobs may not include a summary. */ }
  return <section aria-label="Word audio" className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="text-sm font-semibold text-slate-900">Word &amp; phrase audio</h4>
      <p className="mt-1 text-sm text-slate-600">Reuse saved vocabulary audio. New words are spoken separately and saved for future lessons.</p></div>
      <button type="button" disabled={disabled || busy} onClick={() => setOpen(value => !value)} aria-expanded={open}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{open ? 'Hide audio details' : 'Check vocabulary audio'}</button></div>
    {busy ? <p role="status" className="text-sm text-slate-700">Preparing vocabulary audio… You can leave this page and return when it finishes.</p> : null}
    {outcome ? <p role="status" className="text-sm text-emerald-800">Audio ready: {outcome.reusedCount} entries reused saved audio; {outcome.generatedCount} new recordings generated and saved to Vocabulary.</p> : null}
    {job?.error ? <p role="alert" className="text-sm text-rose-700">{job.error.message} Check the vocabulary again before retrying.</p> : null}
    {error || jobQuery.error ? <p role="alert" className="text-sm text-rose-700">{error || 'Unable to check audio progress. Reload this page to reconnect.'}</p> : null}
    {open ? <>
      {plan.isLoading ? <p role="status" className="text-sm">Checking saved recordings…</p> : plan.error ? <p role="alert" className="text-sm text-rose-700">{plan.error.message}</p> : data ? <>
        <p className="text-sm font-medium text-slate-800">{data.reuseCount} entries can reuse audio · {data.generateCount} new recordings needed</p>
        <ul className="max-h-64 divide-y divide-slate-200 overflow-y-auto rounded-md border border-slate-200 bg-white">{data.entries.map(entry => <li key={entry.entryId} className="space-y-2 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="break-words text-sm"><strong>{entry.text}</strong> · {entry.translation}</span>
            <span className="text-xs text-slate-600">{entry.recordingId ? 'Reuse saved audio' : 'Generate new audio'}</span>
            {entry.assetId ? <button type="button" className="px-2 py-1 text-sm text-brand-700 underline" onClick={() => setPreviewId(previewId === entry.entryId ? null : entry.entryId)}>{previewId === entry.entryId ? 'Close preview' : 'Listen'}</button> : null}</div>
          {entry.assetId && previewId === entry.entryId ? <RecordingPreview assetId={entry.assetId} word={entry.text} /> : null}
        </li>)}</ul>
        {data.generateCount > 0 && !data.audioGenerationConfigured ? <p className="text-sm text-amber-800">ElevenLabs is not configured for the missing recordings.</p> : null}
        <button type="button" disabled={disabled || busy || !data.entries.length || (data.generateCount > 0 && !data.audioGenerationConfigured)} onClick={() => void prepare()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{data.generateCount ? `Reuse saved audio & generate ${data.generateCount} new recordings` : 'Use saved vocabulary audio'}</button>
      </> : null}
    </> : null}
  </section>;
}
