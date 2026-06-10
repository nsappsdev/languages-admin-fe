export type TimingField = 'startMs' | 'endMs';

export type TimingRange = {
  startMs: number;
  endMs: number;
};

function parseTimingValue(rawValue: string) {
  if (!rawValue.trim()) {
    return null;
  }
  const value = Number(rawValue);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export function clearItemTimingDrafts(
  drafts: Record<string, string>,
  itemLocalId: string,
) {
  const itemPrefix = `${itemLocalId}:`;
  return Object.fromEntries(
    Object.entries(drafts).filter(([key]) => !key.startsWith(itemPrefix)),
  );
}

export function clearSegmentTimingDrafts(
  drafts: Record<string, string>,
  itemLocalId: string,
  segmentLocalId: string,
) {
  const segmentPrefix = `${itemLocalId}:${segmentLocalId}:`;
  return Object.fromEntries(
    Object.entries(drafts).filter(([key]) => !key.startsWith(segmentPrefix)),
  );
}

export function applyTimingDraft({
  bounds,
  field,
  range,
  rawValue,
}: {
  bounds?: TimingRange;
  field: TimingField;
  range: TimingRange;
  rawValue: string;
}): { error?: string; range?: TimingRange } {
  const value = parseTimingValue(rawValue);
  if (value === null) {
    return { error: 'Timing must be a non-negative whole number.' };
  }

  const nextRange = { ...range, [field]: value };
  if (nextRange.endMs <= nextRange.startMs) {
    return { error: 'End timing must be greater than start timing.' };
  }
  if (
    bounds &&
    (nextRange.startMs < bounds.startMs || nextRange.endMs > bounds.endMs)
  ) {
    return { error: 'Word timing must stay inside its sentence timing.' };
  }

  return { range: nextRange };
}

export function applyTimingRangeDrafts({
  bounds,
  endRawValue,
  range,
  startRawValue,
}: {
  bounds?: TimingRange;
  endRawValue?: string;
  range: TimingRange;
  startRawValue?: string;
}): { error?: string; range?: TimingRange } {
  const startMs =
    startRawValue === undefined ? range.startMs : parseTimingValue(startRawValue);
  const endMs =
    endRawValue === undefined ? range.endMs : parseTimingValue(endRawValue);
  if (startMs === null || endMs === null) {
    return { error: 'Timing must be a non-negative whole number.' };
  }

  const nextRange = { startMs, endMs };
  if (nextRange.endMs <= nextRange.startMs) {
    return { error: 'End timing must be greater than start timing.' };
  }
  if (
    bounds &&
    (nextRange.startMs < bounds.startMs || nextRange.endMs > bounds.endMs)
  ) {
    return { error: 'Word timing must stay inside its sentence timing.' };
  }

  return { range: nextRange };
}
