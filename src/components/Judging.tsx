"use client";

import { useAuiState } from "@assistant-ui/react";

/**
 * A small badge next to a panel's title while a turn is in flight — from the moment the
 * player submits until `saved` arrives, which is also when that panel's own numbers
 * next change. The panel keeps showing the previous turn's numbers underneath rather
 * than blanking out; this only signals that they are about to move.
 */
export const Judging = () => {
  const isRunning = useAuiState((state) => state.thread.isRunning);
  if (!isRunning) return null;
  return (
    <span className="jev-judging" role="status" aria-live="polite">
      判读中…
    </span>
  );
};
