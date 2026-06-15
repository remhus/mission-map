'use client';

import { useEffect } from 'react';

// Close an overlay with the Escape key while it is open.
export function useEscape(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onClose]);
}
