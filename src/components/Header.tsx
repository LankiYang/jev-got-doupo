import { useAuiState } from "@assistant-ui/react";
import {
  ARC_STAGE_NAMES,
  ARC_STAGES,
  BEATS,
  DANGERS,
  MOODS,
  type BeatId,
  type ChapterView,
  type DangerId,
  type MoodId,
  type Position,
} from "./api";

type HeaderProps = {
  readonly turn: number;
  /** Both fallbacks stand in until Jev has labelled a scene. */
  readonly positionFallback: Position;
  readonly moodFallback: MoodId;
  /** Resolved server-side; always current, so it needs no fallback of its own. */
  readonly chapter: ChapterView;
};

const isPosition = (value: unknown): value is Position =>
  typeof value === "object" && value !== null && "location" in value;

const oneOf =
  <T extends string>(values: ReadonlyArray<string>) =>
  (value: unknown): value is T =>
    typeof value === "string" && values.includes(value);

const isMood = oneOf<MoodId>(MOODS);
const isBeat = oneOf<BeatId>(BEATS);
const isDanger = oneOf<DangerId>(DANGERS);

const titleCase = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

/** Keyed on its own text, so React replaces the node and the CSS fade runs again. */
const Fading = ({ text }: { readonly text: string }) => (
  <span key={text} className="fading">
    {text}
  </span>
);

/**
 * Place, mood, beat and danger each come from the last message carrying that label,
 * which is the same judgment that steers the music and the next prompt.
 */
export const Header = ({ turn, positionFallback, moodFallback, chapter }: HeaderProps) => {
  const messages = useAuiState((state) => state.thread.messages);

  const lastWhere = messages.findLast((message) => isPosition(message.metadata.custom.position));
  const position = isPosition(lastWhere?.metadata.custom.position)
    ? lastWhere.metadata.custom.position
    : positionFallback;

  const lastMood = messages.findLast((message) => isMood(message.metadata.custom.mood));
  const mood = isMood(lastMood?.metadata.custom.mood)
    ? lastMood.metadata.custom.mood
    : moodFallback;

  const lastBeat = messages.findLast((message) => isBeat(message.metadata.custom.beat));
  const beat = isBeat(lastBeat?.metadata.custom.beat) ? lastBeat.metadata.custom.beat : undefined;

  const lastDanger = messages.findLast((message) => isDanger(message.metadata.custom.danger));
  const danger = isDanger(lastDanger?.metadata.custom.danger)
    ? lastDanger.metadata.custom.danger
    : undefined;

  // Beat and danger only exist once a scene has been judged, so the prologue shows mood alone.
  const labels: ReadonlyArray<readonly [string, string]> = [
    ["情绪", titleCase(mood)],
    ...(beat ? ([["场景", titleCase(beat)]] as const) : []),
    ...(danger ? ([["危险", titleCase(danger)]] as const) : []),
  ];

  return (
    <header className="header">
      <h1 className="title">斗破苍穹</h1>
      <p className="location">
        <Fading text={`地点：${position.location.name}`} />
      </p>
      <p className="chapter">
        <Fading text={`第 ${chapter.index} / ${chapter.total} 章 · ${chapter.title}`} />
      </p>
      <p className="chapter-goal">{chapter.goal}</p>
      <ol className="arc-stages" aria-label={`章节进度：${ARC_STAGE_NAMES[chapter.stage]}`}>
        {ARC_STAGES.map((stage, index) => (
          <li
            key={stage}
            className={index <= ARC_STAGES.indexOf(chapter.stage) ? "arc-stage is-reached" : "arc-stage"}
          >
            {ARC_STAGE_NAMES[stage]}
          </li>
        ))}
      </ol>
      <p className="labels">
        {labels.map(([name, value], index) => (
          <span key={name}>
            {index > 0 ? (
              <span className="divider" aria-hidden="true">
                |
              </span>
            ) : null}
            {name}: <Fading text={value} />
          </span>
        ))}
      </p>
      <p className="counter">第 {turn} 回合</p>
    </header>
  );
};
