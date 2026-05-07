'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { useToast } from '../../../../../components/providers/ToastProvider';
import { ConfirmDialog } from '../../../../../components/ui/ConfirmDialog';
import { useVocabularyEntry } from '../../../../../hooks/useVocabulary';
import { useVocabularyMutations } from '../../../../../hooks/useVocabularyMutations';
import { VocabularyKind } from '../../../../../lib/apiTypes';

const KINDS: VocabularyKind[] = ['WORD', 'PHRASE', 'SENTENCE'];

export default function VocabularyDetailPage() {
  const params = useParams<{ entryId: string }>();
  const entryId = params?.entryId ?? '';
  const router = useRouter();
  const { data, isLoading, error } = useVocabularyEntry(entryId);
  const { updateEntry, addTranslation, deleteTranslation, deleteEntry } = useVocabularyMutations();
  const { notify } = useToast();

  const entry = data?.entry;
  const [englishText, setEnglishText] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [kind, setKind] = useState<VocabularyKind>('WORD');
  const [translationLang, setTranslationLang] = useState('am');
  const [translationText, setTranslationText] = useState('');
  const [translationUsage, setTranslationUsage] = useState('');
  const [deleteEntryOpen, setDeleteEntryOpen] = useState(false);

  useEffect(() => {
    if (entry) {
      setEnglishText(entry.englishText);
      setNotes(entry.notes ?? '');
      setTags(entry.tags.join(', '));
      setKind(entry.kind);
    }
  }, [entry]);

  const handleUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!entryId) return;
    try {
      await updateEntry.mutateAsync({
        entryId,
        data: {
          englishText: englishText.trim(),
          notes: notes.trim(),
          tags: tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
          kind,
        },
      });
      notify('Entry updated');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update entry', 'error');
    }
  };

  const handleAddTranslation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!entryId) return;
    try {
      await addTranslation.mutateAsync({
        entryId,
        languageCode: translationLang.trim(),
        translation: translationText.trim(),
        usageExample: translationUsage.trim() || undefined,
      });
      notify('Translation added');
      setTranslationText('');
      setTranslationUsage('');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to add translation', 'error');
    }
  };

  const handleDeleteEntry = async () => {
    if (!entryId) return;
    try {
      await deleteEntry.mutateAsync(entryId);
      notify('Entry deleted');
      router.push('/dashboard/vocabulary');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete entry', 'error');
    }
  };

  const handleDeleteTranslation = async (translationId: string) => {
    if (!entryId) return;
    try {
      await deleteTranslation.mutateAsync({ entryId, translationId });
      notify('Translation removed');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to remove translation', 'error');
    }
  };

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading vocabulary…</p>;
  }
  if (error || !entry) {
    return <p className="text-sm text-rose-600">{error?.message ?? 'Vocabulary entry not found.'}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/vocabulary" className="text-sm text-brand-600">
          ← Back to vocabulary
        </Link>
        <button onClick={() => setDeleteEntryOpen(true)} className="text-sm text-rose-600">
          Delete entry
        </button>
      </div>

      <form className="space-y-4" onSubmit={handleUpdate}>
        <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">English text</label>
            <input
              value={englishText}
              onChange={(e) => setEnglishText(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
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
            <label className="block text-sm font-medium text-slate-700">Tags</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="greeting,basic"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            disabled={updateEntry.isPending}
          >
            {updateEntry.isPending ? 'Saving…' : 'Save entry'}
          </button>
        </div>
      </form>

      <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Translations</h2>
        <div className="divide-y divide-slate-100">
          {entry.translations.map((translation) => (
            <div key={translation.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-slate-900">
                  {translation.languageCode.toUpperCase()}: {translation.translation}
                </p>
                {translation.usageExample && (
                  <p className="text-sm text-slate-500">Example: {translation.usageExample}</p>
                )}
              </div>
              <button
                className="text-xs text-rose-600"
                onClick={() => handleDeleteTranslation(translation.id)}
                disabled={deleteTranslation.isPending}
              >
                Remove
              </button>
            </div>
          ))}
          {!entry.translations.length && (
            <p className="py-3 text-sm text-slate-500">No translations yet.</p>
          )}
        </div>
        <form className="space-y-3" onSubmit={handleAddTranslation}>
          <h3 className="text-sm font-semibold text-slate-900">Add translation</h3>
          <div className="flex gap-3">
            <select
              value={translationLang}
              onChange={(e) => setTranslationLang(e.target.value)}
              className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="am">AM</option>
            </select>
            <input
              value={translationText}
              onChange={(e) => setTranslationText(e.target.value)}
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Translation"
            />
          </div>
          <input
            value={translationUsage}
            onChange={(e) => setTranslationUsage(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Usage example (optional)"
          />
          <button
            type="submit"
            disabled={addTranslation.isPending}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {addTranslation.isPending ? 'Adding…' : 'Add translation'}
          </button>
        </form>
      </section>
      {deleteEntryOpen ? (
        <ConfirmDialog
          title="Delete vocabulary entry?"
          description="This will permanently delete this entry and cascade to translations, learner words, and lesson dictionary references."
          confirmLabel="Delete"
          tone="danger"
          isPending={deleteEntry.isPending}
          onCancel={() => setDeleteEntryOpen(false)}
          onConfirm={() => {
            void handleDeleteEntry();
          }}
        />
      ) : null}
    </div>
  );
}
