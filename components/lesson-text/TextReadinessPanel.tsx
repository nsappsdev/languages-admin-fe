'use client';
import { TextReadiness } from '../../lib/textAuthoringTypes';
const REASONS: Record<string, string> = {
  NARRATION_MISSING: 'Generate audio for every sentence.',
  NARRATION_FAILED: 'Sentence audio generation failed. Try generating again.',
  NARRATION_IN_PROGRESS: 'Sentence audio is being generated.',
  ALIGNMENT_MISSING: 'Generate sentence audio to prepare playback timing.',
  ALIGNMENT_NEEDS_REVIEW: 'Complete sentence audio and resolve any sentence timing issues before publishing.',
  SELECTED_MISSING_TRANSLATION: 'Add an Armenian translation for every selected word or phrase.',
  SELECTED_MISSING_CLIP: 'Prepare the selected words and phrases in the Word & phrase audio section.',
};
export function TextReadinessPanel({ readiness }: { readiness: TextReadiness | undefined }) {
  if (!readiness) return <p className="text-xs text-slate-500">Checking readiness…</p>;
  return <div className="space-y-2 border-t border-slate-200 pt-4">
    <p className={`text-sm font-semibold ${readiness.canPublish ? 'text-emerald-700' : 'text-amber-800'}`}>
      {readiness.canPublish ? 'Ready to publish' : 'Complete this text before publishing'}
    </p>
    <p className="text-xs text-slate-600">{readiness.selectedCount} learning entries · {readiness.selectedMissingTranslationCount} missing Armenian translations</p>
    {readiness.selectedMissingClipCount > 0 ? <p className="text-xs text-slate-500">{readiness.selectedMissingClipCount} learning entries need word audio before publishing.</p> : null}
    <ul className="space-y-1 text-xs text-amber-800">{readiness.reasonCodes.filter(code => REASONS[code] && (readiness.narrationValid || !code.startsWith('ALIGNMENT_'))).map(code => <li key={code}>{REASONS[code]}</li>)}</ul>
  </div>;
}
