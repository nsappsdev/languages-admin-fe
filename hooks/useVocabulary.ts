'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { VocabularyEntry, VocabularyKind } from '../lib/apiTypes';
import { useApiClient } from './useApiClient';

export type VocabularyTranslatedFilter = 'translated' | 'untranslated';

type UseVocabularyOptions = {
  page?: number;
  pageSize?: number;
  q?: string;
  kind?: VocabularyKind;
  tag?: string;
  translated?: VocabularyTranslatedFilter;
  lang?: string;
};

export const useVocabulary = (options: UseVocabularyOptions = {}) => {
  const { request } = useApiClient();
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 25;
  const q = options.q?.trim() ?? '';
  const kind = options.kind;
  const tag = options.tag?.trim() ?? '';
  const translated = options.translated;
  const lang = options.lang?.trim() ?? '';

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  if (q) params.set('q', q);
  if (kind) params.set('kind', kind);
  if (tag) params.set('tag', tag);
  if (translated) params.set('translated', translated);
  if (lang) params.set('lang', lang);

  return useQuery({
    queryKey: ['vocabulary', page, pageSize, q, kind ?? '', tag, translated ?? '', lang],
    queryFn: () =>
      request<{
        entries: VocabularyEntry[];
        page: number;
        pageSize: number;
        total: number;
        pageCount: number;
      }>(`/vocabulary?${params.toString()}`),
    placeholderData: keepPreviousData,
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
