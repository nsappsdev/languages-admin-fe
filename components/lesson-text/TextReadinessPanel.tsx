'use client';

import { TextReadiness } from '../../lib/textAuthoringTypes';

const REASON_LABELS: Record<string, string> = {
  NARRATION_MISSING: 'Narration has not been generated yet.',
  NARRATION_FAILED: 'The last narration generation failed.',
  ALIGNMENT_MISSING: 'No alignment is available yet.',
  ALIGNMENT_NEEDS_REVIEW: 'Alignment needs manual review before words can be trusted.',
  NO_WORDS_SELECTED: 'No learning words selected (this is allowed, not an error).',
  SELECTED_MISSING_TRANSLATION: 'Some selected words are missing a translation.',
  SELECTED_MISSING_CLIP: 'Some selected words are missing an extracted clip.',
};

interface TextReadinessPanelProps {
  readiness: TextReadiness | undefined;
  onApprove: () => void;
  isApproving: boolean;
  approvedReleaseId: string | null;
}

export function TextReadinessPanel({ readiness, onApprove, isApproving, approvedReleaseId }: TextReadinessPanelProps) {
  if (!readiness) {
    return <p className="text-xs text-slate-500">Readiness unavailable.</p>;
  }

  return (
    <div className="space-y-2 border-t border-slate-200 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
        <p className={`text-sm font-semibold ${readiness.readyForApproval ? 'text-emerald-700' : 'text-slate-800'}`}>{readiness.readyForApproval ? 'Ready for admin approval' : readiness.narrationValid && readiness.alignmentStatus === 'OK' ? 'Finish selected words to approve' : 'Not ready for approval'}</p>
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
          <li>Selected words: {readiness.selectedCount}</li>
          <li>Missing translation: {readiness.selectedMissingTranslationCount}</li>
          <li>Missing clip: {readiness.selectedMissingClipCount}</li>
        </ul>
        </div>
        <button
          type="button"
          onClick={onApprove}
          disabled={!readiness.readyForApproval || isApproving}
          className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isApproving ? 'Approving…' : 'Approve text version'}
        </button>
      </div>
      {readiness.reasonCodes.length ? (
        <details className="text-xs text-slate-500"><summary className="cursor-pointer">Readiness details</summary><ul className="mt-2 list-disc pl-4">
          {readiness.reasonCodes.map((code) => <li key={code}>{REASON_LABELS[code] ?? code}</li>)}
        </ul></details>
      ) : null}
      <p className="text-xs text-slate-500">
        Admin approval only. This does not publish content to learners.
      </p>
      {approvedReleaseId ? <p className="break-all text-xs text-slate-500">Last approved release: {approvedReleaseId}.</p> : null}
    </div>
  );
}
