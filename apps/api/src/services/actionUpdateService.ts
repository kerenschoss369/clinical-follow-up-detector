import { AppError } from '../errors/appError.js';
import {
  findActionById,
  updateAction as persistActionUpdate,
  type ActionUpdateFields,
} from '../repositories/actionsRepository.js';
import type { UpdateActionInput } from '../schemas/updateActionSchema.js';

const INVALID_TRANSITION_MESSAGE =
  'The requested action status change is not allowed.';

const REJECTED_CANNOT_COMPLETE_MESSAGE =
  'A rejected action cannot be marked as completed.';

const COMPLETED_CANNOT_REJECT_MESSAGE =
  'A completed action cannot be rejected.';

function assertWorkflowTransition(
  currentReviewStatus: ActionUpdateFields['reviewStatus'],
  currentCompletionStatus: ActionUpdateFields['completionStatus'],
  patch: UpdateActionInput,
): ActionUpdateFields {
  const nextReviewStatus = patch.reviewStatus ?? currentReviewStatus;
  let nextCompletionStatus = patch.completionStatus ?? currentCompletionStatus;

  if (
    patch.reviewStatus === 'rejected' &&
    patch.completionStatus === 'completed'
  ) {
    throw new AppError(
      409,
      'INVALID_ACTION_TRANSITION',
      REJECTED_CANNOT_COMPLETE_MESSAGE,
    );
  }

  if (
    patch.reviewStatus === 'rejected' &&
    currentCompletionStatus === 'completed'
  ) {
    throw new AppError(
      409,
      'INVALID_ACTION_TRANSITION',
      COMPLETED_CANNOT_REJECT_MESSAGE,
    );
  }

  if (patch.reviewStatus === 'rejected') {
    nextCompletionStatus = 'open';
  }

  if (patch.completionStatus === 'open' && currentCompletionStatus === 'completed') {
    throw new AppError(
      409,
      'INVALID_ACTION_TRANSITION',
      INVALID_TRANSITION_MESSAGE,
    );
  }

  if (nextCompletionStatus === 'completed') {
    if (nextReviewStatus === 'rejected') {
      throw new AppError(
        409,
        'INVALID_ACTION_TRANSITION',
        REJECTED_CANNOT_COMPLETE_MESSAGE,
      );
    }

    if (nextReviewStatus !== 'confirmed') {
      throw new AppError(
        409,
        'INVALID_ACTION_TRANSITION',
        INVALID_TRANSITION_MESSAGE,
      );
    }

    if (
      currentCompletionStatus === 'completed' &&
      patch.completionStatus === 'completed'
    ) {
      throw new AppError(
        409,
        'INVALID_ACTION_TRANSITION',
        INVALID_TRANSITION_MESSAGE,
      );
    }
  }

  const updateFields: ActionUpdateFields = { ...patch };

  if (patch.reviewStatus === 'rejected') {
    updateFields.completionStatus = 'open';
  } else if (patch.completionStatus !== undefined) {
    updateFields.completionStatus = nextCompletionStatus;
  }

  return updateFields;
}

export function updateActionById(actionId: string, patch: UpdateActionInput) {
  const existing = findActionById(actionId);
  if (!existing) {
    throw new AppError(
      404,
      'ACTION_NOT_FOUND',
      'The requested action was not found.',
    );
  }

  const updateFields = assertWorkflowTransition(
    existing.reviewStatus,
    existing.completionStatus,
    patch,
  );

  const updatedAt = new Date().toISOString();
  const updated = persistActionUpdate(actionId, updateFields, updatedAt);

  if (!updated) {
    throw new AppError(
      404,
      'ACTION_NOT_FOUND',
      'The requested action was not found.',
    );
  }

  return updated;
}
