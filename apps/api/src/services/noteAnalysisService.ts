import { randomBytes, randomUUID } from 'node:crypto';
import { getReferenceDate } from '../config.js';
import { extractActions } from '../clients/aiServiceClient.js';
import { insertNoteWithActions } from '../repositories/notesRepository.js';
import type { PythonAction } from '../schemas/pythonExtractionSchema.js';

function createNoteId(): string {
  return `note_${randomBytes(5).toString('hex')}`;
}

function createActionId(): string {
  return `action_${randomUUID()}`;
}

function mapPythonAction(action: PythonAction, noteId: string, timestamp: string) {
  return {
    id: createActionId(),
    noteId,
    title: action.title,
    type: action.type,
    deadlineText: action.deadline_text,
    normalizedDeadline: action.normalized_deadline,
    priority: action.priority,
    evidence: action.evidence,
    needsReview: action.needs_review,
    uncertaintyReason: action.uncertainty_reason,
    reviewStatus: 'pending' as const,
    completionStatus: 'open' as const,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function analyzeNote(text: string) {
  const referenceDate = getReferenceDate();
  const extraction = await extractActions(text, referenceDate);

  const noteId = createNoteId();
  const createdAt = new Date().toISOString();
  const actions = extraction.actions.map((action) =>
    mapPythonAction(action, noteId, createdAt),
  );

  return insertNoteWithActions({
    noteId,
    originalText: text,
    createdAt,
    actions,
  });
}
