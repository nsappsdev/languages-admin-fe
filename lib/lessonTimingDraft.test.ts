import {
  applyTimingDraft,
  applyTimingRangeDrafts,
  clearItemTimingDrafts,
  clearSegmentTimingDrafts,
} from './lessonTimingDraft';

describe('clearItemTimingDrafts', () => {
  it('removes stale drafts for regenerated timings and keeps other items', () => {
    expect(
      clearItemTimingDrafts(
        {
          'item-1:sentence-1:sentence-1:startMs': '9900',
          'item-1:sentence-1:sentence-1:endMs': '10620',
          'item-2:sentence-1:sentence-1:startMs': '500',
        },
        'item-1',
      ),
    ).toEqual({
      'item-2:sentence-1:sentence-1:startMs': '500',
    });
  });
});

describe('clearSegmentTimingDrafts', () => {
  it('removes drafts only for the rolled-back sentence', () => {
    expect(
      clearSegmentTimingDrafts(
        {
          'item-1:sentence-1:sentence-1:startMs': '9900',
          'item-1:sentence-1:word-1:endMs': '10100',
          'item-1:sentence-2:sentence-2:startMs': '10800',
          'item-2:sentence-1:sentence-1:startMs': '500',
        },
        'item-1',
        'sentence-1',
      ),
    ).toEqual({
      'item-1:sentence-2:sentence-2:startMs': '10800',
      'item-2:sentence-1:sentence-1:startMs': '500',
    });
  });
});

describe('applyTimingDraft', () => {
  it('commits the exact integer without sorting or rounding', () => {
    expect(
      applyTimingDraft({
        field: 'startMs',
        range: { startMs: 100, endMs: 500 },
        rawValue: '275',
      }),
    ).toEqual({ range: { startMs: 275, endMs: 500 } });
  });

  it('rejects invalid ranges', () => {
    expect(
      applyTimingDraft({
        field: 'endMs',
        range: { startMs: 400, endMs: 700 },
        rawValue: '400',
      }),
    ).toEqual({ error: 'End timing must be greater than start timing.' });
  });

  it('rejects an empty timing instead of treating it as zero', () => {
    expect(
      applyTimingDraft({
        field: 'startMs',
        range: { startMs: 100, endMs: 500 },
        rawValue: '',
      }),
    ).toEqual({ error: 'Timing must be a non-negative whole number.' });
  });

  it('keeps word timings inside the sentence', () => {
    expect(
      applyTimingDraft({
        bounds: { startMs: 100, endMs: 1000 },
        field: 'endMs',
        range: { startMs: 400, endMs: 700 },
        rawValue: '1100',
      }),
    ).toEqual({ error: 'Word timing must stay inside its sentence timing.' });
  });
});

describe('applyTimingRangeDrafts', () => {
  it('applies start and end drafts together', () => {
    expect(
      applyTimingRangeDrafts({
        range: { startMs: 0, endMs: 100 },
        startRawValue: '200',
        endRawValue: '300',
      }),
    ).toEqual({ range: { startMs: 200, endMs: 300 } });
  });

  it('keeps the saved value for a field without a draft', () => {
    expect(
      applyTimingRangeDrafts({
        range: { startMs: 100, endMs: 500 },
        endRawValue: '700',
      }),
    ).toEqual({ range: { startMs: 100, endMs: 700 } });
  });
});
