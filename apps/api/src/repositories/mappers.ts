import type {
  ActionType,
  CompletionStatus,
  Priority,
  ReviewStatus,
} from '../schemas/sharedEnums.js';

export interface ActionRow {
  id: string;
  note_id: string;
  title: string;
  type: ActionType;
  deadline_text: string | null;
  normalized_deadline: string | null;
  priority: Priority;
  evidence: string;
  needs_review: number;
  uncertainty_reason: string | null;
  review_status: ReviewStatus;
  completion_status: CompletionStatus;
  created_at: string;
  updated_at: string;
}

export interface NoteRow {
  id: string;
  original_text: string;
  created_at: string;
}

export interface ApiNoteSummary {
  id: string;
  createdAt: string;
}

export interface ApiNoteWithText extends ApiNoteSummary {
  text: string;
}

export interface ApiAction {
  id: string;
  noteId: string;
  title: string;
  type: ActionType;
  deadlineText: string | null;
  normalizedDeadline: string | null;
  priority: Priority;
  evidence: string;
  needsReview: boolean;
  uncertaintyReason: string | null;
  reviewStatus: ReviewStatus;
  completionStatus: CompletionStatus;
  createdAt: string;
  updatedAt: string;
}

export function mapActionRowToApi(row: ActionRow): ApiAction {
  return {
    id: row.id,
    noteId: row.note_id,
    title: row.title,
    type: row.type,
    deadlineText: row.deadline_text,
    normalizedDeadline: row.normalized_deadline,
    priority: row.priority,
    evidence: row.evidence,
    needsReview: row.needs_review === 1,
    uncertaintyReason: row.uncertainty_reason,
    reviewStatus: row.review_status,
    completionStatus: row.completion_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapNoteRowToApiSummary(row: NoteRow): ApiNoteSummary {
  return {
    id: row.id,
    createdAt: row.created_at,
  };
}

export function mapNoteRowToApiWithText(row: NoteRow): ApiNoteWithText {
  return {
    id: row.id,
    text: row.original_text,
    createdAt: row.created_at,
  };
}
