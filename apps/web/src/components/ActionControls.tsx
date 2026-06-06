import type { Action } from '../types/domain';

interface ActionControlsProps {
  action: Action;
  isUpdating: boolean;
  isEditing: boolean;
  onConfirm: () => void;
  onReject: () => void;
  onEdit: () => void;
  onComplete: () => void;
}

function canConfirm(action: Action): boolean {
  return action.reviewStatus === 'pending';
}

function canReject(action: Action): boolean {
  return action.reviewStatus === 'pending';
}

function canComplete(action: Action): boolean {
  return (
    action.reviewStatus === 'confirmed' && action.completionStatus === 'open'
  );
}

export function ActionControls({
  action,
  isUpdating,
  isEditing,
  onConfirm,
  onReject,
  onEdit,
  onComplete,
}: ActionControlsProps) {
  if (isEditing) {
    return null;
  }

  const controlsDisabled = isUpdating;

  return (
    <footer className="action-controls" aria-label={`Actions for ${action.title}`}>
      {canConfirm(action) ? (
        <button
          type="button"
          className="action-controls__button action-controls__button--confirm"
          onClick={onConfirm}
          disabled={controlsDisabled}
          aria-label={`Confirm action: ${action.title}`}
        >
          Confirm
        </button>
      ) : null}

      {canReject(action) ? (
        <button
          type="button"
          className="action-controls__button action-controls__button--reject"
          onClick={onReject}
          disabled={controlsDisabled}
          aria-label={`Reject action: ${action.title}`}
        >
          Reject
        </button>
      ) : null}

      <button
        type="button"
        className="action-controls__button action-controls__button--edit"
        onClick={onEdit}
        disabled={controlsDisabled}
        aria-label={`Edit action: ${action.title}`}
      >
        Edit
      </button>

      {canComplete(action) ? (
        <button
          type="button"
          className="action-controls__button action-controls__button--complete"
          onClick={onComplete}
          disabled={controlsDisabled}
          aria-label={`Mark action completed: ${action.title}`}
        >
          Mark completed
        </button>
      ) : null}
    </footer>
  );
}
