'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '../../hooks/useApiClient';

export function ReaderPublication({ lessonId, publicationId }: { lessonId: string; publicationId?: string | null }) {
  const { request } = useApiClient();
  const queries = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const publish = async () => {
    setBusy(true); setError(null); setMessage(null);
    try {
      const saved = await request<{ lesson: { items: { id: string }[] } }>(`/lessons/${lessonId}`);
      const workspaces = await Promise.all(saved.lesson.items.map(item => request<{ text: { approvedTextReleaseId: string | null } }>(`/admin/lessons/${lessonId}/texts/${item.id}`)));
      if (!workspaces.length || workspaces.some(result => !result.text.approvedTextReleaseId)) throw new Error('Approve every saved text in its V2 workspace before publishing.');
      await request(`/admin/lessons/${lessonId}/reader-publications`, { method: 'POST', body: JSON.stringify({ textReleaseIds: workspaces.map(result => result.text.approvedTextReleaseId) }) });
      await queries.invalidateQueries({ queryKey: ['lesson', lessonId] });
      setMessage('Approved text versions are now available in the learning app.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to publish'); }
    finally { setBusy(false); }
  };
  return <section aria-label="Mobile publication" className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-teal-200 bg-teal-50 p-4">
    <div><h2 className="font-semibold text-teal-950">Learning app</h2>
      <p className="mt-1 text-sm text-teal-900">{publicationId ? 'A saved version is published. Publish again after approving your changes.' : 'Publish saved, approved V2 texts to make them available to learners.'}</p>
      {message ? <p role="status" className="mt-2 text-sm text-teal-800">{message}</p> : null}
      {error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
    <button type="button" disabled={busy} onClick={() => { void publish(); }} className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{busy ? 'Publishing…' : 'Publish to mobile'}</button>
  </section>;
}
