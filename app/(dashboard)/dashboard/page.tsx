'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useAnalytics } from '../../../hooks/useAnalytics';

export default function DashboardPage() {
  const { data, isLoading, error } = useAnalytics();
  const stats = data?.stats;

  const cards = [
    {
      label: 'Total Lessons',
      value: stats ? stats.totalLessons.toString() : '—',
      change: stats ? `${stats.draftLessons} draft${stats.draftLessons === 1 ? '' : 's'}` : 'Loading…',
    },
    {
      label: 'Published Lessons',
      value: stats ? stats.publishedLessons.toString() : '—',
      change: stats?.latestPublishedLesson
        ? `Last: ${stats.latestPublishedLesson.title}`
        : 'No published lessons',
    },
    {
      label: 'Avg Items / Lesson',
      value: stats ? stats.avgItemsPerLesson.toString() : '—',
      change: stats ? `${stats.totalItems} items total` : 'Loading…',
    },
  ];

  const activityRows = useMemo(() => {
    if (isLoading) {
      return <p className="text-sm text-slate-500">Loading analytics…</p>;
    }
    if (error) {
      return <p className="text-sm text-rose-600">{error.message}</p>;
    }
    if (!stats?.latestPublishedLesson) {
      return <p className="text-sm text-slate-500">No recent published lessons.</p>;
    }
    const last = stats.latestPublishedLesson;
    return (
      <div className="flex items-center justify-between border-b border-slate-100 py-3 last:border-b-0">
        <div>
          <p className="font-medium text-slate-900">{last.title}</p>
          <p className="text-sm text-slate-500">
            Published {new Date(last.publishedAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    );
  }, [error, isLoading, stats]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
            <p className="text-xs sm:text-sm text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl sm:text-3xl font-semibold text-slate-900">{card.value}</p>
            <p className="text-xs text-slate-500">{card.change}</p>
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Recent Lesson Activity</h2>
          <Link
            href="/dashboard/lessons"
            className="text-sm text-brand-600 hover:text-brand-500"
          >
            View lessons
          </Link>
        </div>
        <div className="mt-4">{activityRows}</div>
      </section>
    </div>
  );
}
