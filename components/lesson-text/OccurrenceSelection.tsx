'use client';

import { OccurrencesResponse } from '../../lib/textAuthoringTypes';
import { Fragment, useEffect, useState } from 'react';
import { learningOccurrences } from '../../lib/vocabularyImport';

interface OccurrenceSelectionProps {
  occurrences: OccurrencesResponse;
  pendingOccurrenceId: string | null;
  onToggle: (occurrenceId: string, selected: boolean) => void;
  focusedOccurrenceId: string | null;
  onFocusOccurrence: (occurrenceId: string) => void;
  onCreatePhrase?: (firstId: string, lastId: string) => Promise<void>;
  onDraftChange?: (dirty: boolean) => void;
}

/**
 * Repeated words are disambiguated by sentence/position; nothing is selected
 * by default (product requirement: most simple words are deliberately
 * excluded, "select all" is never the default).
 */
export function OccurrenceSelection({ occurrences, pendingOccurrenceId, onToggle, focusedOccurrenceId, onFocusOccurrence, onCreatePhrase, onDraftChange }: OccurrenceSelectionProps) {
  const [phraseMode, setPhraseMode] = useState(false);
  const [startId, setStartId] = useState<string | null>(null);
  const [endId, setEndId] = useState<string | null>(null);
  const [phraseError, setPhraseError] = useState('');
  const selected = learningOccurrences(occurrences);
  const phraseStart = occurrences.occurrences.find(word => word.id === startId);
  const phraseEnd = occurrences.occurrences.find(word => word.id === endId);
  const sentence = occurrences.sentences.find(item => item.id === phraseStart?.sentenceId);
  const phrase = phraseStart && phraseEnd && sentence ? sentence.text.slice(phraseStart.charStart - sentence.charStart, phraseEnd.charEnd - sentence.charStart) : '';
  const overlap = phraseStart && phraseEnd && selected.some(word => word.charStart < phraseEnd.charEnd && word.charEnd > phraseStart.charStart);
  useEffect(() => { onDraftChange?.(!!startId); return () => onDraftChange?.(false); }, [startId, onDraftChange]);
  const cancelPhrase = () => { setPhraseMode(false); setStartId(null); setEndId(null); setPhraseError(''); };
  const addPhrase = async () => {
    if (!phraseStart || !phraseEnd || overlap) return;
    try { await onCreatePhrase?.(phraseStart.id, phraseEnd.id); cancelPhrase(); }
    catch (error) { setPhraseError(error instanceof Error ? error.message : 'Unable to add phrase. Try again.'); }
  };
  const needsReview = occurrences.status === 'NEEDS_REVIEW';

  return (
    <div>
      {onCreatePhrase ? <div className="mb-3 space-y-2 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" aria-pressed={phraseMode} disabled={needsReview || !!pendingOccurrenceId} onClick={() => phraseMode ? cancelPhrase() : setPhraseMode(true)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">{phraseMode ? 'Cancel phrase' : 'Select a phrase'}</button>
          <span className="text-xs text-slate-600">{phraseMode ? phraseStart ? 'Now choose the last word in the same sentence.' : 'Choose the first word of your phrase.' : 'Click a word to select it, or group consecutive words.'}</span>
        </div>
        {phrase ? <div className="flex flex-wrap items-center gap-3"><span className="text-sm font-medium">{phrase}</span>
          <button type="button" disabled={!!overlap || !!pendingOccurrenceId} onClick={() => void addPhrase()} className="rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Add phrase</button></div> : null}
        {overlap ? <p role="alert" className="text-sm text-amber-800">This phrase overlaps a selected word or phrase. Remove that selection first.</p> : null}
        {phraseError ? <p role="alert" className="text-sm text-rose-700">{phraseError}</p> : null}
      </div> : null}
      {needsReview ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Alignment needs review. Word selection is unavailable; you can still listen to the narration.
          Manual alignment correction is not available yet.
        </p>
      ) : null}
      {occurrences.sentences.map((sentence, index) => {
        const words = occurrences.occurrences
          .filter(word => phraseMode || !selected.some(range => word.charStart > range.charStart && word.charStart < range.charEnd))
          .map(word => phraseMode ? word : selected.find(range => range.id === word.id) ?? word)
          .filter((word) => word.sentenceId === sentence.id)
          .sort((a, b) => a.charStart - b.charStart);
        let cursor = 0;
        return (
        <section key={sentence.id} aria-label={`Sentence ${index + 1}`} className="flex gap-3 py-4 first:pt-1">
          <h4 className="pt-2 text-[11px] tabular-nums text-slate-400" title={`Sentence ${index + 1}`}><span className="sr-only">Sentence </span>{String(index + 1).padStart(2, '0')}</h4>
          <div className="min-w-0 whitespace-pre-wrap break-words text-base leading-8 text-slate-800">
            {words.map((occurrence, wordIndex) => {
              const start = occurrence.charStart - sentence.charStart;
              const end = occurrence.charEnd - sentence.charStart;
              const prefix = sentence.text.slice(cursor, start);
              const nextStart = words[wordIndex + 1]?.charStart;
              const gapEnd = nextStart === undefined ? sentence.text.length : nextStart - sentence.charStart;
              // Keep punctuation beside its word without changing the occurrence's
              // source offsets or including punctuation in its selectable button.
              const punctuation = sentence.text.slice(end, gapEnd).match(/^\p{P}+/u)?.[0] ?? '';
              cursor = end + punctuation.length;
              const disabled = needsReview || occurrence.mappingStatus === 'UNMAPPED' || Boolean(pendingOccurrenceId);
              const incomplete = occurrence.selected && !occurrence.translations.some((t) => ['hy', 'am'].includes(t.languageCode) && t.translation.trim());
              return (
                <Fragment key={occurrence.id}>
                  {prefix}
                  <span className={occurrence.endOccurrenceId ? 'inline whitespace-normal' : 'inline-block whitespace-nowrap'}>
                  <button
                    type="button"
                    aria-pressed={occurrence.selected}
                    aria-label={`${occurrence.selected ? 'Show' : 'Select'} occurrence "${occurrence.text}" (position ${occurrence.ordinal})`}
                    disabled={disabled}
                    onClick={() => {
                      if (phraseMode) {
                        setPhraseError('');
                        if (!phraseStart || phraseEnd) { setStartId(occurrence.id); setEndId(null); }
                        else if (occurrence.sentenceId !== phraseStart.sentenceId || occurrence.charStart <= phraseStart.charStart) {
                          setPhraseError('Choose a later word in the same sentence.');
                        } else setEndId(occurrence.id);
                        return;
                      }
                      onFocusOccurrence(occurrence.id);
                      if (!occurrence.selected) onToggle(occurrence.id, true);
                    }}
                    className={`rounded px-0.5 py-1 text-left transition focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                      phraseMode && phraseStart && occurrence.charStart >= phraseStart.charStart && occurrence.charEnd <= (phraseEnd?.charEnd ?? phraseStart.charEnd) ? 'bg-brand-100 text-brand-900' : incomplete ? 'bg-amber-50 text-amber-800 underline decoration-amber-400 underline-offset-4'
                        : occurrence.selected ? 'bg-brand-50 text-brand-800 underline decoration-brand-400 underline-offset-4'
                          : 'hover:bg-slate-100'
                    } ${focusedOccurrenceId === occurrence.id ? 'ring-2 ring-brand-400' : ''}`}
                    title={occurrence.mappingStatus === 'UNMAPPED' ? 'Not mappable to speech in this narration' : undefined}
                  >
                    {sentence.text.slice(start, end)}
                  </button>
                  {punctuation}
                  </span>
                </Fragment>
              );
            })}
            {sentence.text.slice(cursor)}
          </div>
        </section>
      );})}
      {!occurrences.sentences.length ? <p className="text-sm text-slate-500">No aligned sentences available yet.</p> : null}
    </div>
  );
}
