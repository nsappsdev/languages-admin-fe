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

export function SentenceAudioControls({ text, recordings, plannedEnds, allowRegeneration, disabled, onGenerate, onDirtyChange }: {
  text: string;
  recordings: SentenceRecording[];
  plannedEnds?: number[];
  allowRegeneration: boolean;
  disabled: boolean;
  onGenerate: (endOffsets: number[], regenerateSentenceIndex?: number) => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const id = useId();
  const initialEnds = recordings.length
    ? recordings.map((sentence, index) => index === recordings.length - 1 ? text.length : sentence.charEnd)
    : plannedEnds ?? sentenceEnds(text);
  const [editedEnds, setEditedEnds] = useState<number[] | null>(null);
  const [splitAt, setSplitAt] = useState<{ index: number; offset: number } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const ends = editedEnds ?? initialEnds;
  const dirty = editedEnds !== null;
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
        <p className="mt-1 text-sm text-slate-600">Review {spans.length} sentences. Each gets a separate recording. Full-text playback joins them in order.</p></div>
      {dirty ? <button type="button" disabled={disabled} onClick={() => { setEditedEnds(null); setSplitAt(null); }} className={buttonClass}>Reset sentence breaks</button> : null}
    </div>
    <p className="text-xs text-slate-500">To split a sentence, place the cursor between words below. Use Join next to combine two sentences. Edit wording in Full text.</p>
    <ol className="max-h-96 divide-y divide-slate-200 overflow-y-auto rounded-md border border-slate-200">
      {spans.map((span, index) => {
        const recording = recordings.find(item => item.charStart === span.charStart && item.charEnd === span.charEnd && item.text === span.text);
        const offset = splitAt?.index === index ? splitAt.offset : -1;
        const canSplit = offset > span.charStart && offset < span.charEnd &&
          /\s/.test(text[offset - 1] ?? '') && /[\p{L}\p{N}]/u.test(text.slice(span.charStart, offset)) && /[\p{L}\p{N}]/u.test(text.slice(offset, span.charEnd));
        return <li key={`${span.charStart}-${span.charEnd}`} className="space-y-2 p-3">
          <label htmlFor={`${id}-${index}`} className="text-xs font-semibold text-slate-600">Sentence {index + 1}{recording ? ' · Ready' : ' · Needs audio'}</label>
          <textarea id={`${id}-${index}`} readOnly value={span.text} rows={2} disabled={disabled}
            onSelect={event => setSplitAt({ index, offset: span.charStart + event.currentTarget.selectionStart })}
            className="w-full resize-y rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm focus-visible:outline-brand-500" />
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={disabled || !canSplit} onClick={() => { setEditedEnds([...ends.slice(0, index), offset, ...ends.slice(index)]); setSplitAt(null); }}
              aria-label={`Split sentence ${index + 1} at cursor`} className={buttonClass}>Split at cursor</button>
            {index < spans.length - 1 ? <button type="button" disabled={disabled} onClick={() => { setEditedEnds(ends.filter((_, position) => position !== index)); setSplitAt(null); }}
              aria-label={`Join sentence ${index + 1} with next`} className={buttonClass}>Join next</button> : null}
            {recording ? <button type="button" onClick={() => setPreview(preview === recording.assetId ? null : recording.assetId)}
              aria-label={`Listen to sentence ${index + 1}`} className={buttonClass}>{preview === recording.assetId ? 'Close preview' : 'Listen'}</button> : null}
            <button type="button" disabled={disabled || dirty || !allowRegeneration} onClick={() => onGenerate(ends, index)}
              aria-label={`Regenerate sentence ${index + 1}`} className={buttonClass}>Regenerate sentence</button>
          </div>
          {recording && preview === recording.assetId ? <RecordingPreview key={recording.assetId} assetId={recording.assetId} word={`sentence ${index + 1}`} /> : null}
        </li>;
      })}
    </ol>
    <button type="button" disabled={disabled || !spans.length} onClick={() => onGenerate(ends)}
      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{dirty ? 'Apply breaks and prepare audio' : 'Prepare sentence audio'}</button>
    <p className="text-xs text-slate-500">Preparation reuses matching recordings. Generating missing audio or regenerating a sentence uses ElevenLabs credits.</p>
  </section>;
}
