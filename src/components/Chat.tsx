import { useMemo, useRef, useState } from "react";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  type ThreadMessageLike,
} from "@assistant-ui/react";
import type { ChapterView, Story, StoryMessage } from "./api";
import { createStoryAdapter } from "./runtime";
import { usePrefetch } from "./prefetch";
import { Composer } from "./Composer";
import { Ended } from "./Ended";
import { Header } from "./Header";
import { JevPanel } from "./JevPanel";
import { MusicPlayer } from "./MusicPlayer";
import { RestartButton } from "./RestartButton";
import { SceneBackground } from "./SceneBackground";
import { StatsPanel } from "./StatsPanel";
import { Thread } from "./Thread";

type ChatProps = {
  readonly story: Story;
  readonly onNewTale: () => void;
};

type Progress = {
  readonly turn: number;
  readonly ended: boolean;
  readonly chapter: ChapterView;
};

const progressOf = (
  turn: number,
  ended: boolean,
  chapter: ChapterView,
): Progress => ({
  turn,
  ended,
  chapter,
});

const toThreadMessage = (message: StoryMessage): ThreadMessageLike => {
  if (message.role === "user") {
    return { id: message.id, role: "user", content: [{ type: "text", text: message.text }] };
  }
  return {
    id: message.id,
    role: "assistant",
    content: [{ type: "text", text: message.text }],
    metadata: {
      custom: {
        position: message.position,
        mood: message.mood,
        beat: message.beat,
        danger: message.danger,
        reading: message.reading,
        options: message.options,
        stats: message.stats,
      },
    },
  };
};

/**
 * The turn count lives in a ref so the adapter always posts the number the last
 * response gave it, and in state so the header re-renders.
 */
export const Chat = ({ story, onNewTale }: ChatProps) => {
  const [progress, setProgress] = useState<Progress>(
    progressOf(story.turn, story.ended, story.chapter),
  );
  const [started, setStarted] = useState(false);
  const turnRef = useRef(story.turn);

  const initialMessages = useMemo(() => story.messages.map(toThreadMessage), [story.messages]);

  const adapter = useMemo(
    () =>
      createStoryAdapter({
        sessionId: story.sessionId,
        readTurn: () => turnRef.current,
        onTurn: (result) => {
          turnRef.current = result.turn;
          setProgress(progressOf(result.turn, result.ended, result.chapter));
        },
        onEnded: () => setProgress((current) => ({ ...current, ended: true })),
        onResync: (fresh) => {
          turnRef.current = fresh.turn;
          setProgress(progressOf(fresh.turn, fresh.ended, fresh.chapter));
        },
      }),
    [story.sessionId],
  );

  const runtime = useLocalRuntime(adapter, { initialMessages });

  // The opening scene is already on screen by the time this mounts, so warm the rest.
  usePrefetch(true);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <SceneBackground fallback={story.position} />
      {/* The story column and the reading panel sit side by side when there is
          room, and stack when there is not. */}
      <div className="stage">
        <Header
          turn={progress.turn}
          positionFallback={story.position}
          moodFallback={story.mood}
          chapter={progress.chapter}
        />
        <section className="chatbox">
          <Thread />
          {progress.ended ? (
            <Ended onNewTale={onNewTale} />
          ) : (
            <Composer onSend={() => setStarted(true)} />
          )}
        </section>
        <div className="controls">
          <RestartButton onRestart={onNewTale} />
          <MusicPlayer fallback={story.mood} started={started} />
        </div>
      </div>
      <aside className="jev-aside">
        <StatsPanel />
        <JevPanel />
      </aside>
    </AssistantRuntimeProvider>
  );
};
