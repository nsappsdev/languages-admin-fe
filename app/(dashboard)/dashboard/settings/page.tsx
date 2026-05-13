'use client';

import { useEffect, useState } from 'react';
import {
  AppSettings,
  MAIN_FONT_OPTIONS,
  REPETITION_OPTIONS,
  ReadingModeSettings,
  TRANSLATION_FONT_OPTIONS,
} from '../../../../lib/apiTypes';
import { useSettings } from '../../../../hooks/useSettings';
import { useSettingsMutations } from '../../../../hooks/useSettingsMutations';

const DEFAULT_READING_MODES: ReadingModeSettings[] = [
  { id: 'introduction', enabled: true, displayName: 'Introduction', order: 0 },
  {
    id: 'teaching',
    enabled: true,
    displayName: 'Teaching',
    order: 1,
    unknownWordRepetitions: 5,
  },
  {
    id: 'deep_learning',
    enabled: true,
    displayName: 'Deep Learning',
    order: 2,
    unknownWordRepetitions: 5,
    repeatSentenceWhenUnknownCountAtLeast: 2,
    sentenceRepetitions: 2,
  },
];

const MODE_RULE_LABELS: Record<ReadingModeSettings['id'], string> = {
  introduction: 'Plays the uploaded lesson audio normally.',
  teaching: 'Repeats marked unknown word ranges from the uploaded audio.',
  deep_learning: 'Repeats unknown words and sentence ranges with multiple unknown words.',
};

export default function SettingsPage() {
  const { data, isLoading, isError } = useSettings();
  const { updateSettings } = useSettingsMutations();

  const [form, setForm] = useState<Partial<AppSettings>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.settings) {
      setForm(data.settings);
    }
  }, [data?.settings]);

  const handleSave = () => {
    updateSettings.mutate(
      {
        readingModes: (form.readingModes ?? DEFAULT_READING_MODES).map((mode) => ({
          ...mode,
          displayName: mode.displayName.trim(),
          order: Number(mode.order),
        })),
        mainTextFontFamily: form.mainTextFontFamily,
        mainTextFontSize: form.mainTextFontSize,
        translationFontFamily: form.translationFontFamily,
        translationFontSize: form.translationFontSize,
        translationFontMinSize: form.translationFontMinSize,
        translationFontMaxSize: form.translationFontMaxSize,
        translationLetterSpacingMin: form.translationLetterSpacingMin,
        translationLetterSpacingMax: form.translationLetterSpacingMax,
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        },
      },
    );
  };

  if (isLoading) {
    return <p className="text-slate-500 text-sm">Loading settings…</p>;
  }

  if (isError) {
    return <p className="text-red-500 text-sm">Failed to load settings.</p>;
  }

  const previewMainFont =
    form.mainTextFontFamily === 'System' ? 'inherit' : (form.mainTextFontFamily ?? 'inherit');
  const previewTransFont =
    form.translationFontFamily === 'System' ? 'inherit' : (form.translationFontFamily ?? 'inherit');
  const readingModes = [...(form.readingModes ?? DEFAULT_READING_MODES)].sort(
    (left, right) => left.order - right.order,
  );

  const updateReadingMode = (
    modeId: ReadingModeSettings['id'],
    updater: (mode: ReadingModeSettings) => ReadingModeSettings,
  ) => {
    setForm((current) => ({
      ...current,
      readingModes: (current.readingModes ?? DEFAULT_READING_MODES).map((mode) =>
        mode.id === modeId ? updater(mode) : mode,
      ),
    }));
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">App Settings</h2>
        <p className="text-sm text-slate-500 mt-1">
          These settings are applied globally across the mobile app.
        </p>
      </div>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Reading modes
        </h3>
        <div className="space-y-3">
          {readingModes.map((mode) => (
            <div key={mode.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_96px]">
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-slate-500">Display name</span>
                  <input
                    value={mode.displayName}
                    onChange={(event) =>
                      updateReadingMode(mode.id, (current) => ({
                        ...current,
                        displayName: event.target.value,
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-slate-500">Order</span>
                  <input
                    type="number"
                    min={0}
                    value={mode.order}
                    onChange={(event) =>
                      updateReadingMode(mode.id, (current) => ({
                        ...current,
                        order: Number(event.target.value),
                      }))
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex items-center gap-2 pt-5 text-sm font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={mode.enabled}
                    onChange={(event) =>
                      updateReadingMode(mode.id, (current) => ({
                        ...current,
                        enabled: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 accent-brand-600"
                  />
                  Enabled
                </label>
              </div>
              <p className="mt-2 text-xs text-slate-500">{MODE_RULE_LABELS[mode.id]}</p>

              {mode.id !== 'introduction' ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_160px]">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500">Unknown word repetitions</p>
                    <div className="flex flex-wrap gap-2">
                      {REPETITION_OPTIONS.map((count) => (
                        <button
                          key={count}
                          type="button"
                          onClick={() =>
                            updateReadingMode(mode.id, (current) => ({
                              ...current,
                              unknownWordRepetitions: count,
                            }))
                          }
                          className={[
                            'rounded-md border px-3 py-2 text-xs font-semibold',
                            mode.unknownWordRepetitions === count
                              ? 'border-brand-600 bg-brand-50 text-brand-700'
                              : 'border-slate-200 text-slate-600',
                          ].join(' ')}
                        >
                          {count}
                        </button>
                      ))}
                    </div>
                  </div>
                  <label className="space-y-1">
                    <span className="block text-xs font-medium text-slate-500">Custom</span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={mode.unknownWordRepetitions ?? 5}
                      onChange={(event) =>
                        updateReadingMode(mode.id, (current) => ({
                          ...current,
                          unknownWordRepetitions: Number(event.target.value),
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              ) : null}

              {mode.id === 'deep_learning' ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="block text-xs font-medium text-slate-500">
                      Repeat sentence when unknown words reach
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={mode.repeatSentenceWhenUnknownCountAtLeast ?? 2}
                      onChange={(event) =>
                        updateReadingMode(mode.id, (current) => ({
                          ...current,
                          repeatSentenceWhenUnknownCountAtLeast: Number(event.target.value),
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="block text-xs font-medium text-slate-500">
                      Sentence repetitions
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={mode.sentenceRepetitions ?? 2}
                      onChange={(event) =>
                        updateReadingMode(mode.id, (current) => ({
                          ...current,
                          sentenceRepetitions: Number(event.target.value),
                        }))
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* Main text typography */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Main text (English)
        </h3>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Font family</label>
          <select
            value={form.mainTextFontFamily ?? 'System'}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                mainTextFontFamily: e.target.value as AppSettings['mainTextFontFamily'],
              }))
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {MAIN_FONT_OPTIONS.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Font size: <span className="text-brand-600">{form.mainTextFontSize}px</span>
          </label>
          <input
            type="range"
            min={12}
            max={32}
            value={form.mainTextFontSize ?? 18}
            onChange={(e) =>
              setForm((f) => ({ ...f, mainTextFontSize: Number(e.target.value) }))
            }
            className="w-full accent-brand-600"
          />
          <div className="flex justify-between text-xs text-slate-400">
            <span>12px</span>
            <span>32px</span>
          </div>
        </div>
      </section>

      {/* Translation text typography */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Translation text (Armenian)
        </h3>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Font family</label>
          <select
            value={form.translationFontFamily ?? 'System'}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                translationFontFamily: e.target.value as AppSettings['translationFontFamily'],
              }))
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            {TRANSLATION_FONT_OPTIONS.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">Minimum size</span>
            <input
              type="number"
              min={6}
              max={20}
              value={form.translationFontMinSize ?? 8}
              onChange={(e) =>
                setForm((f) => ({ ...f, translationFontMinSize: Number(e.target.value) }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">Maximum size</span>
            <input
              type="number"
              min={6}
              max={24}
              value={form.translationFontMaxSize ?? 15}
              onChange={(e) =>
                setForm((f) => ({ ...f, translationFontMaxSize: Number(e.target.value) }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">Minimum letter spacing</span>
            <input
              type="number"
              min={-2}
              max={4}
              step={0.1}
              value={form.translationLetterSpacingMin ?? -0.2}
              onChange={(e) =>
                setForm((f) => ({ ...f, translationLetterSpacingMin: Number(e.target.value) }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">Maximum letter spacing</span>
            <input
              type="number"
              min={-2}
              max={4}
              step={0.1}
              value={form.translationLetterSpacingMax ?? 0.8}
              onChange={(e) =>
                setForm((f) => ({ ...f, translationLetterSpacingMax: Number(e.target.value) }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Armenian labels fit above the English word inside this size and spacing range.
        </div>
      </section>

      {/* Live preview */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Preview</h3>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-wrap gap-2">
            {[
              { en: 'Hello,', hy: 'Բարև,' },
              { en: 'how are you?', hy: 'ինչպես եք' },
            ].map((pair) => (
              <div
                key={pair.en}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-center"
              >
                <p
                  style={{
                    fontFamily: previewTransFont,
                    fontSize: `${Math.min(form.translationFontMaxSize ?? 15, form.mainTextFontSize ?? 18)}px`,
                    letterSpacing: `${form.translationLetterSpacingMax ?? 0.8}px`,
                    color: '#0e7490',
                  }}
                >
                  {pair.hy}
                </p>
                <p
                  style={{
                    fontFamily: previewMainFont,
                    fontSize: `${form.mainTextFontSize ?? 18}px`,
                    color: '#111827',
                  }}
                >
                  {pair.en}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={updateSettings.isPending}
          className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {updateSettings.isPending ? 'Saving…' : 'Save settings'}
        </button>
        {saved && <span className="text-sm text-green-600">Settings saved.</span>}
        {updateSettings.isError && (
          <span className="text-sm text-red-500">Failed to save. Try again.</span>
        )}
      </div>
    </div>
  );
}
