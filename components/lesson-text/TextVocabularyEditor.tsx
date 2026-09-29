'use client';

import { useEffect, useRef, useState } from 'react';
import { useAudioAsset } from '../../hooks/useAudioAsset';
import { OccurrenceSentence, WordOccurrenceDto } from '../../lib/textAuthoringTypes';

const TARGET_LANGUAGE = 'am';

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
        aria-label={`${playing ? 'Pause' : 'Play'} clip for ${word} (${occurrenceId})`}
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
  onExtractClips: (occurrenceIds: string[]) => void;
  isExtracting: boolean;
  savingEntryId: string | null;
  sentences: OccurrenceSentence[];
  focusedOccurrenceId: string | null;
  focusRequest: number;
  onRemove: (occurrenceId: string) => void;
  isSelecting: boolean;
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
}) {
  const existing = occurrence.translations.find((t) => t.languageCode === TARGET_LANGUAGE);
  const [draft, setDraft] = useState(existing?.translation ?? '');
  const rowRef = useRef<HTMLDivElement>(null);
  const translationRef = useRef<HTMLInputElement>(null);
  const missingTranslation = !existing?.translation.trim();
  const hasChanged = draft !== (existing?.translation ?? '');
  const saving = savingEntryId === occurrence.entryId;

  useEffect(() => {
    if (focused) {
      rowRef.current?.scrollIntoView?.({ block: 'nearest' });
      translationRef.current?.focus({ preventScroll: true });
    }
  }, [focused, focusRequest]);

  return (
    <div ref={rowRef} data-testid={`vocabulary-${occurrence.id}`} className={`space-y-2 border-l-2 px-3 py-3 transition-colors ${focused ? 'border-brand-500 bg-brand-50/60' : 'border-transparent hover:bg-slate-50'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h4 className="break-words text-sm font-semibold text-slate-900">{occurrence.text}</h4>
          <span className="shrink-0 text-[11px] text-slate-400" title={`Sentence ${sentenceNumber}, occurrence ${occurrence.ordinal + 1}`}>S{sentenceNumber} · #{occurrence.ordinal + 1}</span>
        </div>
        <button type="button" onClick={() => onRemove(occurrence.id)} disabled={isSelecting}
          className="flex size-7 shrink-0 items-center justify-center rounded text-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-brand-500 disabled:opacity-50"
          title="Remove learning word" aria-label={`Remove occurrence "${occurrence.text}" (position ${occurrence.ordinal})`}>×</button>
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
        {occurrence.clipAssetId ? <ClipPlayer key={occurrence.clipAssetId} assetId={occurrence.clipAssetId} occurrenceId={occurrence.id} word={occurrence.text} /> : <span className="text-xs text-amber-700">Clip missing</span>}
        {hasChanged ? <span className="text-[11px] text-amber-700">Unsaved translation</span> : missingTranslation ? <span className="text-[11px] text-amber-700">Translation missing</span> : null}
      </div>
    </div>
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
  onExtractClips,
  isExtracting,
  savingEntryId,
  sentences,
  focusedOccurrenceId,
  focusRequest,
  onRemove,
  isSelecting,
}: TextVocabularyEditorProps) {
  const missingClipIds = selectedOccurrences.filter((o) => !o.clipAssetId).map((o) => o.id);

  if (!selectedOccurrences.length) {
    return <p className="px-3 py-6 text-sm leading-relaxed text-slate-500">Choose a word in a sentence to add its Armenian translation and audio clip here.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 pb-3">
        <span className="text-xs text-slate-500">{selectedOccurrences.length} selected</span>
        <button
          type="button"
          onClick={() => onExtractClips(missingClipIds)}
          disabled={!missingClipIds.length || isExtracting}
          className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isExtracting ? 'Extracting…' : `Extract missing clips (${missingClipIds.length})`}
        </button>
      </div>
      <div className="divide-y divide-slate-100">{selectedOccurrences.map((occurrence) => (
        <OccurrenceRow
          key={occurrence.id}
          occurrence={occurrence}
          onSaveTranslation={onSaveTranslation}
          savingEntryId={savingEntryId}
          sentence={sentences.find((sentence) => sentence.id === occurrence.sentenceId)}
          sentenceNumber={sentences.findIndex((sentence) => sentence.id === occurrence.sentenceId) + 1}
          focused={focusedOccurrenceId === occurrence.id}
          focusRequest={focusRequest}
          onRemove={onRemove}
          isSelecting={isSelecting}
        />
      ))}</div>
    </div>
  );
}
