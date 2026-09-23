import { Either, ParseResult, Schema } from "effect";
import * as ArcStage from "@/core/ArcStage";
import * as Beat from "@/core/Beat";
import * as Companion from "@/core/Companion";
import * as Danger from "@/core/Danger";
import { InvalidRequest } from "@/core/Errors";
import * as Location from "@/core/Location";
import * as Mood from "@/core/Mood";
import { JevReading } from "@/core/JevReading";
import { SessionId } from "@/core/Story";

/** The composer's cap, enforced again on the server so the client cannot lift it. */
export const maxActionLength = 200;

/** One turn as the client sends it. `turn` is how many turns the client believes are done. */
export const TurnRequest = Schema.Struct({
  action: Schema.Trim.pipe(Schema.minLength(1), Schema.maxLength(maxActionLength)),
  turn: Schema.Int.pipe(Schema.nonNegative()),
});

export type TurnRequest = typeof TurnRequest.Type;

/** The domain stores ids; the header needs the name, so the id is resolved server-side. */
export const Place = Schema.Struct({
  id: Location.LocationId,
  name: Schema.String,
  region: Location.Region,
});

export type Place = typeof Place.Type;

/** `background` is the artwork's public path, so the browser never carries the catalog. */
export const Position = Schema.Struct({
  location: Place,
  background: Schema.String,
});

export type Position = typeof Position.Type;

/**
 * Where the story currently stands in its chapter arc, resolved server-side: the
 * catalog stays there, the client gets a title and goal it can print as-is.
 */
export const ChapterView = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  goal: Schema.String,
  /** 1-based, for "第 N 章" without the client counting the catalog itself. */
  index: Schema.Int,
  total: Schema.Int,
  /** The furthest 起承转合 stage reached since this chapter opened. */
  stage: ArcStage.ArcStageId,
});

export type ChapterView = typeof ChapterView.Type;

/**
 * The three running gauges, current as of this message: `sceneDanger` and `tension`
 * always apply, `affection` is keyed by every companion the catalog knows (loose
 * string keys, like `JevReading`'s probabilities, so a catalog that has moved on still
 * decodes an older turn), and `companion` names whoever had a real presence in this
 * particular scene, for the client to decide who the affection bar is about right now.
 */
export const Stats = Schema.Struct({
  sceneDanger: Schema.Number,
  tension: Schema.Number,
  morality: Schema.Number,
  gold: Schema.Number,
  affection: Schema.Record({ key: Schema.String, value: Schema.Number }),
  companion: Companion.CompanionId,
});

export type Stats = typeof Stats.Type;

/** One message in the thread, with the labels that message was written under. */
export const Message = Schema.Struct({
  id: Schema.String,
  role: Schema.Literal("user", "assistant"),
  text: Schema.String,
  position: Schema.optional(Position),
  mood: Schema.optional(Mood.MoodId),
  beat: Schema.optional(Beat.BeatId),
  danger: Schema.optional(Danger.DangerId),
  /** Jev's full answer for this scene, for the reading panel. */
  reading: Schema.optional(JevReading),
  /** Suggested next actions, shown beneath this message only while it is the latest. */
  options: Schema.optional(Schema.Array(Schema.String)),
  stats: Schema.optional(Stats),
});

export type Message = typeof Message.Type;

/** The whole story, as `GET /api/story/[id]` returns it. */
export const StoryView = Schema.Struct({
  sessionId: SessionId,
  position: Position,
  mood: Mood.MoodId,
  chapter: ChapterView,
  /** Turns already played. */
  turn: Schema.Int,
  turnsRemaining: Schema.Int,
  ended: Schema.Boolean,
  messages: Schema.Array(Message),
});

export type StoryView = typeof StoryView.Type;

export { JevReading };
export type { LabelledChoice, LabelledNoul, LabelledScore } from "@/core/JevReading";

/** One played turn, as `POST /api/story/[id]/turn` returns it. */
export const TurnView = Schema.Struct({
  position: Position,
  mood: Mood.MoodId,
  beat: Beat.BeatId,
  danger: Danger.DangerId,
  text: Schema.String,
  /** Jev's full answer, including the distributions the panel plots. */
  reading: JevReading,
  chapter: ChapterView,
  /** Turns played after this one. */
  turn: Schema.Int,
  turnsRemaining: Schema.Int,
  ended: Schema.Boolean,
  stats: Stats,
});

export type TurnView = typeof TurnView.Type;

const firstIssue = (error: ParseResult.ParseError): string => {
  const issues = ParseResult.ArrayFormatter.formatErrorSync(error);
  const issue = issues[0];
  if (issue === undefined) return "invalid request";
  if (issue.path.length === 0) return issue.message;
  return `${issue.path.join(".")}: ${issue.message}`;
};

const decode = <A, I>(schema: Schema.Schema<A, I>) => {
  const decoder = Schema.decodeUnknownEither(schema);
  return (input: unknown): Either.Either<A, InvalidRequest> =>
    decoder(input).pipe(
      Either.mapLeft((error) => new InvalidRequest({ message: firstIssue(error) })),
    );
};

export const decodeSessionId = decode(SessionId);

export const decodeTurnRequest = decode(TurnRequest);
