'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useToast } from '../../../../components/providers/ToastProvider';
import { useVocabulary } from '../../../../hooks/useVocabulary';
import { useVocabularyMutations } from '../../../../hooks/useVocabularyMutations';

export default function VocabularyPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useVocabulary({ page, pageSize: 10 });
  const { deleteEntry } = useVocabularyMutations();
  const { notify } = useToast();
  const handleDelete = async (entryId: string) => {
    if (!window.confirm('Delete this vocabulary entry?')) return;
    try {
      await deleteEntry.mutateAsync(entryId);
      notify('Vocabulary entry deleted');
    } catch (err) {
      notify(
        err instanceof Error ? err.message : 'Failed to delete entry',
        'error',
      );
    }
  };

  const entries = data?.entries ?? [];
  const pageCount = data?.pageCount ?? 1;
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Vocabulary</h1>
          <p className="text-sm text-slate-500">Manage the global word/phrase library.</p>
        </div>
        <Link
          href="/dashboard/vocabulary/new"
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
        >
          New entry
        </Link>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between text-sm text-slate-500">
          <p>Global dictionary. 10 entries per page.</p>
          <p>Total entries: {total}</p>
        </div>
        {isLoading ? <p className="text-sm text-slate-500">Loading entries…</p> : null}
        {!isLoading && error ? <p className="text-sm text-rose-600">{error.message}</p> : null}
        {!isLoading && !error && !entries.length ? (
          <p className="text-sm text-slate-500">No vocabulary entries yet.</p>
        ) : null}
        {!isLoading && !error && entries.length ? (
          <div className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between py-4">
                <Link href={`/dashboard/vocabulary/${entry.id}`} className="flex-1">
                  <p className="font-semibold text-slate-900">{entry.englishText}</p>
                  <p className="text-xs uppercase text-slate-400">
                    {entry.kind} • {entry.translations.length} translations
                  </p>
                </Link>
                <div className="flex items-center gap-3">
                  <Link href={`/dashboard/vocabulary/${entry.id}`} className="text-sm text-brand-600">
                    Edit
                  </Link>
                  <button
                    className="text-sm text-rose-600 disabled:opacity-50"
                    onClick={() => handleDelete(entry.id)}
                    disabled={deleteEntry.isPending}
                  >
                    {deleteEntry.isPending ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {!isLoading && !error && pageCount > 1 ? (
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <p className="text-sm text-slate-500">
              Page {page} of {pageCount}
            </p>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={page === pageCount}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
