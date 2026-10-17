'use client';

import { useEffect, useId, useState } from 'react';
import { OccurrencesResponse } from '../../lib/textAuthoringTypes';
import { ImportMatch, importMatchesOverlap, matchVocabularyImport, parseVocabularyImport } from '../../lib/vocabularyImport';

export interface VocabularyImportInput {
  alignmentId: string; expectedDraftVersion: number;
  entries: Array<{ occurrenceId: string; endOccurrenceId: string | null; translation: string }>;
}

export function VocabularyImport({ data, pending, onImport, onClose, onDirtyChange }: {
  data: OccurrencesResponse; pending: boolean;
  onImport: (input: VocabularyImportInput) => Promise<unknown>;
  onClose: () => void; onDirtyChange: (dirty: boolean) => void;
}) {
  const id = useId();
  const [source, setSource] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<ReturnType<typeof matchVocabularyImport> & { draftVersion: number } | null>(null);
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const chosen = preview?.matches.filter(match => included.has(match.key)) ?? [];
  const stale = preview !== null && preview.draftVersion !== data.draftVersion;
  const overlapping = importMatchesOverlap(chosen);
  useEffect(() => { onDirtyChange(!!source.trim() || pending); return () => onDirtyChange(false); }, [source, pending, onDirtyChange]);
  const edit = (value: string) => { setSource(value); setPreview(null); setErrors([]); setMessage(''); };
  const buildPreview = () => {
    const parsed = parseVocabularyImport(source);
    setErrors(parsed.errors); setMessage('');
    if (parsed.errors.length || data.draftVersion === undefined) { setPreview(null); return; }
    const result = matchVocabularyImport(parsed.rows, data);
    setPreview({ ...result, draftVersion: data.draftVersion });
    setIncluded(new Set(result.matches.filter(match => !match.issue && !match.replace && !match.unchanged).map(match => match.key)));
  };
  const apply = async () => {
    if (!preview || stale || overlapping || !chosen.length || chosen.length > 500) return;
    setErrors([]);
    try {
      await onImport({ alignmentId: data.alignmentId, expectedDraftVersion: preview.draftVersion,
        entries: chosen.map(match => ({ occurrenceId: match.first.id, endOccurrenceId: match.last.id === match.first.id ? null : match.last.id, translation: match.row.translation })) });
      setMessage(`Imported ${chosen.length} learning ${chosen.length === 1 ? 'entry' : 'entries'} with Armenian translations.`);
      setSource(''); setPreview(null);
    } catch (error) { setErrors([error instanceof Error ? error.message : 'Import failed. Your preview is preserved; try again.']); }
  };
  const setChecked = (match: ImportMatch, checked: boolean) => setIncluded(previous => {
    const next = new Set(previous); if (checked) next.add(match.key); else next.delete(match.key); return next;
  });
  return <section aria-label="Import words and phrases" className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
    <div className="flex items-start justify-between gap-3">
      <div><h4 className="font-semibold text-slate-900">Import words &amp; phrases</h4><p className="mt-1 text-sm text-slate-600">Paste two columns from a spreadsheet, use an arrow between each pair, or upload a CSV.</p></div>
      <button type="button" disabled={pending} onClick={onClose} className="shrink-0 rounded px-2 py-2 text-sm text-slate-600 hover:bg-slate-200 focus-visible:outline-brand-500 disabled:opacity-50">Cancel import</button>
    </div>
    <fieldset disabled={pending} className="min-w-0 space-y-3">
      <label htmlFor={`${id}-source`} className="block text-sm font-medium text-slate-700">Words or phrases and Armenian translations</label>
      <textarea id={`${id}-source`} value={source} onChange={event => edit(event.target.value)} rows={4} maxLength={200000}
        placeholder={'look after → հոգ տանել\njourney → ճանապարհորդություն'} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-brand-500" />
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-slate-700">CSV file <input type="file" accept=".csv,text/csv" aria-label="Upload vocabulary CSV" className="block max-w-full text-xs file:mr-2 file:rounded file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-slate-700" onChange={async event => {
          const file = event.target.files?.[0]; event.target.value = '';
          if (!file) return;
          if (file.size > 200000) { setErrors(['Keep the CSV file below 200 KB.']); return; }
          try { edit(await file.text()); } catch { setErrors(['Could not read this file. Try another CSV or paste its contents.']); }
        }} /></label>
        <a download="vocabulary-template.csv" href={'data:text/csv;charset=utf-8,' + encodeURIComponent('\uFEFFword,translation\nlook after,հոգ տանել\njourney,ճանապարհորդություն\n')} className="text-sm text-brand-600 underline underline-offset-4">Download CSV template</a>
        <button type="button" onClick={buildPreview} disabled={!source.trim() || data.draftVersion === undefined} className="ml-auto rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{preview ? 'Refresh preview' : 'Preview matches'}</button>
      </div>
      <p className="text-xs text-slate-600">CSV columns: word, translation. Each repeated occurrence is listed separately. Nothing is saved until you apply the import.</p>
      {preview ? <div className="space-y-3 border-t border-slate-200 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{preview.matches.length} matches · {chosen.length} selected</p>
          <button type="button" className="text-sm text-brand-600 underline" onClick={() => setIncluded(new Set())}>Clear selection</button></div>
        <p className="text-xs text-slate-600">Review the sentence for each match. Replacing an existing translation is unchecked by default.</p>
        {preview.unmatched.length ? <p role="status" className="text-sm text-amber-800">No match for {preview.unmatched.map(row => `“${row.term}” (row ${row.line})`).join(', ')}. These rows will not be imported.</p> : null}
        <div className="max-h-80 overflow-y-auto overscroll-contain rounded-md border border-slate-200 bg-white">
          {preview.matches.map(match => <label key={match.key} className="flex items-start gap-3 border-b border-slate-100 p-3 last:border-0">
            <input type="checkbox" className="mt-1 size-4 shrink-0 accent-indigo-600" checked={included.has(match.key)} disabled={!!match.issue || match.unchanged} onChange={event => setChecked(match, event.target.checked)}
              aria-label={`Import ${match.row.term} in sentence ${match.sentenceNumber}, position ${match.first.ordinal}`} />
            <span className="min-w-0 break-words text-sm"><span className="font-semibold text-slate-900">{match.row.term}</span><span className="text-slate-700"> · {match.row.translation}</span>
              <span className="mt-1 block text-xs text-slate-600">Sentence {match.sentenceNumber}: {match.sentence}</span>
              {match.replace ? <span className="mt-1 block text-xs text-amber-800">Replace “{match.existingTranslation}”</span> : null}
              {match.unchanged ? <span className="mt-1 block text-xs text-slate-600">Already saved</span> : null}
              {match.issue ? <span className="mt-1 block text-xs text-amber-800">{match.issue}</span> : null}
            </span>
          </label>)}
        </div>
        {stale ? <p role="alert" className="text-sm text-amber-800">This text changed. Refresh the preview before importing.</p> : null}
        {overlapping ? <p role="alert" className="text-sm text-amber-800">Some checked words overlap with a checked phrase. Choose one or the other.</p> : null}
        {chosen.length > 500 ? <p role="alert" className="text-sm text-amber-800">Select up to 500 occurrences at a time.</p> : null}
        <button type="button" onClick={() => void apply()} disabled={!chosen.length || chosen.length > 500 || overlapping || stale} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {pending ? 'Importing…' : `Import ${chosen.length} ${chosen.length === 1 ? 'entry' : 'entries'}`}
        </button>
      </div> : null}
    </fieldset>
    {errors.length ? <div role="alert" className="space-y-1 text-sm text-rose-700">{errors.map((error, index) => <p key={index}>{error}</p>)}</div> : null}
    {message ? <p role="status" className="text-sm text-emerald-800">{message}</p> : null}
  </section>;
}
