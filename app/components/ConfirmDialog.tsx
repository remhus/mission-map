'use client';

import { useEffect } from 'react';

// Confirmation dialog for destructive actions. Closes on Escape or backdrop click.
export default function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', onConfirm, onCancel }: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      onClick={onCancel}
      role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-sm rounded-3xl p-6 animate-slide-up bg-surface-2"
        style={{ border: '1px solid rgba(255,180,171,0.2)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <span className="material-symbols-outlined text-danger" style={{ fontSize: '24px' }}>warning</span>
          <h3 className="font-black text-base text-ink" style={{ fontFamily: 'var(--font-jakarta)' }}>{title}</h3>
        </div>
        <p className="text-sm mb-5 leading-relaxed text-ink-2">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="btn-quiet flex-1 py-2.5 rounded-xl text-sm font-semibold">
            Cancel
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-danger"
            style={{ background: 'rgba(255,180,171,0.1)', border: '1px solid rgba(255,180,171,0.3)' }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
