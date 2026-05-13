'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useMemo, useState } from 'react';
import { useApiClient } from '../../../../../hooks/useApiClient';
import { LessonItem, LessonItemSegment, LessonStatus } from '../../../../../lib/apiTypes';

type EditableSegment = LessonItemSegment & { localId: string };
type EditableItem = Omit<
  LessonItem,
  'segments' | 'wordTimings' | 'sentenceTimings'
> & {
  localId: string;
  segments: EditableSegment[];
  wordTimings: LessonItem['wordTimings'];
  sentenceTimings: LessonItem['sentenceTimings'];
};

const LESSON_STATUSES: LessonStatus[] = ['DRAFT', 'PUBLISHED'];

const createLocalId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const createSegment = (startMs = 0, endMs = startMs + 1000): EditableSegment => ({
  id: createLocalId(),
  localId: createLocalId(),
  text: '',
  startMs,
  endMs,
});

const createItem = (order: number): EditableItem => ({
  id: createLocalId(),
  lessonId: '',
  localId: createLocalId(),
  text: '',
  audioUrl: '',
  order,
  segments: [createSegment()],
  wordTimings: [],
  sentenceTimings: [],
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
      segments: item.segments.map((segment): EditableSegment => ({
        id: segment.id,
        localId: segment.localId,
        text: segment.text,
        startMs: Number(segment.startMs),
        endMs: Number(segment.endMs),
      })),
      wordTimings: item.wordTimings,
      sentenceTimings: item.sentenceTimings,
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

  const addSegment = (itemLocalId: string) => {
    updateItem(itemLocalId, (item) => {
      const lastSegment = item.segments[item.segments.length - 1];
      const startMs = Number.isFinite(lastSegment?.endMs) ? Number(lastSegment?.endMs) : 0;
      return {
        ...item,
        segments: [...item.segments, createSegment(startMs)],
      };
    });
  };

  const removeSegment = (itemLocalId: string, segmentLocalId: string) => {
    updateItem(itemLocalId, (item) => ({
      ...item,
      segments: item.segments.filter((segment) => segment.localId !== segmentLocalId),
    }));
  };

  const initializeItemSegments = (itemLocalId: string) => {
    const currentItem = items.find((item) => item.localId === itemLocalId);
    if (!currentItem) return;

    const segments = buildSentenceSegments(currentItem);
    if (!segments.length) {
      setError('Add item text before initializing whole-text timings.');
      return;
    }

    updateItem(itemLocalId, (item) => ({
      ...item,
      segments,
      wordTimings: [],
      sentenceTimings: [],
    }));
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const normalizedItems = normalizeItems(sortedItems);
    const hasInvalidItems = normalizedItems.some(
      (item) =>
        item.text.trim().length < 1 ||
        item.segments.length < 1 ||
        item.segments.some(
          (segment) =>
            segment.text.trim().length < 1 ||
            Number.isNaN(segment.startMs) ||
            Number.isNaN(segment.endMs) ||
            segment.endMs <= segment.startMs,
        ),
    );

    if (hasInvalidItems) {
      setError('Each item needs text and valid phrase timings before the lesson can be created.');
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
            segments: item.segments.map(({ id, text, startMs, endMs }) => ({
              id,
              text,
              startMs,
              endMs,
            })),
            wordTimings: item.wordTimings,
            sentenceTimings: item.sentenceTimings,
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
                Add the lesson text and phrase timings before you create the lesson.
              </p>
            </div>
            <button
              type="button"
              onClick={addItem}
              className="rounded-lg border border-brand-200 px-3 py-2 text-xs font-semibold text-brand-600"
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
                      className="text-xs text-slate-500"
                      disabled={index === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(item.localId, 'down')}
                      className="text-xs text-slate-500"
                      disabled={index === sortedItems.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(item.localId)}
                      className="text-xs text-rose-600"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500">Text</label>
                  <textarea
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

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium text-slate-500">Phrase Timings</label>
                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => initializeItemSegments(item.localId)}
                        className="text-xs font-semibold text-brand-600"
                      >
                        Initialize whole text
                      </button>
                      <button
                        type="button"
                        onClick={() => addSegment(item.localId)}
                        className="text-xs font-semibold text-brand-600"
                      >
                        + Add phrase
                      </button>
                    </div>
                  </div>

                  {item.segments.map((segment) => (
                    <div
                      key={segment.localId}
                      className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <p className="text-xs font-medium text-slate-500">Segment</p>
                        {item.segments.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeSegment(item.localId, segment.localId)}
                            className="text-xs text-rose-600"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      <textarea
                        value={segment.text}
                        onChange={(e) =>
                          updateItem(item.localId, (current) => ({
                            ...current,
                            segments: current.segments.map((entry) =>
                              entry.localId === segment.localId
                                ? { ...entry, text: e.target.value }
                                : entry,
                            ),
                          }))
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                        rows={2}
                        placeholder="Phrase text"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-medium text-slate-500">Start (ms)</label>
                          <input
                            type="number"
                            min={0}
                            value={segment.startMs}
                            onChange={(e) =>
                              updateItem(item.localId, (current) => ({
                                ...current,
                                segments: current.segments.map((entry) =>
                                  entry.localId === segment.localId
                                    ? { ...entry, startMs: Number(e.target.value) }
                                    : entry,
                                ),
                              }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-500">End (ms)</label>
                          <input
                            type="number"
                            min={1}
                            value={segment.endMs}
                            onChange={(e) =>
                              updateItem(item.localId, (current) => ({
                                ...current,
                                segments: current.segments.map((entry) =>
                                  entry.localId === segment.localId
                                    ? { ...entry, endMs: Number(e.target.value) }
                                    : entry,
                                ),
                              }))
                            }
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function buildSentenceSegments(item: EditableItem): EditableSegment[] {
  const sentenceParts = splitTextIntoSentences(item.text);
  if (!sentenceParts.length) {
    return [];
  }

  const timingWindow = getItemTimingWindow(item, sentenceParts.length);
  const segments: EditableSegment[] = [];
  let previousEndMs = timingWindow.startMs;

  sentenceParts.forEach((part, index) => {
    const startMs = index === 0 ? timingWindow.startMs : previousEndMs;
    const estimatedEndMs =
      index === sentenceParts.length - 1
        ? timingWindow.endMs
        : estimateMsFromTextOffsetInWindow(
            item.text,
            part.end,
            timingWindow.startMs,
            timingWindow.endMs,
          );
    const endMs = Math.min(
      timingWindow.endMs,
      Math.max(startMs + 100, estimatedEndMs),
    );

    segments.push({
      id: createLocalId(),
      localId: createLocalId(),
      text: part.text,
      startMs,
      endMs,
    });
    previousEndMs = endMs;
  });

  return segments;
}

function splitTextIntoSentences(value: string): Array<{ text: string; start: number; end: number }> {
  const sentences: Array<{ text: string; start: number; end: number }> = [];
  const matcher = /[^.!?]+(?:[.!?]+|$)/g;

  for (const match of value.matchAll(matcher)) {
    const rawText = match[0] ?? '';
    const rawStart = match.index ?? 0;
    const leadingWhitespace = rawText.match(/^\s*/)?.[0].length ?? 0;
    const trailingWhitespace = rawText.match(/\s*$/)?.[0].length ?? 0;
    const start = rawStart + leadingWhitespace;
    const end = rawStart + rawText.length - trailingWhitespace;
    const text = value.slice(start, end).trim();
    if (text) {
      sentences.push({ text, start, end });
    }
  }

  if (sentences.length) {
    return sentences;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  const start = value.indexOf(trimmed);
  return [{ text: trimmed, start, end: start + trimmed.length }];
}

function getItemTimingWindow(
  item: EditableItem,
  sentenceCount: number,
): { startMs: number; endMs: number } {
  const validSegments = item.segments.filter(
    (segment) =>
      Number.isFinite(segment.startMs) &&
      Number.isFinite(segment.endMs) &&
      segment.endMs > segment.startMs,
  );
  const hasOnlyDefaultEmptySegment =
    validSegments.length === 1 &&
    item.segments.length === 1 &&
    !item.segments[0]?.text.trim() &&
    validSegments[0]?.startMs === 0 &&
    validSegments[0]?.endMs === 1000;

  if (validSegments.length && !hasOnlyDefaultEmptySegment) {
    const startMs = Math.min(...validSegments.map((segment) => segment.startMs));
    const endMs = Math.max(...validSegments.map((segment) => segment.endMs));
    if (endMs > startMs) {
      return { startMs, endMs };
    }
  }

  return {
    startMs: 0,
    endMs: Math.max(1000, sentenceCount * 3000),
  };
}

function estimateMsFromTextOffsetInWindow(
  text: string,
  offset: number,
  startMs: number,
  endMs: number,
) {
  const ratio = getSpeechOffsetRatio(text, offset);
  return Math.min(
    endMs,
    Math.max(startMs, startMs + Math.floor((endMs - startMs) * ratio)),
  );
}

function getSpeechOffsetRatio(text: string, offset: number) {
  const boundedOffset = Math.min(Math.max(offset, 0), text.length);
  const totalWeight = getSpeechWeight(text);
  if (totalWeight <= 0) {
    const textLength = Math.max(text.length, 1);
    return Math.min(Math.max(boundedOffset / textLength, 0), 1);
  }

  return Math.min(Math.max(getSpeechWeight(text.slice(0, boundedOffset)) / totalWeight, 0), 1);
}

function getSpeechWeight(value: string) {
  const matches = value.match(/[A-Za-z0-9']+/g);
  if (!matches?.length) {
    return value.trim().length;
  }

  return matches.reduce((sum, part) => sum + part.length, 0);
}
