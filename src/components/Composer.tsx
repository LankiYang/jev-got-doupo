import type { FormEvent } from "react";
import { ComposerPrimitive, ThreadPrimitive, useAuiState } from "@assistant-ui/react";

const MAX_CHARS = 200;

type ComposerProps = {
  /** Called on the first accepted send, which unlocks audio playback. */
  readonly onSend: () => void;
};

const isOptions = (value: unknown): value is ReadonlyArray<string> =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

/**
 * The narrator's own suggested next actions, never Jev's — Jev only ever labels a
 * scene that is already written. Read off the newest message alone, not the thread's
 * history: that is what makes them disappear the instant a new turn starts, rather
 * than lingering as stale suggestions for a scene that has already moved on.
 */
const Suggestions = ({ onSend }: { readonly onSend: () => void }) => {
  const latest = useAuiState((state) => state.thread.messages.at(-1));
  const options = latest?.role === "assistant" ? latest.metadata.custom.options : undefined;
  if (!isOptions(options) || options.length === 0) return null;

  return (
    <div className="suggestions" role="group" aria-label="可选行动">
      {options.map((option) => (
        <ThreadPrimitive.Suggestion
          key={option}
          className="suggestion"
          prompt={option}
          send
          onClick={onSend}
        >
          {option}
        </ThreadPrimitive.Suggestion>
      ))}
    </div>
  );
};

export const Composer = ({ onSend }: ComposerProps) => {
  const length = useAuiState((state) => state.composer.text.trim().length);
  const overflow = length > MAX_CHARS;
  const blocked = overflow || length === 0;

  // Enter reaches the runtime through the form; a blocked submit stops there.
  const guard = (event: FormEvent<HTMLFormElement>) => {
    if (blocked) {
      event.preventDefault();
      return;
    }
    onSend();
  };

  return (
    <ComposerPrimitive.Root className="composer" onSubmit={guard}>
      <Suggestions onSend={onSend} />
      <ComposerPrimitive.Input
        className="composer-input"
        submitMode="enter"
        placeholder="你要做什么？"
        minRows={3}
        maxRows={8}
      />
      <div className="composer-foot">
        <span className={overflow ? "counter counter-over" : "counter"}>
          {length} / {MAX_CHARS}
        </span>
        <ComposerPrimitive.Send className="button" disabled={blocked} onClick={onSend}>
          送出
        </ComposerPrimitive.Send>
      </div>
    </ComposerPrimitive.Root>
  );
};
