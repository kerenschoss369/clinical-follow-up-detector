import { z } from 'zod';

export const actionTypeSchema = z.enum([
  'appointment',
  'test',
  'medication',
  'treatment',
  'warning',
  'other',
]);

export const prioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

export const reviewStatusSchema = z.enum(['pending', 'confirmed', 'rejected']);

export const completionStatusSchema = z.enum(['open', 'completed']);

export type ActionType = z.infer<typeof actionTypeSchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type ReviewStatus = z.infer<typeof reviewStatusSchema>;
export type CompletionStatus = z.infer<typeof completionStatusSchema>;
