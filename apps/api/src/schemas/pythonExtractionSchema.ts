import { z } from 'zod';
import { actionTypeSchema, prioritySchema } from './sharedEnums.js';

export const pythonActionSchema = z
  .object({
    title: z.string().min(1),
    type: actionTypeSchema,
    deadline_text: z.string().nullable(),
    normalized_deadline: z.string().nullable(),
    priority: prioritySchema,
    evidence: z.string().min(1),
    needs_review: z.boolean(),
    uncertainty_reason: z.string().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.needs_review) {
      if (data.uncertainty_reason === null || data.uncertainty_reason.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'uncertainty_reason is required when needs_review is true',
        });
      }
      return;
    }

    if (data.uncertainty_reason !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'uncertainty_reason must be null when needs_review is false',
      });
    }
  });

export const pythonExtractionResponseSchema = z.object({
  actions: z.array(pythonActionSchema),
});

export type PythonAction = z.infer<typeof pythonActionSchema>;
export type PythonExtractionResponse = z.infer<typeof pythonExtractionResponseSchema>;
