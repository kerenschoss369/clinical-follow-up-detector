import { getDatabase } from '../db/database.js';
import type { ApiAction, ApiNoteSummary } from './mappers.js';
import { mapActionRowToApi, mapNoteRowToApiWithText } from './mappers.js';
import type { ActionRow, NoteRow } from './mappers.js';

export interface NewActionRecord {
  id: string;
  noteId: string;
  title: string;
  type: ApiAction['type'];
  deadlineText: string | null;
  normalizedDeadline: string | null;
  priority: ApiAction['priority'];
  evidence: string;
  needsReview: boolean;
  uncertaintyReason: string | null;
  reviewStatus: ApiAction['reviewStatus'];
  completionStatus: ApiAction['completionStatus'];
  createdAt: string;
  updatedAt: string;
}

export interface InsertNoteWithActionsInput {
  noteId: string;
  originalText: string;
  createdAt: string;
  actions: NewActionRecord[];
}

export function insertNoteWithActions(
  input: InsertNoteWithActionsInput,
): { note: ApiNoteSummary; actions: ApiAction[] } {
  const db = getDatabase();

  const insertNote = db.prepare(`
    INSERT INTO notes (id, original_text, created_at)
    VALUES (@id, @original_text, @created_at)
  `);

  const insertAction = db.prepare(`
    INSERT INTO actions (
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
    ) VALUES (
      @id,
      @note_id,
      @title,
      @type,
      @deadline_text,
      @normalized_deadline,
      @priority,
      @evidence,
      @needs_review,
      @uncertainty_reason,
      @review_status,
      @completion_status,
      @created_at,
      @updated_at
    )
  `);

  const save = db.transaction(() => {
    insertNote.run({
      id: input.noteId,
      original_text: input.originalText,
      created_at: input.createdAt,
    });

    for (const action of input.actions) {
      insertAction.run({
        id: action.id,
        note_id: action.noteId,
        title: action.title,
        type: action.type,
        deadline_text: action.deadlineText,
        normalized_deadline: action.normalizedDeadline,
        priority: action.priority,
        evidence: action.evidence,
        needs_review: action.needsReview ? 1 : 0,
        uncertainty_reason: action.uncertaintyReason,
        review_status: action.reviewStatus,
        completion_status: action.completionStatus,
        created_at: action.createdAt,
        updated_at: action.updatedAt,
      });
    }
  });

  save();

  return {
    note: {
      id: input.noteId,
      createdAt: input.createdAt,
    },
    actions: input.actions.map((action) => ({
      id: action.id,
      noteId: action.noteId,
      title: action.title,
      type: action.type,
      deadlineText: action.deadlineText,
      normalizedDeadline: action.normalizedDeadline,
      priority: action.priority,
      evidence: action.evidence,
      needsReview: action.needsReview,
      uncertaintyReason: action.uncertaintyReason,
      reviewStatus: action.reviewStatus,
      completionStatus: action.completionStatus,
      createdAt: action.createdAt,
      updatedAt: action.updatedAt,
    })),
  };
}

export function findNoteWithActionsById(noteId: string): {
  note: ReturnType<typeof mapNoteRowToApiWithText>;
  actions: ApiAction[];
} | null {
  const db = getDatabase();

  const note = db
    .prepare('SELECT id, original_text, created_at FROM notes WHERE id = ?')
    .get(noteId) as NoteRow | undefined;

  if (!note) {
    return null;
  }

  const actionRows = db
    .prepare(`
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
      WHERE note_id = ?
      ORDER BY created_at ASC
    `)
    .all(noteId) as ActionRow[];

  return {
    note: mapNoteRowToApiWithText(note),
    actions: actionRows.map(mapActionRowToApi),
  };
}
