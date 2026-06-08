import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';
import { extractActions } from '../../dist/clients/aiServiceClient.js';
import { AppError } from '../../dist/errors/appError.js';
import { validPythonResponse } from './helpers/fixtures.js';
import * as notesRepository from '../../dist/repositories/notesRepository.js';
import { setupTestApp, teardownTestDatabase } from './helpers/testApp.js';

const mockedExtractActions = vi.mocked(extractActions);

const distinctiveNoteText =
  'PRIVATE_MARKER_xK9m2pQ7 The patient should repeat a CBC within seven days.';

function expectResponseBodyExcludesNote(body: unknown, noteText: string): void {
  expect(JSON.stringify(body)).not.toContain(noteText);
}

describe('error responses do not expose submitted note text', () => {
  let app: Express;

  beforeEach(() => {
    app = setupTestApp();
    mockedExtractActions.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    teardownTestDatabase();
  });

  it('excludes note text from a 400 NOTE_TOO_LONG response', async () => {
    const oversizedNote = `${distinctiveNoteText}${'x'.repeat(20_000)}`;

    const response = await request(app)
      .post('/api/notes/analyze')
      .send({ text: oversizedNote });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('NOTE_TOO_LONG');
    expectResponseBodyExcludesNote(response.body, distinctiveNoteText);
  });

  it('excludes note text from a 502 AI_SERVICE_UNAVAILABLE response', async () => {
    mockedExtractActions.mockRejectedValue(
      new AppError(
        502,
        'AI_SERVICE_UNAVAILABLE',
        'The note could not be analyzed because the AI service is unavailable.',
      ),
    );

    const response = await request(app)
      .post('/api/notes/analyze')
      .send({ text: distinctiveNoteText });

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('AI_SERVICE_UNAVAILABLE');
    expectResponseBodyExcludesNote(response.body, distinctiveNoteText);
  });

  it('excludes note text from a 502 INVALID_AI_RESPONSE response', async () => {
    mockedExtractActions.mockRejectedValue(
      new AppError(
        502,
        'INVALID_AI_RESPONSE',
        'The AI service returned an invalid response. No data was saved.',
      ),
    );

    const response = await request(app)
      .post('/api/notes/analyze')
      .send({ text: distinctiveNoteText });

    expect(response.status).toBe(502);
    expect(response.body.error.code).toBe('INVALID_AI_RESPONSE');
    expectResponseBodyExcludesNote(response.body, distinctiveNoteText);
  });

  it('excludes note text from a 500 INTERNAL_ERROR response during analyze', async () => {
    mockedExtractActions.mockResolvedValue(validPythonResponse);
    vi.spyOn(notesRepository, 'insertNoteWithActions').mockImplementation(() => {
      throw new Error(`database failure containing ${distinctiveNoteText}`);
    });

    const response = await request(app)
      .post('/api/notes/analyze')
      .send({ text: distinctiveNoteText });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expectResponseBodyExcludesNote(response.body, distinctiveNoteText);
  });
});
