import { useState } from 'react';
import type { UpdateActionRequest } from '../types/api';
import type { Action } from '../types/domain';
import { ActionControls } from './ActionControls';
import { EditActionForm } from './EditActionForm';
import { EvidenceSection } from './EvidenceSection';
import { StatusBadge } from './StatusBadge';

interface ActionCardProps {
  action: Action;
  isUpdating: boolean;
  updateError: string | null;
  onActionUpdate: (
    actionId: string,
    patch: UpdateActionRequest,
  ) => void | Promise<void>;
}

function formatLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function reviewBadge(action: Action): { variant: 'pending' | 'confirmed' | 'rejected'; label: string } {
  switch (action.reviewStatus) {
    case 'confirmed':
      return { variant: 'confirmed', label: 'Confirmed' };
    case 'rejected':
      return { variant: 'rejected', label: 'Rejected' };
    default:
      return { variant: 'pending', label: 'Pending review' };
  }
}

function completionBadge(action: Action): { variant: 'open' | 'completed'; label: string } {
  return action.completionStatus === 'completed'
    ? { variant: 'completed', label: 'Completed' }
    : { variant: 'open', label: 'Open' };
}

export function ActionCard({
  action,
  isUpdating,
  updateError,
  onActionUpdate,
}: ActionCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const review = reviewBadge(action);
  const completion = completionBadge(action);

  const handleWorkflowUpdate = async (patch: UpdateActionRequest) => {
    try {
      await onActionUpdate(action.id, patch);
    } catch {
      // Error is surfaced through updateError from the parent.
    }
  };

  const handleEditSave = async (patch: UpdateActionRequest) => {
    try {
      await onActionUpdate(action.id, patch);
      setIsEditing(false);
    } catch {
      // Keep edit mode open and preserve draft when update fails.
    }
  };

  return (
    <article
      className={`action-card${isUpdating ? ' action-card--updating' : ''}`}
      aria-busy={isUpdating ? true : undefined}
    >
      <header className="action-card__header">
        {!isEditing ? (
          <div className="action-card__title-row">
            <h3 className="action-card__title">{action.title}</h3>
            {action.needsReview ? (
              <span className="needs-review-flag" role="status">
                Needs review
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="action-card__review-status">
          <span
            className={`review-status-indicator review-status-indicator--${review.variant}`}
            role="status"
          >
            {review.label}
          </span>
        </div>
        <div className="action-card__meta-badges">
          <StatusBadge variant="type" value={formatLabel(action.type)} />
          <StatusBadge variant="priority" value={formatLabel(action.priority)} />
          <StatusBadge variant={completion.variant} value={completion.label} />
        </div>
      </header>

      {isEditing ? (
        <EditActionForm
          action={action}
          isUpdating={isUpdating}
          onSave={handleEditSave}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <div className="action-card__deadline">
          <h4 className="action-card__label">Deadline</h4>
          <p className="action-card__deadline-text">
            {action.deadlineText ?? 'Not specified'}
          </p>
          {action.normalizedDeadline ? (
            <p className="action-card__normalized-deadline">
              Resolved: {action.normalizedDeadline}
            </p>
          ) : null}
        </div>
      )}

      <EvidenceSection evidence={action.evidence} />

      {action.needsReview ? (
        <section className="action-card__uncertainty-section" aria-label="Why review is needed">
          <h4 className="action-card__label">Why review is needed</h4>
          <p className="action-card__uncertainty" role="note">
            {action.uncertaintyReason ??
              'This action was flagged for human review before it can be confirmed.'}
          </p>
        </section>
      ) : null}

      {isUpdating ? (
        <p className="action-card__updating" role="status" aria-live="polite">
          Updating...
        </p>
      ) : null}

      {updateError ? (
        <p className="action-card__error" role="alert">
          {updateError}
        </p>
      ) : null}

      <ActionControls
        action={action}
        isUpdating={isUpdating}
        isEditing={isEditing}
        onConfirm={() => handleWorkflowUpdate({ reviewStatus: 'confirmed' })}
        onReject={() => handleWorkflowUpdate({ reviewStatus: 'rejected' })}
        onEdit={() => setIsEditing(true)}
        onComplete={() => handleWorkflowUpdate({ completionStatus: 'completed' })}
      />
    </article>
  );
}
