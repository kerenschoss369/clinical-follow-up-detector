import type {
  Action,
  ActionType,
  CompletionStatus,
  NoteSummary,
  Priority,
  ReviewStatus,
  SavedNote,
} from './domain';

export interface AnalyzeNoteRequest {
  text: string;
}

export interface AnalyzeNoteResponse {
  note: NoteSummary;
  actions: Action[];
}

export interface GetNoteResponse {
  note: SavedNote;
  actions: Action[];
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export type AnalysisState =
  | { status: 'idle' }
  | { status: 'loading'; operation: 'analyze' | 'load' }
  | { status: 'success'; note: NoteSummary; actions: Action[] }
  | { status: 'error'; message: string };

export interface UpdateActionRequest {
  title?: string;
  type?: ActionType;
  deadlineText?: string | null;
  normalizedDeadline?: string | null;
  priority?: Priority;
  reviewStatus?: ReviewStatus;
  completionStatus?: CompletionStatus;
}

export interface UpdateActionResponse {
  action: Action;
}