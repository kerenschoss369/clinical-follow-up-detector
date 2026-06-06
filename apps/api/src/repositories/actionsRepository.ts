import { getDatabase } from '../db/database.js';
import type { ApiAction } from './mappers.js';
import { mapActionRowToApi } from './mappers.js';
import type { ActionRow } from './mappers.js';
import type {
  ActionType,
  CompletionStatus,
  Priority,
  ReviewStatus,
} from '../schemas/sharedEnums.js';

export interface ActionUpdateFields {
  title?: string;
  type?: ActionType;
  deadlineText?: string | null;
  normalizedDeadline?: string | null;
  priority?: Priority;
  reviewStatus?: ReviewStatus;
  completionStatus?: CompletionStatus;
}

const ACTION_SELECT = `
  SELECT
    id,
    note_id,
    title,
    type,
    deadline_text,
    normalized_deadline,
    priority,
    evidence,
    needs_review,
    uncertainty_reason,
    review_status,
    completion_status,
    created_at,
    updated_at
  FROM actions
  WHERE id = ?
`;

export function findActionById(actionId: string): ApiAction | null {
  const db = getDatabase();
  const row = db.prepare(ACTION_SELECT).get(actionId) as ActionRow | undefined;

  if (!row) {
    return null;
  }

  return mapActionRowToApi(row);
}

export function updateAction(
  actionId: string,
  fields: ActionUpdateFields,
  updatedAt: string,
): ApiAction | null {
  const db = getDatabase();

  const assignments: string[] = ['updated_at = @updated_at'];
  const params: Record<string, string | number | null> = {
    id: actionId,
    updated_at: updatedAt,
  };

  if (fields.title !== undefined) {
    assignments.push('title = @title');
    params.title = fields.title;
  }

  if (fields.type !== undefined) {
    assignments.push('type = @type');
    params.type = fields.type;
  }

  if (fields.deadlineText !== undefined) {
    assignments.push('deadline_text = @deadline_text');
    params.deadline_text = fields.deadlineText;
  }

  if (fields.normalizedDeadline !== undefined) {
    assignments.push('normalized_deadline = @normalized_deadline');
    params.normalized_deadline = fields.normalizedDeadline;
  }

  if (fields.priority !== undefined) {
    assignments.push('priority = @priority');
    params.priority = fields.priority;
  }

  if (fields.reviewStatus !== undefined) {
    assignments.push('review_status = @review_status');
    params.review_status = fields.reviewStatus;
  }

  if (fields.completionStatus !== undefined) {
    assignments.push('completion_status = @completion_status');
    params.completion_status = fields.completionStatus;
  }

  const result = db
    .prepare(`UPDATE actions SET ${assignments.join(', ')} WHERE id = @id`)
    .run(params);

  if (result.changes === 0) {
    return null;
  }

  return findActionById(actionId);
}
