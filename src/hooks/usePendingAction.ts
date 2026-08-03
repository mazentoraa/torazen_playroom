import { useRef, useState } from "react";

/**
 * Guards async button handlers against re-invocation while an action is
 * already in flight, and exposes a per-action "pending" flag so buttons can
 * disable themselves and show a spinner. Prevents duplicate requests from
 * double-clicks and rapid re-submission (e.g. Enter key + click).
 */
export function usePendingAction() {
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const inflight = useRef<Set<string>>(new Set());

  const run = async (key: string, fn: () => Promise<void>) => {
    if (inflight.current.has(key)) return;
    inflight.current.add(key);
    setPendingKey(key);
    try {
      await fn();
    } finally {
      inflight.current.delete(key);
      setPendingKey((current) => (current === key ? null : current));
    }
  };

  return {
    pendingKey,
    run,
    isPending: (key: string) => pendingKey === key,
  };
}
