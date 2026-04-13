'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AppSettings } from '../lib/apiTypes';
import { useApiClient } from './useApiClient';

type UpdateSettingsInput = Partial<
  Pick<
    AppSettings,
    | 'unknownWordRepetitions'
    | 'mainTextFontFamily'
    | 'mainTextFontSize'
    | 'translationFontFamily'
    | 'translationFontSize'
  >
>;

export const useSettingsMutations = () => {
  const { request } = useApiClient();
  const queryClient = useQueryClient();

  const updateSettings = useMutation({
    mutationFn: (data: UpdateSettingsInput) =>
      request<{ settings: AppSettings }>('/settings', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });

  return { updateSettings };
};
