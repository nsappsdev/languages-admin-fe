'use client';

import { useQuery } from '@tanstack/react-query';
import { AppSettings } from '../lib/apiTypes';
import { useApiClient } from './useApiClient';

export const useSettings = () => {
  const { request } = useApiClient();
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => request<{ settings: AppSettings }>('/settings'),
  });
};
