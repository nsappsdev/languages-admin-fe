'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLesson } from '../../../../../hooks/useLesson';
import { useLessonMutations } from '../../../../../hooks/useLessonMutations';
import { useToast } from '../../../../../components/providers/ToastProvider';
import { LessonItem, LessonItemSegment, LessonStatus } from '../../../../../lib/apiTypes';
import { MEDIA_BASE_URL } from '../../../../../lib/config';

const LESSON_STATUSES: LessonStatus[] = ['DRAFT', 'PUBLISHED'];

type EditableSegment = LessonItemSegment & { localId: string };
type EditableItem = Omit<LessonItem, 'segments'> & { localId: string; segments: EditableSegment[] };

const createLocalId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const createSegment = (): EditableSegment => ({
  id: createLocalId(),
  localId: createLocalId(),
  text: '',
  startMs: 0,
  endMs: 1000,
});

const createItem = (lessonId: string, order: number): EditableItem => ({
  id: createLocalId(),
  localId: createLocalId(),
  lessonId,
  text: '',
  audioUrl: '',
  order,
  segments: [createSegment()],
});

const toEditableItem = (item: LessonItem): EditableItem => ({
  ...item,
  localId: item.id,
  segments: item.segments.map((segment) => ({
    ...segment,
    localId: segment.id,
  })),
});

export default function LessonDetailPage() {
  const params = useParams<{ lessonId: string }>();
  const lessonId = params?.lessonId ?? '';
  const { data, isLoading, error } = useLesson(lessonId);
  const lesson = data?.lesson;
  const { updateLesson, uploadLessonAudio, deleteLessonAudio } = useLessonMutations();
  const { notify } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<LessonStatus>('DRAFT');
  const [items, setItems] = useState<EditableItem[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [itemsFeedback, setItemsFeedback] = useState<string | null>(null);
  const [uploadingItemLocalId, setUploadingItemLocalId] = useState<string | null>(null);
  const [deletingItemLocalId, setDeletingItemLocalId] = useState<string | null>(null);

  useEffect(() => {
    if (!lesson) return;
    setTitle(lesson.title);
    setDescription(lesson.description ?? '');
    setStatus(lesson.status);
    setItems(lesson.items.map(toEditableItem));
  }, [lesson]);

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
    }));

  const handleLessonSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lessonId) return;

    setFeedback(null);
    try {
      await updateLesson.mutateAsync({
        lessonId,
        data: { title, description, status },
      });
      setFeedback('Lesson saved');
      notify('Lesson updated');
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Failed to save lesson');
      notify('Failed to save lesson', 'error');
    }
  };

  const handleItemsSave = async () => {
    if (!lessonId) return;

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
      setItemsFeedback('Each item needs text and valid phrase timings. Audio can be uploaded later.');
      return;
    }

    setItemsFeedback('Saving…');
    try {
      await updateLesson.mutateAsync({
        lessonId,
        data: {
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
          })),
        },
      });
      setItems((prev) => normalizeItems(prev));
      setItemsFeedback('Items saved');
      notify('Lesson items updated');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save items';
      setItemsFeedback(message);
      notify(message, 'error');
    }
  };

  const updateItem = (localId: string, updater: (item: EditableItem) => EditableItem) => {
    setItems((prev) =>
      prev.map((item) => (item.localId === localId ? updater(item) : item)),
    );
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
    setItems((prev) => [...prev, createItem(lessonId, prev.length)]);
    setItemsFeedback(null);
  };

  const removeItem = (localId: string) => {
    setItems((prev) =>
      prev
        .filter((item) => item.localId !== localId)
        .map((item, index) => ({ ...item, order: index })),
    );
    setItemsFeedback(null);
  };

  const addSegment = (itemLocalId: string) => {
    updateItem(itemLocalId, (item) => ({
      ...item,
      segments: [...item.segments, createSegment()],
    }));
  };

  const removeSegment = (itemLocalId: string, segmentLocalId: string) => {
    updateItem(itemLocalId, (item) => ({
      ...item,
      segments: item.segments.filter((segment) => segment.localId !== segmentLocalId),
    }));
  };

  const handleAudioUpload = async (itemLocalId: string, file: File) => {
    setUploadingItemLocalId(itemLocalId);
    setItemsFeedback(null);

    try {
      const response = await uploadLessonAudio.mutateAsync({
        file,
        lessonItemId: items.find((item) => item.localId === itemLocalId)?.id,
      });
      updateItem(itemLocalId, (current) => ({
        ...current,
        audioUrl: response.file.audioUrl,
      }));
      setItemsFeedback(`Uploaded ${response.file.originalName}`);
      notify('Audio uploaded');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload audio';
      setItemsFeedback(message);
      notify(message, 'error');
    } finally {
      setUploadingItemLocalId((current) => (current === itemLocalId ? null : current));
    }
  };

  const handleAudioDelete = async (itemLocalId: string, audioUrl: string) => {
    setDeletingItemLocalId(itemLocalId);
    setItemsFeedback(null);

    try {
      await deleteLessonAudio.mutateAsync({
        lessonItemId: items.find((item) => item.localId === itemLocalId)?.id,
        audioUrl,
      });
      updateItem(itemLocalId, (current) => ({
        ...current,
        audioUrl: '',
      }));
      setItemsFeedback('Audio removed. Upload a replacement before saving items.');
      notify('Audio deleted');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete audio';
      setItemsFeedback(message);
      notify(message, 'error');
    } finally {
      setDeletingItemLocalId((current) => (current === itemLocalId ? null : current));
    }
  };

  const renderItemsBody = () => {
    if (isLoading) return <p className="text-sm text-slate-500">Loading lesson…</p>;
    if (error) {
      return <p className="text-sm text-rose-600">Failed to load lesson: {error.message}</p>;
    }
    if (!lesson) {
      return <p className="text-sm text-rose-600">Lesson not found.</p>;
    }
    if (!sortedItems.length) {
      return <p className="text-sm text-slate-500">No lesson items yet.</p>;
    }

    return (
      <div className="space-y-4">
        {sortedItems.map((item, index) => (
          <div
            key={item.localId}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4"
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
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500">Audio File</label>
              {item.audioUrl ? (
                <div className="mt-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <audio
                    controls
                    preload="none"
                    className="w-full"
                    src={`${MEDIA_BASE_URL}${item.audioUrl}`}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void handleAudioDelete(item.localId, item.audioUrl);
                    }}
                    disabled={deletingItemLocalId === item.localId}
                    className="rounded-md border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingItemLocalId === item.localId ? 'Deleting audio…' : 'Delete audio'}
                  </button>
                </div>
              ) : (
                <>
                  <p className="mt-2 text-xs text-slate-500">
                    Upload only
                    {' '}
                    <code className="rounded bg-slate-100 px-1 py-0.5">.mp3</code>
                    {' '}
                    or
                    {' '}
                    <code className="rounded bg-slate-100 px-1 py-0.5">.wav</code>
                    {' '}
                    files.
                  </p>
                  <div className="mt-3 space-y-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3">
                    <label className="block text-xs font-medium text-slate-500">
                      Upload audio
                    </label>
                    <input
                      type="file"
                      accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav"
                      onChange={(e) => {
                        const selectedFile = e.target.files?.[0];
                        if (!selectedFile) {
                          return;
                        }

                        void handleAudioUpload(item.localId, selectedFile);
                        e.currentTarget.value = '';
                      }}
                      disabled={uploadLessonAudio.isPending}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-xs file:font-medium file:text-white hover:file:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    {uploadingItemLocalId === item.localId ? (
                      <p className="text-xs text-brand-600">Uploading audio…</p>
                    ) : null}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-500">Phrase Timings</label>
                <button
                  type="button"
                  onClick={() => addSegment(item.localId)}
                  className="text-xs text-brand-600"
                >
                  + Add phrase
                </button>
              </div>

              {item.segments.map((segment) => (
                <div
                  key={segment.localId}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3"
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
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/lessons" className="text-sm text-brand-600">
          ← Back to lessons
        </Link>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {lesson?.status ?? '—'}
        </span>
      </div>

      <div className="space-y-6">
        <form
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
          onSubmit={handleLessonSubmit}
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
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as LessonStatus)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {LESSON_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          {feedback && <p className="text-sm text-slate-500">{feedback}</p>}
          <button
            type="submit"
            disabled={updateLesson.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {updateLesson.isPending ? 'Saving…' : 'Save lesson'}
          </button>
        </form>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Lesson Items</h2>
              <p className="text-sm text-slate-500">
                Words from saved lesson text are added to the global vocabulary automatically. Audio is optional until you upload it.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/dashboard/vocabulary" className="text-sm text-brand-600">
                Open dictionary
              </Link>
              <button
                type="button"
                onClick={addItem}
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
              >
                Add item
              </button>
            </div>
          </div>
          <div className="mt-4 space-y-4">{renderItemsBody()}</div>
          <div className="mt-4 flex items-center justify-between">
            {itemsFeedback ? <p className="text-sm text-slate-500">{itemsFeedback}</p> : <span />}
            <button
              type="button"
              onClick={handleItemsSave}
              disabled={updateLesson.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {updateLesson.isPending ? 'Saving…' : 'Save items'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
