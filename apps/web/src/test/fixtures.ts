import type { AnalyzeNoteResponse } from '../types/api';
import type { Action } from '../types/domain';

const TIMESTAMP = '2026-06-05T15:30:00.000Z';

export const sampleNoteText =
  'The patient should repeat a CBC within seven days.';

interface CreateActionOptions {
  id?: string;
  title?: string;
  reviewStatus?: Action['reviewStatus'];
  completionStatus?: Action['completionStatus'];
  needsReview?: boolean;
  uncertaintyReason?: string | null;
  evidence?: string;
  priority?: Action['priority'];
  type?: Action['type'];
  deadlineText?: string | null;
}

export function createAction(options: CreateActionOptions = {}): Action {
  return {
    id: options.id ?? 'action_pending',
    noteId: 'note_01',
    title: options.title ?? 'Repeat CBC blood test',
    type: options.type ?? 'test',
    deadlineText: options.deadlineText ?? 'within seven days',
    normalizedDeadline: null,
    priority: options.priority ?? 'high',
    evidence: options.evidence ?? sampleNoteText,
    needsReview: options.needsReview ?? false,
    uncertaintyReason: options.uncertaintyReason ?? null,
    reviewStatus: options.reviewStatus ?? 'pending',
    completionStatus: options.completionStatus ?? 'open',
    createdAt: TIMESTAMP,
    updatedAt: TIMESTAMP,
  };
}

export function analyzeSuccessResponse(
  actions: Action[],
): AnalyzeNoteResponse {
  return {
    note: {
      id: 'note_01',
      createdAt: TIMESTAMP,
    },
    actions,
  };
}

export function patchSuccessResponse(action: Action): { action: Action } {
  return { action };
}
