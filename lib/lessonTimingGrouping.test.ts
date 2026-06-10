import { buildWordTimingSegmentIdMap } from './lessonTimingGrouping';

describe('buildWordTimingSegmentIdMap', () => {
  it('uses sentence word links even when every word has the same timestamp', () => {
    const result = buildWordTimingSegmentIdMap(
      [
        { id: 'sentence-1', startMs: 0, endMs: 240 },
        { id: 'sentence-2', startMs: 0, endMs: 240 },
      ],
      [
        {
          id: 'sentence-1',
          startMs: 0,
          endMs: 240,
          wordMarkIds: ['word-1', 'word-2', 'word-3'],
        },
        {
          id: 'sentence-2',
          startMs: 0,
          endMs: 240,
          wordMarkIds: ['word-4', 'word-5'],
        },
      ],
    );

    expect(Object.fromEntries(result)).toEqual({
      'word-1': 'sentence-1',
      'word-2': 'sentence-1',
      'word-3': 'sentence-1',
      'word-4': 'sentence-2',
      'word-5': 'sentence-2',
    });
  });

  it('falls back to an exact sentence range for saved generated ids', () => {
    const result = buildWordTimingSegmentIdMap(
      [{ id: 'segment-1', startMs: 100, endMs: 900 }],
      [
        {
          id: 'saved-sentence-1',
          startMs: 100,
          endMs: 900,
          wordMarkIds: ['word-1'],
        },
      ],
    );

    expect(result.get('word-1')).toBe('segment-1');
  });
});
