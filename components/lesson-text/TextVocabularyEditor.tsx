'use client';

import { useEffect, useRef, useState } from 'react';
import { useAudioAsset } from '../../hooks/useAudioAsset';
import { OccurrenceSentence, WordOccurrenceDto } from '../../lib/textAuthoringTypes';
import { armenianTranslation } from '../../lib/vocabularyImport';


/** Clip controls stay small; duration comes from the actual authenticated audio. */
function ClipPlayer({ assetId, occurrenceId, word }: { assetId: string; occurrenceId: string; word: string }) {
  const { url, error, isLoading } = useAudioAsset(assetId);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setPlaybackError(null);
    if (!audio.paused) {
      audio.pause();
      return;
    }
    try {
      audio.currentTime = 0;
      await audio.play();
    } catch {
      setPlaybackError('Could not play this clip. Try again.');
    }
  };

  return (
    <>
      <button type="button" onClick={() => void togglePlayback()} disabled={!url || isLoading || Boolean(error)}
        aria-label={`${playing ? 'Pause' : 'Play'} clip for ${word} `}
        title={playing ? 'Pause clip' : 'Play extracted clip'}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:border-brand-300 hover:text-brand-700 focus-visible:outline-brand-500 disabled:opacity-50">
        <span aria-hidden="true">{playing ? 'Ⅱ' : '▶'}</span>
        {duration !== null ? `${duration.toFixed(2)}s` : isLoading ? 'Loading' : 'Clip'}
      </button>
      {url ? <audio ref={audioRef} src={url} preload="metadata" data-testid={`clip-player-${occurrenceId}`}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          setDuration(Number.isFinite(value) ? value : null);
        }}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
        onError={() => { setPlaying(false); setPlaybackError('Unable to decode this audio clip.'); }}
      /> : null}
      {error || playbackError ? <span role="alert" className="basis-full text-xs text-rose-700">{error ?? playbackError}</span> : null}
    </>
  );
}

interface TextVocabularyEditorProps {
  selectedOccurrences: WordOccurrenceDto[];
  onSaveTranslation: (entryId: string, translation: string) => void;
  savingEntryId: string | null;
  sentences: OccurrenceSentence[];
  focusedOccurrenceId: string | null;
  focusRequest: number;
  onRemove: (occurrenceId: string) => void;
  isSelecting: boolean;
  onDirtyChange?: (occurrenceId: string, dirty: boolean) => void;
}

function OccurrenceRow({
  occurrence,
  onSaveTranslation,
  savingEntryId,
  sentence,
  sentenceNumber,
  focused,
  focusRequest,
  onRemove,
  isSelecting,
  onDirtyChange,
}: {
  occurrence: WordOccurrenceDto;
  onSaveTranslation: (entryId: string, translation: string) => void;
  savingEntryId: string | null;
  sentence?: OccurrenceSentence;
  sentenceNumber: number;
  focused: boolean;
  focusRequest: number;
  onRemove: (occurrenceId: string) => void;
  isSelecting: boolean;
  onDirtyChange?: (occurrenceId: string, dirty: boolean) => void;
}) {
  const existing = occurrence.translations.find((t) => ['hy', 'am'].includes(t.languageCode));
  const [draft, setDraft] = useState(existing?.translation ?? '');
  const rowRef = useRef<HTMLDetailsElement>(null);
  const translationRef = useRef<HTMLInputElement>(null);
  const missingTranslation = !existing?.translation.trim();
  const hasChanged = draft !== (existing?.translation ?? '');
  const saving = savingEntryId === occurrence.entryId;

  useEffect(() => {
    onDirtyChange?.(occurrence.id, hasChanged || saving);
    return () => onDirtyChange?.(occurrence.id, false);
  }, [onDirtyChange, occurrence.id, hasChanged, saving]);

  useEffect(() => {
    if (focused) {
      if (rowRef.current) rowRef.current.open = true;
      rowRef.current?.scrollIntoView?.({ block: 'nearest' });
      translationRef.current?.focus({ preventScroll: true });
    }
  }, [focused, focusRequest]);

  return (
    <details ref={rowRef} open={missingTranslation || focused || hasChanged || saving || undefined} data-testid={`vocabulary-${occurrence.id}`} className={`group px-3 py-1 ${focused ? 'bg-brand-50' : 'hover:bg-slate-50'}`}>
      <summary className="cursor-pointer py-3 text-sm marker:text-slate-500 focus-visible:outline-brand-500">
        <span className="ml-1 font-semibold text-slate-900">{occurrence.text}</span>
        <span className="ml-2 text-slate-600">{hasChanged ? 'Unsaved translation' : existing?.translation || 'Add translation'}</span>
        {occurrence.endOccurrenceId ? <span className="ml-2 text-xs text-slate-600">Phrase</span> : null}
      </summary>
      <div className="space-y-2 pb-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h4 className="break-words text-sm font-semibold text-slate-900">{occurrence.text}</h4>
          <span className="shrink-0 text-[11px] text-slate-400" title={`Sentence ${sentenceNumber}, occurrence ${occurrence.ordinal + 1}`}>S{sentenceNumber} · #{occurrence.ordinal + 1}</span>
        </div>
        <button type="button" onClick={() => onRemove(occurrence.id)} disabled={isSelecting}
          className="shrink-0 rounded px-2 py-2 text-xs text-slate-600 hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-brand-500 disabled:opacity-50"
          title="Remove learning word" aria-label={`Remove occurrence "${occurrence.text}" (position ${occurrence.ordinal})`}>Remove</button>
      </div>
      {sentence ? <p className="truncate text-[11px] text-slate-500" title={sentence.text}>{sentence.text}</p> : null}
      <div className="flex items-center gap-1.5">
        <input
          ref={translationRef}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Armenian translation"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              if (occurrence.entryId && hasChanged && !saving) onSaveTranslation(occurrence.entryId, draft);
            }
          }}
          className="w-full min-w-0 flex-auto rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-base outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 sm:text-sm"
          aria-label={`Translation for ${occurrence.text} at position ${occurrence.ordinal}`}
        />
        <button
          type="button"
          onClick={() => occurrence.entryId && onSaveTranslation(occurrence.entryId, draft)}
          disabled={!occurrence.entryId || saving || !hasChanged}
          aria-label={`Save translation for ${occurrence.text} at position ${occurrence.ordinal}`}
          className="rounded-md px-2 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {occurrence.clipAssetId ? <ClipPlayer key={occurrence.clipAssetId} assetId={occurrence.clipAssetId} occurrenceId={occurrence.id} word={occurrence.text} /> : <span className="text-xs text-amber-700">Clip will be prepared when publishing</span>}
        {hasChanged ? <span className="text-[11px] text-amber-700">Unsaved translation</span> : missingTranslation ? <span className="text-[11px] text-amber-700">Translation missing</span> : null}
      </div>
      </div>
    </details>
  );
}

/**
 * One entry per occurrence, never per spelling: the same word selected
 * twice in one text (or in a different text entirely) always gets its own
 * translation field and clip here.
 */
export function TextVocabularyEditor({
  selectedOccurrences,
  onSaveTranslation,
  savingEntryId,
  sentences,
  focusedOccurrenceId,
  focusRequest,
  onRemove,
  isSelecting,
  onDirtyChange,
}: TextVocabularyEditorProps) {
  const [search, setSearch] = useState({ value: '', focusRequest });
  const [missingOnly, setMissingOnly] = useState(false);
  const query = (search.focusRequest === focusRequest ? search.value : '').trim().toLocaleLowerCase();
  const isVisible = (word: WordOccurrenceDto) => (word.id === focusedOccurrenceId && search.focusRequest !== focusRequest) ||
    ((!missingOnly || !armenianTranslation(word).trim()) && `${word.text} ${armenianTranslation(word)}`.toLocaleLowerCase().includes(query));
  const visibleCount = selectedOccurrences.filter(isVisible).length;

  if (!selectedOccurrences.length) {
    return <p className="px-3 py-6 text-sm leading-relaxed text-slate-500">Select words or a phrase in the text, or import a list with Armenian translations.</p>;
  }

  return (
    <div>
      <div className="space-y-3 border-b border-slate-200 pb-3">
        <input type="search" aria-label="Search learning words and translations" placeholder="Find a word or translation" value={search.focusRequest === focusRequest ? search.value : ''}
          onChange={event => setSearch({ value: event.target.value, focusRequest })} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus-visible:outline-brand-500" />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <span>{selectedOccurrences.length} selected · {selectedOccurrences.filter(word => !armenianTranslation(word).trim()).length} need translation</span>
          <label className="flex items-center gap-2 py-1"><input type="checkbox" checked={missingOnly} onChange={event => setMissingOnly(event.target.checked)} />Missing translations only</label>
        </div>
      </div>
      {!visibleCount ? <p role="status" className="py-4 text-sm text-slate-600">No learning entries match this filter.</p> : null}
      <div className="max-h-[34rem] overflow-y-auto overscroll-contain [contain:layout_paint] divide-y divide-slate-200">{selectedOccurrences.map((occurrence) => (
        <div key={`${occurrence.id}:${occurrence.endOccurrenceId ?? ''}:${armenianTranslation(occurrence)}`} hidden={!isVisible(occurrence)}>
        <OccurrenceRow
          occurrence={occurrence}
          onSaveTranslation={onSaveTranslation}
          savingEntryId={savingEntryId}
          sentence={sentences.find((sentence) => sentence.id === occurrence.sentenceId)}
          sentenceNumber={sentences.findIndex((sentence) => sentence.id === occurrence.sentenceId) + 1}
          focused={focusedOccurrenceId === occurrence.id}
          focusRequest={focusRequest}
          onRemove={onRemove}
          isSelecting={isSelecting}
          onDirtyChange={onDirtyChange}
        />
        </div>
      ))}</div>
    </div>
  );
}
