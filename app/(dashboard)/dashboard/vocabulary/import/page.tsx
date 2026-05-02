'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { useToast } from '../../../../../components/providers/ToastProvider';
import { useVocabularyMutations } from '../../../../../hooks/useVocabularyMutations';
import { parseAndValidate } from '../../../../../lib/vocabularyCsv';
import type { BulkImportResult } from '../../../../../lib/apiTypes';

const TARGET_LANGUAGES = [
  { code: 'hy', label: 'Armenian' },
  { code: 'ru', label: 'Russian' },
  { code: 'es', label: 'Spanish' },
];

const SAMPLE_CSV = [
  'englishText,translation,kind,notes,tags,usageExample',
  'hello,բարև,WORD,common greeting,greeting;basic,Hello there!',
  'how are you,ինչպես ես,PHRASE,,greeting;basic,',
  'I am tired today,Ես այսօր հոգնած եմ,SENTENCE,,daily;feelings,',
].join('\n');

export default function VocabularyImportPage() {
  const router = useRouter();
  const { notify } = useToast();
  const { bulkImport } = useVocabularyMutations();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [targetLanguageCode, setTargetLanguageCode] = useState('hy');
  const [result, setResult] = useState<BulkImportResult | null>(null);

  const parsed = useMemo(() => (csvText ? parseAndValidate(csvText) : null), [csvText]);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
    setResult(null);
  };

  const handleSubmit = async () => {
    if (!parsed || parsed.rows.length === 0) return;
    try {
      const res = await bulkImport.mutateAsync({
        targetLanguageCode,
        rows: parsed.rows,
      });
      setResult(res);
      notify(`Imported: ${res.created} created, ${res.mergedTranslations} merged`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Import failed', 'error');
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vocabulary-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const errorRowIndices = new Set(parsed?.errors.filter((e) => e.row >= 0).map((e) => e.row) ?? []);
  const headerErrors = parsed?.errors.filter((e) => e.row === -1) ?? [];
  const previewRows = parsed?.rows.slice(0, 20) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Import vocabulary</h1>
          <p className="text-xs sm:text-sm text-slate-500">Upload a CSV to bulk-create entries.</p>
        </div>
        <Link href="/dashboard/vocabulary" className="text-sm text-brand-600">
          ← Back
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">1. Upload CSV</h2>
          <button type="button" onClick={downloadTemplate} className="text-xs text-brand-600">
            Download template
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="block w-full text-sm"
        />
        {fileName ? <p className="text-xs text-slate-500">{fileName}</p> : null}
        <div className="text-xs text-slate-500">
          <p>
            Required columns: <span className="font-mono">englishText, translation</span>
          </p>
          <p>
            Optional: <span className="font-mono">kind, notes, tags, usageExample</span>
          </p>
          <p>
            Tags are semicolon-separated (e.g. <span className="font-mono">greeting;basic</span>)
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">2. Target language</h2>
        <select
          value={targetLanguageCode}
          onChange={(e) => setTargetLanguageCode(e.target.value)}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {TARGET_LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.code} — {lang.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-slate-500">
          Translations in the CSV will be saved under this language code.
        </p>
      </div>

      {parsed ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">3. Preview</h2>
          {headerErrors.length ? (
            <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
              {headerErrors.map((e, i) => (
                <p key={i}>{e.message}</p>
              ))}
            </div>
          ) : null}
          <p className="text-xs text-slate-600">
            {parsed.rows.length} valid · {parsed.errors.filter((e) => e.row >= 0).length} invalid ·{' '}
            {parsed.totalParsed} total
          </p>
          {previewRows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-left">
                    <th className="px-2 py-1">#</th>
                    <th className="px-2 py-1">englishText</th>
                    <th className="px-2 py-1">translation</th>
                    <th className="px-2 py-1">kind</th>
                    <th className="px-2 py-1">tags</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={i} className={errorRowIndices.has(i) ? 'bg-rose-50' : ''}>
                      <td className="px-2 py-1 text-slate-400">{i}</td>
                      <td className="px-2 py-1">{r.englishText}</td>
                      <td className="px-2 py-1">{r.translation}</td>
                      <td className="px-2 py-1">
                        {r.kind ?? <span className="text-slate-400">auto</span>}
                      </td>
                      <td className="px-2 py-1">{r.tags?.join('; ') ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {parsed.errors.length ? (
            <details className="text-xs">
              <summary className="cursor-pointer text-slate-600">
                {parsed.errors.length} error{parsed.errors.length === 1 ? '' : 's'}
              </summary>
              <ul className="mt-2 space-y-1 text-rose-700">
                {parsed.errors.map((e, i) => (
                  <li key={i}>
                    {e.row === -1 ? 'Header' : `Row ${e.row}`}: {e.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      {parsed && parsed.rows.length > 0 && !result ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={bulkImport.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {bulkImport.isPending ? 'Importing…' : `Import ${parsed.rows.length} rows`}
          </button>
        </div>
      ) : null}

      {result ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
          <h2 className="text-sm font-semibold text-emerald-900">Import complete</h2>
          <p className="text-xs text-emerald-800">
            Created: {result.created} · Merged translations: {result.mergedTranslations} · Skipped:{' '}
            {result.skipped} · Errors: {result.errors.length}
          </p>
          {result.errors.length ? (
            <details className="text-xs">
              <summary className="cursor-pointer text-emerald-800">View errors</summary>
              <ul className="mt-2 space-y-1 text-rose-700">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <button
            type="button"
            onClick={() => router.push('/dashboard/vocabulary')}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
          >
            Back to vocabulary
          </button>
        </div>
      ) : null}
    </div>
  );
}
