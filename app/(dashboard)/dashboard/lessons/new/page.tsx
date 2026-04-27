'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApiClient } from '../../../../../hooks/useApiClient';

export default function NewLessonPage() {
  const router = useRouter();
  const { request } = useApiClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const payload = await request<{ lesson: { id: string } }>('/lessons', {
        method: 'POST',
        body: JSON.stringify({ title, description, status }),
      });
      router.push(`/dashboard/lessons/${payload.lesson.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lesson');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Create Lesson</h1>
        <p className="text-xs sm:text-sm text-slate-500">Draft a new lesson for learners.</p>
      </div>
      <form className="space-y-4 rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-slate-700">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={4}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as 'DRAFT' | 'PUBLISHED')}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
        >
          {isSubmitting ? 'Creating…' : 'Create lesson'}
        </button>
      </form>
    </div>
  );
}
