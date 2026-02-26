'use client';

import { useQuery } from '@tanstack/react-query';
import { LearnerProgressSummaryResponse } from '../lib/apiTypes';
import { useApiClient } from './useApiClient';

export const useLearnerProgressSummary = (learnerId: string) => {
  const { request } = useApiClient();
  return useQuery({
    queryKey: ['learners', learnerId, 'progress-summary'],
    queryFn: () =>
      request<LearnerProgressSummaryResponse>(`/learners/${learnerId}/progress-summary`),
    enabled: Boolean(learnerId),
  });
};
