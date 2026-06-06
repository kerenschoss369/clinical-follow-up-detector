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

async function createPendingAction(app: Express) {
  const analyzeResponse = await request(app)
    .post('/api/notes/analyze')
    .send({ text: sampleNoteText });

  expect(analyzeResponse.status).toBe(201);
  return analyzeResponse.body.actions[0].id as string;
}

describe('PATCH /api/actions/:actionId', () => {
  let app: Express;

  beforeEach(() => {
    app = setupTestApp();
    mockedExtractActions.mockReset();
    mockedExtractActions.mockResolvedValue(validPythonResponse);
  });

  afterEach(() => {
    teardownTestDatabase();
  });

  it('returns 400 for an invalid body', async () => {
    const actionId = await createPendingAction(app);

    const response = await request(app)
      .patch(`/api/actions/${actionId}`)
      .send({ unknownField: 'value' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_REQUEST');
  });

  it('returns 404 for an unknown action', async () => {
    const response = await request(app)
      .patch('/api/actions/action_does_not_exist')
      .send({ title: 'Updated title' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('ACTION_NOT_FOUND');
  });

  it('persists a valid title or priority edit', async () => {
    const actionId = await createPendingAction(app);

    const response = await request(app)
      .patch(`/api/actions/${actionId}`)
      .send({ title: 'Repeat complete blood count', priority: 'medium' });

    expect(response.status).toBe(200);
    expect(response.body.action.title).toBe('Repeat complete blood count');
    expect(response.body.action.priority).toBe('medium');
    expect(response.body.action.reviewStatus).toBe('pending');
  });

  it('persists confirming an action', async () => {
    const actionId = await createPendingAction(app);

    const response = await request(app)
      .patch(`/api/actions/${actionId}`)
      .send({ reviewStatus: 'confirmed' });

    expect(response.status).toBe(200);
    expect(response.body.action.reviewStatus).toBe('confirmed');
    expect(response.body.action.completionStatus).toBe('open');
  });

  it('persists rejecting an action and keeps completionStatus open', async () => {
    const actionId = await createPendingAction(app);

    const response = await request(app)
      .patch(`/api/actions/${actionId}`)
      .send({ reviewStatus: 'rejected' });

    expect(response.status).toBe(200);
    expect(response.body.action.reviewStatus).toBe('rejected');
    expect(response.body.action.completionStatus).toBe('open');
  });

  it('returns 409 when a pending action is marked completed', async () => {
    const actionId = await createPendingAction(app);

    const response = await request(app)
      .patch(`/api/actions/${actionId}`)
      .send({ completionStatus: 'completed' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_ACTION_TRANSITION');
  });

  it('returns 409 when a rejected action is marked completed', async () => {
    const actionId = await createPendingAction(app);

    await request(app)
      .patch(`/api/actions/${actionId}`)
      .send({ reviewStatus: 'rejected' });

    const response = await request(app)
      .patch(`/api/actions/${actionId}`)
      .send({ completionStatus: 'completed' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_ACTION_TRANSITION');
    expect(response.body.error.message).toBe(
      'A rejected action cannot be marked as completed.',
    );
  });

  it('allows a confirmed action to be completed', async () => {
    const actionId = await createPendingAction(app);

    await request(app)
      .patch(`/api/actions/${actionId}`)
      .send({ reviewStatus: 'confirmed' });

    const response = await request(app)
      .patch(`/api/actions/${actionId}`)
      .send({ completionStatus: 'completed' });

    expect(response.status).toBe(200);
    expect(response.body.action.reviewStatus).toBe('confirmed');
    expect(response.body.action.completionStatus).toBe('completed');
  });

  it('returns 409 for an invalid transition when rejecting a completed action', async () => {
    const actionId = await createPendingAction(app);

    await request(app)
      .patch(`/api/actions/${actionId}`)
      .send({ reviewStatus: 'confirmed' });

    await request(app)
      .patch(`/api/actions/${actionId}`)
      .send({ completionStatus: 'completed' });

    const response = await request(app)
      .patch(`/api/actions/${actionId}`)
      .send({ reviewStatus: 'rejected' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_ACTION_TRANSITION');
    expect(response.body.error.message).toBe(
      'A completed action cannot be rejected.',
    );
  });

  it('updates updatedAt after a successful update', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-06-05T15:30:00.000Z'));

    const analyzeResponse = await request(app)
      .post('/api/notes/analyze')
      .send({ text: sampleNoteText });

    const actionId = analyzeResponse.body.actions[0].id as string;
    const originalUpdatedAt = analyzeResponse.body.actions[0].updatedAt as string;

    vi.setSystemTime(new Date('2026-06-05T16:00:00.000Z'));

    const response = await request(app)
      .patch(`/api/actions/${actionId}`)
      .send({ priority: 'low' });

    vi.useRealTimers();

    expect(response.status).toBe(200);
    expect(response.body.action.updatedAt).toBe('2026-06-05T16:00:00.000Z');
    expect(response.body.action.updatedAt).not.toBe(originalUpdatedAt);
  });
});
