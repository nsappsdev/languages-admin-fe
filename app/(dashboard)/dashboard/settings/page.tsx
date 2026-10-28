'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AppSettings,
  REPETITION_OPTIONS,
  ReadingModeSettings,
} from '../../../../lib/apiTypes';
import { useSettings } from '../../../../hooks/useSettings';
import { useSettingsMutations } from '../../../../hooks/useSettingsMutations';
import { ReaderAppearance } from '../../../../components/settings/ReaderAppearance';

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
  introduction: 'Plays the full lesson narration normally.',
  teaching: 'Repeats selected learning words from the same narration.',
  deep_learning: 'Repeats unknown words and sentence ranges with multiple unknown words.',
};

export default function SettingsPage() {
  const { data, isLoading, isError } = useSettings();
  const { updateSettings } = useSettingsMutations();

  const [form, setForm] = useState<Partial<AppSettings>>({});
  const previousSettings = useRef<Partial<AppSettings> | null>(null);
  const [saved, setSaved] = useState(false);
  const pauseMs = form.wordRepetitionPauseMs ?? 800;
  const validPause = Number.isInteger(pauseMs) && pauseMs >= 0 && pauseMs <= 3000;

  useEffect(() => {
    if (data?.settings) {
      const incoming = data.settings;
      const previous = previousSettings.current;
      setForm(current => {
        const next = { ...incoming };
        // A reader-appearance save refreshes this query too. Keep unrelated edits.
        for (const key of Object.keys(current) as (keyof AppSettings)[]) {
          if (previous && JSON.stringify(current[key]) !== JSON.stringify(previous[key])) {
            Object.assign(next, { [key]: current[key] });
          }
        }
        return next;
      });
      previousSettings.current = incoming;
    }
  }, [data?.settings]);

  const handleSave = () => {
    if (!validPause) return;
    updateSettings.mutate(
      {
        readingModes: (form.readingModes ?? DEFAULT_READING_MODES).map((mode) => ({
          ...mode,
          displayName: mode.displayName.trim(),
          order: Number(mode.order),
        })),
        wordRepetitionPauseMs: form.wordRepetitionPauseMs ?? 800,
        updatePolicyEnabled: form.updatePolicyEnabled ?? false,
        latestAndroidBuildNumber: form.latestAndroidBuildNumber ?? 0,
        minAndroidBuildNumber: form.minAndroidBuildNumber ?? 0,
        androidStoreUrl: form.androidStoreUrl ?? '',
        updateMessage: form.updateMessage?.trim() || 'A newer app version is available.',
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

      {data?.settings ? <ReaderAppearance settings={data.settings} /> : null}

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

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
          Word repetition timing
        </h3>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <label className="space-y-1">
            <span className="block text-sm font-medium text-slate-700">
              Pause between repeated words (milliseconds)
            </span>
            <span className="block text-xs text-slate-500">
              Controls the quiet gap between repetitions in Practice and Deep learning, including quiet clip edges.
              Save, then reopen the lesson to apply it. 400 ms is a good starting point for a flowing rhythm.
            </span>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="number"
                aria-label="Pause between repeated words (milliseconds)"
                aria-describedby="repetition-pause-help"
                aria-invalid={!validPause}
                min={0}
                max={3000}
                step={50}
                value={Number.isFinite(pauseMs) ? pauseMs : ''}
                onChange={(event) => {
                  setSaved(false);
                  setForm((current) => ({
                    ...current,
                    wordRepetitionPauseMs: event.target.value === '' ? NaN : Number(event.target.value),
                  }));
                }}
                className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <span className="text-sm text-slate-500">
                {validPause ? `${(pauseMs / 1000).toFixed(2)} s` : 'Enter 0–3000 ms'}
              </span>
            </div>
          </label>
          <p id="repetition-pause-help" className="mt-2 text-xs text-slate-500">0 ms joins repetitions directly. 1000 ms is one second. Repetition counts are controlled by each reading mode above.</p>
          {!validPause && <p role="alert" className="mt-2 text-sm text-red-600">Enter a whole number from 0 to 3000 milliseconds.</p>}
          <button type="button" className="mt-3 text-sm font-medium text-brand-700" onClick={() => {
            setSaved(false); setForm(current => ({ ...current, wordRepetitionPauseMs: 400 }));
          }}>Use 400 ms</button>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
            App update policy
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Android compares the installed native build number with these values.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={form.updatePolicyEnabled ?? false}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                updatePolicyEnabled: event.target.checked,
              }))
            }
            className="h-4 w-4 accent-brand-600"
          />
          Enable update prompts
        </label>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-800">Android</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="block text-xs font-medium text-slate-500">Latest build</span>
              <input
                type="number"
                min={0}
                value={form.latestAndroidBuildNumber ?? 0}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    latestAndroidBuildNumber: Number(event.target.value),
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-xs font-medium text-slate-500">Minimum build</span>
              <input
                type="number"
                min={0}
                value={form.minAndroidBuildNumber ?? 0}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    minAndroidBuildNumber: Number(event.target.value),
                  }))
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
          <label className="mt-3 block space-y-1">
            <span className="block text-xs font-medium text-slate-500">Play Store URL</span>
            <input
              value={form.androidStoreUrl ?? ''}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  androidStoreUrl: event.target.value,
                }))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="block text-sm font-medium text-slate-700">Update message</span>
          <textarea
            value={form.updateMessage ?? 'A newer app version is available.'}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                updateMessage: event.target.value,
              }))
            }
            rows={3}
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </section>

      {/* Save */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={updateSettings.isPending || !validPause}
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
