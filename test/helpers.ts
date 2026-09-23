import { Schema } from "effect";
import type { Decision } from "@/core/Decision";
import * as Position from "@/core/Position";
import type { StoredAnswers } from "@/core/Question";
import { SessionId, type Turn } from "@/core/Story";

/** A fixed session id, so a failing test names the same file every time. */
export const sessionId = Schema.decodeSync(SessionId)("2f6a9c1e-6d7b-4d0e-9d2a-7f2c8b1a4e55");

/** Stored answers with only the fields a test cares about spelled out. */
export const storedAnswers = (options: {
  readonly location?: Record<string, number>;
  /** Jev's own pick, when a test wants it to disagree with the distribution. */
  readonly choice?: string;
  readonly beat?: string;
  readonly mood?: string;
  readonly danger?: number;
  readonly inFiction?: number;
  readonly arcStage?: number;
  readonly companion?: string;
  readonly affectionDirection?: number;
  readonly affectionMagnitude?: number;
  readonly sceneDangerDirection?: number;
  readonly sceneDangerMagnitude?: number;
  readonly tensionDirection?: number;
  readonly tensionMagnitude?: number;
  readonly moralityDirection?: number;
  readonly moralityMagnitude?: number;
  readonly goldDirection?: number;
  /** A rung of `Meter.goldLadder`, as the string Jev answers with. */
  readonly goldAmount?: string;
}): StoredAnswers => ({
  location: {
    choice: options.choice ?? Object.keys(options.location ?? {})[0] ?? "xiao-clan-manor",
    confidence: 0.8,
    probabilities: options.location ?? {},
  },
  beat: {
    choice: options.beat ?? "journey",
    confidence: 0.8,
    probabilities: { [options.beat ?? "journey"]: 0.8 },
  },
  mood: {
    choice: options.mood ?? "calm",
    confidence: 0.8,
    probabilities: { [options.mood ?? "calm"]: 0.8 },
  },
  danger: {
    score: options.danger ?? 0,
    confidence: 0.8,
    probabilities: { [String(options.danger ?? 0)]: 0.8 },
  },
  inFiction: { noul: options.inFiction ?? 0.95 },
  arcStage: {
    score: options.arcStage ?? 0,
    confidence: 0.8,
    probabilities: { [String(options.arcStage ?? 0)]: 0.8 },
  },
  companion: {
    choice: options.companion ?? "none",
    confidence: 0.8,
    probabilities: { [options.companion ?? "none"]: 0.8 },
  },
  affectionDirection: { noul: options.affectionDirection ?? 0.5 },
  affectionMagnitude: {
    score: options.affectionMagnitude ?? 0,
    confidence: 0.8,
    probabilities: { [String(options.affectionMagnitude ?? 0)]: 0.8 },
  },
  sceneDangerDirection: { noul: options.sceneDangerDirection ?? 0.5 },
  sceneDangerMagnitude: {
    score: options.sceneDangerMagnitude ?? 0,
    confidence: 0.8,
    probabilities: { [String(options.sceneDangerMagnitude ?? 0)]: 0.8 },
  },
  tensionDirection: { noul: options.tensionDirection ?? 0.5 },
  tensionMagnitude: {
    score: options.tensionMagnitude ?? 0,
    confidence: 0.8,
    probabilities: { [String(options.tensionMagnitude ?? 0)]: 0.8 },
  },
  moralityDirection: { noul: options.moralityDirection ?? 0.5 },
  moralityMagnitude: {
    score: options.moralityMagnitude ?? 0,
    confidence: 0.8,
    probabilities: { [String(options.moralityMagnitude ?? 0)]: 0.8 },
  },
  goldDirection: { noul: options.goldDirection ?? 0.5 },
  goldAmount: {
    choice: options.goldAmount ?? "0",
    confidence: 0.8,
    probabilities: { [options.goldAmount ?? "0"]: 0.8 },
  },
});

/** A decision with sensible defaults, for building saved turns. */
export const decision = (overrides: Partial<Decision> = {}): Decision => ({
  position: Position.at("xiao-clan-manor"),
  mood: "calm",
  beat: "journey",
  danger: "safe",
  inFiction: true,
  arcStage: "setup",
  companion: "none",
  affectionDelta: 0,
  sceneDangerDelta: 0,
  tensionDelta: 0,
  moralityDelta: 0,
  goldDelta: 0,
  ...overrides,
});

/** A saved turn, for states a test wants to start part-way through. */
export const playedTurn = (overrides: Partial<Turn> = {}): Turn => ({
  action: "I practice my stance in the training ground.",
  narration: "You practice your stance, and the sand keeps your secret.",
  answers: storedAnswers({}),
  decision: decision(),
  at: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});
