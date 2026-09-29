'use client';

import { OccurrencesResponse } from '../../lib/textAuthoringTypes';
import { Fragment } from 'react';

interface OccurrenceSelectionProps {
  occurrences: OccurrencesResponse;
  pendingOccurrenceId: string | null;
  onToggle: (occurrenceId: string, selected: boolean) => void;
  focusedOccurrenceId: string | null;
  onFocusOccurrence: (occurrenceId: string) => void;
}

/**
 * Repeated words are disambiguated by sentence/position; nothing is selected
 * by default (product requirement: most simple words are deliberately
 * excluded, "select all" is never the default).
 */
export function OccurrenceSelection({ occurrences, pendingOccurrenceId, onToggle, focusedOccurrenceId, onFocusOccurrence }: OccurrenceSelectionProps) {
  const needsReview = occurrences.status === 'NEEDS_REVIEW';

  return (
    <div className="divide-y divide-slate-100">
      {needsReview ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Alignment needs review. Word selection is unavailable; you can still listen to the narration.
          Manual alignment correction is not available yet.
        </p>
      ) : null}
      {occurrences.sentences.map((sentence, index) => {
        const words = occurrences.occurrences
          .filter((word) => word.sentenceId === sentence.id)
          .sort((a, b) => a.charStart - b.charStart);
        let cursor = 0;
        return (
        <section key={sentence.id} aria-label={`Sentence ${index + 1}`} className="flex gap-3 py-4 first:pt-1">
          <h4 className="pt-2 text-[11px] tabular-nums text-slate-400" title={`Sentence ${index + 1}`}><span className="sr-only">Sentence </span>{String(index + 1).padStart(2, '0')}</h4>
          <div className="min-w-0 whitespace-pre-wrap break-words text-lg leading-relaxed text-slate-800">
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
              const incomplete = occurrence.selected && (!occurrence.clipAssetId || !occurrence.translations.some((t) => t.languageCode === 'am' && t.translation.trim()));
              return (
                <Fragment key={occurrence.id}>
                  {prefix}
                  <span className="inline-block whitespace-nowrap">
                  <button
                    type="button"
                    aria-pressed={occurrence.selected}
                    aria-label={`${occurrence.selected ? 'Show' : 'Select'} occurrence "${occurrence.text}" (position ${occurrence.ordinal})`}
                    disabled={disabled}
                    onClick={() => {
                      onFocusOccurrence(occurrence.id);
                      if (!occurrence.selected) onToggle(occurrence.id, true);
                    }}
                    className={`rounded px-0.5 py-1 text-left transition focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 ${
                      incomplete ? 'bg-amber-50 text-amber-800 underline decoration-amber-400 underline-offset-4'
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
