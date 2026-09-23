"use client";

import { useAuiState } from "@assistant-ui/react";
import { nameOfCompanion, type Stats } from "./api";
import { Judging } from "./Judging";

/**
 * The narrative gauges: 好感度, 场景危险度, 人物紧张度, 道德值, 金币量. Each moves a
 * turn at a time by Jev's own two-step reading (direction, then how much) — see
 * `Oracle.ts`'s `*Direction`/`*Magnitude` questions and `Meter.deltaOf`. This panel only
 * ever renders what the server already resolved; it does no judging of its own.
 *
 * Every assistant message carries the gauges as they stood right after that turn,
 * `stats` included on the opening message too, so there is always something to show
 * from the very first render — unlike `JevPanel`, which has nothing before turn one.
 */

const isStats = (value: unknown): value is Stats =>
  typeof value === "object" &&
  value !== null &&
  "sceneDanger" in value &&
  "tension" in value &&
  "morality" in value &&
  "gold" in value &&
  "affection" in value;

const percent = (value: number): string => `${Math.round(value)}%`;

type Trend = "up" | "down" | "flat";

const trendOf = (current: number, previous: number | undefined): Trend => {
  if (previous === undefined || current === previous) return "flat";
  return current > previous ? "up" : "down";
};

const Arrow = ({ trend }: { readonly trend: Trend }) => {
  if (trend === "flat") return null;
  return (
    <span className={trend === "up" ? "stat-trend is-up" : "stat-trend is-down"} aria-hidden="true">
      {trend === "up" ? "▲" : "▼"}
    </span>
  );
};

const Gauge = ({
  label,
  value,
  previous,
}: {
  readonly label: string;
  readonly value: number;
  readonly previous: number | undefined;
}) => (
  <div className="stat-gauge">
    <span className="jev-meter-label">{label}</span>
    <span className="jev-bar-track" aria-hidden="true">
      <span className="jev-bar-fill" style={{ width: percent(value) }} />
    </span>
    <span className="jev-bar-value">
      {percent(value)}
      <Arrow trend={trendOf(value, previous)} />
    </span>
  </div>
);

/** Gold is a coin count, not a 1–100 gauge — a bar sized against a ceiling it does not
 *  have would be meaningless, so this just prints the number. */
const Count = ({
  label,
  value,
  previous,
}: {
  readonly label: string;
  readonly value: number;
  readonly previous: number | undefined;
}) => (
  <div className="stat-count">
    <span className="jev-meter-label">{label}</span>
    <span className="stat-count-value">
      {Math.round(value)}
      <Arrow trend={trendOf(value, previous)} />
    </span>
  </div>
);

/** Whoever last had a real presence in a scene, so the affection bar survives a
 *  companion-less turn instead of blanking out between their appearances. */
const companionOf = (
  messages: ReadonlyArray<{ readonly metadata: { readonly custom: Record<string, unknown> } }>,
): string | undefined => {
  const withSomeone = messages.findLast((message) => {
    const stats = message.metadata.custom.stats;
    return isStats(stats) && stats.companion !== "none";
  });
  const stats = withSomeone?.metadata.custom.stats;
  return isStats(stats) ? stats.companion : undefined;
};

export const StatsPanel = ({ title = "状态" }: { readonly title?: string }) => {
  const messages = useAuiState((state) => state.thread.messages);
  const withStats = messages.filter((message) => isStats(message.metadata.custom.stats));
  const latest = withStats.at(-1)?.metadata.custom.stats;
  const prior = withStats.at(-2)?.metadata.custom.stats;
  if (!isStats(latest)) return null;

  const companion = companionOf(messages);
  const affection = companion ? latest.affection[companion] : undefined;
  const priorAffection = companion && isStats(prior) ? prior.affection[companion] : undefined;

  return (
    <section aria-label={title}>
      <h2 className="jev-title">
        {title}
        <Judging />
      </h2>
      <div className="stats-panel">
        {companion && affection !== undefined ? (
          <Gauge
            label={`好感度 · ${nameOfCompanion(companion)}`}
            value={affection}
            previous={priorAffection}
          />
        ) : null}
        <Gauge label="场景危险度" value={latest.sceneDanger} previous={isStats(prior) ? prior.sceneDanger : undefined} />
        <Gauge label="人物紧张度" value={latest.tension} previous={isStats(prior) ? prior.tension : undefined} />
        <Gauge label="道德值" value={latest.morality} previous={isStats(prior) ? prior.morality : undefined} />
        <Count label="金币量" value={latest.gold} previous={isStats(prior) ? prior.gold : undefined} />
      </div>
    </section>
  );
};
