'use client';

import { useQuery } from '@tanstack/react-query';
import { LearnerSummary } from '../lib/apiTypes';
import { useApiClient } from './useApiClient';

export const useLearners = () => {
  const { request } = useApiClient();
  return useQuery({
    queryKey: ['learners'],
    queryFn: () => request<{ learners: LearnerSummary[] }>('/learners'),
  });
};
