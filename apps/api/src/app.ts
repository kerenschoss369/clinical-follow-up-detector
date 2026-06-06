import express from 'express';
import { errorHandler } from './middleware/errorHandler.js';
import { actionsRouter } from './routes/actionsRoutes.js';
import { notesRouter } from './routes/notesRoutes.js';

export function createApp() {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'api',
    });
  });

  app.use('/api/notes', notesRouter);
  app.use('/api/actions', actionsRouter);

  app.use(errorHandler);

  return app;
}
