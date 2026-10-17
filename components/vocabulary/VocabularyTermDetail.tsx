'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useVocabularyPreference, useVocabularyTerm } from '../../hooks/useVocabularyLibrary';
import { LibraryMeaning } from '../../lib/vocabularyLibraryTypes';
import { RecordingPreview } from './RecordingPreview';

export function VocabularyTermDetail({ termId }: { termId: string }) {
  const query = useVocabularyTerm(termId);
  const preference = useVocabularyPreference(termId);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  async function choose(meaning: LibraryMeaning, voiceId: string, recordingId: string | null) {
    setNotice(''); setError('');
    try {
      await preference.mutateAsync({ meaningId: meaning.id, voiceId, recordingId,
        expectedRecordingId: meaning.preferences.find(p => p.voiceId === voiceId)?.recordingId ?? null });
      setNotice(recordingId ? 'Preferred recording saved for this meaning and voice.' : 'Vocabulary practice will use each lesson’s original recording.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save the preferred recording.'); }
  }
  const term = query.data;
  return <div className="mx-auto max-w-4xl space-y-5 pb-8">
    <Link href="/dashboard/vocabulary" className="inline-block py-2 text-sm font-medium text-brand-700">← Vocabulary library</Link>
    {query.isLoading ? <p role="status">Loading recordings…</p> : query.error ? <div role="alert"><p>Unable to load this vocabulary entry.</p>
      <button onClick={() => void query.refetch()} className="mt-2 rounded border bg-white px-3 py-2">Try again</button></div> : term ? <>
      <div><h1 className="break-words text-2xl font-semibold text-slate-900">{term.text}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">Choose a saved recording for standalone vocabulary practice. It will be reused for this Armenian meaning and voice. Listening inside a lesson keeps its original recording.</p></div>
      {notice ? <p role="status" className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}
      {error ? <div role="alert" className="rounded-md bg-rose-50 p-3 text-sm text-rose-800"><p>{error}</p>
        <button className="mt-2 underline" onClick={() => { setError(''); void query.refetch(); }}>Reload recordings</button></div> : null}
      {term.meanings.map(meaning => <section key={meaning.id} aria-label={`Meaning: ${meaning.translation}`} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <div><p className="text-xs font-medium text-slate-500">Armenian meaning</p><h2 className="mt-1 break-words text-xl font-semibold text-slate-900">{meaning.translation}</h2></div>
        {[...new Set(meaning.recordings.map(r => r.voiceId))].map((voiceId, voiceIndex, voices) => {
          const recordings = meaning.recordings.filter(r => r.voiceId === voiceId);
          const preferredId = meaning.preferences.find(p => p.voiceId === voiceId)?.recordingId;
          return <div key={voiceId} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <h3 className="text-sm font-semibold text-slate-700" title={voiceId}>{voices.length > 1 ? `Voice ${voiceIndex + 1} · ` : ''}{recordings.length} saved {recordings.length === 1 ? 'recording' : 'recordings'}</h3>
              {preferredId ? <button disabled={preference.isPending} onClick={() => void choose(meaning, voiceId, null)} className="rounded-md border px-3 py-2 text-xs text-slate-600 disabled:opacity-50">Use each lesson’s recording</button> : <span className="text-xs text-slate-500">Using each lesson’s recording</span>}
            </div>
            <ul className="divide-y divide-slate-100">{recordings.map((recording, index) => <li key={recording.id} className="py-4 first:pt-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-800">Recording {index + 1} <span className="ml-2 font-normal text-slate-500">{(recording.asset.frameCount / recording.asset.sampleRate).toFixed(2)}s</span>
                  {preferredId === recording.id ? <span className="ml-2 text-xs font-semibold text-emerald-700">Preferred</span> : null}</div>
                <div className="flex flex-wrap gap-2"><button disabled={!recording.available} onClick={() => setPreviewId(previewId === recording.id ? null : recording.id)}
                  aria-label={`${previewId === recording.id ? 'Close' : 'Preview'} recording ${index + 1} of ${term.text} for ${meaning.translation}`}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">{previewId === recording.id ? 'Close preview' : 'Listen'}</button>
                  {preferredId !== recording.id ? <button disabled={!recording.available || preference.isPending} onClick={() => void choose(meaning, voiceId, recording.id)}
                    aria-label={`Prefer recording ${index + 1} of ${term.text} for ${meaning.translation}`}
                    className="rounded-md border border-brand-200 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50">Use for vocabulary practice</button> : null}</div>
              </div>
              {!recording.available ? <p className="mt-2 text-sm text-amber-800">Recording unavailable. Vocabulary practice uses the lesson recording instead.</p> : null}
              {previewId === recording.id ? <RecordingPreview key={recording.id} assetId={recording.asset.id} word={term.text} /> : null}
              <details className="mt-3" open={recordings.length === 1 || undefined}>
                <summary className="cursor-pointer py-2 text-sm text-slate-600 focus-visible:outline-brand-500">Used in {new Set(recording.usages.map(u => u.lessonId)).size} {new Set(recording.usages.map(u => u.lessonId)).size === 1 ? 'lesson' : 'lessons'}</summary>
                <ul className="space-y-3 border-l border-slate-200 pl-3">{recording.usages.map(usage => <li key={`${usage.textReleaseId}:${usage.occurrenceId}`}>
                  <Link href={`/dashboard/lessons/${usage.lessonId}`} className="break-words text-sm font-medium text-brand-700 hover:underline">{usage.lessonTitle}</Link>
                  {!usage.current ? <span className="ml-2 text-xs text-slate-500">Earlier publication</span> : null}
                  <p className="mt-1 break-words text-sm leading-relaxed text-slate-600">{usage.sentence}</p>
                </li>)}</ul>
              </details>
            </li>)}</ul>
          </div>;
        })}
      </section>)}
    </> : null}
  </div>;
}
