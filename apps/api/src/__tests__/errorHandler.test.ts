import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../dist/middleware/errorHandler.js';

function createMockResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };

  return response as Response & { statusCode: number; body: unknown };
}

describe('errorHandler', () => {
  it('returns a controlled 500 response for unexpected errors', () => {
    const response = createMockResponse();
    const next = vi.fn() as NextFunction;

    errorHandler(
      new Error('unexpected database failure'),
      {} as Request,
      response,
      next,
    );

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected server error occurred.',
      },
    });
  });

  it('does not expose stack traces or sensitive error details to clients', () => {
    const response = createMockResponse();
    const sensitiveError = new Error('api_key=secret-value stack at foo.js:10');

    errorHandler(sensitiveError, {} as Request, response, vi.fn() as NextFunction);

    expect(JSON.stringify(response.body)).not.toContain('stack');
    expect(JSON.stringify(response.body)).not.toContain('secret-value');
    expect(JSON.stringify(response.body)).not.toContain('foo.js');
  });

  it('does not expose submitted note text in unhandled error responses', () => {
    const response = createMockResponse();
    const noteText =
      'PRIVATE_MARKER_xK9m2pQ7 The patient should repeat a CBC within seven days.';
    const noteLeakError = new Error(`persistence failed for note: ${noteText}`);

    errorHandler(noteLeakError, {} as Request, response, vi.fn() as NextFunction);

    expect(response.statusCode).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected server error occurred.',
      },
    });
    expect(JSON.stringify(response.body)).not.toContain(noteText);
  });
});

describe('unexpected route errors', () => {
  it('returns 500 through the Express error middleware', async () => {
    const express = await import('express');
    const request = (await import('supertest')).default;
    const { errorHandler } = await import('../../dist/middleware/errorHandler.js');

    const app = express.default();
    app.get('/test-error', (_req, _res, next) => {
      next(new Error('forced failure'));
    });
    app.use(errorHandler);

    const response = await request(app).get('/test-error');

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(response.body)).not.toContain('forced failure');
  });
});
