'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LessonItem, LessonStatus, LessonSummary, UploadedAudioFile } from '../lib/apiTypes';
import { useApiClient } from './useApiClient';

type UpdateLessonInput = {
  lessonId: string;
  data: Partial<Pick<LessonSummary, 'title' | 'description' | 'status'>> & {
    items?: Array<{
      id?: string;
      text: string;
      audioUrl: string;
      order?: number;
      segments: LessonItem['segments'];
    }>;
  };
};

type CreateItemInput = {
  lessonId: string;
  text: string;
  audioUrl: string;
  order?: number;
  segments: LessonItem['segments'];
};

type DeleteItemInput = { lessonId: string; itemId: string };
type DeleteLessonInput = { lessonId: string };
type UploadLessonAudioInput = { file: File; lessonItemId?: string };
type DeleteLessonAudioInput = { lessonItemId?: string; audioUrl: string };

export const useLessonMutations = () => {
  const { request } = useApiClient();
  const queryClient = useQueryClient();

  const invalidate = (lessonId: string) => {
    queryClient.invalidateQueries({ queryKey: ['lessons'] });
    queryClient.invalidateQueries({ queryKey: ['lesson', lessonId] });
  };

  const updateLesson = useMutation({
    mutationFn: ({ lessonId, data }: UpdateLessonInput) =>
      request<{ lesson: LessonSummary }>(`/lessons/${lessonId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      invalidate(variables.lessonId);
    },
  });

  const createItem = useMutation({
    mutationFn: ({ lessonId, ...data }: CreateItemInput) =>
      request<{ item: { id: string } }>(`/lessons/${lessonId}/items`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_data, variables) => {
      invalidate(variables.lessonId);
    },
  });

  const deleteItem = useMutation({
    mutationFn: ({ lessonId, itemId }: DeleteItemInput) =>
      request<void>(`/lessons/${lessonId}/items/${itemId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_data, variables) => {
      invalidate(variables.lessonId);
    },
  });

  const deleteLesson = useMutation({
    mutationFn: ({ lessonId }: DeleteLessonInput) =>
      request<void>(`/lessons/${lessonId}`, { method: 'DELETE' }),
    onSuccess: (_data, variables) => {
      invalidate(variables.lessonId);
    },
  });

  const uploadLessonAudio = useMutation({
    mutationFn: async ({ file, lessonItemId }: UploadLessonAudioInput) => {
      const formData = new FormData();
      formData.append('file', file);
      if (lessonItemId) {
        formData.append('lessonItemId', lessonItemId);
      }
      return request<{ file: UploadedAudioFile }>('/media/audio', {
        method: 'POST',
        body: formData,
      });
    },
  });

  const deleteLessonAudio = useMutation({
    mutationFn: ({ lessonItemId, audioUrl }: DeleteLessonAudioInput) =>
      request<void>('/media/audio', {
        method: 'DELETE',
        body: JSON.stringify({ lessonItemId, audioUrl }),
      }),
  });

  return {
    updateLesson,
    createItem,
    deleteItem,
    deleteLesson,
    uploadLessonAudio,
    deleteLessonAudio,
  };
};
