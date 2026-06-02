'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GeneratedLessonTimings,
  LessonItem,
  LessonStatus,
  LessonSummary,
  UploadedAudioFile,
} from '../lib/apiTypes';
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
      wordTimings?: LessonItem['wordTimings'];
      sentenceTimings?: LessonItem['sentenceTimings'];
      chunkTimings?: LessonItem['chunkTimings'];
    }>;
  };
};

type CreateItemInput = {
  lessonId: string;
  text: string;
  audioUrl: string;
  order?: number;
  segments: LessonItem['segments'];
  wordTimings?: LessonItem['wordTimings'];
  sentenceTimings?: LessonItem['sentenceTimings'];
  chunkTimings?: LessonItem['chunkTimings'];
};

type DeleteItemInput = { lessonId: string; itemId: string };
type DeleteLessonInput = { lessonId: string };
type UploadLessonAudioInput = { file: File; lessonItemId?: string };
type DeleteLessonAudioInput = { lessonItemId?: string; audioUrl: string };
type GenerateLessonItemTimingsInput = { lessonId: string; itemId: string; text: string };
type UpdateLessonSegmentTimingsInput = {
  lessonId: string;
  itemId: string;
  segmentId: string;
  segment: LessonItem['segments'][number];
  wordTimings: LessonItem['wordTimings'];
  chunkTimings: LessonItem['chunkTimings'];
};

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
      queryClient.invalidateQueries({ queryKey: ['lessons'] });
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

  const updateLessonSegmentTimings = useMutation({
    mutationFn: ({
      lessonId,
      itemId,
      segmentId,
      segment,
      wordTimings,
      chunkTimings,
    }: UpdateLessonSegmentTimingsInput) =>
      request<{ item: LessonItem }>(
        `/lessons/${lessonId}/items/${itemId}/segments/${segmentId}/timings`,
        {
          method: 'PATCH',
          body: JSON.stringify({ segment, wordTimings, chunkTimings }),
        },
      ),
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

  const generateLessonItemTimings = useMutation({
    mutationFn: ({ lessonId, itemId, text }: GenerateLessonItemTimingsInput) =>
      request<{ timings: GeneratedLessonTimings }>(
        `/lessons/${lessonId}/items/${itemId}/transcribe-timings`,
        {
          method: 'POST',
          body: JSON.stringify({ text }),
        },
      ),
  });

  return {
    updateLesson,
    createItem,
    deleteItem,
    deleteLesson,
    updateLessonSegmentTimings,
    uploadLessonAudio,
    deleteLessonAudio,
    generateLessonItemTimings,
  };
};
