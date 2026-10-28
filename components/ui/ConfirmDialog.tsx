'use client';

import { useEffect, useRef, useState } from 'react';

type ConfirmTone = 'danger' | 'default';

interface ConfirmDialogProps {
  cancelLabel?: string;
  confirmLabel?: string;
  confirmText?: string;
  description: string;
  error?: string | null;
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
  error,
  isPending = false,
  onCancel,
  onConfirm,
  title,
  tone = 'default',
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [typedText, setTypedText] = useState('');
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    return () => { dialog?.close(); previousFocus?.focus(); };
  }, []);
  const requiresTypedConfirm = Boolean(confirmText);
  const canConfirm = !isPending && (!requiresTypedConfirm || typedText === confirmText);
  const confirmClassName =
    tone === 'danger'
      ? 'bg-rose-600 text-white hover:bg-rose-700'
      : 'bg-brand-600 text-white hover:bg-brand-700';

  return (
      <dialog
        ref={dialogRef}
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        aria-busy={isPending}
        onCancel={event => { event.preventDefault(); if (!isPending) onCancel(); }}
        className="w-[calc(100%_-_2rem)] max-w-md rounded-xl bg-white p-5 shadow-xl backdrop:bg-slate-950/45"
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <p id="confirm-dialog-description" className="mt-2 text-sm text-slate-600">{description}</p>
        {error ? <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p> : null}

        {confirmText ? (
          <div className="mt-4">
            <label htmlFor="confirm-dialog-input" className="block text-sm text-slate-700">
              Type <span className="font-mono font-semibold">{confirmText}</span> to confirm:
            </label>
            <input
              id="confirm-dialog-input"
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
      </dialog>
  );
}
