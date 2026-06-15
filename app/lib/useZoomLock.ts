import { useEffect } from 'react';

const LOCKED = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
const UNLOCKED = 'width=device-width, initial-scale=1';

// Dynamically enables/disables pinch-to-zoom by rewriting the viewport meta tag.
// Default app state is locked; pass locked=false to allow zoom (e.g. lightbox, fullscreen grid).
export function useZoomLock(locked: boolean) {
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (!meta) return;
    meta.setAttribute('content', locked ? LOCKED : UNLOCKED);
    // Re-lock on unmount (navigating away from a page that unlocked zoom)
    return () => meta.setAttribute('content', LOCKED);
  }, [locked]);
}
