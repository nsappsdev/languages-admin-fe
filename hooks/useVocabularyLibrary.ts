'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from './useApiClient';
import { LibrarySearch, LibraryTerm } from '../lib/vocabularyLibraryTypes';

export function useVocabularyLibrary(q: string, page: number) {
  const { request } = useApiClient();
  return useQuery({ queryKey: ['vocabulary-library', q, page], queryFn: () => request<LibrarySearch>(`/admin/vocabulary?${new URLSearchParams({ q, page: String(page) })}`) });
}
export function useVocabularyTerm(id: string) {
  const { request } = useApiClient();
  return useQuery({ queryKey: ['vocabulary-term', id], queryFn: () => request<LibraryTerm>(`/admin/vocabulary/${id}`), enabled: !!id });
}
export function useVocabularyPreference(termId: string) {
  const { request } = useApiClient();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ meaningId, ...body }: { meaningId: string; voiceId: string; recordingId: string | null; expectedRecordingId: string | null }) =>
      request(`/admin/vocabulary/meanings/${meaningId}/preference`, { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['vocabulary-term', termId] }),
  });
}
