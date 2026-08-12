"use client";

import { useEffect, useState } from "react";

// Registers the PWA service worker and shows a lightweight "Add to Home Screen"
// prompt on Android/desktop Chrome when the browser offers one.
export function RegisterSW() {
  const [installEvent, setInstallEvent] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* SW registration is best-effort */
      });
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!installEvent || dismissed) return null;

  return (
    <div className="fixed inset-x-3 bottom-20 z-30 mx-auto max-w-md rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-xl">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-semibold">Install ShiftBoard</p>
          <p className="text-xs text-white/70">Add it to your home screen for quick access.</p>
        </div>
        <button
          className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-slate-900"
          onClick={async () => {
            installEvent.prompt();
            await installEvent.userChoice;
            setInstallEvent(null);
          }}
        >
          Install
        </button>
        <button className="text-white/60" aria-label="Dismiss" onClick={() => setDismissed(true)}>
          ✕
        </button>
      </div>
    </div>
  );
}
