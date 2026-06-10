type TimingRange = {
  id: string;
  startMs: number;
  endMs: number;
};

type SentenceTimingRange = TimingRange & {
  wordMarkIds: string[];
};

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
