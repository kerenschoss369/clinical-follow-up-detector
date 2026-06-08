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

const TERMINAL_REJECTED_MESSAGE =
  'A rejected action cannot be changed.';

const TERMINAL_COMPLETED_MESSAGE =
  'A completed action cannot be changed.';

function isEditableState(
  reviewStatus: ActionUpdateFields['reviewStatus'],
  completionStatus: ActionUpdateFields['completionStatus'],
): boolean {
  return (
    (reviewStatus === 'pending' && completionStatus === 'open') ||
    (reviewStatus === 'confirmed' && completionStatus === 'open')
  );
}

function hasContentFieldEdits(patch: UpdateActionInput): boolean {
  return (
    patch.title !== undefined ||
    patch.type !== undefined ||
    patch.deadlineText !== undefined ||
    patch.normalizedDeadline !== undefined ||
    patch.priority !== undefined
  );
}

function buildUpdateFields(
  patch: UpdateActionInput,
  completionStatus: ActionUpdateFields['completionStatus'],
): ActionUpdateFields {
  const updateFields: ActionUpdateFields = { ...patch };

  if (patch.reviewStatus === 'rejected') {
    updateFields.completionStatus = 'open';
  } else if (patch.completionStatus !== undefined) {
    updateFields.completionStatus = completionStatus;
  }

  return updateFields;
}

function assertPendingOpenTransition(
  patch: UpdateActionInput,
): ActionUpdateFields {
  const nextCompletionStatus = patch.completionStatus ?? 'open';

  if (nextCompletionStatus === 'completed') {
    throw new AppError(
      409,
      'INVALID_ACTION_TRANSITION',
      INVALID_TRANSITION_MESSAGE,
    );
  }

  if (patch.reviewStatus === 'rejected') {
    return buildUpdateFields(patch, 'open');
  }

  if (
    patch.reviewStatus === 'pending' ||
    patch.reviewStatus === 'confirmed' ||
    patch.reviewStatus === undefined
  ) {
    return buildUpdateFields(patch, 'open');
  }

  throw new AppError(
    409,
    'INVALID_ACTION_TRANSITION',
    INVALID_TRANSITION_MESSAGE,
  );
}

function assertConfirmedOpenTransition(
  patch: UpdateActionInput,
): ActionUpdateFields {
  if (patch.reviewStatus === 'rejected' || patch.reviewStatus === 'pending') {
    throw new AppError(
      409,
      'INVALID_ACTION_TRANSITION',
      INVALID_TRANSITION_MESSAGE,
    );
  }

  const nextCompletionStatus = patch.completionStatus ?? 'open';

  if (nextCompletionStatus === 'completed') {
    return buildUpdateFields(patch, 'completed');
  }

  if (
    patch.reviewStatus === 'confirmed' ||
    patch.reviewStatus === undefined ||
    patch.completionStatus === 'open'
  ) {
    return buildUpdateFields(patch, 'open');
  }

  throw new AppError(
    409,
    'INVALID_ACTION_TRANSITION',
    INVALID_TRANSITION_MESSAGE,
  );
}

function assertWorkflowTransition(
  currentReviewStatus: ActionUpdateFields['reviewStatus'],
  currentCompletionStatus: ActionUpdateFields['completionStatus'],
  patch: UpdateActionInput,
): ActionUpdateFields {
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
    currentReviewStatus === 'rejected' &&
    currentCompletionStatus === 'open'
  ) {
    if (hasContentFieldEdits(patch)) {
      throw new AppError(
        409,
        'INVALID_ACTION_TRANSITION',
        TERMINAL_REJECTED_MESSAGE,
      );
    }

    if (patch.reviewStatus !== undefined && patch.reviewStatus !== 'rejected') {
      throw new AppError(
        409,
        'INVALID_ACTION_TRANSITION',
        TERMINAL_REJECTED_MESSAGE,
      );
    }

    if (patch.completionStatus === 'completed') {
      throw new AppError(
        409,
        'INVALID_ACTION_TRANSITION',
        REJECTED_CANNOT_COMPLETE_MESSAGE,
      );
    }

    return buildUpdateFields(patch, 'open');
  }

  if (
    currentReviewStatus === 'confirmed' &&
    currentCompletionStatus === 'completed'
  ) {
    if (hasContentFieldEdits(patch)) {
      throw new AppError(
        409,
        'INVALID_ACTION_TRANSITION',
        TERMINAL_COMPLETED_MESSAGE,
      );
    }

    if (
      patch.reviewStatus === 'rejected' ||
      patch.reviewStatus === 'pending'
    ) {
      throw new AppError(
        409,
        'INVALID_ACTION_TRANSITION',
        TERMINAL_COMPLETED_MESSAGE,
      );
    }

    if (patch.completionStatus === 'open') {
      throw new AppError(
        409,
        'INVALID_ACTION_TRANSITION',
        INVALID_TRANSITION_MESSAGE,
      );
    }

    return buildUpdateFields(patch, 'completed');
  }

  if (!isEditableState(currentReviewStatus, currentCompletionStatus)) {
    throw new AppError(
      409,
      'INVALID_ACTION_TRANSITION',
      INVALID_TRANSITION_MESSAGE,
    );
  }

  if (
    currentReviewStatus === 'pending' &&
    currentCompletionStatus === 'open'
  ) {
    return assertPendingOpenTransition(patch);
  }

  return assertConfirmedOpenTransition(patch);
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
