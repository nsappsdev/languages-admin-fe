'use client';

import { useState } from 'react';

type ConfirmTone = 'danger' | 'default';

interface ConfirmDialogProps {
  cancelLabel?: string;
  confirmLabel?: string;
  confirmText?: string;
  description: string;
  isPending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  tone?: ConfirmTone;
}

export function ConfirmDialog({
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  confirmText,
  description,
  isPending = false,
  onCancel,
  onConfirm,
  title,
  tone = 'default',
}: ConfirmDialogProps) {
  const [typedText, setTypedText] = useState('');
  const requiresTypedConfirm = Boolean(confirmText);
  const canConfirm = !isPending && (!requiresTypedConfirm || typedText === confirmText);
  const confirmClassName =
    tone === 'danger'
      ? 'bg-rose-600 text-white hover:bg-rose-700'
      : 'bg-brand-600 text-white hover:bg-brand-700';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{description}</p>

        {confirmText ? (
          <div className="mt-4">
            <label className="block text-sm text-slate-700">
              Type <span className="font-mono font-semibold">{confirmText}</span> to confirm:
            </label>
            <input
              type="text"
              value={typedText}
              onChange={(event) => setTypedText(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
              autoFocus
            />
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50 ${confirmClassName}`}
          >
            {isPending ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
