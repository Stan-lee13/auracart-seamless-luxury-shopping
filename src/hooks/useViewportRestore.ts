import { useEffect } from 'react';

/**
 * Restores viewport mode after returning from external OAuth redirects (AliExpress, Paystack).
 * Reads `userDeviceMode` from localStorage and re-applies the proper meta viewport so the
 * site does not unexpectedly switch to desktop layout after the round trip.
 */
export function useViewportRestore() {
  useEffect(() => {
    try {
      const stored = localStorage.getItem('userDeviceMode');
      if (!stored) return;

      let viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
      if (!viewportMeta) {
        viewportMeta = document.createElement('meta');
        viewportMeta.name = 'viewport';
        document.head.appendChild(viewportMeta);
      }
      // Both modes use device-width; this just guarantees the tag exists and forces a relayout.
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
      document.body.classList.toggle('mobile-mode', stored === 'mobile');

      // One-shot restore — remove so future sessions reflect actual device
      localStorage.removeItem('userDeviceMode');
    } catch {
      // localStorage may be unavailable (private mode); ignore silently
    }
  }, []);
}
