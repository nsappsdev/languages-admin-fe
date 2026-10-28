'use client';
import { useQuery } from '@tanstack/react-query';
import { useApiClient } from './useApiClient';
import type { ReaderFont } from '../lib/apiTypes';

export function useReaderFonts() {
  const { request } = useApiClient();
  return useQuery({ queryKey: ['reader-fonts'], queryFn: () => request<{ fonts: ReaderFont[] }>('/admin/reader-fonts') });
}
