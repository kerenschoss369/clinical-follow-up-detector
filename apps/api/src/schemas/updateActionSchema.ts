import { z } from 'zod';
import {
  actionTypeSchema,
  completionStatusSchema,
  prioritySchema,
  reviewStatusSchema,
} from './sharedEnums.js';

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'normalizedDeadline must use YYYY-MM-DD format.');

export const updateActionSchema = z
  .object({
    title: z.string().min(1).optional(),
    type: actionTypeSchema.optional(),
    deadlineText: z.string().nullable().optional(),
    normalizedDeadline: z.union([isoDateSchema, z.null()]).optional(),
    priority: prioritySchema.optional(),
    reviewStatus: reviewStatusSchema.optional(),
    completionStatus: completionStatusSchema.optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    { message: 'At least one editable field is required.' },
  );

export type UpdateActionInput = z.infer<typeof updateActionSchema>;
