import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/appError.js';
import { updateActionSchema } from '../schemas/updateActionSchema.js';
import { updateActionById } from '../services/actionUpdateService.js';

function mapValidationError(error: ZodError): AppError {
  const firstIssue = error.issues[0];
  return new AppError(
    400,
    'INVALID_REQUEST',
    firstIssue?.message ?? 'The request body is invalid.',
  );
}

export async function patchActionHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actionId = req.params.actionId;
    if (typeof actionId !== 'string') {
      throw new AppError(
        404,
        'ACTION_NOT_FOUND',
        'The requested action was not found.',
      );
    }

    const parsed = updateActionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw mapValidationError(parsed.error);
    }

    const action = updateActionById(actionId, parsed.data);
    res.status(200).json({ action });
  } catch (error) {
    next(error);
  }
}
