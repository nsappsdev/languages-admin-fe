'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BulkAiTranslationResult,
  BulkDeleteResult,
  BulkImportResult,
  BulkImportRow,
  VocabularyEntry,
  VocabularyKind,
} from '../lib/apiTypes';
import { useApiClient } from './useApiClient';

type LessonVocabularyInput = {
  englishText: string;
  kind?: VocabularyKind;
  sourceItemId?: string | null;
  order?: number;
  notes?: string | null;
  tags?: string[];
  translations?: Array<{
    languageCode: string;
    translation: string;
    usageExample?: string;
  }>;
};

export const useLessonVocabularyMutations = () => {
  const { request } = useApiClient();
  const queryClient = useQueryClient();

  const invalidate = (lessonId: string) => {
    queryClient.invalidateQueries({ queryKey: ['lesson', lessonId] });
    queryClient.invalidateQueries({ queryKey: ['lessonVocabulary', lessonId] });
  };

  const createEntry = useMutation({
    mutationFn: ({ lessonId, data }: { lessonId: string; data: LessonVocabularyInput }) =>
      request<{ entry: VocabularyEntry }>(`/lessons/${lessonId}/vocabulary`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, vars) => invalidate(vars.lessonId),
  });

  const updateEntry = useMutation({
    mutationFn: ({
      lessonId,
      entryId,
      data,
    }: {
      lessonId: string;
      entryId: string;
      data: Partial<LessonVocabularyInput>;
    }) =>
      request<{ entry: VocabularyEntry }>(`/lessons/${lessonId}/vocabulary/${entryId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, vars) => invalidate(vars.lessonId),
  });

  const deleteEntry = useMutation({
    mutationFn: ({ lessonId, entryId }: { lessonId: string; entryId: string }) =>
      request<void>(`/lessons/${lessonId}/vocabulary/${entryId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_data, vars) => invalidate(vars.lessonId),
  });

  const bulkDeleteEntries = useMutation({
    mutationFn: ({ lessonId, ids }: { lessonId: string; ids: string[] }) =>
      request<BulkDeleteResult>(`/lessons/${lessonId}/vocabulary/bulk-delete`, {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
    onSuccess: (_data, vars) => invalidate(vars.lessonId),
  });

  const importEntries = useMutation({
    mutationFn: ({
      lessonId,
      targetLanguageCode,
      rows,
    }: {
      lessonId: string;
      targetLanguageCode: string;
      rows: BulkImportRow[];
    }) =>
      request<BulkImportResult>(`/lessons/${lessonId}/vocabulary/import`, {
        method: 'POST',
        body: JSON.stringify({ targetLanguageCode, rows }),
      }),
    onSuccess: (_data, vars) => invalidate(vars.lessonId),
  });

  const generateAiTranslations = useMutation({
    mutationFn: ({
      lessonId,
      entryIds,
      targetLanguageCode = 'am',
    }: {
      lessonId: string;
      entryIds?: string[];
      targetLanguageCode?: string;
    }) => {
      const body = {
        targetLanguageCode,
        ...(entryIds?.length ? { entryIds } : {}),
      };
      return request<BulkAiTranslationResult>(`/lessons/${lessonId}/vocabulary/ai-translations`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_data, vars) => invalidate(vars.lessonId),
  });

  return {
    bulkDeleteEntries,
    createEntry,
    deleteEntry,
    generateAiTranslations,
    importEntries,
    updateEntry,
  };
};
