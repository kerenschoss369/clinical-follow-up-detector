import { z } from 'zod';

export function createAnalyzeNoteSchema(maxNoteLength: number) {
  return z.object({
    text: z.string(),
  }).superRefine((data, ctx) => {
    if (data.text.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Note text is required.',
      });
    }

    if (data.text.length > maxNoteLength) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'The note exceeds the maximum allowed length.',
      });
    }
  });
}

export type AnalyzeNoteInput = z.infer<ReturnType<typeof createAnalyzeNoteSchema>>;
