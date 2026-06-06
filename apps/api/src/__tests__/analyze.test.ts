import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';
import { extractActions } from '../../dist/clients/aiServiceClient.js';
import { AppError } from '../../dist/errors/appError.js';
import {
  emptyPythonResponse,
  sampleNoteText,
  validPythonResponse,
} from './helpers/fixtures.js';
import {
  countActions,
  countNotes,
  resetTestDatabase,
  setupTestApp,
  teardownTestDatabase,
} from './helpers/testApp.js';

const mockedExtractActions = vi.mocked(extractActions);

describe('POST /api/notes/analyze', () => {
  let app: Express;

  beforeEach(() => {
    app = setupTestApp();
    mockedExtractActions.mockReset();
  });

  afterEach(() => {
    teardownTestDatabase();
  });

  it('returns 400 for an empty note', async () => {
    const response = await request(app)
      .post('/api/notes/analyze')
      .send({ text: '' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_NOTE');
    expect(mockedExtractActions).not.toHaveBeenCalled();
  });

  it('returns 400 for a whitespace-only note', async () => {
    const response = await request(app)
      .post('/api/notes/analyze')
      .send({ text: '   ' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_NOTE');
    expect(mockedExtractActions).not.toHaveBeenCalled();
  });

  it('returns 400 for an oversized note', async () => {
    const response = await request(app)
      .post('/api/notes/analyze')
      .send({ text: 'a'.repeat(20_001) });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('NOTE_TOO_LONG');
    expect(mockedExtractActions).not.toHaveBeenCalled();
  });

  it('returns 502 when the Python service is unavailable', async () => {
    mockedExtractActions.mockRejectedValue(
      new AppError(
        502,
        'AI_SERVICE_UNAVAILABLE',
        'The note could not be analyzed because the AI service is unavailable.',
      ),
    );

    const response = await request(app)
      .post('/api/notes/analyze')
      .send({ text: sampleNoteText });

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('AI_SERVICE_UNAVAILABLE');
    expect(countNotes()).toBe(0);
    expect(countActions()).toBe(0);
  });

  it('returns 502 for an invalid Python response', async () => {
    mockedExtractActions.mockRejectedValue(
      new AppError(
        502,
        'INVALID_AI_RESPONSE',
        'The AI service returned an invalid response. No data was saved.',
      ),
    );

    const response = await request(app)
      .post('/api/notes/analyze')
      .send({ text: sampleNoteText });

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('INVALID_AI_RESPONSE');
    expect(countNotes()).toBe(0);
    expect(countActions()).toBe(0);
  });

  it('persists the note and actions for a valid extraction', async () => {
    mockedExtractActions.mockResolvedValue(validPythonResponse);

    const response = await request(app)
      .post('/api/notes/analyze')
      .send({ text: sampleNoteText });

    expect(response.status).toBe(201);
    expect(response.body.note.id).toMatch(/^note_/);
    expect(response.body.actions).toHaveLength(1);
    expect(response.body.actions[0].reviewStatus).toBe('pending');
    expect(response.body.actions[0].completionStatus).toBe('open');
    expect(countNotes()).toBe(1);
    expect(countActions()).toBe(1);

    const getResponse = await request(app).get(
      `/api/notes/${response.body.note.id}`,
    );

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.note.text).toBe(sampleNoteText);
    expect(getResponse.body.actions).toHaveLength(1);
  });

  it('persists the note when the actions array is empty', async () => {
    mockedExtractActions.mockResolvedValue(emptyPythonResponse);

    const response = await request(app)
      .post('/api/notes/analyze')
      .send({ text: sampleNoteText });

    expect(response.status).toBe(201);
    expect(response.body.actions).toEqual([]);
    expect(countNotes()).toBe(1);
    expect(countActions()).toBe(0);
  });

  it('does not save anything when extraction fails', async () => {
    mockedExtractActions.mockRejectedValue(
      new AppError(
        502,
        'AI_SERVICE_UNAVAILABLE',
        'The note could not be analyzed because the AI service is unavailable.',
      ),
    );

    await request(app).post('/api/notes/analyze').send({ text: sampleNoteText });

    expect(countNotes()).toBe(0);
    expect(countActions()).toBe(0);
  });
});

describe('test database isolation', () => {
  let app: Express;

  beforeEach(() => {
    app = setupTestApp();
    mockedExtractActions.mockReset();
    mockedExtractActions.mockResolvedValue(validPythonResponse);
  });

  afterEach(() => {
    teardownTestDatabase();
  });

  it('resets database state between tests', async () => {
    await request(app).post('/api/notes/analyze').send({ text: sampleNoteText });
    expect(countNotes()).toBe(1);

    resetTestDatabase();
    expect(countNotes()).toBe(0);
  });
});
