'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { useApiClient } from '../../../../../hooks/useApiClient';
import { LessonItem, LessonStatus } from '../../../../../lib/apiTypes';

type EditableItem = Pick<LessonItem, 'id' | 'lessonId' | 'text' | 'audioUrl' | 'order'> & {
  localId: string;
};

const LESSON_STATUSES: LessonStatus[] = ['DRAFT', 'PUBLISHED'];

const smallNeutralButtonClass =
  'inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

const smallDangerButtonClass =
  'inline-flex items-center justify-center rounded-md border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50';

const createLocalId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const createItem = (order: number): EditableItem => ({
  id: createLocalId(),
  lessonId: '',
  localId: createLocalId(),
  text: '',
  audioUrl: '',
  order,
});

export default function NewLessonPage() {
  const router = useRouter();
  const { request } = useApiClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<LessonStatus>('DRAFT');
  const [items, setItems] = useState<EditableItem[]>([createItem(0)]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => left.order - right.order),
    [items],
  );

  const normalizeItems = (currentItems: EditableItem[]): EditableItem[] =>
    currentItems.map((item, index): EditableItem => ({
      ...item,
      order: index,
    }));

  const updateItem = (localId: string, updater: (item: EditableItem) => EditableItem) => {
    setItems((prev) => prev.map((item) => (item.localId === localId ? updater(item) : item)));
  };

  const moveItem = (localId: string, direction: 'up' | 'down') => {
    setItems((prev) => {
      const currentIndex = prev.findIndex((item) => item.localId === localId);
      if (currentIndex === -1) return prev;
      const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const reordered = [...prev];
      const [moved] = reordered.splice(currentIndex, 1);
      reordered.splice(nextIndex, 0, moved);
      return reordered.map((item, index) => ({ ...item, order: index }));
    });
  };

  const addItem = () => {
    setItems((prev) => [...prev, createItem(prev.length)]);
  };

  const removeItem = (localId: string) => {
    setItems((prev) =>
      prev
        .filter((item) => item.localId !== localId)
        .map((item, index) => ({ ...item, order: index })),
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const normalizedItems = normalizeItems(sortedItems);
    const hasInvalidItems =
      normalizedItems.length < 1 || normalizedItems.some((item) => item.text.trim().length < 1);

    if (hasInvalidItems) {
      setError('Add at least one lesson item with text before creating the lesson.');
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = await request<{ lesson: { id: string } }>('/lessons', {
        method: 'POST',
        body: JSON.stringify({
          title,
          description,
          status,
          items: normalizedItems.map((item, index) => ({
            id: item.id,
            text: item.text,
            audioUrl: item.audioUrl,
            order: index,
            segments: buildCreateSegments(item, index),
            wordTimings: [],
            sentenceTimings: [],
          })),
        }),
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
        <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Create Lesson</h1>
        <p className="text-xs text-slate-500 sm:text-sm">Draft a new lesson for learners.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.68fr)]">
        <form
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
          onSubmit={handleSubmit}
        >
          <div>
            <label htmlFor="lesson-title" className="block text-sm font-medium text-slate-700">
              Title
            </label>
            <input
              id="lesson-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="lesson-description" className="block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              id="lesson-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows={4}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Status</label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {LESSON_STATUSES.map((value) => {
                const isActive = status === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatus(value)}
                    className={[
                      'flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition',
                      isActive
                        ? 'border-brand-600 bg-brand-50 text-brand-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'h-2.5 w-2.5 rounded-full border',
                        isActive ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-transparent',
                      ].join(' ')}
                    />
                    {value === 'DRAFT' ? 'Draft' : 'Published'}
                  </button>
                );
              })}
            </div>
          </div>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting ? 'Creating…' : 'Create lesson'}
          </button>
        </form>

        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Lesson Items</h2>
              <p className="text-xs text-slate-500">
                Add lesson text. Audio and AI timings can be generated after the lesson is created.
              </p>
            </div>
            <button
              type="button"
              onClick={addItem}
              className="inline-flex items-center justify-center rounded-lg border border-brand-200 bg-white px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50"
            >
              + Add item
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {sortedItems.map((item, index) => (
              <div
                key={item.localId}
                className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <p className="text-sm font-semibold text-slate-900">#{index + 1}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => moveItem(item.localId, 'up')}
                      className={smallNeutralButtonClass}
                      disabled={index === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(item.localId, 'down')}
                      className={smallNeutralButtonClass}
                      disabled={index === sortedItems.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.localId)}
                      className={smallDangerButtonClass}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor={`lesson-item-text-${item.localId}`}
                    className="block text-xs font-medium text-slate-500"
                  >
                    Text
                  </label>
                  <textarea
                    id={`lesson-item-text-${item.localId}`}
                    value={item.text}
                    onChange={(e) =>
                      updateItem(item.localId, (current) => ({
                        ...current,
                        text: e.target.value,
                      }))
                    }
                    className="mt-1 min-h-36 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    rows={5}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function buildCreateSegments(item: EditableItem, itemIndex: number): LessonItem['segments'] {
  return [
    {
      id: `segment-${itemIndex + 1}`,
      text: item.text.trim(),
      startMs: 0,
      endMs: 1000,
    },
  ];
}
