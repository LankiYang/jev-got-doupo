"use client";

import { useAuiState } from "@assistant-ui/react";
import {
  ARC_STAGES,
  nameOfArcStage,
  nameOfBeat,
  nameOfCompanion,
  nameOfDanger,
  nameOfMood,
  type JevReading,
  type LabelledChoice,
} from "./api";
import { Judging } from "./Judging";

/**
 * The reading panel: everything Jev returned for the scene on screen.
 *
 * The page itself only ever needed Jev's conclusions — a location, a mood id, a score.
 * This shows the judgement behind them: how confident it was, which options it weighed
 * and how the probability mass fell, and what the whole request cost in time and
 * tokens. That is the part that makes it legible as a classifier rather than an oracle.
 */

type PanelProps = {
  /** Heading shown above the panel. */
  readonly title?: string;
};

const isReading = (value: unknown): value is JevReading =>
  typeof value === "object" &&
  value !== null &&
  "location" in value &&
  "inFiction" in value;

const percent = (value: number): string => `${Math.round(value * 100)}%`;

/** Sorted high to low, dropping options Jev rounded away. */
const ranked = (
  probabilities: Readonly<Record<string, number>>,
  name: (id: string) => string,
): ReadonlyArray<{ readonly label: string; readonly value: number }> =>
  Object.entries(probabilities)
    .filter(([, value]) => Number.isFinite(value) && value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([id, value]) => ({ label: name(id), value }));

/** A labelled probability bar. The chosen option is marked, not coloured differently. */
const Bars = ({
  rows,
  chosen,
}: {
  readonly rows: ReadonlyArray<{ readonly label: string; readonly value: number }>;
  readonly chosen: string;
}) => (
  <ul className="jev-bars">
    {rows.map((row) => (
      <li
        key={row.label}
        className={row.label === chosen ? "jev-bar is-chosen" : "jev-bar"}
      >
        <span className="jev-bar-label">{row.label}</span>
        <span className="jev-bar-track" aria-hidden="true">
          <span className="jev-bar-fill" style={{ width: percent(row.value) }} />
        </span>
        <span className="jev-bar-value">{percent(row.value)}</span>
      </li>
    ))}
  </ul>
);

/** One Choice question: the pick, its confidence, and the distribution behind it. */
const Choice = ({
  question,
  answer,
  name,
}: {
  readonly question: string;
  readonly answer: LabelledChoice;
  readonly name: (id: string) => string;
}) => (
  <section className="jev-question">
    <header className="jev-question-head">
      <span className="jev-question-name">{question}</span>
      <span className="jev-confidence" title="置信度">
        {answer.confidence.toFixed(2)}
      </span>
    </header>
    <p className="jev-choice">{name(answer.choice)}</p>
    <Bars rows={ranked(answer.probabilities, name)} chosen={name(answer.choice)} />
  </section>
);

/** A meter for a 0–1 answer. */
const Meter = ({ value, label }: { readonly value: number; readonly label: string }) => (
  <div className="jev-meter">
    <span className="jev-meter-label">{label}</span>
    <span className="jev-bar-track" aria-hidden="true">
      <span
        className={value >= 0.5 ? "jev-bar-fill" : "jev-bar-fill is-low"}
        style={{ width: percent(value) }}
      />
    </span>
    <span className="jev-bar-value">{percent(value)}</span>
  </div>
);

const Panel = ({ reading }: { readonly reading: JevReading }) => {
  const dangerRows = ranked(
    reading.danger.probabilities,
    // The score rubric is indexed 0..4; show the index, since the rubric text is
    // a server-side catalog the client deliberately does not carry.
    (id) => `等级 ${id}`,
  );

  const arcStageRows = ranked(reading.arcStage.probabilities, (id) =>
    nameOfArcStage(ARC_STAGES[Number(id)] ?? id),
  );
  const arcStageChosen = nameOfArcStage(
    ARC_STAGES[Math.min(3, Math.max(0, Math.round(reading.arcStage.score)))] ?? "setup",
  );

  return (
    <div className="jev-panel">
      <Choice question="地点" answer={reading.location} name={(id) => id} />
      <Choice question="场景类型" answer={reading.beat} name={nameOfBeat} />
      <Choice question="情绪" answer={reading.mood} name={nameOfMood} />
      <Choice question="同行的熟面孔" answer={reading.companion} name={nameOfCompanion} />

      <section className="jev-question">
        <header className="jev-question-head">
          <span className="jev-question-name">危险度</span>
          <span className="jev-confidence" title="置信度">
            {reading.danger.confidence.toFixed(2)}
          </span>
        </header>
        <p className="jev-choice">
          {nameOfDanger(
            ["safe", "uneasy", "dangerous", "perilous", "deadly"][
              Math.min(4, Math.max(0, Math.round(reading.danger.score)))
            ] ?? "safe",
          )}
          <span className="jev-score-raw"> ({reading.danger.score.toFixed(2)})</span>
        </p>
        <Bars rows={dangerRows} chosen="" />
      </section>

      <section className="jev-question">
        <header className="jev-question-head">
          <span className="jev-question-name">章节阶段（起承转合）</span>
          <span className="jev-confidence" title="置信度">
            {reading.arcStage.confidence.toFixed(2)}
          </span>
        </header>
        <p className="jev-choice">
          {arcStageChosen}
          <span className="jev-score-raw"> ({reading.arcStage.score.toFixed(2)})</span>
        </p>
        <Bars rows={arcStageRows} chosen={arcStageChosen} />
      </section>

      <section className="jev-question">
        <header className="jev-question-head">
          <span className="jev-question-name">是否在世界观内</span>
        </header>
        <Meter value={reading.inFiction.noul} label="P(是)" />
      </section>

      <footer className="jev-cost">
        {reading.latencyMs > 0 ? (
          <span title="Jev 一次请求的往返耗时">
            {reading.latencyMs} ms
          </span>
        ) : null}
        {reading.inputTokens > 0 ? (
          <span title="本次判读计费的输入 token">
            {reading.inputTokens.toLocaleString()} tokens
          </span>
        ) : null}
      </footer>
    </div>
  );
};

/**
 * Reads the newest assistant message's `reading` off the thread. Before the first
 * turn the prologue carries none, and the panel renders nothing rather than an empty
 * frame — there is no judgement yet to show.
 *
 * Content only, no wrapping `<aside>`: `Chat` owns the single `.jev-aside` column and
 * stacks this beside `StatsPanel`, so the two never fight over the same grid cell.
 */
export const JevPanel = ({ title = "Jev 判读" }: PanelProps) => {
  const messages = useAuiState((state) => state.thread.messages);
  const latest = messages.findLast((message) => isReading(message.metadata.custom.reading));
  const reading = latest?.metadata.custom.reading;
  if (!isReading(reading)) return null;

  return (
    <section aria-label={title}>
      <h2 className="jev-title">
        {title}
        <Judging />
      </h2>
      <Panel reading={reading} />
    </section>
  );
};
