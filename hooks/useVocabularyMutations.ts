'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  BulkDeleteResult,
  BulkImportResult,
  BulkImportRow,
  VocabularyEntry,
  VocabularyTranslation,
} from '../lib/apiTypes';
import { useApiClient } from './useApiClient';

type CreateEntryInput = {
  englishText: string;
  kind: VocabularyEntry['kind'];
  notes?: string;
  tags?: string[];
};

type UpdateEntryInput = {
  entryId: string;
  data: Partial<CreateEntryInput>;
};

type TranslationInput = {
  entryId: string;
  languageCode: string;
  translation: string;
  usageExample?: string;
};

type DeleteTranslationInput = {
  entryId: string;
  translationId: string;
};

export const useVocabularyMutations = () => {
  const { request } = useApiClient();
  const queryClient = useQueryClient();

  const invalidate = (entryId?: string) => {
    queryClient.invalidateQueries({ queryKey: ['vocabulary'] });
    if (entryId) queryClient.invalidateQueries({ queryKey: ['vocabulary', entryId] });
  };

  const createEntry = useMutation({
    mutationFn: (payload: CreateEntryInput) =>
      request<{ entry: VocabularyEntry }>('/vocabulary', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => invalidate(),
  });

  const updateEntry = useMutation({
    mutationFn: ({ entryId, data }: UpdateEntryInput) =>
      request<{ entry: VocabularyEntry }>(`/vocabulary/${entryId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, vars) => invalidate(vars.entryId),
  });

  const deleteEntry = useMutation({
    mutationFn: (entryId: string) =>
      request<void>(`/vocabulary/${entryId}`, { method: 'DELETE' }),
    onSuccess: () => invalidate(),
  });

  const addTranslation = useMutation({
    mutationFn: (payload: TranslationInput) =>
      request<{ translation: VocabularyTranslation }>(
        `/vocabulary/${payload.entryId}/translations`,
        { method: 'POST', body: JSON.stringify(payload) },
      ),
    onSuccess: (_data, vars) => invalidate(vars.entryId),
  });

  const deleteTranslation = useMutation({
    mutationFn: ({ entryId, translationId }: DeleteTranslationInput) =>
      request<void>(`/vocabulary/${entryId}/translations/${translationId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_data, vars) => invalidate(vars.entryId),
  });

  const bulkImport = useMutation({
    mutationFn: (input: { targetLanguageCode: string; rows: BulkImportRow[] }) =>
      request<BulkImportResult>('/vocabulary/bulk-import', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => invalidate(),
  });

  const bulkDelete = useMutation({
    mutationFn: (ids: string[]) =>
      request<BulkDeleteResult>('/vocabulary/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () => invalidate(),
  });

  const deleteAll = useMutation({
    mutationFn: () =>
      request<BulkDeleteResult>('/vocabulary/all', {
        method: 'DELETE',
      }),
    onSuccess: () => invalidate(),
  });

  return {
    createEntry,
    updateEntry,
    deleteEntry,
    addTranslation,
    deleteTranslation,
    bulkImport,
    bulkDelete,
    deleteAll,
  };
};
