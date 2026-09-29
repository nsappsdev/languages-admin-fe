'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAudioJob } from '../../hooks/useAudioJob';
import {
  useTextAuthoringMutations,
  useTextOccurrences,
  useTextReadiness,
  useTextWorkspace,
} from '../../hooks/useTextAuthoring';
import { NarrationControls } from './NarrationControls';
import { OccurrenceSelection } from './OccurrenceSelection';
import { TextVocabularyEditor } from './TextVocabularyEditor';
import { TextReadinessPanel } from './TextReadinessPanel';

interface TextAuthoringPanelProps {
  lessonId: string;
  textId: string;
}

/**
 * Additive text-authoring workspace for one LessonItem ("text"). Mounted
 * above the collapsed legacy item editor; never
 * writes to the legacy text/audioUrl/timing fields.
 */
export function TextAuthoringPanel({ lessonId, textId }: TextAuthoringPanelProps) {
  const queryClient = useQueryClient();
  const workspaceQuery = useTextWorkspace(lessonId, textId);
  const workspace = workspaceQuery.data?.text;

  const [draftText, setDraftText] = useState('');
  const [hasInitializedDraft, setHasInitializedDraft] = useState(false);
  const [narrationJobId, setNarrationJobId] = useState<string | null>(null);
  const [clipJobId, setClipJobId] = useState<string | null>(null);
  const [savingEntryId, setSavingEntryId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [focusedOccurrenceId, setFocusedOccurrenceId] = useState<string | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const runAction = async (action: () => Promise<void>) => {
    setActionError(null);
    try {
      await action();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    }
  };

  useEffect(() => {
    if (!hasInitializedDraft && workspace) {
      setDraftText(workspace.contentRevision?.text ?? workspace.legacyText);
      setHasInitializedDraft(true);
    }
  }, [hasInitializedDraft, workspace]);

  const alignmentId = workspace?.alignmentSummary?.id ?? null;
  const occurrencesQuery = useTextOccurrences(lessonId, textId, alignmentId);
  const readinessQuery = useTextReadiness(lessonId, textId);
  const mutations = useTextAuthoringMutations(lessonId, textId);
  const narrationJobQuery = useAudioJob(narrationJobId);
  const clipJobQuery = useAudioJob(clipJobId);

  const invalidateAfterGeneration = () => {
    queryClient.invalidateQueries({ queryKey: ['text-workspace', lessonId, textId] });
    queryClient.invalidateQueries({ queryKey: ['text-occurrences', lessonId, textId] });
    queryClient.invalidateQueries({ queryKey: ['text-readiness', lessonId, textId] });
  };

  useEffect(() => {
    if (narrationJobQuery.data?.job.status === 'SUCCEEDED') {
      invalidateAfterGeneration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [narrationJobQuery.data?.job.status]);

  useEffect(() => {
    if (clipJobQuery.data?.job.status === 'SUCCEEDED') {
      invalidateAfterGeneration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clipJobQuery.data?.job.status]);

  const hasUnsavedTextChanges = Boolean(
    workspace && draftText !== (workspace.contentRevision?.text ?? workspace.legacyText),
  );

  const handleSaveText = async () => {
    await mutations.saveContentRevision.mutateAsync(draftText);
    setIsEditing(false);
  };

  const handleGenerate = async () => {
    if (!workspace?.contentRevision) return;
    const result = await mutations.requestNarrationJob.mutateAsync({
      contentRevisionId: workspace.contentRevision.id,
    });
    setNarrationJobId(result.job.id);
  };

  const handleRetryGenerate = () => {
    if (narrationJobId) {
      setNarrationJobId(null);
      setTimeout(() => setNarrationJobId(narrationJobId), 0);
    }
  };

  const handleToggle = async (occurrenceId: string, selected: boolean) => {
    if (!alignmentId) return;
    await mutations.setSelection.mutateAsync({ alignmentId, changes: [{ occurrenceId, selected }] });
  };

  const handleSaveTranslation = async (entryId: string, translation: string) => {
    setSavingEntryId(entryId);
    try {
      await mutations.setTranslations.mutateAsync({
        entryId,
        translations: translation.trim() ? [{ languageCode: 'am', translation: translation.trim() }] : [],
      });
    } finally {
      setSavingEntryId(null);
    }
  };

  const handleExtractClips = async (occurrenceIds: string[]) => {
    if (!workspace?.narration || !alignmentId || !occurrenceIds.length) return;
    const result = await mutations.requestClipJob.mutateAsync({
      narrationId: workspace.narration.id,
      alignmentId,
      occurrenceIds,
    });
    setClipJobId(result.job.id);
  };

  const handleApprove = async () => {
    if (!workspace?.contentRevision || !workspace.narration || !alignmentId) return;
    await mutations.approveRelease.mutateAsync({
      contentRevisionId: workspace.contentRevision.id,
      narrationId: workspace.narration.id,
      alignmentId,
    });
  };

  const selectedOccurrences = useMemo(
    () => (occurrencesQuery.data?.occurrences ?? []).filter((o) => o.selected),
    [occurrencesQuery.data],
  );

  if (workspaceQuery.isLoading) {
    return <p className="text-xs text-slate-500">Loading text workspace…</p>;
  }
  if (workspaceQuery.error || !workspace) {
    return <p className="text-xs text-rose-600">Failed to load text workspace.</p>;
  }

  return (
    <section aria-label="Text workspace (V2)" style={{ containerType: 'inline-size', containerName: 'text-workspace' }} className="min-w-0 space-y-4 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <style>{`
        .text-workspace-columns { display: flex; flex-direction: column; }
        .text-workspace-words { border-top: 1px solid #e2e8f0; padding-top: 1rem; }
        .text-workspace-sentences { order: -1; padding-bottom: 1rem; }
        @container text-workspace (min-width: 540px) {
          .text-workspace-columns { display: grid; grid-template-columns: minmax(230px, 0.85fr) minmax(0, 1.15fr); }
          .text-workspace-words { border-top: 0; border-right: 1px solid #e2e8f0; padding-top: 0; padding-right: 1rem; }
          .text-workspace-sentences { order: 0; padding-left: 1.25rem; padding-bottom: 0; }
        }
      `}</style>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Text workspace <span className="ml-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">V2</span></h3>
          <p className="mt-1 text-xs text-slate-500">
            {hasUnsavedTextChanges ? 'Unsaved text changes' : workspace.contentRevision ? 'Saved revision' : 'Save a revision to begin'}
            {occurrencesQuery.data ? ` · ${occurrencesQuery.data.sentences.length} sentences` : ''}
          </p>
        </div>
        {workspace.contentRevision ? (
          <button type="button" onClick={() => setIsEditing(!isEditing)} aria-expanded={isEditing} aria-controls={`text-editor-${textId}`}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
            {isEditing ? 'Close editor' : 'Edit text'}
          </button>
        ) : null}
      </div>

      <div id={`text-editor-${textId}`} hidden={!isEditing && Boolean(workspace.contentRevision)}>
        <label htmlFor={`text-draft-${textId}`} className="block text-sm font-medium text-slate-700">Full text</label>
        <textarea
          id={`text-draft-${textId}`}
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          className="mt-1 min-h-32 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm"
          rows={4}
        />
        <button
          type="button"
          onClick={() => void runAction(handleSaveText)}
          disabled={(!hasUnsavedTextChanges && Boolean(workspace.contentRevision)) || !draftText.trim() || mutations.saveContentRevision.isPending}
          className="mt-2 rounded-md border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {mutations.saveContentRevision.isPending ? 'Saving…' : 'Save text'}
        </button>
      </div>

      {actionError ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{actionError}</p> : null}

      <NarrationControls
        narration={workspace.narration}
        audioGenerationConfigured={workspace.audioGenerationConfigured}
        hasUnsavedTextChanges={hasUnsavedTextChanges}
        hasSavedRevision={Boolean(workspace.contentRevision)}
        isGenerating={
          mutations.requestNarrationJob.isPending ||
          narrationJobQuery.data?.job.status === 'QUEUED' ||
          narrationJobQuery.data?.job.status === 'RUNNING'
        }
        activeJob={narrationJobQuery.data?.job}
        onGenerate={() => void runAction(handleGenerate)}
        onRetry={handleRetryGenerate}
      />

      <div className="text-workspace-columns min-w-0 border-t border-slate-200 pt-4">
        <section aria-label="Selected words and translations" className="text-workspace-words min-w-0 space-y-3">
          <div className="px-3"><h3 className="text-sm font-semibold text-slate-800">Learning words</h3><p className="mt-0.5 text-xs text-slate-400">Armenian translations · narration clips</p></div>
          <TextVocabularyEditor
            selectedOccurrences={selectedOccurrences}
            sentences={occurrencesQuery.data?.sentences ?? []}
            focusedOccurrenceId={focusedOccurrenceId}
            focusRequest={focusRequest}
            onRemove={(id) => void runAction(() => handleToggle(id, false))}
            isSelecting={mutations.setSelection.isPending}
            onSaveTranslation={(id, translation) => void runAction(() => handleSaveTranslation(id, translation))}
            onExtractClips={(ids) => void runAction(() => handleExtractClips(ids))}
            isExtracting={
              mutations.requestClipJob.isPending ||
              clipJobQuery.data?.job.status === 'QUEUED' ||
              clipJobQuery.data?.job.status === 'RUNNING'
            }
            savingEntryId={savingEntryId}
          />
          {clipJobQuery.data?.job.status === 'FAILED' ? <p role="alert" className="text-sm text-rose-700">Clip extraction failed: {clipJobQuery.data.job.error?.message ?? 'Unknown error'}</p> : null}
          {clipJobQuery.data?.job.status === 'QUEUED' ? <p role="status" className="text-xs text-amber-700">Clip extraction queued. Waiting for the audio worker.</p> : null}
        </section>
        <section aria-label="Aligned sentences" className="text-workspace-sentences min-w-0 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">Sentences</h3>
            <span className="text-[11px] text-slate-400">{occurrencesQuery.data?.sentences.length ?? 0} aligned</span>
          </div>
          {workspace.alignmentSummary ? occurrencesQuery.error ? (
            <p role="alert" className="text-sm text-rose-700">Could not load aligned sentences. <button type="button" onClick={() => void occurrencesQuery.refetch()} className="underline">Try again</button></p>
          ) : occurrencesQuery.data ? (
            <>
              <p className="text-xs leading-relaxed text-slate-500">Select words to teach. Highlighted words open their translation.</p>
              <OccurrenceSelection
                occurrences={occurrencesQuery.data}
                pendingOccurrenceId={mutations.setSelection.isPending ? mutations.setSelection.variables?.changes[0]?.occurrenceId ?? null : null}
                onToggle={(id, selected) => void runAction(() => handleToggle(id, selected))}
                focusedOccurrenceId={focusedOccurrenceId}
                onFocusOccurrence={(id) => {
                  setFocusedOccurrenceId(id);
                  setFocusRequest((request) => request + 1);
                }}
              />
            </>
          ) : <p className="text-sm text-slate-500">Loading aligned sentences…</p> : (
            <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">Generate narration for this revision to see its aligned sentences and select learning words.</div>
          )}
        </section>
      </div>

      <TextReadinessPanel
        readiness={readinessQuery.data?.readiness}
        onApprove={() => void runAction(handleApprove)}
        isApproving={mutations.approveRelease.isPending}
        approvedReleaseId={workspace.approvedTextReleaseId}
      />
    </section>
  );
}
