import { RotateCcw } from "lucide-react";

type EndedProps = {
  readonly onNewTale: () => void;
};

/** Replaces the composer once the fifteenth turn has been narrated. */
export const Ended = ({ onNewTale }: EndedProps) => (
  <div className="ended">
    <p className="ended-line">你的故事到此为止——暂时。</p>
    <button type="button" className="button" onClick={onNewTale}>
      <RotateCcw size={15} aria-hidden />
      开始新的故事
    </button>
  </div>
);
