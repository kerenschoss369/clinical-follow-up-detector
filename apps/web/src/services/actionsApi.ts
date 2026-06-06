import type { UpdateActionRequest, UpdateActionResponse } from '../types/api';
import type { Action, ActionType, CompletionStatus, Priority, ReviewStatus } from '../types/domain';

const FALLBACK_ERROR_MESSAGE =
  'The action could not be updated. Please try again.';

const NETWORK_ERROR_MESSAGE = 'Unable to reach the server.';

const ACTION_TYPES: readonly ActionType[] = [
  'appointment',
  'test',
  'medication',
  'treatment',
  'warning',
  'other',
];

const PRIORITIES: readonly Priority[] = ['low', 'medium', 'high', 'urgent'];

const REVIEW_STATUSES: readonly ReviewStatus[] = [
  'pending',
  'confirmed',
  'rejected',
];

const COMPLETION_STATUSES: readonly CompletionStatus[] = ['open', 'completed'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isEnumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value);
}

function parseApiErrorBody(body: unknown): string | null {
  if (!isRecord(body)) {
    return null;
  }

  const error = body.error;
  if (!isRecord(error) || !isString(error.message)) {
    return null;
  }

  return error.message;
}

function parseAction(value: unknown): Action | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isString(value.id) ||
    !isString(value.noteId) ||
    !isString(value.title) ||
    !isEnumValue(value.type, ACTION_TYPES) ||
    !isNullableString(value.deadlineText) ||
    !isNullableString(value.normalizedDeadline) ||
    !isEnumValue(value.priority, PRIORITIES) ||
    !isString(value.evidence) ||
    !isBoolean(value.needsReview) ||
    !isNullableString(value.uncertaintyReason) ||
    !isEnumValue(value.reviewStatus, REVIEW_STATUSES) ||
    !isEnumValue(value.completionStatus, COMPLETION_STATUSES) ||
    !isString(value.createdAt) ||
    !isString(value.updatedAt)
  ) {
    return null;
  }

  return {
    id: value.id,
    noteId: value.noteId,
    title: value.title,
    type: value.type,
    deadlineText: value.deadlineText,
    normalizedDeadline: value.normalizedDeadline,
    priority: value.priority,
    evidence: value.evidence,
    needsReview: value.needsReview,
    uncertaintyReason: value.uncertaintyReason,
    reviewStatus: value.reviewStatus,
    completionStatus: value.completionStatus,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function parseUpdateActionResponse(body: unknown): UpdateActionResponse | null {
  if (!isRecord(body)) {
    return null;
  }

  const action = parseAction(body.action);
  if (!action) {
    return null;
  }

  return { action };
}

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export class UpdateActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UpdateActionError';
  }
}

export async function updateAction(
  actionId: string,
  patch: UpdateActionRequest,
): Promise<UpdateActionResponse> {
  let response: Response;

  try {
    response = await fetch(`/api/actions/${actionId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(patch),
    });
  } catch {
    throw new UpdateActionError(NETWORK_ERROR_MESSAGE);
  }

  const body = await readResponseBody(response);

  if (!response.ok) {
    const apiMessage = parseApiErrorBody(body);
    throw new UpdateActionError(apiMessage ?? FALLBACK_ERROR_MESSAGE);
  }

  const parsed = parseUpdateActionResponse(body);
  if (!parsed) {
    throw new UpdateActionError(FALLBACK_ERROR_MESSAGE);
  }

  return parsed;
}
