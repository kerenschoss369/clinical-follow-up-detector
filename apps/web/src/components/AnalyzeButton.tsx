interface AnalyzeButtonProps {
  disabled: boolean;
  isLoading: boolean;
  onClick: () => void;
}

export function AnalyzeButton({
  disabled,
  isLoading,
  onClick,
}: AnalyzeButtonProps) {
  return (
    <button
      type="button"
      className="analyze-button"
      onClick={onClick}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
    >
      {isLoading ? 'Analyzing note...' : 'Analyze note'}
    </button>
  );
}