type TimingRange = {
  id: string;
  startMs: number;
  endMs: number;
};

type SentenceTimingRange = TimingRange & {
  wordMarkIds: string[];
};

type EditableTimingItem = {
  localId: string;
  segments: { localId: string }[];
};

export function getTimingSegmentKey(itemLocalId: string, segmentLocalId: string) {
  return `${itemLocalId}:${segmentLocalId}`;
}

export function retainOpenTimingSegments(
  current: Record<string, true>,
  items: EditableTimingItem[],
) {
  const availableKeys = new Set(
    items.flatMap((item) =>
      item.segments.map((segment) =>
        getTimingSegmentKey(item.localId, segment.localId),
      ),
    ),
  );
  const retained = Object.fromEntries(
    Object.keys(current)
      .filter((key) => availableKeys.has(key))
      .map((key) => [key, true] as const),
  );

  return Object.keys(retained).length === Object.keys(current).length
    ? current
    : retained;
}

export function buildWordTimingSegmentIdMap(
  segments: TimingRange[],
  sentenceTimings: SentenceTimingRange[],
) {
  const segmentById = new Map(segments.map((segment) => [segment.id, segment]));
  const segmentIdByWordId = new Map<string, string>();

  for (const sentence of sentenceTimings) {
    const segment =
      segmentById.get(sentence.id) ??
      segments.find(
        (candidate) =>
          candidate.startMs === sentence.startMs &&
          candidate.endMs === sentence.endMs,
      ) ??
      segments.find(
        (candidate) =>
          sentence.startMs >= candidate.startMs &&
          sentence.startMs < candidate.endMs,
      );
    if (!segment) continue;

    for (const wordMarkId of sentence.wordMarkIds) {
      segmentIdByWordId.set(wordMarkId, segment.id);
    }
  }

  return segmentIdByWordId;
}
