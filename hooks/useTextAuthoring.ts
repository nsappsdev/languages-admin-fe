'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from './useApiClient';
import {
  AudioJob,
  OccurrencesResponse,
  TextContentRevision,
  TextReadiness,
  TextVocabularyEntryDto,
  TextWorkspaceDetail,
} from '../lib/textAuthoringTypes';

export function useTextWorkspace(lessonId: string, textId: string) {
  const { request } = useApiClient();
  return useQuery({
    queryKey: ['text-workspace', lessonId, textId],
    queryFn: () => request<{ text: TextWorkspaceDetail }>(`/admin/lessons/${lessonId}/texts/${textId}`),
    enabled: Boolean(lessonId && textId),
  });
}

export function useTextOccurrences(lessonId: string, textId: string, alignmentId: string | null) {
  const { request } = useApiClient();
  return useQuery({
    queryKey: ['text-occurrences', lessonId, textId, alignmentId],
    queryFn: () =>
      request<OccurrencesResponse>(
        `/admin/lessons/${lessonId}/texts/${textId}/occurrences?alignmentId=${alignmentId}`,
      ),
    enabled: Boolean(lessonId && textId && alignmentId),
  });
}

export function useTextReadiness(lessonId: string, textId: string) {
  const { request } = useApiClient();
  return useQuery({
    queryKey: ['text-readiness', lessonId, textId],
    queryFn: () => request<{ readiness: TextReadiness }>(`/admin/lessons/${lessonId}/texts/${textId}/readiness`),
    enabled: Boolean(lessonId && textId),
  });
}

const createIdempotencyKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `key-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function useTextAuthoringMutations(lessonId: string, textId: string) {
  const { request } = useApiClient();
  const queryClient = useQueryClient();

  const invalidateWorkspace = () => {
    queryClient.invalidateQueries({ queryKey: ['text-workspace', lessonId, textId] });
    queryClient.invalidateQueries({ queryKey: ['text-readiness', lessonId, textId] });
  };
  const invalidateSelectionState = () => {
    queryClient.invalidateQueries({ queryKey: ['text-workspace', lessonId, textId] });
    queryClient.invalidateQueries({ queryKey: ['text-occurrences', lessonId, textId] });
    queryClient.invalidateQueries({ queryKey: ['text-readiness', lessonId, textId] });
  };

  const saveContentRevision = useMutation({
    mutationFn: (text: string) =>
      request<{ revision: TextContentRevision; textVersion: number }>(
        `/admin/lessons/${lessonId}/texts/${textId}/content-revisions`,
        { method: 'POST', body: JSON.stringify({ text, sourceLanguage: 'en' }) },
      ),
    onSuccess: invalidateWorkspace,
  });

  const requestNarrationJob = useMutation({
    mutationFn: ({ contentRevisionId }: { contentRevisionId: string }) =>
      request<{ job: AudioJob; replay: boolean }>(`/admin/lessons/${lessonId}/texts/${textId}/narration-jobs`, {
        method: 'POST',
        headers: { 'Idempotency-Key': createIdempotencyKey() },
        body: JSON.stringify({ contentRevisionId }),
      }),
  });

  const setSelection = useMutation({
    mutationFn: ({
      alignmentId,
      changes,
    }: {
      alignmentId: string;
      changes: Array<{ occurrenceId: string; selected: boolean }>;
    }) =>
      request<{ entries: TextVocabularyEntryDto[] }>(`/admin/lessons/${lessonId}/texts/${textId}/selection`, {
        method: 'PATCH',
        body: JSON.stringify({ alignmentId, changes }),
      }),
    onSuccess: invalidateSelectionState,
  });

  const setTranslations = useMutation({
    mutationFn: ({
      entryId,
      translations,
    }: {
      entryId: string;
      translations: Array<{ languageCode: string; translation: string; usageExample?: string }>;
    }) =>
      request<{ entry: TextVocabularyEntryDto }>(
        `/admin/lessons/${lessonId}/texts/${textId}/vocabulary/${entryId}`,
        { method: 'PATCH', body: JSON.stringify({ translations }) },
      ),
    onSuccess: invalidateSelectionState,
  });

  const requestClipJob = useMutation({
    mutationFn: ({
      narrationId,
      alignmentId,
      occurrenceIds,
    }: {
      narrationId: string;
      alignmentId: string;
      occurrenceIds: string[];
    }) =>
      request<{ job: AudioJob; replay: boolean }>(`/admin/lessons/${lessonId}/texts/${textId}/clip-jobs`, {
        method: 'POST',
        headers: { 'Idempotency-Key': createIdempotencyKey() },
        body: JSON.stringify({ narrationId, alignmentId, occurrenceIds }),
      }),
  });

  const approveRelease = useMutation({
    mutationFn: ({
      contentRevisionId,
      narrationId,
      alignmentId,
    }: {
      contentRevisionId: string;
      narrationId: string;
      alignmentId: string;
    }) =>
      request<{ release: { id: string } }>(`/admin/lessons/${lessonId}/texts/${textId}/releases`, {
        method: 'POST',
        body: JSON.stringify({ contentRevisionId, narrationId, alignmentId }),
      }),
    onSuccess: invalidateWorkspace,
  });

  return {
    saveContentRevision,
    requestNarrationJob,
    setSelection,
    setTranslations,
    requestClipJob,
    approveRelease,
  };
}
