'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '../../../../../components/providers/ToastProvider';
import { useVocabularyMutations } from '../../../../../hooks/useVocabularyMutations';
import { VocabularyKind } from '../../../../../lib/apiTypes';

const KINDS: VocabularyKind[] = ['WORD', 'PHRASE', 'SENTENCE'];

export default function NewVocabularyPage() {
  const router = useRouter();
  const { notify } = useToast();
  const { createEntry } = useVocabularyMutations();
  const [englishText, setEnglishText] = useState('');
  const [kind, setKind] = useState<VocabularyKind>('WORD');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!englishText.trim()) {
      setError('English text is required');
      return;
    }
    try {
      const resp = await createEntry.mutateAsync({
        englishText: englishText.trim(),
        kind,
        notes: notes.trim() || undefined,
        tags: tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      });
      notify('Vocabulary entry created');
      router.push(`/dashboard/vocabulary/${resp.entry.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create entry';
      setError(message);
      notify(message, 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New Vocabulary Entry</h1>
        <p className="text-sm text-slate-500">Add an English word/phrase with metadata.</p>
      </div>
      <form
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={handleSubmit}
      >
        <div>
          <label className="block text-sm font-medium text-slate-700">English text</label>
          <input
            value={englishText}
            onChange={(e) => setEnglishText(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Type</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as VocabularyKind)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            {KINDS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={3}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Tags (comma separated)</label>
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="greeting,basic"
          />
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={createEntry.isPending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {createEntry.isPending ? 'Saving…' : 'Create entry'}
        </button>
      </form>
    </div>
  );
}
