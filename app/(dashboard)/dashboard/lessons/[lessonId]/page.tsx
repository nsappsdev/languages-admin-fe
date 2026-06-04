'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLesson } from '../../../../../hooks/useLesson';
import { useLessonMutations } from '../../../../../hooks/useLessonMutations';
import { useLessonVocabularyMutations } from '../../../../../hooks/useLessonVocabularyMutations';
import { useToast } from '../../../../../components/providers/ToastProvider';
import { ConfirmDialog } from '../../../../../components/ui/ConfirmDialog';
import {
  GeneratedLessonTimings,
  LessonItem,
  LessonItemChunkTiming,
  LessonItemSegment,
  LessonItemSentenceTiming,
  LessonItemWordTiming,
  LessonStatus,
  VocabularyEntry,
} from '../../../../../lib/apiTypes';
import { MEDIA_BASE_URL } from '../../../../../lib/config';
import {
  buildMissingTranslationsCsv,
  buildMissingTranslationsFilename,
} from '../../../../../lib/lessonMissingTranslationsCsv';
import { parseAndValidate } from '../../../../../lib/vocabularyCsv';

const LESSON_STATUSES: LessonStatus[] = ['DRAFT', 'PUBLISHED'];

const smallSecondaryButtonClass =
  'inline-flex items-center justify-center rounded-md border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50';

const smallNeutralButtonClass =
  'inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

const smallDangerButtonClass =
  'inline-flex items-center justify-center rounded-md border border-rose-200 bg-white px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50';

const secondaryButtonClass =
  'inline-flex items-center justify-center rounded-lg border border-brand-200 bg-white px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50';

const vocabularyTabButtonClass =
  'inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-semibold transition';

type EditableSegment = LessonItemSegment & { localId: string };
type EditableWordTiming = LessonItemWordTiming & { localId: string; segmentLocalId?: string };
type EditableSentenceTiming = LessonItemSentenceTiming & { localId: string };
type EditableChunkTiming = LessonItemChunkTiming & { localId: string };
type EditableItem = Omit<
  LessonItem,
  'segments' | 'wordTimings' | 'sentenceTimings' | 'chunkTimings'
> & {
  localId: string;
  segments: EditableSegment[];
  wordTimings: EditableWordTiming[];
  sentenceTimings: EditableSentenceTiming[];
  chunkTimings: EditableChunkTiming[];
};

type VocabularyPanelTab = 'missing' | 'all';

const createLocalId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const toEditableSegment = (segment: LessonItemSegment): EditableSegment => ({
  ...segment,
  localId: segment.id,
});

const toEditableWordTiming = (
  mark: LessonItemWordTiming,
  segments: EditableSegment[],
): EditableWordTiming => ({
  ...mark,
  localId: mark.id,
  segmentLocalId: findSegmentForTiming(segments, mark)?.localId,
});

const toEditableSentenceTiming = (mark: LessonItemSentenceTiming): EditableSentenceTiming => ({
  ...mark,
  localId: mark.id,
});

const toEditableChunkTiming = (mark: LessonItemChunkTiming): EditableChunkTiming => ({
  ...mark,
  localId: mark.id,
});

const createWordTiming = (
  text = '',
  startMs = 0,
  endMs = startMs + 250,
  order = 0,
  segmentLocalId?: string,
): EditableWordTiming => ({
  id: createLocalId(),
  localId: createLocalId(),
  segmentLocalId,
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

const toEditableItem = (item: LessonItem): EditableItem => {
  const segments = item.segments.map(toEditableSegment);
  return {
    ...item,
    localId: item.id,
    segments,
    wordTimings: (item.wordTimings ?? []).map((mark) => toEditableWordTiming(mark, segments)),
    sentenceTimings: (item.sentenceTimings ?? []).map(toEditableSentenceTiming),
    chunkTimings: (item.chunkTimings ?? []).map(toEditableChunkTiming),
  };
};

export default function LessonDetailPage() {
  const params = useParams<{ lessonId: string }>();
  const lessonId = params?.lessonId ?? '';
  const { data, isLoading, error } = useLesson(lessonId);
  const lesson = data?.lesson;
  const { updateLesson, updateLessonSegmentTimings, uploadLessonAudio, deleteLessonAudio, generateLessonItemTimings } =
    useLessonMutations();
  const { bulkDeleteEntries, createEntry, deleteEntry, generateAiTranslations, importEntries, pullFromTimings, updateEntry } =
    useLessonVocabularyMutations();
  const { notify } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<LessonStatus>('DRAFT');
  const [items, setItems] = useState<EditableItem[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [itemsFeedback, setItemsFeedback] = useState<string | null>(null);
  const [uploadingItemLocalId, setUploadingItemLocalId] = useState<string | null>(null);
  const [deletingItemLocalId, setDeletingItemLocalId] = useState<string | null>(null);
  const [generatingTimingsItemLocalId, setGeneratingTimingsItemLocalId] = useState<string | null>(null);
  const [savingTimingSegmentKey, setSavingTimingSegmentKey] = useState<string | null>(null);
  const [timingWarningsByItemId, setTimingWarningsByItemId] = useState<Record<string, string[]>>({});
  const [openTimingSegments, setOpenTimingSegments] = useState<Record<string, true>>({});
  const [deleteAudioTarget, setDeleteAudioTarget] = useState<{
    itemLocalId: string;
    audioUrl: string;
  } | null>(null);
  const [vocabularyForm, setVocabularyForm] = useState({
    englishText: '',
    translation: '',
    focusText: '',
  });
  const [editingVocabularyId, setEditingVocabularyId] = useState<string | null>(null);
  const [selectedVocabularyIds, setSelectedVocabularyIds] = useState<string[]>([]);
  const [vocabularyTab, setVocabularyTab] = useState<VocabularyPanelTab>('missing');
  const [csvImportFeedback, setCsvImportFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!lesson) return;
    setTitle(lesson.title);
    setDescription(lesson.description ?? '');
    setStatus(lesson.status);
    setItems(lesson.items.map(toEditableItem));
    setOpenTimingSegments({});
  }, [lesson]);

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => left.order - right.order),
    [items],
  );
  const lessonVocabulary = useMemo(
    () => lesson?.vocabulary ?? lesson?.dictionary ?? [],
    [lesson?.dictionary, lesson?.vocabulary],
  );
  const vocabularyTerms = useMemo(
    () => lessonVocabulary.filter((entry) => entry.kind !== 'SENTENCE'),
    [lessonVocabulary],
  );
  const sentenceVocabularyCount = lessonVocabulary.length - vocabularyTerms.length;
  const lessonVocabularyIds = useMemo(
    () => new Set(vocabularyTerms.map((entry) => entry.id)),
    [vocabularyTerms],
  );
  const selectedVocabularyCount = selectedVocabularyIds.length;
  const dictionaryCoverage = useMemo(
    () => (lesson?.vocabularyCoverage ?? lesson?.dictionaryCoverage ?? []).filter((item) => item.kind !== 'SENTENCE'),
    [lesson?.dictionaryCoverage, lesson?.vocabularyCoverage],
  );
  const missingArmenianTranslations = dictionaryCoverage.filter(
    (item) => !item.hasArmenianTranslation,
  );
  const armenianTranslatedCount = dictionaryCoverage.length - missingArmenianTranslations.length;
  const missingEntryIds = useMemo(
    () =>
      new Set(
        missingArmenianTranslations
          .map((item) => item.entryId)
          .filter((entryId): entryId is string => Boolean(entryId)),
      ),
    [missingArmenianTranslations],
  );
  const missingVocabularyEntries = useMemo(
    () => vocabularyTerms.filter((entry) => missingEntryIds.has(entry.id)),
    [missingEntryIds, vocabularyTerms],
  );

  useEffect(() => {
    setSelectedVocabularyIds((current) => {
      const next = current.filter((entryId) => lessonVocabularyIds.has(entryId));
      return next.length === current.length ? current : next;
    });
  }, [lessonVocabularyIds]);

  const normalizeItems = (currentItems: EditableItem[]): EditableItem[] =>
    currentItems.map((item, index): EditableItem => {
      const segments = item.segments.map((segment): EditableSegment => ({
        id: segment.id,
        localId: segment.localId,
        text: segment.text,
        startMs: Number(segment.startMs),
        endMs: Number(segment.endMs),
      }));
      const wordTimings = orderWordTimingsBySegment(segments, item.wordTimings).map(
        (mark, markIndex): EditableWordTiming => ({
          id: mark.id,
          localId: mark.localId,
          segmentLocalId: getWordTimingSegmentLocalId(mark, segments),
          text: mark.text,
          normalizedText: normalizeTimingText(mark.normalizedText || mark.text),
          startMs: Number(mark.startMs),
          endMs: Number(mark.endMs),
          order: markIndex,
        }),
      );
      const wordTimingsById = new Map(wordTimings.map((mark) => [mark.id, mark]));
      const linkedWordIds = new Set<string>();
      const chunkTimings = orderChunkTimings(
        [
          ...(item.chunkTimings ?? [])
            .map((mark) => {
              const wordMarkIds = mark.wordMarkIds.filter((wordMarkId) =>
                wordTimingsById.has(wordMarkId),
              );
              if (!wordMarkIds.length) {
                return null;
              }
              wordMarkIds.forEach((wordMarkId) => linkedWordIds.add(wordMarkId));
              return deriveChunkTimingFromWords(mark, wordMarkIds, wordTimingsById);
            })
            .filter((mark): mark is EditableChunkTiming => Boolean(mark)),
          ...wordTimings
            .filter((mark) => !linkedWordIds.has(mark.id))
            .map((mark) =>
              deriveChunkTimingFromWords(
                {
                  id: createLocalId(),
                  localId: createLocalId(),
                  text: mark.text,
                  normalizedText: mark.normalizedText,
                  startMs: mark.startMs,
                  endMs: mark.endMs,
                  wordMarkIds: [mark.id],
                  order: mark.order,
                },
                [mark.id],
                wordTimingsById,
              ),
            ),
        ],
      );

      return {
        ...item,
        order: index,
        segments,
        wordTimings,
        sentenceTimings: deriveSegmentSentenceTimings(segments, wordTimings),
        chunkTimings,
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
        ) ||
        item.chunkTimings.some(
          (mark) =>
            mark.text.trim().length < 1 ||
            Number.isNaN(mark.startMs) ||
            Number.isNaN(mark.endMs) ||
            mark.endMs <= mark.startMs ||
            mark.wordMarkIds.length < 1,
        ),
    );

    if (hasInvalidItems) {
      setItemsFeedback('Each item needs text and valid segments plus word/phrase timings. Audio can be uploaded later.');
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
            chunkTimings: item.chunkTimings.map(
              ({ id, text, normalizedText, startMs, endMs, wordMarkIds, order }) => ({
                id,
                text,
                normalizedText,
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

  const saveSegmentTimings = async (item: EditableItem, segment: EditableSegment) => {
    if (!lessonId || !item.id) {
      return saveLessonItems();
    }

    const key = getTimingSegmentKey(item.localId, segment.localId);
    const normalizedItem = normalizeItems([item])[0];
    const normalizedSegment = normalizedItem.segments.find((entry) => entry.id === segment.id);
    if (!normalizedSegment) {
      setItemsFeedback('Could not find the segment to save.');
      return false;
    }

    const segmentWordTimings = getSegmentWordTimings(
      normalizedItem.wordTimings,
      normalizedSegment,
      normalizedItem.segments,
    );
    const segmentWordTimingIds = new Set(segmentWordTimings.map((mark) => mark.id));
    const segmentChunkTimings = normalizedItem.chunkTimings.filter((chunk) =>
      chunk.wordMarkIds.some((wordMarkId) => segmentWordTimingIds.has(wordMarkId)),
    );

    setItemsFeedback('Saving segment timings…');
    setSavingTimingSegmentKey(key);
    try {
      const response = await updateLessonSegmentTimings.mutateAsync({
        lessonId,
        itemId: item.id,
        segmentId: segment.id,
        segment: {
          id: normalizedSegment.id,
          text: normalizedSegment.text,
          startMs: normalizedSegment.startMs,
          endMs: normalizedSegment.endMs,
        },
        wordTimings: segmentWordTimings.map(
          ({ id, text, normalizedText, startMs, endMs, order }) => ({
            id,
            text,
            normalizedText,
            startMs,
            endMs,
            order,
          }),
        ),
        chunkTimings: segmentChunkTimings.map(
          ({ id, text, normalizedText, startMs, endMs, wordMarkIds, order }) => ({
            id,
            text,
            normalizedText,
            startMs,
            endMs,
            wordMarkIds,
            order,
          }),
        ),
      });
      setItems((current) =>
        current.map((entry) =>
          entry.id === response.item.id ? toEditableItem(response.item) : entry,
        ),
      );
      setItemsFeedback('Segment timings saved');
      notify('Segment timings saved');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save segment timings';
      setItemsFeedback(message);
      notify(message, 'error');
      return false;
    } finally {
      setSavingTimingSegmentKey((current) => (current === key ? null : current));
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

  const removeSegment = (itemLocalId: string, segmentLocalId: string) => {
    updateItem(itemLocalId, (item) => {
      const nextSegments = item.segments.filter((segment) => segment.localId !== segmentLocalId);
      return {
        ...item,
        segments: nextSegments,
        wordTimings: orderWordTimingsBySegment(
          nextSegments,
          item.wordTimings.filter((mark) => {
            if (mark.segmentLocalId) {
              return mark.segmentLocalId !== segmentLocalId;
            }
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
        chunkTimings: orderChunkTimings(
          item.chunkTimings
            .map((chunk) => ({
              ...chunk,
              wordMarkIds: chunk.wordMarkIds.filter((wordMarkId) =>
                item.wordTimings.some((mark) => {
                  if (mark.id !== wordMarkId) return false;
                  if (mark.segmentLocalId) {
                    return mark.segmentLocalId !== segmentLocalId;
                  }
                  const segment = item.segments.find((entry) => entry.localId === segmentLocalId);
                  return segment ? !isTimingInsideSegment(mark, segment) : true;
                }),
              ),
            }))
            .filter((chunk) => chunk.wordMarkIds.length > 0),
        ),
      };
    });
  };

  const addWordTiming = (itemLocalId: string, segmentLocalId: string) => {
    updateItem(itemLocalId, (item) => {
      const segment = item.segments.find((entry) => entry.localId === segmentLocalId);
      if (!segment) {
        return item;
      }
      const segmentWordTimings = getSegmentWordTimings(item.wordTimings, segment, item.segments);
      const lastTiming = segmentWordTimings[segmentWordTimings.length - 1];
      const startMs = Number.isFinite(lastTiming?.endMs)
        ? lastTiming.endMs
        : segment.startMs;
      const endMs = Math.max(startMs + 1, Math.min(startMs + 250, segment.endMs));

      const wordTiming = createWordTiming('', startMs, endMs, item.wordTimings.length, segmentLocalId);
      const chunkTiming: EditableChunkTiming = {
        id: createLocalId(),
        localId: createLocalId(),
        text: wordTiming.text,
        normalizedText: wordTiming.normalizedText,
        startMs: wordTiming.startMs,
        endMs: wordTiming.endMs,
        wordMarkIds: [wordTiming.id],
        order: item.chunkTimings.length,
      };

      return {
        ...item,
        wordTimings: orderWordTimingsBySegment(item.segments, [
          ...item.wordTimings,
          wordTiming,
        ]),
        chunkTimings: orderChunkTimings([...item.chunkTimings, chunkTiming]),
      };
    });
  };

  const removeWordTiming = (itemLocalId: string, wordLocalId: string) => {
    updateItem(itemLocalId, (item) => {
      const removed = item.wordTimings.find((mark) => mark.localId === wordLocalId);
      return {
        ...item,
        wordTimings: orderWordTimingsBySegment(
          item.segments,
          item.wordTimings
            .filter((mark) => mark.localId !== wordLocalId)
            .map((mark, index) => ({ ...mark, order: index })),
        ),
        sentenceTimings: item.sentenceTimings.map((sentence) => ({
          ...sentence,
          wordMarkIds: removed
            ? sentence.wordMarkIds.filter((wordMarkId) => wordMarkId !== removed.id)
            : sentence.wordMarkIds,
        })),
        chunkTimings: orderChunkTimings(
          item.chunkTimings
            .map((chunk) => ({
              ...chunk,
              wordMarkIds: removed
                ? chunk.wordMarkIds.filter((wordMarkId) => wordMarkId !== removed.id)
                : chunk.wordMarkIds,
            }))
            .filter((chunk) => chunk.wordMarkIds.length > 0),
        ),
      };
    });
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

  const applyGeneratedTimings = (itemLocalId: string, timings: GeneratedLessonTimings) => {
    const segments = timings.segments.map(toEditableSegment);
    updateItem(itemLocalId, (current) => ({
      ...current,
      segments,
      wordTimings: timings.wordTimings.map((mark) => toEditableWordTiming(mark, segments)),
      sentenceTimings: timings.sentenceTimings.map(toEditableSentenceTiming),
      chunkTimings: timings.chunkTimings.map(toEditableChunkTiming),
    }));
  };

  const handleGenerateTimings = async (item: EditableItem) => {
    if (!lessonId || !item.id) return;
    setGeneratingTimingsItemLocalId(item.localId);
    setItemsFeedback(null);
    setTimingWarningsByItemId((prev) => ({ ...prev, [item.localId]: [] }));

    try {
      const response = await generateLessonItemTimings.mutateAsync({
        lessonId,
        itemId: item.id,
        text: item.text,
      });
      applyGeneratedTimings(item.localId, response.timings);
      setTimingWarningsByItemId((prev) => ({
        ...prev,
        [item.localId]: response.timings.warnings,
      }));
      const warningSuffix = response.timings.warnings.length
        ? ` with ${response.timings.warnings.length} warning(s)`
        : '';
      const chunkSuffix = ` (${response.timings.chunkTimings.length} logical parts)`;
      setItemsFeedback(`AI timings generated${chunkSuffix}${warningSuffix}. Review and save items.`);
      notify(`AI timings generated${chunkSuffix}${warningSuffix}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate AI timings';
      setItemsFeedback(message);
      notify(message, 'error');
    } finally {
      setGeneratingTimingsItemLocalId((current) => (current === item.localId ? null : current));
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

  const importTranslationsCsv = async (file: File | null) => {
    if (!lessonId || !file) return;

    setCsvImportFeedback(null);
    try {
      const csvText = await file.text();
      const result = parseAndValidate(csvText);
      if (result.errors.length) {
        const firstError = result.errors[0];
        const rowLabel = firstError.row >= 0 ? `Row ${firstError.row + 2}: ` : '';
        const message = `${rowLabel}${firstError.message}`;
        setCsvImportFeedback(message);
        notify(message, 'error');
        return;
      }
      if (!result.rows.length) {
        const message = 'CSV has no translations to import';
        setCsvImportFeedback(message);
        notify(message, 'error');
        return;
      }

      const importResult = await importEntries.mutateAsync({
        lessonId,
        targetLanguageCode: 'am',
        rows: result.rows,
      });
      const message = `Imported ${importResult.created + importResult.mergedTranslations} translations, skipped ${importResult.skipped}`;
      setCsvImportFeedback(message);
      notify(message);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to import translations CSV';
      setCsvImportFeedback(message);
      notify(message, 'error');
    }
  };

  const pullVocabularyFromTimings = async () => {
    if (!lessonId) return;

    setCsvImportFeedback(null);
    try {
      const result = await pullFromTimings.mutateAsync({ lessonId });
      const message = `Created ${result.created} word terms from saved timings, skipped ${result.skipped}`;
      setCsvImportFeedback(message);
      notify(message);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to pull vocabulary from timings';
      setCsvImportFeedback(message);
      notify(message, 'error');
    }
  };

  const generateMissingAiTranslations = async () => {
    if (!lessonId || !missingVocabularyEntries.length) return;

    const selectedMissingIds = selectedVocabularyIds.filter((entryId) => missingEntryIds.has(entryId));
    setCsvImportFeedback(null);
    try {
      const result = await generateAiTranslations.mutateAsync({
        lessonId,
        targetLanguageCode: 'am',
        entryIds: selectedMissingIds.length ? selectedMissingIds : undefined,
      });
      const scopeLabel = selectedMissingIds.length ? 'selected terms' : 'missing terms';
      const message = `AI translated ${result.translated} ${scopeLabel}, skipped ${result.skipped}`;
      setCsvImportFeedback(message);
      notify(message);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate AI translations';
      setCsvImportFeedback(message);
      notify(message, 'error');
    }
  };

  const resetVocabularyForm = () => {
    setVocabularyForm({
      englishText: '',
      translation: '',
      focusText: '',
    });
    setEditingVocabularyId(null);
  };

  const startEditingVocabulary = (entry: VocabularyEntry) => {
    setEditingVocabularyId(entry.id);
    setVocabularyForm({
      englishText: entry.englishText,
      translation: getArmenianTranslation(entry) ?? '',
      focusText: entry.focusText ?? '',
    });
  };

  const saveVocabularyEntry = async () => {
    if (!lessonId || !vocabularyForm.englishText.trim()) return;

    const translations = vocabularyForm.translation.trim()
      ? [
          {
            languageCode: 'am',
            translation: vocabularyForm.translation.trim(),
          },
        ]
      : [];
    const payload = {
      englishText: vocabularyForm.englishText.trim(),
      focusText: vocabularyForm.focusText.trim() || null,
      translations,
    };

    try {
      if (editingVocabularyId) {
        await updateEntry.mutateAsync({
          lessonId,
          entryId: editingVocabularyId,
          data: payload,
        });
        notify('Lesson vocabulary updated');
      } else {
        await createEntry.mutateAsync({ lessonId, data: payload });
        notify('Lesson vocabulary added');
      }
      resetVocabularyForm();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save lesson vocabulary', 'error');
    }
  };

  const removeVocabularyEntry = async (entryId: string) => {
    if (!lessonId) return;
    try {
      await deleteEntry.mutateAsync({ lessonId, entryId });
      setSelectedVocabularyIds((current) => current.filter((id) => id !== entryId));
      if (editingVocabularyId === entryId) {
        resetVocabularyForm();
      }
      notify('Lesson vocabulary deleted');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete lesson vocabulary', 'error');
    }
  };

  const toggleVocabularySelection = (entryId: string) => {
    setSelectedVocabularyIds((current) =>
      current.includes(entryId)
        ? current.filter((id) => id !== entryId)
        : [...current, entryId],
    );
  };

  const selectAllVocabulary = () => {
    const entries = vocabularyTab === 'missing' ? missingVocabularyEntries : vocabularyTerms;
    setSelectedVocabularyIds(entries.map((entry) => entry.id));
  };

  const removeSelectedVocabularyEntries = async () => {
    if (!lessonId || !selectedVocabularyIds.length) return;

    try {
      const selectedIds = [...selectedVocabularyIds];
      const result = await bulkDeleteEntries.mutateAsync({ lessonId, ids: selectedIds });
      setSelectedVocabularyIds([]);
      if (editingVocabularyId && selectedIds.includes(editingVocabularyId)) {
        resetVocabularyForm();
      }
      notify(`${result.deleted} lesson vocabulary terms deleted`);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete selected lesson vocabulary', 'error');
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
                    preload="metadata"
                    className="w-full"
                    src={`${MEDIA_BASE_URL}${item.audioUrl}`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteAudioTarget({ itemLocalId: item.localId, audioUrl: item.audioUrl })
                    }
                    disabled={deletingItemLocalId === item.localId}
                    className={smallDangerButtonClass}
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

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-700">AI timings</p>
                  <p className="text-xs text-slate-500">
                    Generate word and sentence millisecond ranges from this item&apos;s uploaded audio.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleGenerateTimings(item);
                  }}
                  disabled={
                    !item.audioUrl ||
                    item.text.trim().length < 1 ||
                    generatingTimingsItemLocalId === item.localId
                  }
                  className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generatingTimingsItemLocalId === item.localId
                    ? 'Generating…'
                    : 'Generate AI timings'}
                </button>
              </div>
              {!item.audioUrl ? (
                <p className="mt-2 text-xs text-slate-500">Upload audio before generating timings.</p>
              ) : null}
              {timingWarningsByItemId[item.localId]?.length ? (
                <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-2">
                  <p className="text-xs font-semibold text-amber-800">Timing warnings</p>
                  <ul className="mt-1 max-h-28 space-y-1 overflow-y-auto text-xs text-amber-800">
                    {timingWarningsByItemId[item.localId].slice(0, 12).map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-slate-500">AI Segments</label>
                <span className="text-xs text-slate-500">{item.segments.length} segments</span>
              </div>

              {item.segments.length ? (
                <div className="space-y-2">
                  {item.segments.map((segment, segmentIndex) => {
                    const segmentWordTimings = getSegmentWordTimings(
                      item.wordTimings,
                      segment,
                      item.segments,
                    );
                    const segmentLogicalParts = getSegmentLogicalParts(
                      item.chunkTimings,
                      segmentWordTimings,
                    );
                    const isWordTimingOpen = Boolean(
                      openTimingSegments[getTimingSegmentKey(item.localId, segment.localId)],
                    );

                    return (
                      <div
                        key={segment.localId}
                        className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-medium text-slate-500">Segment {segmentIndex + 1}</p>
                            <p className="text-[11px] text-slate-400">
                              {segmentLogicalParts.length} logical parts, {segmentWordTimings.length} word timings
                            </p>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                void saveSegmentTimings(item, segment);
                              }}
                              disabled={
                                updateLessonSegmentTimings.isPending ||
                                savingTimingSegmentKey ===
                                  getTimingSegmentKey(item.localId, segment.localId)
                              }
                              className={smallSecondaryButtonClass}
                            >
                              {savingTimingSegmentKey ===
                              getTimingSegmentKey(item.localId, segment.localId)
                                ? 'Saving…'
                                : 'Save segment timings'}
                            </button>
                            {item.segments.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeSegment(item.localId, segment.localId)}
                                className={smallDangerButtonClass}
                              >
                                Remove
                              </button>
                            )}
                          </div>
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
                          placeholder="Segment text"
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

                        <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                          <button
                            type="button"
                            onClick={() => toggleTimingSegment(item.localId, segment.localId)}
                            className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                            aria-expanded={isWordTimingOpen}
                          >
                            <span>
                              <span className="block text-xs font-medium text-slate-500">
                                Logical Parts
                              </span>
                              <span className="text-[11px] text-slate-400">
                                {segmentLogicalParts.length} parts with {segmentWordTimings.length} word timings
                              </span>
                            </span>
                            <span className="text-xs font-semibold text-slate-500">
                              {isWordTimingOpen ? 'Collapse' : 'Expand'}
                            </span>
                          </button>

                          {isWordTimingOpen ? (
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => addWordTiming(item.localId, segment.localId)}
                                className={smallSecondaryButtonClass}
                              >
                                + Add word timing
                              </button>
                            </div>
                          ) : null}

                          {isWordTimingOpen && segmentLogicalParts.length ? (
                            <div className="space-y-2">
                              {segmentLogicalParts.map((logicalPart, logicalPartIndex) => (
                                <div
                                  key={logicalPart.chunk.localId}
                                  className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                      <p className="text-xs font-semibold text-slate-600">
                                        Part {logicalPartIndex + 1}
                                      </p>
                                      <p className="text-sm text-slate-800">
                                        {getChunkDisplayText(logicalPart.words)}
                                      </p>
                                    </div>
                                    <span className="text-[11px] text-slate-400">
                                      {getChunkDisplayRange(logicalPart.words)}
                                    </span>
                                  </div>
                                  <div className="space-y-2">
                                    {logicalPart.words.map((mark, markIndex) => (
                                      <div
                                        key={mark.localId}
                                        className="grid gap-2 rounded-md border border-slate-200 bg-white p-2 md:grid-cols-[32px_minmax(180px,1fr)_110px_110px_auto]"
                                      >
                                        <span className="pt-2 text-xs font-medium text-slate-400">
                                          #{markIndex + 1}
                                        </span>
                                        <input
                                          value={mark.text}
                                          onChange={(event) =>
                                            updateItem(item.localId, (current) => ({
                                              ...current,
                                              wordTimings: current.wordTimings.map((entry) =>
                                                entry.localId === mark.localId
                                                  ? {
                                                      ...entry,
                                                      segmentLocalId: segment.localId,
                                                      text: event.target.value,
                                                      normalizedText: normalizeTimingText(event.target.value),
                                                    }
                                                  : entry,
                                              ),
                                            }))
                                          }
                                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                          placeholder="Word"
                                        />
                                        <input
                                          type="number"
                                          min={0}
                                          value={mark.startMs}
                                          onChange={(event) =>
                                            updateItem(item.localId, (current) => ({
                                              ...current,
                                              wordTimings: current.wordTimings.map((entry) =>
                                                entry.localId === mark.localId
                                                  ? {
                                                      ...entry,
                                                      segmentLocalId: segment.localId,
                                                      startMs: Number(event.target.value),
                                                    }
                                                  : entry,
                                              ),
                                            }))
                                          }
                                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                          aria-label="Word start ms"
                                        />
                                        <input
                                          type="number"
                                          min={1}
                                          value={mark.endMs}
                                          onChange={(event) =>
                                            updateItem(item.localId, (current) => ({
                                              ...current,
                                              wordTimings: current.wordTimings.map((entry) =>
                                                entry.localId === mark.localId
                                                  ? {
                                                      ...entry,
                                                      segmentLocalId: segment.localId,
                                                      endMs: Number(event.target.value),
                                                    }
                                                  : entry,
                                              ),
                                            }))
                                          }
                                          className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                          aria-label="Word end ms"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => removeWordTiming(item.localId, mark.localId)}
                                          className={smallDangerButtonClass}
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {isWordTimingOpen && !segmentLogicalParts.length ? (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                              Generate AI timings or add a word timing for this segment.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                  Generate AI timings to create segments for this item.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderDictionaryCoverage = () => {
    if (!lesson) return null;
    const visibleEntries = vocabularyTab === 'missing' ? missingVocabularyEntries : vocabularyTerms;
    const emptyListMessage =
      vocabularyTab === 'missing'
        ? 'All word and phrase terms currently have Armenian translations.'
        : 'Save segment timings, then create word terms from timings or add phrases by hand.';

    return (
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">Vocabulary translations</h3>
            <p className="text-xs text-slate-500">
              {missingArmenianTranslations.length} missing of {dictionaryCoverage.length} words and phrases.
              {sentenceVocabularyCount ? ` ${sentenceVocabularyCount} sentence entries are hidden.` : ''}
            </p>
          </div>
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setVocabularyTab('missing')}
              className={[
                vocabularyTabButtonClass,
                vocabularyTab === 'missing'
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-500 hover:bg-slate-50',
              ].join(' ')}
            >
              Missing
            </button>
            <button
              type="button"
              onClick={() => setVocabularyTab('all')}
              className={[
                vocabularyTabButtonClass,
                vocabularyTab === 'all'
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-500 hover:bg-slate-50',
              ].join(' ')}
            >
              All terms
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Missing</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{missingArmenianTranslations.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Translated</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{armenianTranslatedCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase text-slate-500">Total</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{dictionaryCoverage.length}</p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={vocabularyForm.englishText}
              onChange={(event) =>
                setVocabularyForm((prev) => ({ ...prev, englishText: event.target.value }))
              }
              placeholder="English word or phrase"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={vocabularyForm.translation}
              onChange={(event) =>
                setVocabularyForm((prev) => ({ ...prev, translation: event.target.value }))
              }
              placeholder="Armenian translation"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              value={vocabularyForm.focusText}
              onChange={(event) =>
                setVocabularyForm((prev) => ({ ...prev, focusText: event.target.value }))
              }
              placeholder="Pulse word"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                void saveVocabularyEntry();
              }}
              disabled={createEntry.isPending || updateEntry.isPending}
              className={smallSecondaryButtonClass}
            >
              {editingVocabularyId ? 'Save' : 'Add'}
            </button>
          </div>
          {editingVocabularyId ? (
            <button type="button" onClick={resetVocabularyForm} className={`${smallNeutralButtonClass} mt-2`}>
              Cancel editing
            </button>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">CSV translations</p>
              <p className="text-xs text-slate-500">
                Save segment timings first, create word terms from timings, then download/import translations.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={downloadMissingTranslationsCsv}
                disabled={!missingArmenianTranslations.length}
                className={smallSecondaryButtonClass}
              >
                Download CSV
              </button>
              <label className={smallNeutralButtonClass}>
                Import CSV
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    void importTranslationsCsv(file);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  void pullVocabularyFromTimings();
                }}
                disabled={pullFromTimings.isPending}
                className={smallSecondaryButtonClass}
              >
                {pullFromTimings.isPending ? 'Creating…' : 'Create words from timings'}
              </button>
            </div>
          </div>
          {csvImportFeedback ? (
            <p className="mt-2 text-xs font-medium text-slate-600">{csvImportFeedback}</p>
          ) : null}
        </div>

        {visibleEntries.length ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-medium text-slate-500">
                {selectedVocabularyCount} selected
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={selectAllVocabulary} className={smallNeutralButtonClass}>
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedVocabularyIds([])}
                  disabled={!selectedVocabularyCount}
                  className={smallNeutralButtonClass}
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void removeSelectedVocabularyEntries();
                  }}
                  disabled={!selectedVocabularyCount || bulkDeleteEntries.isPending}
                  className={smallDangerButtonClass}
                >
                  {bulkDeleteEntries.isPending ? 'Deleting…' : 'Delete selected'}
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
              {visibleEntries.map((entry) => {
                const isSelected = selectedVocabularyIds.includes(entry.id);
                const translation = getArmenianTranslation(entry);

                return (
                  <div key={entry.id} className="flex items-center justify-between gap-3 p-3">
                    <label className="flex min-w-0 flex-1 items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleVocabularySelection(entry.id)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                        aria-label={`Select ${entry.englishText}`}
                      />
                      <span className="grid min-w-0 flex-1 gap-1 sm:grid-cols-2">
                        <span className="truncate text-sm font-semibold text-slate-900">
                          {entry.englishText}
                        </span>
                        <span className={translation ? 'truncate text-sm text-slate-700' : 'truncate text-sm text-rose-600'}>
                          {translation ?? 'Missing Armenian translation'}
                        </span>
                        <span className="truncate text-xs text-slate-500 sm:col-span-2">
                          Pulse: {entry.focusText ?? entry.englishText}
                        </span>
                      </span>
                    </label>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditingVocabulary(entry)}
                        className={smallNeutralButtonClass}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void removeVocabularyEntry(entry.id);
                        }}
                        disabled={deleteEntry.isPending}
                        className={smallDangerButtonClass}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-500">
            {emptyListMessage}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/lessons" className={secondaryButtonClass}>
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

function getArmenianTranslation(entry: VocabularyEntry) {
  return entry.translations.find((translation) =>
    ['am', 'hy'].includes(translation.languageCode.toLowerCase()),
  )?.translation;
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

function findSegmentForTiming(
  segments: EditableSegment[],
  mark: { startMs: number; endMs: number },
) {
  return segments.find((segment) => isTimingInsideSegment(mark, segment));
}

function getWordTimingSegmentLocalId(
  mark: EditableWordTiming,
  segments: EditableSegment[],
) {
  if (mark.segmentLocalId && segments.some((segment) => segment.localId === mark.segmentLocalId)) {
    return mark.segmentLocalId;
  }
  return findSegmentForTiming(segments, mark)?.localId ?? segments[0]?.localId;
}

function getSegmentWordTimings(
  wordTimings: EditableWordTiming[],
  segment: EditableSegment,
  segments: EditableSegment[],
) {
  return wordTimings
    .filter((mark) => getWordTimingSegmentLocalId(mark, segments) === segment.localId)
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);
}

function orderWordTimingsBySegment<T extends EditableWordTiming>(
  segments: EditableSegment[],
  timings: T[],
): T[] {
  const segmentOrder = new Map(segments.map((segment, index) => [segment.localId, index]));
  return [...timings]
    .sort((left, right) => {
      const leftSegmentIndex = segmentOrder.get(getWordTimingSegmentLocalId(left, segments) ?? '') ?? Number.MAX_SAFE_INTEGER;
      const rightSegmentIndex = segmentOrder.get(getWordTimingSegmentLocalId(right, segments) ?? '') ?? Number.MAX_SAFE_INTEGER;
      return (
        leftSegmentIndex - rightSegmentIndex ||
        left.startMs - right.startMs ||
        left.endMs - right.endMs
      );
    })
    .map((timing, index) => ({ ...timing, order: index }));
}

function orderSentenceTimings<T extends EditableSentenceTiming>(timings: T[]): T[] {
  return [...timings]
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs)
    .map((timing, index) => ({ ...timing, order: index }));
}

function orderChunkTimings<T extends EditableChunkTiming>(timings: T[]): T[] {
  return [...timings]
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs)
    .map((timing, index) => ({ ...timing, order: index }));
}

function deriveChunkTimingFromWords(
  chunk: EditableChunkTiming,
  wordMarkIds: string[],
  wordTimingsById: Map<string, EditableWordTiming>,
): EditableChunkTiming {
  const linkedWords = wordMarkIds
    .map((wordMarkId) => wordTimingsById.get(wordMarkId))
    .filter((mark): mark is EditableWordTiming => Boolean(mark))
    .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);
  const text = linkedWords.map((word) => word.text.trim()).filter(Boolean).join(' ');
  const startMs = linkedWords[0]?.startMs ?? chunk.startMs;
  const endMs = linkedWords[linkedWords.length - 1]?.endMs ?? chunk.endMs;

  return {
    ...chunk,
    text,
    normalizedText: normalizeTimingText(text),
    startMs,
    endMs,
    wordMarkIds: linkedWords.map((word) => word.id),
  };
}

function getSegmentLogicalParts(
  chunkTimings: EditableChunkTiming[],
  segmentWordTimings: EditableWordTiming[],
) {
  const wordTimingsById = new Map(segmentWordTimings.map((mark) => [mark.id, mark]));
  const linkedWordIds = new Set<string>();
  const logicalParts = chunkTimings
    .map((chunk) => {
      const words = chunk.wordMarkIds
        .map((wordMarkId) => wordTimingsById.get(wordMarkId))
        .filter((mark): mark is EditableWordTiming => Boolean(mark))
        .sort((left, right) => left.startMs - right.startMs || left.endMs - right.endMs);
      if (!words.length) {
        return null;
      }
      words.forEach((word) => linkedWordIds.add(word.id));
      return { chunk, words };
    })
    .filter(
      (logicalPart): logicalPart is { chunk: EditableChunkTiming; words: EditableWordTiming[] } =>
        Boolean(logicalPart),
    );

  const singleWordParts = segmentWordTimings
    .filter((word) => !linkedWordIds.has(word.id))
    .map((word) => ({
      chunk: {
        id: `single-${word.id}`,
        localId: `single-${word.localId}`,
        text: word.text,
        normalizedText: word.normalizedText,
        startMs: word.startMs,
        endMs: word.endMs,
        wordMarkIds: [word.id],
        order: word.order,
      },
      words: [word],
    }));

  return [...logicalParts, ...singleWordParts].sort(
    (left, right) =>
      left.words[0].startMs - right.words[0].startMs ||
      left.words[left.words.length - 1].endMs - right.words[right.words.length - 1].endMs,
  );
}

function getChunkDisplayText(words: EditableWordTiming[]) {
  return words.map((word) => word.text.trim()).filter(Boolean).join(' ') || 'Untitled part';
}

function getChunkDisplayRange(words: EditableWordTiming[]) {
  if (!words.length) {
    return '0-0 ms';
  }
  return `${words[0].startMs}-${words[words.length - 1].endMs} ms`;
}

function deriveSegmentSentenceTimings(
  segments: EditableSegment[],
  wordTimings: EditableWordTiming[],
): EditableSentenceTiming[] {
  return orderSentenceTimings(
    segments.flatMap((segment) => {
      const linkedWords = wordTimings.filter(
        (mark) => getWordTimingSegmentLocalId(mark, segments) === segment.localId,
      );
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
