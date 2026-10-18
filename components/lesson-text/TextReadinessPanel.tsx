'use client';
import { TextReadiness } from '../../lib/textAuthoringTypes';
const REASONS: Record<string, string> = {
  NARRATION_MISSING: 'Generate narration for the saved text.',
  NARRATION_FAILED: 'Narration generation failed. Try generating again.',
  NARRATION_IN_PROGRESS: 'Narration is being generated.',
  ALIGNMENT_MISSING: 'Aligned words will appear after narration is generated.',
  ALIGNMENT_NEEDS_REVIEW: 'The narration could not be aligned reliably. Regenerate it before publishing.',
  SELECTED_MISSING_TRANSLATION: 'Add an Armenian translation for every selected word or phrase.',
  SELECTED_MISSING_CLIP: 'Prepare word audio: reuse saved vocabulary recordings and generate any missing ones.',
};
export function TextReadinessPanel({ readiness }: { readiness: TextReadiness | undefined }) {
  if (!readiness) return <p className="text-xs text-slate-500">Checking readiness…</p>;
  return <div className="space-y-2 border-t border-slate-200 pt-4">
    <p className={`text-sm font-semibold ${readiness.canPublish ? 'text-emerald-700' : 'text-amber-800'}`}>
      {readiness.canPublish ? 'Ready to publish' : 'Complete this text before publishing'}
    </p>
    <p className="text-xs text-slate-600">{readiness.selectedCount} learning entries · {readiness.selectedMissingTranslationCount} missing Armenian translations</p>
    {readiness.selectedMissingClipCount > 0 ? <p className="text-xs text-slate-500">{readiness.selectedMissingClipCount} learning entries need word audio before publishing.</p> : null}
    <ul className="space-y-1 text-xs text-amber-800">{readiness.reasonCodes.filter(code => REASONS[code]).map(code => <li key={code}>{REASONS[code]}</li>)}</ul>
  </div>;
}
