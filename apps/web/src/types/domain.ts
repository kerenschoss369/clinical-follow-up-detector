export type ActionType =
  | 'appointment'
  | 'test'
  | 'medication'
  | 'treatment'
  | 'warning'
  | 'other';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export type ReviewStatus = 'pending' | 'confirmed' | 'rejected';

export type CompletionStatus = 'open' | 'completed';

export interface NoteSummary {
  id: string;
  createdAt: string;
}

export interface SavedNote {
  id: string;
  text: string;
  createdAt: string;
}

export interface Action {
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