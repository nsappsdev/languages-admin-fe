'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useVocabularyLibrary } from '../../../../hooks/useVocabularyLibrary';

export default function VocabularyPage() {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => { const timer = setTimeout(() => { setSearch(input); setPage(1); }, 250); return () => clearTimeout(timer); }, [input]);
  const query = useVocabularyLibrary(search, page);
  return <div className="mx-auto max-w-5xl space-y-5 pb-8">
    <div><h1 className="text-2xl font-semibold text-slate-900">Vocabulary library</h1>
      <p className="mt-2 text-sm text-slate-600">Saved words and phrases from published lessons. Listen to existing clips and choose recordings to reuse.</p></div>
    <div><label htmlFor="vocabulary-search" className="mb-2 block text-sm font-medium text-slate-700">Find a word, phrase, or Armenian meaning</label>
      <input id="vocabulary-search" type="search" value={input} onChange={event => setInput(event.target.value)} placeholder="Search vocabulary"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-base focus-visible:outline-brand-500" /></div>
    {query.isLoading ? <p role="status" className="py-6 text-slate-600">Loading saved vocabulary…</p> : query.error ? <div role="alert" className="space-y-2 rounded-lg border border-rose-200 p-4">
      <p>Unable to load vocabulary.</p><button onClick={() => void query.refetch()} className="rounded border px-3 py-2 text-sm">Try again</button></div> : query.data ? <>
      <p role="status" className="text-sm text-slate-500">{query.data.total} {query.data.total === 1 ? 'entry' : 'entries'}{search ? ' found' : ' in your library'}</p>
      {query.data.terms.length ? <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {query.data.terms.map(term => <li key={term.id}><Link href={`/dashboard/vocabulary/${term.id}`} className="flex min-w-0 items-center justify-between gap-4 px-4 py-4 hover:bg-slate-50 focus-visible:outline-brand-500">
          <div className="min-w-0"><span className="break-words font-semibold text-slate-900">{term.text}</span><span className="ml-2 text-xs text-slate-500">{term.language.toUpperCase()}</span>
            <p className="mt-1 break-words text-sm text-slate-600">{term.translations.join(' · ')}</p>
            <p className="mt-1 text-xs text-slate-500">{term.recordingCount} saved {term.recordingCount === 1 ? 'recording' : 'recordings'}</p></div>
          <span aria-hidden="true" className="shrink-0 text-slate-400">→</span></Link></li>)}
      </ul> : <div className="rounded-lg border border-slate-200 bg-white p-6"><h2 className="font-semibold">{search ? 'No matching vocabulary' : 'Your saved vocabulary will appear here'}</h2>
        <p className="mt-2 text-sm text-slate-600">{search ? 'Try another spelling or Armenian translation.' : 'Select words or phrases, add translations, and publish a lesson. Its clips are added automatically.'}</p></div>}
      {query.data.total > query.data.pageSize ? <nav aria-label="Vocabulary pages" className="flex items-center justify-between gap-2 text-sm">
        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="rounded border bg-white px-3 py-2 disabled:opacity-40">Previous</button>
        <span>Page {page} of {Math.ceil(query.data.total / query.data.pageSize)}</span>
        <button disabled={page * query.data.pageSize >= query.data.total} onClick={() => setPage(p => p + 1)} className="rounded border bg-white px-3 py-2 disabled:opacity-40">Next</button>
      </nav> : null}
    </> : null}
  </div>;
}
