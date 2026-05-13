'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLesson } from '../../../../../hooks/useLesson';
import { useLessonMutations } from '../../../../../hooks/useLessonMutations';
import { useToast } from '../../../../../components/providers/ToastProvider';
import { ConfirmDialog } from '../../../../../components/ui/ConfirmDialog';
import {
  LessonDictionaryCoverageItem,
  LessonItem,
  LessonItemSegment,
  LessonItemSentenceTiming,
  LessonItemWordTiming,
  LessonStatus,
} from '../../../../../lib/apiTypes';
import { MEDIA_BASE_URL } from '../../../../../lib/config';
import {
  buildMissingTranslationsCsv,
  buildMissingTranslationsFilename,
} from '../../../../../lib/lessonMissingTranslationsCsv';

const LESSON_STATUSES: LessonStatus[] = ['DRAFT', 'PUBLISHED'];

type EditableSegment = LessonItemSegment & { localId: string };
type EditableWordTiming = LessonItemWordTiming & { localId: string };
type EditableSentenceTiming = LessonItemSentenceTiming & { localId: string };
type TranslatedTimingCandidate = {
  text: string;
  normalizedText: string;
  textStart: number;
  textEnd: number;
  startMs: number;
  endMs: number;
};
type EditableItem = Omit<
  LessonItem,
  'segments' | 'wordTimings' | 'sentenceTimings'
> & {
  localId: string;
  segments: EditableSegment[];
  wordTimings: EditableWordTiming[];
  sentenceTimings: EditableSentenceTiming[];
};

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

const createWordTiming = (
  text = '',
  startMs = 0,
  endMs = startMs + 250,
  order = 0,
): EditableWordTiming => ({
  id: createLocalId(),
  localId: createLocalId(),
  text,
  normalizedText: normalizeTimingText(text),
  startMs,
  endMs,
  order,
});

const createSentenceTiming = (
  text = '',
  startMs = 0,
  endMs = startMs + 1000,
  order = 0,
  wordMarkIds: string[] = [],
): EditableSentenceTiming => ({
  id: createLocalId(),
  localId: createLocalId(),
  text,
  startMs,
  endMs,
  wordMarkIds,
  order,
});

const toEditableItem = (item: LessonItem): EditableItem => ({
  ...item,
  localId: item.id,
  segments: item.segments.map((segment) => ({
    ...segment,
    localId: segment.id,
  })),
  wordTimings: (item.wordTimings ?? []).map((mark) => ({
    ...mark,
    localId: mark.id,
  })),
  sentenceTimings: (item.sentenceTimings ?? []).map((mark) => ({
    ...mark,
    localId: mark.id,
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
  const [openTimingSegments, setOpenTimingSegments] = useState<Record<string, true>>({});
  const [deleteAudioTarget, setDeleteAudioTarget] = useState<{
    itemLocalId: string;
    audioUrl: string;
  } | null>(null);

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
  const dictionaryCoverage = lesson?.dictionaryCoverage ?? [];
  const missingArmenianTranslations = dictionaryCoverage.filter(
    (item) => !item.hasArmenianTranslation,
  );
  const armenianTranslatedCount = dictionaryCoverage.length - missingArmenianTranslations.length;

  const normalizeItems = (currentItems: EditableItem[]): EditableItem[] =>
    currentItems.map((item, index): EditableItem => {
      const segments = item.segments.map((segment): EditableSegment => ({
        id: segment.id,
        localId: segment.localId,
        text: segment.text,
        startMs: Number(segment.startMs),
        endMs: Number(segment.endMs),
      }));
      const wordTimings = orderWordTimings(item.wordTimings).map(
        (mark, markIndex): EditableWordTiming => ({
          id: mark.id,
          localId: mark.localId,
          text: mark.text,
          normalizedText: normalizeTimingText(mark.normalizedText || mark.text),
          startMs: Number(mark.startMs),
          endMs: Number(mark.endMs),
          order: markIndex,
        }),
      );

      return {
        ...item,
        order: index,
        segments,
        wordTimings,
        sentenceTimings: deriveSegmentSentenceTimings(segments, wordTimings),
      };
    });

  const saveLessonMetadata = async () => {
    if (!lessonId) return false;

    setFeedback(null);
    try {
      await updateLesson.mutateAsync({
        lessonId,
        data: { title, description, status },
      });
      setFeedback('Lesson saved');
      return true;
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Failed to save lesson');
      return false;
    }
  };

  const saveLessonItems = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!lessonId) return false;

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
        ) ||
        item.wordTimings.some(
          (mark) =>
            mark.text.trim().length < 1 ||
            Number.isNaN(mark.startMs) ||
            Number.isNaN(mark.endMs) ||
            mark.endMs <= mark.startMs,
        ) ||
        item.sentenceTimings.some(
          (mark) =>
            mark.text.trim().length < 1 ||
            Number.isNaN(mark.startMs) ||
            Number.isNaN(mark.endMs) ||
            mark.endMs <= mark.startMs,
        ),
    );

    if (hasInvalidItems) {
      setItemsFeedback('Each item needs text and valid phrase plus word/phrase timings. Audio can be uploaded later.');
      return false;
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
            wordTimings: item.wordTimings.map(
              ({ id, text, normalizedText, startMs, endMs, order }) => ({
                id,
                text,
                normalizedText,
                startMs,
                endMs,
                order,
              }),
            ),
            sentenceTimings: item.sentenceTimings.map(
              ({ id, text, startMs, endMs, wordMarkIds, order }) => ({
                id,
                text,
                startMs,
                endMs,
                wordMarkIds,
                order,
              }),
            ),
          })),
        },
      });
      setItems((prev) => normalizeItems(prev));
      setItemsFeedback('Items saved');
      if (!silent) {
        notify('Lesson items updated');
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save items';
      setItemsFeedback(message);
      notify(message, 'error');
      return false;
    }
  };

  const handleSaveAll = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!lessonId) return;

    const lessonSaved = await saveLessonMetadata();
    const itemsSaved = await saveLessonItems({ silent: true });

    if (lessonSaved && itemsSaved) {
      notify('Lesson updated');
    }
  };

  const updateItem = (localId: string, updater: (item: EditableItem) => EditableItem) => {
    setItems((prev) =>
      prev.map((item) => (item.localId === localId ? updater(item) : item)),
    );
  };

  const toggleTimingSegment = (itemLocalId: string, segmentLocalId: string) => {
    const key = getTimingSegmentKey(itemLocalId, segmentLocalId);
    setOpenTimingSegments((current) => {
      if (current[key]) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      return { ...current, [key]: true };
    });
  };

  const openTimingSegment = (itemLocalId: string, segmentLocalId: string) => {
    setOpenTimingSegments((current) => ({
      ...current,
      [getTimingSegmentKey(itemLocalId, segmentLocalId)]: true,
    }));
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

  const removeItem = (localId: string) => {
    setItems((prev) =>
      prev
        .filter((item) => item.localId !== localId)
        .map((item, index) => ({ ...item, order: index })),
    );
    setItemsFeedback(null);
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
      wordTimings: orderWordTimings(
        item.wordTimings.filter((mark) => {
          const segment = item.segments.find((entry) => entry.localId === segmentLocalId);
          return segment ? !isTimingInsideSegment(mark, segment) : true;
        }),
      ),
      sentenceTimings: orderSentenceTimings(
        item.sentenceTimings.filter((mark) => {
          const segment = item.segments.find((entry) => entry.localId === segmentLocalId);
          return segment ? !isTimingInsideSegment(mark, segment) : true;
        }),
      ),
    }));
  };

  const addWordTiming = (itemLocalId: string, segment: EditableSegment) => {
    updateItem(itemLocalId, (item) => ({
      ...item,
      wordTimings: orderWordTimings([
        ...item.wordTimings,
        createWordTiming(
          '',
          segment.startMs,
          Math.min(segment.startMs + 250, segment.endMs),
          item.wordTimings.length,
        ),
      ]),
    }));
    openTimingSegment(itemLocalId, segment.localId);
  };

  const removeWordTiming = (itemLocalId: string, wordLocalId: string) => {
    updateItem(itemLocalId, (item) => {
      const removed = item.wordTimings.find((mark) => mark.localId === wordLocalId);
      return {
        ...item,
        wordTimings: orderWordTimings(item.wordTimings
          .filter((mark) => mark.localId !== wordLocalId)
          .map((mark, index) => ({ ...mark, order: index }))),
        sentenceTimings: item.sentenceTimings.map((sentence) => ({
          ...sentence,
          wordMarkIds: removed
            ? sentence.wordMarkIds.filter((wordMarkId) => wordMarkId !== removed.id)
            : sentence.wordMarkIds,
        })),
      };
    });
  };

  const initializeSegmentTimingMarks = (itemLocalId: string, segment: EditableSegment) => {
    updateItem(itemLocalId, (item) => {
      const translatedCandidates = getTranslatedTimingCandidates(segment, dictionaryCoverage);
      const wordTimingPairs = translatedCandidates.map((candidate, index) => ({
        candidate,
        mark: {
          ...createWordTiming(candidate.text, candidate.startMs, candidate.endMs, index),
          normalizedText: candidate.normalizedText,
        },
      }));
      const wordTimings = wordTimingPairs.map(({ mark }) => mark);

      const preservedWords = item.wordTimings.filter((mark) => !isTimingInsideSegment(mark, segment));
      const nextWordTimings = orderWordTimings([...preservedWords, ...wordTimings]);

      return {
        ...item,
        wordTimings: nextWordTimings,
        sentenceTimings: deriveSegmentSentenceTimings(item.segments, nextWordTimings),
      };
    });
    openTimingSegment(itemLocalId, segment.localId);
  };

  const initializeItemTimingMarks = (itemLocalId: string) => {
    const currentItem = items.find((item) => item.localId === itemLocalId);
    if (!currentItem) return;

    const initialized = buildSentenceInitializedItem(currentItem, dictionaryCoverage);
    if (!initialized) {
      setItemsFeedback('Add item text before initializing whole-text timings.');
      return;
    }

    setItems((prev) =>
      prev.map((item) => (item.localId === itemLocalId ? initialized.item : item)),
    );
    setOpenTimingSegments((current) => {
      const next = { ...current };
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${itemLocalId}:`)) {
          delete next[key];
        }
      }
      return next;
    });
    setItemsFeedback(
      `Initialized ${initialized.segmentCount} sentence segments and ${initialized.wordCount} word/phrase timings.`,
    );
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
      setDeleteAudioTarget((current) => (current?.itemLocalId === itemLocalId ? null : current));
    }
  };

  const downloadMissingTranslationsCsv = () => {
    if (!lesson || !missingArmenianTranslations.length) return;

    const csv = buildMissingTranslationsCsv(missingArmenianTranslations, lesson.title);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = buildMissingTranslationsFilename(lesson.title);
    link.click();
    URL.revokeObjectURL(url);
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
                className="mt-1 min-h-48 w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows={6}
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
                    onClick={() => setDeleteAudioTarget({ itemLocalId: item.localId, audioUrl: item.audioUrl })}
                    disabled={deletingItemLocalId === item.localId}
                    className="rounded-md border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingItemLocalId === item.localId ? 'Deleting voice…' : 'Delete voice'}
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
                <div className="flex flex-wrap justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => initializeItemTimingMarks(item.localId)}
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

              {item.segments.map((segment) => {
                const segmentWordTimings = item.wordTimings.filter((mark) =>
                  isTimingInsideSegment(mark, segment),
                );
                const isTimingOpen = Boolean(
                  openTimingSegments[getTimingSegmentKey(item.localId, segment.localId)],
                );

                return (
                  <div
                    key={segment.localId}
                    className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-3"
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

                    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
                      <button
                        type="button"
                        onClick={() => toggleTimingSegment(item.localId, segment.localId)}
                        className="flex w-full items-center justify-between gap-3 text-left text-xs font-semibold uppercase text-slate-600"
                      >
                        <span>
                          {isTimingOpen ? 'Hide' : 'Show'} segment timings
                          <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                            {segmentWordTimings.length} words/phrases
                          </span>
                        </span>
                        <span className="text-base leading-none text-slate-400">
                          {isTimingOpen ? '⌃' : '⌄'}
                        </span>
                      </button>
                      {isTimingOpen ? (
                        <div className="flex flex-wrap justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => initializeSegmentTimingMarks(item.localId, segment)}
                            className="text-xs font-semibold text-brand-600"
                          >
                            Initialize this segment
                          </button>
                          <button
                            type="button"
                            onClick={() => addWordTiming(item.localId, segment)}
                            className="text-xs font-semibold text-brand-600"
                          >
                            + Add word/phrase
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void saveLessonItems();
                            }}
                            disabled={updateLesson.isPending}
                            className="text-xs font-semibold text-slate-700 disabled:opacity-50"
                          >
                            {updateLesson.isPending ? 'Saving…' : 'Save segment timings'}
                          </button>
                        </div>
                      ) : null}

                      {isTimingOpen ? (
                        <>
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-slate-500">Words / phrases</p>
                        {segmentWordTimings.length ? (
                          segmentWordTimings.map((mark) => (
                            <div
                              key={mark.localId}
                              className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(180px,1fr)_110px_110px_auto]"
                            >
                              <input
                                value={mark.text}
                                onChange={(event) =>
                                  updateItem(item.localId, (current) => ({
                                    ...current,
                                    wordTimings: orderWordTimings(
                                      current.wordTimings.map((entry) =>
                                        entry.localId === mark.localId
                                          ? {
                                              ...entry,
                                              text: event.target.value,
                                              normalizedText: normalizeTimingText(event.target.value),
                                            }
                                          : entry,
                                      ),
                                    ),
                                  }))
                                }
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                placeholder="Word / phrase"
                              />
                              <input
                                type="number"
                                min={segment.startMs}
                                value={mark.startMs}
                                onChange={(event) =>
                                  updateItem(item.localId, (current) => ({
                                    ...current,
                                    wordTimings: orderWordTimings(
                                      current.wordTimings.map((entry) =>
                                        entry.localId === mark.localId
                                          ? { ...entry, startMs: Number(event.target.value) }
                                          : entry,
                                      ),
                                    ),
                                  }))
                                }
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                aria-label="Word start ms"
                              />
                              <input
                                type="number"
                                min={segment.startMs + 1}
                                value={mark.endMs}
                                onChange={(event) =>
                                  updateItem(item.localId, (current) => ({
                                    ...current,
                                    wordTimings: orderWordTimings(
                                      current.wordTimings.map((entry) =>
                                        entry.localId === mark.localId
                                          ? { ...entry, endMs: Number(event.target.value) }
                                          : entry,
                                      ),
                                    ),
                                  }))
                                }
                                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                aria-label="Word end ms"
                              />
                              <button
                                type="button"
                                onClick={() => removeWordTiming(item.localId, mark.localId)}
                                className="text-xs text-rose-600"
                              >
                                Remove
                              </button>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-500">No word ranges in this segment.</p>
                        )}
                      </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => addSegment(item.localId)}
                  className="text-xs font-semibold text-brand-600"
                >
                  + Add phrase
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderDictionaryCoverage = () => {
    if (!lesson) return null;

    if (!dictionaryCoverage.length) {
      return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
          Save lesson text to generate dictionary coverage.
        </div>
      );
    }

    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
        <div className="flex flex-col gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Dictionary coverage</h3>
            <p className="text-xs text-slate-500">
              {armenianTranslatedCount} of {dictionaryCoverage.length} saved terms have Armenian translations.
              Save item text to refresh this list.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {missingArmenianTranslations.length ? (
              <button
                type="button"
                onClick={downloadMissingTranslationsCsv}
                className="text-xs font-semibold text-brand-600"
              >
                Download missing CSV
              </button>
            ) : null}
            <Link
              href="/dashboard/vocabulary/import"
              className="text-xs font-semibold text-brand-600"
            >
              Import CSV
            </Link>
            <Link
              href="/dashboard/vocabulary"
              className="text-xs font-semibold text-brand-600"
            >
              Open dictionary
            </Link>
          </div>
        </div>

        {missingArmenianTranslations.length ? (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase text-rose-600">
              Missing Armenian translations
            </p>
            <div className="mt-3 flex min-h-24 flex-wrap gap-2">
              {missingArmenianTranslations.map((item) => (
                <CoveragePill key={`${item.kind}:${item.normalizedText}`} item={item} />
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs font-medium text-emerald-700">
            All saved lesson terms currently have Armenian translations.
          </p>
        )}
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

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.82fr)_minmax(0,1.68fr)]">
        <form
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm"
          onSubmit={handleSaveAll}
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
          {feedback && <p className="text-sm text-slate-500">{feedback}</p>}
          <button
            type="submit"
            disabled={updateLesson.isPending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {updateLesson.isPending ? 'Saving…' : 'Save lesson'}
          </button>
          <div className="pt-2">{renderDictionaryCoverage()}</div>
        </form>

        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Lesson Items</h2>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  void saveLessonItems();
                }}
                disabled={updateLesson.isPending}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {updateLesson.isPending ? 'Saving…' : 'Save items'}
              </button>
            </div>
          </div>
          <div className="mt-4 space-y-4">{renderItemsBody()}</div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            {itemsFeedback ? <p className="text-sm text-slate-500">{itemsFeedback}</p> : <span />}
            <button
              type="button"
              onClick={() => {
                void saveLessonItems();
              }}
              disabled={updateLesson.isPending}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {updateLesson.isPending ? 'Saving…' : 'Save items'}
            </button>
          </div>
        </section>
      </div>

      {deleteAudioTarget ? (
        <ConfirmDialog
          title="Delete voice?"
          description="Do you really want to delete this voice? This cannot be undone."
          confirmLabel="Delete voice"
          tone="danger"
          isPending={deletingItemLocalId === deleteAudioTarget.itemLocalId}
          onCancel={() => setDeleteAudioTarget(null)}
          onConfirm={() => {
            void handleAudioDelete(deleteAudioTarget.itemLocalId, deleteAudioTarget.audioUrl);
          }}
        />
      ) : null}
    </div>
  );
}

function CoveragePill({ item }: { item: LessonDictionaryCoverageItem }) {
  const content = (
    <>
      <span>{item.text}</span>
      <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
        {item.kind.toLowerCase()}
      </span>
    </>
  );

  const className =
    'inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-rose-300 hover:bg-rose-50';

  if (!item.entryId) {
    return <span className={className}>{content}</span>;
  }

  return (
    <Link href={`/dashboard/vocabulary/${item.entryId}`} className={className}>
      {content}
    </Link>
  );
}

function normalizeTimingText(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/(^'+|'+$)/g, '')
    .replace(/'s$/g, '');
}

function isTimingInsideSegment(
  mark: { startMs: number; endMs: number },
  segment: { startMs: number; endMs: number },
) {
  return mark.startMs >= segment.startMs && mark.startMs < segment.endMs;
}

function getTimingSegmentKey(itemLocalId: string, segmentLocalId: string) {
  return `${itemLocalId}:${segmentLocalId}`;
}

function orderWordTimings<T extends EditableWordTiming>(timings: T[]): T[] {
  return [...timings]
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs)
    .map((timing, index) => ({ ...timing, order: index }));
}

function orderSentenceTimings<T extends EditableSentenceTiming>(timings: T[]): T[] {
  return [...timings]
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs)
    .map((timing, index) => ({ ...timing, order: index }));
}

function deriveSegmentSentenceTimings(
  segments: EditableSegment[],
  wordTimings: EditableWordTiming[],
): EditableSentenceTiming[] {
  return orderSentenceTimings(
    segments.flatMap((segment) => {
      const linkedWords = wordTimings.filter((mark) => isTimingInsideSegment(mark, segment));
      if (!linkedWords.length) {
        return [];
      }

      return [
        createSentenceTiming(
          segment.text,
          segment.startMs,
          segment.endMs,
          0,
          linkedWords.map((word) => word.id),
        ),
      ];
    }),
  );
}

function buildSentenceInitializedItem(
  item: EditableItem,
  dictionaryCoverage: LessonDictionaryCoverageItem[],
): { item: EditableItem; segmentCount: number; wordCount: number } | null {
  const sentenceParts = splitTextIntoSentences(item.text);
  if (!sentenceParts.length) {
    return null;
  }

  const timingWindow = getItemTimingWindow(item, sentenceParts.length);
  const segments: EditableSegment[] = [];
  let previousEndMs = timingWindow.startMs;

  sentenceParts.forEach((part, index) => {
    const startMs =
      index === 0
        ? timingWindow.startMs
        : previousEndMs;
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

  const wordTimings = orderWordTimings(
    segments.flatMap((segment) =>
      getTranslatedTimingCandidates(segment, dictionaryCoverage).map((candidate, index) => ({
        ...createWordTiming(candidate.text, candidate.startMs, candidate.endMs, index),
        normalizedText: candidate.normalizedText,
      })),
    ),
  );

  const nextItem: EditableItem = {
    ...item,
    segments,
    wordTimings,
    sentenceTimings: deriveSegmentSentenceTimings(segments, wordTimings),
  };

  return {
    item: nextItem,
    segmentCount: segments.length,
    wordCount: wordTimings.length,
  };
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
  return trimmed ? [{ text: trimmed, start: value.indexOf(trimmed), end: value.indexOf(trimmed) + trimmed.length }] : [];
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

  if (validSegments.length) {
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
  const textLength = Math.max(text.length, 1);
  const ratio = Math.min(Math.max(offset / textLength, 0), 1);
  return Math.min(
    endMs,
    Math.max(startMs, startMs + Math.floor((endMs - startMs) * ratio)),
  );
}

function getTranslatedTimingCandidates(
  segment: EditableSegment,
  dictionaryCoverage: LessonDictionaryCoverageItem[],
): TranslatedTimingCandidate[] {
  const translatedTerms = dictionaryCoverage
    .filter((item) => item.hasArmenianTranslation || item.hasTranslation)
    .filter((item) => item.kind === 'WORD' || item.kind === 'PHRASE')
    .flatMap((item) => {
      const labels = Array.from(new Set([item.text, item.normalizedText].filter(Boolean)));
      return labels.map((label) => ({
        kind: item.kind,
        normalizedText: item.normalizedText,
        text: label,
      }));
    })
    .sort((left, right) => right.text.length - left.text.length);

  const candidates: TranslatedTimingCandidate[] = [];
  const occupiedSpans: Array<{ start: number; end: number }> = [];

  for (const term of translatedTerms) {
    const pattern = buildTermPattern(term.text, term.kind);
    if (!pattern) continue;

    const matcher = new RegExp(`(^|[^A-Za-z'])(${pattern})(?=$|[^A-Za-z'])`, 'gi');
    for (const match of segment.text.matchAll(matcher)) {
      const prefix = match[1] ?? '';
      const matchedText = match[2] ?? '';
      if (!matchedText) continue;

      const textStart = (match.index ?? 0) + prefix.length;
      const textEnd = textStart + matchedText.length;
      if (occupiedSpans.some((span) => textStart < span.end && textEnd > span.start)) {
        continue;
      }
      occupiedSpans.push({ start: textStart, end: textEnd });

      const startMs = estimateMsFromTextOffset(segment, textStart);
      const endMs = Math.max(
        startMs + 100,
        estimateMsFromTextOffset(segment, textEnd),
      );

      candidates.push({
        text: matchedText,
        normalizedText: term.normalizedText,
        textStart,
        textEnd,
        startMs,
        endMs: Math.min(endMs, segment.endMs),
      });
    }
  }

  return candidates.sort((left, right) => left.textStart - right.textStart || left.textEnd - right.textEnd);
}

function buildTermPattern(term: string, kind: LessonDictionaryCoverageItem['kind']) {
  const trimmed = term.trim();
  if (!trimmed || kind === 'SENTENCE') return null;
  return escapeRegExp(trimmed).replace(/\s+/g, '\\s+');
}

function estimateMsFromTextOffset(segment: EditableSegment, offset: number) {
  const textLength = Math.max(segment.text.length, 1);
  const ratio = Math.min(Math.max(offset / textLength, 0), 1);
  return Math.min(
    segment.endMs,
    Math.max(segment.startMs, segment.startMs + Math.floor((segment.endMs - segment.startMs) * ratio)),
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
