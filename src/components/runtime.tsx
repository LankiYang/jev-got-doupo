import type { ChatModelAdapter, TextMessagePart, ThreadMessage } from "@assistant-ui/react";
import { FAILURES, fetchStory, streamTurn, type JevReading, type Story, type TurnResult } from "./api";

type AdapterOptions = {
  readonly sessionId: string;
  /** The number of completed turns the client currently knows. */
  readonly readTurn: () => number;
  readonly onTurn: (result: TurnResult) => void;
  readonly onEnded: () => void;
  readonly onResync: (story: Story) => void;
};

const isText = (part: ThreadMessage["content"][number]): part is TextMessagePart =>
  part.type === "text";

const lastUserAction = (messages: readonly ThreadMessage[]): string => {
  const last = messages.findLast((message) => message.role === "user");
  if (!last) return "";
  return last.content
    .filter(isText)
    .map((part) => part.text)
    .join(" ")
    .trim();
};

/**
 * A turn conflict refreshes the client's idea of the story before failing, so the
 * next attempt carries the right turn number.
 */
export const createStoryAdapter = ({
  sessionId,
  readTurn,
  onTurn,
  onEnded,
  onResync,
}: AdapterOptions): ChatModelAdapter => ({
  /**
   * Streams the scene rather than returning it whole.
   *
   * The reader used to wait out the whole turn — several seconds of generation plus the
   * judgement that follows — before a single word appeared. Yielding each chunk as it
   * arrives puts prose on screen almost immediately and lets the panel fill in behind it.
   */
  async *run({ messages, abortSignal }) {
    const action = lastUserAction(messages);
    if (!action) throw new Error(FAILURES.invalid_request);

    let narration = "";
    let failure: string | null = null;
    // The narrator's own suggested next actions — set once, if the `options` event
    // arrives; stays empty for the closing turn, which never asks for any.
    let options: ReadonlyArray<string> = [];
    // Jev's reading, once the `reading` event names it. Carried forward into every
    // later yield's `custom` metadata in this same run: the runtime merges a yield's
    // `custom` against the message's metadata from *before this run started*, not
    // against what the previous yield just set, so a later yield that omits a field
    // silently drops it rather than leaving it alone.
    let reading: JevReading | null = null;
    // Labels for the finished turn, held until the `saved` event names them.
    let settled: TurnResult | null = null;

    for await (const event of streamTurn(sessionId, { action, turn: readTurn() }, abortSignal)) {
      switch (event._tag) {
        case "chunk": {
          narration += event.text;
          yield { content: [{ type: "text" as const, text: narration }] };
          break;
        }
        case "reset": {
          // The prose that just streamed broke the fiction and a rewrite is coming.
          // Clearing it here is what makes the replacement land in the same message
          // instead of appending to text the reader has already been shown.
          narration = "";
          yield { content: [{ type: "text" as const, text: "" }] };
          break;
        }
        case "reading": {
          reading = event.reading;
          yield {
            content: [{ type: "text" as const, text: narration }],
            metadata: { custom: { reading, options } },
          };
          break;
        }
        case "options": {
          options = event.options;
          yield {
            content: [{ type: "text" as const, text: narration }],
            metadata: { custom: { options, ...(reading ? { reading } : {}) } },
          };
          break;
        }
        case "saved": {
          settled = event.result;
          break;
        }
        case "error": {
          failure = event.cause;
          break;
        }
      }
    }

    if (settled !== null) {
      const { position, mood, beat, danger, text, reading, stats } = settled;
      onTurn(settled);
      yield {
        content: [{ type: "text" as const, text }],
        metadata: { custom: { position, mood, beat, danger, reading, options, stats } },
      };
      return;
    }

    const code = failure ?? "unknown";
    if (code === "story_ended") onEnded();
    if (code === "turn_conflict") {
      const story = await fetchStory(sessionId, abortSignal).catch(() => null);
      if (story) onResync(story);
    }
    throw new Error(FAILURES[code as keyof typeof FAILURES] ?? FAILURES.unknown);
  },
});
