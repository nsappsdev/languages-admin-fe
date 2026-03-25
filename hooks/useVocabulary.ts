'use client';

import { useQuery } from '@tanstack/react-query';
import { VocabularyEntry } from '../lib/apiTypes';
import { useApiClient } from './useApiClient';

type UseVocabularyOptions = {
  page?: number;
  pageSize?: number;
};

export const useVocabulary = (options: UseVocabularyOptions = {}) => {
  const { request } = useApiClient();
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 10;

  return useQuery({
    queryKey: ['vocabulary', page, pageSize],
    queryFn: () =>
      request<{
        entries: VocabularyEntry[];
        page: number;
        pageSize: number;
        total: number;
        pageCount: number;
      }>(`/vocabulary?page=${page}&pageSize=${pageSize}`),
  });
};

export const useVocabularyEntry = (entryId?: string) => {
  const { request } = useApiClient();
  return useQuery({
    queryKey: ['vocabulary', entryId],
    queryFn: () => request<{ entry: VocabularyEntry }>(`/vocabulary/${entryId}`),
    enabled: Boolean(entryId),
  });
};
