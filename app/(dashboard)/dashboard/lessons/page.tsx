'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useLessons } from '../../../../hooks/useLessons';
import { useLessonMutations } from '../../../../hooks/useLessonMutations';
import { useToast } from '../../../../components/providers/ToastProvider';

export default function LessonsPage() {
  const { data, isLoading, error } = useLessons();
  const { deleteLesson } = useLessonMutations();
  const { notify } = useToast();
  const lessons = data?.lessons ?? [];
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async (lessonId: string) => {
    if (!window.confirm('Delete this lesson? This cannot be undone.')) {
      return;
    }
    setPendingId(lessonId);
    setDeleteError(null);
    try {
      await deleteLesson.mutateAsync({ lessonId });
      notify('Lesson deleted');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete lesson';
      setDeleteError(message);
      notify(message, 'error');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Lessons</h1>
          <p className="text-xs sm:text-sm text-slate-500">Manage text and audio lesson content.</p>
        </div>
        <Link
          href="/dashboard/lessons/new"
          className="shrink-0 rounded-lg bg-brand-600 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white"
        >
          New lesson
        </Link>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
        {deleteError && <p className="mb-3 text-sm text-rose-600">{deleteError}</p>}
        {isLoading ? <p className="text-sm text-slate-500">Loading lessons…</p> : null}
        {!isLoading && error ? (
          <p className="text-sm text-rose-600">Failed to load lessons: {error.message}</p>
        ) : null}
        {!isLoading && !error && !lessons.length ? (
          <p className="text-sm text-slate-500">No lessons yet. Create one to begin.</p>
        ) : null}
        {!isLoading && !error && lessons.length ? (
          <div className="divide-y divide-slate-100">
            {lessons.map((lesson) => (
              <div key={lesson.id} className="flex items-center justify-between py-4">
                <Link href={`/dashboard/lessons/${lesson.id}`} className="flex-1">
                  <p className="text-base font-semibold text-slate-900">{lesson.title}</p>
                  <p className="text-sm text-slate-500">
                    {lesson.items.length} items • {lesson.status}
                  </p>
                </Link>
                <div className="flex items-center gap-3">
                  <Link href={`/dashboard/lessons/${lesson.id}`} className="text-sm text-brand-600">
                    View
                  </Link>
                  <button
                    className="text-sm text-rose-600 disabled:opacity-50"
                    onClick={() => handleDelete(lesson.id)}
                    disabled={pendingId === lesson.id}
                  >
                    {pendingId === lesson.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
