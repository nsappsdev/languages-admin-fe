'use client';
import { useEffect, useId, useState } from 'react';
import type { SentenceRecording } from '../../lib/textAuthoringTypes';
import { RecordingPreview } from '../vocabulary/RecordingPreview';

function sentenceEnds(text: string) {
  if (!text.trim()) return [];
  const parts = [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)];
  const ends = parts.filter((part, index) => /[\p{L}\p{N}]/u.test(part.segment) && (index === parts.length - 1 ||
    !/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St)\.$/i.test(part.segment.trimEnd())))
    .map(part => part.index + part.segment.length);
  if (ends.length) ends[ends.length - 1] = text.length;
  return ends;
}

export function SentenceAudioControls({ text, recordings, plannedEnds, disabled, audioDisabled, onSave, onGenerate, onRepair, onDirtyChange }: {
  text: string;
  recordings: SentenceRecording[];
  plannedEnds?: number[];
  audioDisabled?: boolean;
  onSave: (endOffsets: number[]) => Promise<void>;
  disabled: boolean;
  onGenerate: (endOffsets: number[], sentenceIndex?: number, regenerate?: boolean) => void;
  onRepair?: (sentenceIndex: number) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const id = useId();
  const initialEnds = plannedEnds ?? (recordings.length
    ? recordings.map((sentence, index) => index === recordings.length - 1 ? text.length : sentence.charEnd)
    : sentenceEnds(text));
  const [editedEnds, setEditedEnds] = useState<number[] | null>(null);
  const [splitAt, setSplitAt] = useState<{ index: number; offset: number } | null>(null);
  const [saveError, setSaveError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const ends = editedEnds ?? initialEnds;
  const dirty = editedEnds !== null && JSON.stringify(editedEnds) !== JSON.stringify(initialEnds);
  useEffect(() => { onDirtyChange(dirty); return () => onDirtyChange(false); }, [dirty, onDirtyChange]);
  const spans = ends.map((end, index) => {
    const start = ends[index - 1] ?? 0;
    const raw = text.slice(start, end);
    return { text: raw.trim(), charStart: start + raw.length - raw.trimStart().length, charEnd: end - (raw.length - raw.trimEnd().length) };
  });
  const buttonClass = 'rounded-md border border-slate-300 px-3 py-2 text-xs disabled:opacity-50';
  return <section aria-label="Sentence audio" className="space-y-3 rounded-lg border border-slate-200 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-base font-semibold text-slate-900">Sentence audio</h3>
        <p className="mt-1 text-sm text-slate-600">Review {spans.length} {spans.length === 1 ? 'sentence' : 'sentences'}. Each gets a separate recording. Playback reads these recordings in order.</p></div>
      {dirty ? <button type="button" disabled={disabled} onClick={() => { setEditedEnds(null); setSplitAt(null); }} className={buttonClass}>Reset sentence breaks</button> : null}
    </div>
    <p className="text-xs text-slate-500">To split a sentence, place the cursor between words below. Use Join next to combine two sentences. Edit wording in Full text.</p>
    <ol className="max-h-96 divide-y divide-slate-200 overflow-y-auto rounded-md border border-slate-200">
      {spans.map((span, index) => {
        const recording = recordings.find(item => item.charStart === span.charStart && item.charEnd === span.charEnd && item.text === span.text);
        const regenerate = Boolean(recording?.assetId || recording?.requiresRegeneration);
        const offset = splitAt?.index === index ? splitAt.offset : -1;
        const canSplit = offset > span.charStart && offset < span.charEnd &&
          /\s/.test(text[offset - 1] ?? '') && /[\p{L}\p{N}]/u.test(text.slice(span.charStart, offset)) && /[\p{L}\p{N}]/u.test(text.slice(offset, span.charEnd));
        return <li key={`${span.charStart}-${span.charEnd}`} className="space-y-2 p-3">
          <label htmlFor={`${id}-${index}`} className="text-xs font-semibold text-slate-600">Sentence {index + 1}{recording?.assetId ? recording.alignmentIssue ? ' · Timing needs review' : ' · Ready' : ' · Needs audio'}</label>
          <textarea id={`${id}-${index}`} readOnly value={span.text} rows={2} disabled={disabled}
            onSelect={event => setSplitAt({ index, offset: span.charStart + event.currentTarget.selectionStart })}
            className="w-full resize-y rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm focus-visible:outline-brand-500" />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={disabled || !canSplit} onClick={() => { setEditedEnds([...ends.slice(0, index), offset, ...ends.slice(index)]); setSplitAt(null); }}
              aria-label={`Split sentence ${index + 1} at cursor`} className={buttonClass}>Split at cursor</button>
            {index < spans.length - 1 ? <button type="button" disabled={disabled} onClick={() => { setEditedEnds(ends.filter((_, position) => position !== index)); setSplitAt(null); }}
              aria-label={`Join sentence ${index + 1} with next`} className={buttonClass}>Join next</button> : null}
            {recording?.assetId ? <button type="button" onClick={() => setPreview(preview === recording.assetId ? null : recording.assetId)}
              aria-label={`Listen to sentence ${index + 1}`} className={buttonClass}>{preview === recording.assetId ? 'Close preview' : 'Listen'}</button> : null}
            {recording?.alignmentIssue && onRepair ? <button type="button" disabled={disabled || dirty || recording.canRepair === false}
              onClick={() => onRepair(index)} aria-label={`Repair timings for sentence ${index + 1}`} className={buttonClass}>Repair timings</button> : null}
            <button type="button" disabled={disabled || audioDisabled} onClick={() => onGenerate(ends, index, regenerate)}
              aria-label={`${regenerate ? 'Regenerate' : 'Generate'} sentence ${index + 1}`} className={buttonClass}>{regenerate ? 'Regenerate sentence' : 'Generate sentence'}</button>
          </div>
          {recording?.requiresRegeneration ? <p className="text-sm text-amber-800">The previous request could not be confirmed. Use Regenerate sentence to make a new request.</p> : null}
          {recording?.alignmentIssue ? <p className="text-sm text-amber-800">{recording.alignmentIssue} {recording.repairError ?? 'The recording is saved. Repair timings keeps the same audio.'}</p> : null}
          {recording?.assetId && preview === recording.assetId ? <RecordingPreview key={recording.assetId} assetId={recording.assetId} word={`sentence ${index + 1}`} /> : null}
        </li>;
      })}
    </ol>
    <div className="flex flex-wrap gap-3">
    {dirty ? <button type="button" disabled={disabled} onClick={() => { setSaveError(''); void onSave(ends).then(() => setEditedEnds(null)).catch(error => setSaveError(error instanceof Error ? error.message : 'Unable to save sentence breaks.')); }} className={buttonClass}>Save sentence breaks</button> : null}
    <button type="button" disabled={disabled || audioDisabled || !spans.length} onClick={() => onGenerate(ends)}
      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Generate all sentences</button>
    </div>
    {saveError ? <p role="alert" className="text-sm text-rose-700">{saveError}</p> : null}
    <p className="text-xs text-slate-500">Preparation reuses matching recordings and checks their timings automatically. Timing repair keeps the audio and may use ElevenLabs alignment credits. Generating or regenerating audio uses speech credits.</p>
  </section>;
}
