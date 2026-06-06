import { Router } from 'express';
import { patchActionHandler } from '../controllers/actionsController.js';

export const actionsRouter = Router();

actionsRouter.patch('/:actionId', patchActionHandler);
