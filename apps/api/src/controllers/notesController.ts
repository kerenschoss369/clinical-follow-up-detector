import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { config } from '../config.js';
import { AppError } from '../errors/appError.js';
import { findNoteWithActionsById } from '../repositories/notesRepository.js';
import { createAnalyzeNoteSchema } from '../schemas/analyzeNoteSchema.js';
import { analyzeNote } from '../services/noteAnalysisService.js';

const analyzeNoteSchema = createAnalyzeNoteSchema(config.maxNoteLength);

function mapValidationError(error: ZodError): AppError {
  const tooLongIssue = error.issues.find(
    (issue) =>
      issue.message === 'The note exceeds the maximum allowed length.',
  );

  if (tooLongIssue) {
    return new AppError(400, 'NOTE_TOO_LONG', tooLongIssue.message);
  }

  const firstIssue = error.issues[0];
  return new AppError(
    400,
    'INVALID_NOTE',
    firstIssue?.message ?? 'Note text is required.',
  );
}

export async function analyzeNoteHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = analyzeNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw mapValidationError(parsed.error);
    }

    const result = await analyzeNote(parsed.data.text);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getNoteHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const noteId = req.params.noteId;
    if (typeof noteId !== 'string') {
      throw new AppError(
        404,
        'NOTE_NOT_FOUND',
        'The requested note was not found.',
      );
    }

    const result = findNoteWithActionsById(noteId);
    if (!result) {
      throw new AppError(
        404,
        'NOTE_NOT_FOUND',
        'The requested note was not found.',
      );
    }

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
