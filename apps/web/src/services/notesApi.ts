import type { AnalyzeNoteResponse, GetNoteResponse } from '../types/api';
import type { Action, ActionType, CompletionStatus, Priority, ReviewStatus } from '../types/domain';

const ANALYZE_URL = '/api/notes/analyze';

const FALLBACK_ERROR_MESSAGE =
  'The note could not be analyzed. Please try again.';

const NETWORK_ERROR_MESSAGE =
  'Unable to reach the server. Make sure the Node API is running on port 3000.';

const UNAVAILABLE_ERROR_MESSAGE =
  'The note could not be analyzed because the API server is unavailable. Start the Node API on port 3000.';

const GET_FALLBACK_ERROR_MESSAGE =
  'The saved note could not be loaded. Please try again.';

const GET_NETWORK_ERROR_MESSAGE = 'Unable to reach the server.';

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

function parseActions(body: unknown): Action[] | null {
  if (!isRecord(body) || !Array.isArray(body.actions)) {
    return null;
  }

  const actions: Action[] = [];
  for (const item of body.actions) {
    const action = parseAction(item);
    if (!action) {
      return null;
    }
    actions.push(action);
  }

  return actions;
}

function parseAnalyzeResponse(body: unknown): AnalyzeNoteResponse | null {
  if (!isRecord(body)) {
    return null;
  }

  const note = body.note;
  if (!isRecord(note) || !isString(note.id) || !isString(note.createdAt)) {
    return null;
  }

  const actions = parseActions(body);
  if (!actions) {
    return null;
  }

  return {
    note: {
      id: note.id,
      createdAt: note.createdAt,
    },
    actions,
  };
}

function parseGetNoteResponse(body: unknown): GetNoteResponse | null {
  if (!isRecord(body)) {
    return null;
  }

  const note = body.note;
  if (
    !isRecord(note) ||
    !isString(note.id) ||
    !isString(note.text) ||
    !isString(note.createdAt)
  ) {
    return null;
  }

  const actions = parseActions(body);
  if (!actions) {
    return null;
  }

  return {
    note: {
      id: note.id,
      text: note.text,
      createdAt: note.createdAt,
    },
    actions,
  };
}

async function readResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export class AnalyzeNoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnalyzeNoteError';
  }
}

export class GetNoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GetNoteError';
  }
}

export async function analyzeNote(text: string): Promise<AnalyzeNoteResponse> {
  let response: Response;

  try {
    response = await fetch(ANALYZE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
  } catch {
    throw new AnalyzeNoteError(NETWORK_ERROR_MESSAGE);
  }

  const body = await readResponseBody(response);

  if (!response.ok) {
    const apiMessage = parseApiErrorBody(body);
    if (apiMessage) {
      throw new AnalyzeNoteError(apiMessage);
    }

    if (response.status === 502 || response.status === 503 || response.status === 500) {
      throw new AnalyzeNoteError(UNAVAILABLE_ERROR_MESSAGE);
    }

    throw new AnalyzeNoteError(FALLBACK_ERROR_MESSAGE);
  }

  const parsed = parseAnalyzeResponse(body);
  if (!parsed) {
    throw new AnalyzeNoteError(FALLBACK_ERROR_MESSAGE);
  }

  return parsed;
}

export async function getNote(noteId: string): Promise<GetNoteResponse> {
  let response: Response;

  try {
    response = await fetch(`/api/notes/${encodeURIComponent(noteId)}`);
  } catch {
    throw new GetNoteError(GET_NETWORK_ERROR_MESSAGE);
  }

  const body = await readResponseBody(response);

  if (!response.ok) {
    const apiMessage = parseApiErrorBody(body);
    throw new GetNoteError(apiMessage ?? GET_FALLBACK_ERROR_MESSAGE);
  }

  const parsed = parseGetNoteResponse(body);
  if (!parsed) {
    throw new GetNoteError(GET_FALLBACK_ERROR_MESSAGE);
  }

  return parsed;
}