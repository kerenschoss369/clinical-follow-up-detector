import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';
import { extractActions } from '../../dist/clients/aiServiceClient.js';
import { sampleNoteText, validPythonResponse } from './helpers/fixtures.js';
import {
  setupTestApp,
  teardownTestDatabase,
} from './helpers/testApp.js';

const mockedExtractActions = vi.mocked(extractActions);

describe('GET /api/notes/:noteId', () => {
  let app: Express;

  beforeEach(() => {
    app = setupTestApp();
    mockedExtractActions.mockReset();
    mockedExtractActions.mockResolvedValue(validPythonResponse);
  });

  afterEach(() => {
    teardownTestDatabase();
  });

  it('returns the stored note and actions', async () => {
    const analyzeResponse = await request(app)
      .post('/api/notes/analyze')
      .send({ text: sampleNoteText });

    const noteId = analyzeResponse.body.note.id;

    const response = await request(app).get(`/api/notes/${noteId}`);

    expect(response.status).toBe(200);
    expect(response.body.note.id).toBe(noteId);
    expect(response.body.note.text).toBe(sampleNoteText);
    expect(response.body.actions).toHaveLength(1);
    expect(response.body.actions[0].noteId).toBe(noteId);
    expect(response.body.actions[0].deadlineText).toBe('within seven days');
  });

  it('returns 404 for an unknown note', async () => {
    const response = await request(app).get('/api/notes/note_does_not_exist');

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOTE_NOT_FOUND');
  });
});
