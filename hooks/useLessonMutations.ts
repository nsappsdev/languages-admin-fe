'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LessonSummary } from '../lib/apiTypes';
import { useApiClient } from './useApiClient';

export const useLessonMutations = () => {
  const { request } = useApiClient();
  const queries = useQueryClient();
  const invalidate = async (lessonId: string) => {
    await Promise.all([
      queries.invalidateQueries({ queryKey: ['lessons'] }),
      queries.invalidateQueries({ queryKey: ['lesson', lessonId] }),
    ]);
  };
  const updateLesson = useMutation({
    mutationFn: ({ lessonId, data }: { lessonId: string; data: { title?: string; description?: string; items?: { id: string }[] } }) =>
      request<{ lesson: LessonSummary }>(`/lessons/${lessonId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: (_data, variables) => invalidate(variables.lessonId),
  });
  const createItem = useMutation({
    mutationFn: ({ lessonId, text }: { lessonId: string; text: string }) =>
      request<{ item: { id: string } }>(`/lessons/${lessonId}/items`, { method: 'POST', body: JSON.stringify({ text }) }),
    onSuccess: (_data, variables) => invalidate(variables.lessonId),
  });
  return { updateLesson, createItem };
};
