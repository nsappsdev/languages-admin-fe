'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, useApiClient } from '../../hooks/useApiClient';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export function DeleteLessonButton({ lessonId, title, disabled = false }: { lessonId: string; title: string; disabled?: boolean }) {
  const router = useRouter();
  const queries = useQueryClient();
  const { request } = useApiClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const remove = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true); setError(null);
    try {
      try { await request(`/lessons/${lessonId}`, { method: 'DELETE' }); }
      catch (failure) {
        // A retry after a lost success response, or another admin's deletion,
        // has already reached the requested result.
        if (!(failure instanceof ApiError && failure.status === 404)) throw failure;
      }
      // Do not refetch the removed detail while it is still mounted.
      queries.removeQueries({ queryKey: ['lesson', lessonId] });
      void queries.invalidateQueries({ queryKey: ['lessons'] });
      void queries.invalidateQueries({ queryKey: ['analytics'] });
      router.replace('/dashboard/lessons');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to delete lesson. Please try again.');
      setPending(false); inFlight.current = false;
    }
  };

  return <>
    <button type="button" disabled={disabled || pending} onClick={() => { setError(null); setOpen(true); }}
      className="rounded-lg border border-rose-200 bg-white px-3 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50 focus-visible:outline-rose-700 disabled:opacity-50">
      Delete lesson
    </button>
    {open ? <ConfirmDialog title="Delete lesson?" description={`“${title}” will be removed from admin and the learning app. Shared vocabulary recordings and saved learning history will be kept. Unsaved edits will be discarded.`}
      confirmLabel="Delete lesson" tone="danger" isPending={pending} error={error}
      onCancel={() => setOpen(false)} onConfirm={() => void remove()} /> : null}
  </>;
}
