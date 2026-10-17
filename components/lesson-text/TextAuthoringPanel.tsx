'use client';
import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAudioJob } from '../../hooks/useAudioJob';
import { useTextAuthoringMutations, useTextOccurrences, useTextReadiness, useTextWorkspace } from '../../hooks/useTextAuthoring';
import { NarrationControls } from './NarrationControls';
import { OccurrenceSelection } from './OccurrenceSelection';
import { TextVocabularyEditor } from './TextVocabularyEditor';
import { TextReadinessPanel } from './TextReadinessPanel';
import { VocabularyImport } from './VocabularyImport';
import { learningOccurrences } from '../../lib/vocabularyImport';

export function TextAuthoringPanel({ lessonId, textId, onBusyChange }: {
  lessonId: string; textId: string; onBusyChange?: (textId: string, busy: boolean) => void;
}) {
  const queries = useQueryClient();
  const workspaceQuery = useTextWorkspace(lessonId, textId);
  const workspace = workspaceQuery.data?.text;
  const [draftText, setDraftText] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [savingEntryId, setSavingEntryId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importDirty, setImportDirty] = useState(false);
  const [phraseDirty, setPhraseDirty] = useState(false);
  const [dirtyTranslations, setDirtyTranslations] = useState<Record<string, boolean>>({});
  const alignmentId = workspace?.alignmentSummary?.id ?? null;
  const occurrencesQuery = useTextOccurrences(lessonId, textId, alignmentId);
  const readinessQuery = useTextReadiness(lessonId, textId);
  const mutations = useTextAuthoringMutations(lessonId, textId);
  const jobQuery = useAudioJob(workspace?.activeNarrationJobId ?? jobId);
  const text = draftText ?? workspace?.contentRevision?.text ?? '';
  const textDirty = !!workspace && text !== (workspace.contentRevision?.text ?? '');
  const generating = mutations.requestNarrationJob.isPending || jobQuery.data?.job.status === 'QUEUED' || jobQuery.data?.job.status === 'RUNNING' || Boolean(workspace?.activeNarrationJobId);
  const translationsDirty = Object.values(dirtyTranslations).some(Boolean);
  const savingVocabulary = mutations.setSelection.isPending || mutations.setTranslations.isPending || mutations.importVocabulary.isPending;
  const busy = importDirty || phraseDirty || mutations.importVocabulary.isPending || textDirty || generating || mutations.saveContentRevision.isPending || mutations.setSelection.isPending || mutations.setTranslations.isPending || Object.values(dirtyTranslations).some(Boolean);

  useEffect(() => {
    onBusyChange?.(textId, busy);
    return () => onBusyChange?.(textId, false);
  }, [onBusyChange, textId, busy]);
  useEffect(() => {
    if (jobQuery.data?.job.status === 'SUCCEEDED' || jobQuery.data?.job.status === 'FAILED') {
      void queries.invalidateQueries({ queryKey: ['text-workspace', lessonId, textId] });
      void queries.invalidateQueries({ queryKey: ['text-occurrences', lessonId, textId] });
      void queries.invalidateQueries({ queryKey: ['text-readiness', lessonId, textId] });
    }
  }, [jobQuery.data?.job.status, jobQuery.data?.job.id, queries, lessonId, textId]);
  const onTranslationDirty = useCallback((id: string, dirty: boolean) => {
    setDirtyTranslations(previous => previous[id] === dirty ? previous : { ...previous, [id]: dirty });
  }, []);
  const run = async (action: () => Promise<void>) => {
    setActionError(null);
    try { await action(); } catch (error) { setActionError(error instanceof Error ? error.message : 'Unable to save changes'); }
  };
  const saveAndGenerate = async () => {
    const saved = await mutations.saveContentRevision.mutateAsync(text);
    const result = await mutations.requestNarrationJob.mutateAsync({ contentRevisionId: saved.revision.id });
    setJobId(result.job.id);
  };
  const toggle = async (occurrenceId: string, selected: boolean) => {
    if (alignmentId) await mutations.setSelection.mutateAsync({ alignmentId, changes: [{ occurrenceId, selected }] });
  };
  const saveTranslation = async (entryId: string, translation: string) => {
    setSavingEntryId(entryId);
    try { await mutations.setTranslations.mutateAsync({ entryId, translations: [{ languageCode: 'hy', translation: translation.trim() }] }); }
    finally { setSavingEntryId(null); }
  };
  if (workspaceQuery.isLoading) return <p className="text-sm text-slate-500">Loading text…</p>;
  if (workspaceQuery.error || !workspace) return <p role="alert" className="text-sm text-rose-700">Unable to load text. <button onClick={() => void workspaceQuery.refetch()} className="underline">Try again</button></p>;
  return <section aria-label="Text authoring" className="min-w-0 space-y-4">
    <div className="grid items-start gap-4 lg:grid-cols-2">
    <details open={!workspace.narration || textDirty || generating || undefined} className="rounded-lg border border-slate-200 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-slate-800 focus-visible:outline-brand-500">Source text &amp; narration settings <span className="ml-2 font-normal text-slate-600">{text.length.toLocaleString()} characters</span></summary>
      <div className="mt-3">
      <label htmlFor={`text-${textId}`} className="text-sm font-medium text-slate-700">Full text</label>
      <textarea id={`text-${textId}`} value={text} maxLength={5000} onChange={event => setDraftText(event.target.value)} rows={5} disabled={generating || savingVocabulary || importDirty || phraseDirty}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void run(saveAndGenerate)} disabled={!text.trim() || !workspace.audioGenerationConfigured || generating || mutations.saveContentRevision.isPending || savingVocabulary || translationsDirty || importDirty || phraseDirty}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {generating ? 'Generating narration…' : mutations.saveContentRevision.isPending ? 'Saving…' : workspace.narration && !textDirty ? 'Regenerate narration' : 'Save and generate narration'}
        </button>
        {textDirty ? <span className="text-xs text-amber-800">Unsaved text changes</span> : null}
      </div>
      {workspace.narration ? <p className="mt-2 text-xs text-slate-500">Regenerating narration clears the current word selections. Select words again after it finishes.</p> : null}
      {!workspace.audioGenerationConfigured ? <p className="mt-2 text-sm text-amber-800">ElevenLabs narration is not configured. Contact your administrator.</p> : null}
      </div>
    </details>
    <NarrationControls narration={workspace.narration} activeJob={jobQuery.data?.job} />
    </div>
    {actionError ? <p role="alert" className="text-sm text-rose-700">{actionError}</p> : null}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
      <div><h3 className="text-base font-semibold text-slate-900">Learning words &amp; phrases</h3><p className="mt-1 text-sm text-slate-600">Choose from the text, then add Armenian translations.</p></div>
      <button type="button" onClick={() => setImportOpen(true)} disabled={!occurrencesQuery.data || occurrencesQuery.data.status !== 'OK' || textDirty || generating || savingVocabulary || translationsDirty || phraseDirty || importOpen}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Import words &amp; translations</button>
    </div>
    {importOpen && occurrencesQuery.data ? <fieldset className="min-w-0" disabled={textDirty || generating || translationsDirty}>
      <VocabularyImport key={alignmentId} data={occurrencesQuery.data} pending={mutations.importVocabulary.isPending} onDirtyChange={setImportDirty}
        onClose={() => { setImportOpen(false); setImportDirty(false); }} onImport={input => mutations.importVocabulary.mutateAsync(input)} />
    </fieldset> : null}
    <fieldset disabled={textDirty || generating || mutations.saveContentRevision.isPending || mutations.importVocabulary.isPending || importDirty} className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section aria-label="Aligned sentences" className="min-w-0">
        <h4 className="mb-3 text-sm font-semibold text-slate-800">Text</h4>
        <div className="max-h-[40rem] overflow-y-auto overscroll-contain pr-2">
        {occurrencesQuery.data ? <OccurrenceSelection key={alignmentId} occurrences={occurrencesQuery.data}
          onDraftChange={setPhraseDirty}
          onCreatePhrase={async (first, last) => {
            if (!alignmentId) return;
            await mutations.setSelection.mutateAsync({ alignmentId, changes: [{ occurrenceId: first, endOccurrenceId: last, selected: true }] });
            setFocusedId(first); setFocusRequest(value => value + 1);
          }}
          pendingOccurrenceId={mutations.setSelection.isPending ? mutations.setSelection.variables?.changes[0]?.occurrenceId ?? null : null}
          onToggle={(id, selected) => void run(() => toggle(id, selected))} focusedOccurrenceId={focusedId}
          onFocusOccurrence={id => { setFocusedId(id); setFocusRequest(value => value + 1); }} />
          : <p className="text-sm text-slate-500">{occurrencesQuery.error ? 'Unable to load sentences. Reload this page.' : 'Generate narration to see aligned sentences.'}</p>}
        </div>
      </section>
      <section aria-label="Selected words and translations" className="min-w-0">
        <h4 className="mb-3 text-sm font-semibold text-slate-800">Armenian translations</h4>
        <TextVocabularyEditor key={alignmentId ?? 'empty'} selectedOccurrences={occurrencesQuery.data ? learningOccurrences(occurrencesQuery.data) : []}
          sentences={occurrencesQuery.data?.sentences ?? []} focusedOccurrenceId={focusedId} focusRequest={focusRequest}
          onRemove={id => void run(() => toggle(id, false))} isSelecting={mutations.setSelection.isPending}
          onSaveTranslation={(id, translation) => void run(() => saveTranslation(id, translation))}
          savingEntryId={savingEntryId} onDirtyChange={onTranslationDirty} />
      </section>
    </fieldset>
    <TextReadinessPanel readiness={readinessQuery.data?.readiness} />
  </section>;
}
