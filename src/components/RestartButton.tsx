import { RotateCcw } from "lucide-react";

type RestartButtonProps = {
  readonly onRestart: () => void;
};

export const RestartButton = ({ onRestart }: RestartButtonProps) => (
  <button
    type="button"
    className="icon-button"
    onClick={onRestart}
    aria-label="Begin a new tale"
    title="开始新的故事"
  >
    <RotateCcw size={18} aria-hidden />
  </button>
);
