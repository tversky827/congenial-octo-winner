"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MarkAllRead({ hasUnread }: { hasUnread: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!hasUnread) return null;

  return (
    <button
      className="text-sm font-medium text-brand-600"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/notifications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        router.refresh();
        setBusy(false);
      }}
    >
      Mark all read
    </button>
  );
}
