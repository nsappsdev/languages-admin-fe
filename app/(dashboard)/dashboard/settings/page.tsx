'use client';

import { useEffect, useState } from 'react';
import { AppSettings, MAIN_FONT_OPTIONS, TRANSLATION_FONT_OPTIONS } from '../../../../lib/apiTypes';
import { useSettings } from '../../../../hooks/useSettings';
import { useSettingsMutations } from '../../../../hooks/useSettingsMutations';

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
        unknownWordRepetitions: form.unknownWordRepetitions,
        mainTextFontFamily: form.mainTextFontFamily,
        mainTextFontSize: form.mainTextFontSize,
        translationFontFamily: form.translationFontFamily,
        translationFontSize: form.translationFontSize,
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

  return (
    <div className="max-w-xl space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">App Settings</h2>
        <p className="text-sm text-slate-500 mt-1">
          These settings are applied globally across the mobile app.
        </p>
      </div>

      {/* Unknown word repetitions */}
      <section className="space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          Unknown word repetitions
        </label>
        <p className="text-xs text-slate-400">
          How many times an unknown word is shown to the learner before it is considered reviewed.
        </p>
        <input
          type="number"
          min={1}
          max={20}
          value={form.unknownWordRepetitions ?? 2}
          onChange={(e) =>
            setForm((f) => ({ ...f, unknownWordRepetitions: Number(e.target.value) as AppSettings['unknownWordRepetitions'] }))
          }
          className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
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

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Font size: <span className="text-brand-600">{form.translationFontSize}px</span>
          </label>
          <input
            type="range"
            min={10}
            max={24}
            value={form.translationFontSize ?? 12}
            onChange={(e) =>
              setForm((f) => ({ ...f, translationFontSize: Number(e.target.value) }))
            }
            className="w-full accent-brand-600"
          />
          <div className="flex justify-between text-xs text-slate-400">
            <span>10px</span>
            <span>24px</span>
          </div>
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
                    fontSize: `${form.translationFontSize ?? 12}px`,
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
