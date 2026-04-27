'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLearnerProgressSummary } from '../../../../../hooks/useLearnerProgressSummary';

export default function LearnerProgressPage() {
  const params = useParams<{ learnerId: string }>();
  const learnerId = params?.learnerId ?? '';
  const { data, isLoading, error } = useLearnerProgressSummary(learnerId);

  if (isLoading) {
    return <p className="text-sm text-slate-500">Loading learner progress…</p>;
  }

  if (error) {
    return <p className="text-sm text-rose-600">Failed to load learner progress: {error.message}</p>;
  }

  if (!data) {
    return <p className="text-sm text-slate-500">No learner data found.</p>;
  }

  const { learner, lessonSummaries } = data;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/dashboard/learners" className="text-sm text-brand-600">
          ← Back to learners
        </Link>
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 truncate">{learner.name}</h1>
        <p className="text-xs sm:text-sm text-slate-500 truncate">{learner.email}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
          <p className="text-sm text-slate-500">Progress Events</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{learner.progressEvents}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
          <p className="text-sm text-slate-500">Saved Vocabulary</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{learner.vocabularySaved}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
          <p className="text-sm text-slate-500">Active Lessons</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{lessonSummaries.length}</p>
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Per-Lesson Progress</h2>
        {lessonSummaries.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No progress events yet for this learner.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Lesson</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium">Items Started</th>
                  <th className="py-2 pr-3 font-medium">Items Completed</th>
                  <th className="py-2 pr-3 font-medium">Best Completion</th>
                  <th className="py-2 pr-3 font-medium">Last Completion</th>
                  <th className="py-2 font-medium">Last Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lessonSummaries.map((summary) => {
                  return (
                    <tr key={summary.lessonId} className="text-slate-700">
                      <td className="py-3 pr-3 font-medium text-slate-900">
                        {summary.lessonTitle ?? summary.lessonId}
                      </td>
                      <td className="py-3 pr-3">{summary.lessonStatus ?? 'Unknown'}</td>
                      <td className="py-3 pr-3">{summary.itemsStarted}</td>
                      <td className="py-3 pr-3">{summary.itemsCompleted}</td>
                      <td className="py-3 pr-3">
                        {summary.bestCompletion === null ? '—' : `${summary.bestCompletion}%`}
                      </td>
                      <td className="py-3 pr-3">
                        {summary.lastCompletion === null ? '—' : `${summary.lastCompletion}%`}
                      </td>
                      <td className="py-3">
                        {new Date(summary.lastActivityAt).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
