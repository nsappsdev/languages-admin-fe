'use client';

import { useQuery } from '@tanstack/react-query';
import { useApiClient } from './useApiClient';
import { AudioJob } from '../lib/textAuthoringTypes';

const POLL_INTERVAL_MS = 1500;
const ACTIVE_STATUSES = new Set(['QUEUED', 'RUNNING']);

/**
 * Polls job status while QUEUED/RUNNING and stops automatically once the
 * job reaches a terminal state, so a page left open doesn't poll forever
 * and a reload can resume polling by id alone (plan §9 Phase 5 packet:
 * "resume poll after reload").
 */
export function useAudioJob(jobId: string | null) {
  const { request } = useApiClient();
  return useQuery({
    queryKey: ['audio-job', jobId],
    queryFn: () => request<{ job: AudioJob }>(`/admin/audio-jobs/${jobId}`),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = query.state.data?.job.status;
      return status && ACTIVE_STATUSES.has(status) ? POLL_INTERVAL_MS : false;
    },
  });
}
