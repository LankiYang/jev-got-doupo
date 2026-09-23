import { useEffect, useState } from "react";
import { AuiIf } from "@assistant-ui/react";
import { Flame } from "lucide-react";

const LINES = [
  "斗气正在凝聚……",
  "三年之约步步逼近……",
  "药老正在推演……",
  "戒指里的低语渐起……",
  "异火正在大陆深处游走……",
] as const;

const ROTATE_MS = 2500;

const Waiting = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % LINES.length),
      ROTATE_MS,
    );
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="loading" role="status" aria-live="polite">
      <Flame className="quill" size={17} aria-hidden />
      <span className="loading-line">{LINES[index]}</span>
    </div>
  );
};

/** Shown inside the thread while a turn is in flight. */
export const Loading = () => (
  <AuiIf condition={(state) => state.thread.isRunning}>
    <Waiting />
  </AuiIf>
);
