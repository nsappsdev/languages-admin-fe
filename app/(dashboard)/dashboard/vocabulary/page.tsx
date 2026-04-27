'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useToast } from '../../../../components/providers/ToastProvider';
import { useDebounce } from '../../../../hooks/useDebounce';
import { useVocabulary } from '../../../../hooks/useVocabulary';
import { useVocabularyMutations } from '../../../../hooks/useVocabularyMutations';
import { VocabularyKind } from '../../../../lib/apiTypes';

const KIND_OPTIONS: Array<{ value: '' | VocabularyKind; label: string }> = [
  { value: '', label: 'All types' },
  { value: 'WORD', label: 'Word' },
  { value: 'PHRASE', label: 'Phrase' },
  { value: 'SENTENCE', label: 'Sentence' },
];

const PAGE_SIZE = 25;

export default function VocabularyPage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [kind, setKind] = useState<'' | VocabularyKind>('');
  const [tagInput, setTagInput] = useState('');

  const debouncedSearch = useDebounce(searchInput, 300);
  const debouncedTag = useDebounce(tagInput, 300);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, kind, debouncedTag]);

  const { data, isLoading, isFetching, error } = useVocabulary({
    page,
    pageSize: PAGE_SIZE,
    q: debouncedSearch || undefined,
    kind: kind || undefined,
    tag: debouncedTag || undefined,
  });

  const { deleteEntry } = useVocabularyMutations();
  const { notify } = useToast();

  const handleDelete = async (entryId: string) => {
    if (!window.confirm('Delete this vocabulary entry?')) return;
    try {
      await deleteEntry.mutateAsync(entryId);
      notify('Vocabulary entry deleted');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete entry', 'error');
    }
  };

  const entries = data?.entries ?? [];
  const pageCount = data?.pageCount ?? 1;
  const total = data?.total ?? 0;
  const hasFilters = Boolean(debouncedSearch || kind || debouncedTag);

  const clearFilters = () => {
    setSearchInput('');
    setKind('');
    setTagInput('');
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Vocabulary</h1>
          <p className="text-xs sm:text-sm text-slate-500">Search and manage the global library.</p>
        </div>
        <Link
          href="/dashboard/vocabulary/new"
          className="shrink-0 rounded-lg bg-brand-600 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white"
        >
          New entry
        </Link>
      </div>

      {/* Filter bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm space-y-2 sm:space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search English, notes, or translations…"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as '' | VocabularyKind)}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          >
            {KIND_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="Tag"
            className="sm:w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            {isFetching ? 'Searching…' : `${total} ${total === 1 ? 'entry' : 'entries'}`}
            {hasFilters ? ' (filtered)' : ''}
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-brand-600 hover:text-brand-500"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
        {isLoading ? <p className="text-sm text-slate-500">Loading entries…</p> : null}
        {!isLoading && error ? <p className="text-sm text-rose-600">{error.message}</p> : null}
        {!isLoading && !error && !entries.length ? (
          <p className="text-sm text-slate-500">
            {hasFilters ? 'No matches. Try different filters.' : 'No vocabulary entries yet.'}
          </p>
        ) : null}
        {!isLoading && !error && entries.length ? (
          <div className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-2 py-3">
                <Link href={`/dashboard/vocabulary/${entry.id}`} className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{entry.englishText}</p>
                  <p className="text-xs uppercase text-slate-400 truncate">
                    {entry.kind} • {entry.translations.length} translations
                    {entry.tags.length ? ` • ${entry.tags.join(', ')}` : ''}
                  </p>
                </Link>
                <div className="flex items-center gap-3 shrink-0">
                  <Link
                    href={`/dashboard/vocabulary/${entry.id}`}
                    className="text-sm text-brand-600"
                  >
                    Edit
                  </Link>
                  <button
                    className="text-sm text-rose-600 disabled:opacity-50"
                    onClick={() => handleDelete(entry.id)}
                    disabled={deleteEntry.isPending}
                  >
                    {deleteEntry.isPending ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!isLoading && !error && pageCount > 1 ? (
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 sm:pt-4">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs sm:text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <p className="text-xs sm:text-sm text-slate-500">
              Page {page} / {pageCount}
            </p>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              disabled={page === pageCount}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs sm:text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
