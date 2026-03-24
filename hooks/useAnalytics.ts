'use client';

import { useQuery } from '@tanstack/react-query';
import { useApiClient } from './useApiClient';

export interface AnalyticsOverview {
  stats: {
    totalLessons: number;
    publishedLessons: number;
    draftLessons: number;
    totalItems: number;
    avgItemsPerLesson: number;
    latestPublishedLesson: { title: string; publishedAt: string } | null;
  };
}

export const useAnalytics = () => {
  const { request } = useApiClient();
  return useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: () => request<AnalyticsOverview>('/analytics/overview'),
  });
};
