import { Option } from "effect";
import * as Affection from "@/core/Affection";
import * as ArcStage from "@/core/ArcStage";
import * as Background from "@/core/Background";
import * as Beat from "@/core/Beat";
import * as Chapter from "@/core/Chapter";
import * as Companion from "@/core/Companion";
import { openingLocationId, openingMoodId, prologue, startingOptions } from "@/core/data/prologue";
import * as Location from "@/core/Location";
import * as Meter from "@/core/Meter";
import * as Position from "@/core/Position";
import * as Story from "@/core/Story";
import type { TurnResult } from "@/core/StoryEngine";
import type * as Wire from "@/server/schemas";

const place = (id: Location.LocationId): Wire.Place => ({
  id,
  name: Location.byId[id].name,
  region: Location.byId[id].region,
});

/**
 * The beat travels beside the place because the backdrop belongs to the scene rather
 * than the map: a battle looks like a battle wherever it is fought. The opening has
 * no beat and hands `Option.none()`, which falls back to the place.
 */
export const position = (
  where: Position.Position,
  beat: Option.Option<Beat.BeatId>,
): Wire.Position => ({
  location: place(where.location),
  background: Background.forScene(where, beat),
});

/** The beat the story currently stands under; none at all before the first turn. */
const standingBeat = (state: Story.StoryState): Option.Option<Beat.BeatId> =>
  Option.map(Story.lastDecision(state), (decision) => decision.beat);

/**
 * Resolves a chapter id and its progress into the title and goal the header prints.
 *
 * `Chapter.resolve`/`ArcStage.resolve` rather than a bare lookup: a story saved before
 * this build's chapter catalog existed carries neither field, and the header is not
 * where that should turn into a 500 — it reads as chapter one, same as a fresh story.
 */
const chapterView = (info: {
  readonly chapter: Chapter.ChapterId;
  readonly arcStageReached: ArcStage.ArcStageId;
}): Wire.ChapterView => {
  const id = Chapter.resolve(info.chapter);
  const stage = ArcStage.resolve(info.arcStageReached);
  const chapter = Chapter.byId[id];
  return {
    id,
    title: chapter.title,
    goal: chapter.goal,
    index: Chapter.indexOf(id) + 1,
    total: Chapter.all.length,
    stage,
  };
};

/** The seed gauges, so the opening message has something to show before any turn is judged. */
const openingStats: Wire.Stats = {
  sceneDanger: Story.initialSceneDanger,
  tension: Story.initialTension,
  morality: Story.initialMorality,
  gold: Story.initialGold,
  affection: Affection.seed(),
  companion: Companion.none,
};

/** Carries the opening position and mood, so the header and the music can read them at turn zero. */
const opening: Wire.Message = {
  id: "prologue",
  role: "assistant",
  text: `${prologue.protagonist}\n\n${prologue.narrator}`,
  position: position(Position.at(openingLocationId), Option.none()),
  mood: openingMoodId,
  options: startingOptions,
  stats: openingStats,
};

const exchange = (turn: Story.Turn, index: number, stats: Wire.Stats): ReadonlyArray<Wire.Message> => [
  { id: `turn-${index}-user`, role: "user", text: turn.action },
  {
    id: `turn-${index}-assistant`,
    role: "assistant",
    text: turn.narration,
    position: position(turn.decision.position, Option.some(turn.decision.beat)),
    mood: turn.decision.mood,
    beat: turn.decision.beat,
    danger: turn.decision.danger,
    reading: storedReading(turn),
    stats,
  },
];

/**
 * Every turn's gauges as they stood right after it was played, walked forward once
 * rather than re-derived per message: `turns` only carries each turn's signed delta,
 * so the running totals have to be folded in order, the same accumulation
 * `Story.appendTurn` already does when a turn is first saved.
 */
const statsByTurn = (state: Story.StoryState): ReadonlyArray<Wire.Stats> => {
  let sceneDanger = Story.initialSceneDanger;
  let tension = Story.initialTension;
  let morality = Story.initialMorality;
  let gold = Story.initialGold;
  let affection: Readonly<Record<string, number>> = Affection.seed();
  return state.turns.map((played) => {
    const { decision } = played;
    sceneDanger = Meter.apply(sceneDanger, decision.sceneDangerDelta);
    tension = Meter.apply(tension, decision.tensionDelta);
    morality = Meter.apply(morality, decision.moralityDelta);
    // Not `Meter.apply`: gold has no ceiling, only a floor at zero.
    gold = Math.max(0, Math.round(gold + decision.goldDelta));
    if (decision.companion !== Companion.none) {
      affection = {
        ...affection,
        [decision.companion]: Meter.apply(Affection.of(affection, decision.companion), decision.affectionDelta),
      };
    }
    return { sceneDanger, tension, morality, gold, affection, companion: decision.companion };
  });
};

/** The whole thread: the prologue, then every saved turn as a pair of messages. */
export const story = (state: Story.StoryState, maxTurns: number): Wire.StoryView => {
  const stats = statsByTurn(state);
  return {
    sessionId: state.sessionId,
    position: position(state.position, standingBeat(state)),
    mood: state.mood,
    chapter: chapterView(state),
    turn: state.turns.length,
    turnsRemaining: Story.turnsRemaining(state, maxTurns),
    ended: state.ended,
    messages: [
      opening,
      ...state.turns.flatMap((played, index) => exchange(played, index + 1, stats[index])),
    ],
  };
};

/** Read as asked and unconfident, for a turn saved before this question existed. */
const missingScore: Wire.LabelledScore = { score: 0, confidence: 0, probabilities: {} };
const missingChoice = (fallback: string): Wire.LabelledChoice => ({
  choice: fallback,
  confidence: 0,
  probabilities: {},
});

/**
 * Rebuild the reading panel's shape from a saved turn.
 *
 * Turns written before the panel existed have no timing or token count on disk, so
 * those two read as zero and the panel simply omits them. `arcStage` and `companion`
 * are newer than `location`/`beat`/`mood`/`danger`/`inFiction` for the same reason: an
 * even older turn has none of those five either, so this is a total read the whole way
 * down rather than one that trusts every field to be there.
 */
const storedReading = (turn: Story.Turn): Wire.JevReading => ({
  location: { ...turn.answers.location, probabilities: { ...turn.answers.location.probabilities } },
  beat: { ...turn.answers.beat, probabilities: { ...turn.answers.beat.probabilities } },
  mood: { ...turn.answers.mood, probabilities: { ...turn.answers.mood.probabilities } },
  danger: {
    ...turn.answers.danger,
    probabilities: { ...turn.answers.danger.probabilities },
  },
  inFiction: { ...turn.answers.inFiction },
  arcStage: turn.answers.arcStage
    ? { ...turn.answers.arcStage, probabilities: { ...turn.answers.arcStage.probabilities } }
    : missingScore,
  companion: turn.answers.companion
    ? { ...turn.answers.companion, probabilities: { ...turn.answers.companion.probabilities } }
    : missingChoice("none"),
  latencyMs: 0,
  inputTokens: 0,
});

/** One played turn, as the composer's response. */
export const turn = (result: TurnResult): Wire.TurnView => ({
  position: position(result.decision.position, Option.some(result.decision.beat)),
  mood: result.decision.mood,
  beat: result.decision.beat,
  danger: result.decision.danger,
  text: result.text,
  reading: result.reading,
  chapter: chapterView(result),
  turn: result.turn,
  turnsRemaining: result.turnsRemaining,
  ended: result.ended,
  stats: {
    sceneDanger: result.sceneDanger,
    tension: result.tension,
    morality: result.morality,
    gold: result.gold,
    affection: result.affection,
    companion: result.decision.companion,
  },
});
