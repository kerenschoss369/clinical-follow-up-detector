import { Router } from 'express';
import { analyzeNoteHandler, getNoteHandler } from '../controllers/notesController.js';

export const notesRouter = Router();

notesRouter.post('/analyze', analyzeNoteHandler);
notesRouter.get('/:noteId', getNoteHandler);
