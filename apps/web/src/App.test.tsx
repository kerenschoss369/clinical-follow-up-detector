import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { Action } from './types/domain';
import {
  analyzeSuccessResponse,
  createAction,
  patchSuccessResponse,
  sampleNoteText,
} from './test/fixtures';
import {
  deferredResponse,
  getLastPatchBody,
  jsonResponse,
} from './test/fetchMock';

describe('analyze flow', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('disables Analyze for empty input', () => {
    render(<App />);

    expect(screen.getByRole('button', { name: /analyze note/i })).toBeDisabled();
  });

  it('disables Analyze for whitespace-only input', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByRole('textbox', { name: /clinical note/i }), '   ');

    expect(screen.getByRole('button', { name: /analyze note/i })).toBeDisabled();
  });

  it('shows loading while analyze is pending', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    const deferred = deferredResponse();

    fetchMock.mockReturnValueOnce(deferred.promise);

    render(<App />);
    await user.type(
      screen.getByRole('textbox', { name: /clinical note/i }),
      sampleNoteText,
    );
    await user.click(screen.getByRole('button', { name: /analyze note/i }));

    expect(screen.getByRole('status')).toHaveTextContent('Analyzing note...');
    expect(screen.getByRole('button', { name: /analyzing note/i })).toBeDisabled();

    deferred.resolve(
      jsonResponse(201, analyzeSuccessResponse([createAction()])),
    );

    await waitFor(() => {
      expect(screen.getByText('Repeat CBC blood test')).toBeInTheDocument();
    });
  });

  it('renders successful actions', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    const secondAction = createAction({
      id: 'action_second',
      title: 'Oncology follow-up appointment',
      type: 'appointment',
      deadlineText: 'June 15, 2026',
      evidence: 'Attend oncology follow-up on June 15, 2026.',
    });

    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, analyzeSuccessResponse([createAction(), secondAction])),
    );

    render(<App />);
    await user.type(
      screen.getByRole('textbox', { name: /clinical note/i }),
      sampleNoteText,
    );
    await user.click(screen.getByRole('button', { name: /analyze note/i }));

    await waitFor(() => {
      expect(screen.getByText('Repeat CBC blood test')).toBeInTheDocument();
    });

    expect(screen.getByText('Oncology follow-up appointment')).toBeInTheDocument();
    expect(screen.getByText('within seven days')).toBeInTheDocument();

    const firstCard = screen
      .getByRole('heading', { name: 'Repeat CBC blood test' })
      .closest('article');
    expect(firstCard).not.toBeNull();
    expect(within(firstCard as HTMLElement).getByText(sampleNoteText)).toBeInTheDocument();

    const secondCard = screen
      .getByRole('heading', { name: 'Oncology follow-up appointment' })
      .closest('article');
    expect(secondCard).not.toBeNull();
    expect(
      within(secondCard as HTMLElement).getByText(
        'Attend oncology follow-up on June 15, 2026.',
      ),
    ).toBeInTheDocument();
  });

  it('renders successful empty-actions state', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, analyzeSuccessResponse([])),
    );

    render(<App />);
    await user.type(
      screen.getByRole('textbox', { name: /clinical note/i }),
      'Patient feels well today.',
    );
    await user.click(screen.getByRole('button', { name: /analyze note/i }));

    await waitFor(() => {
      expect(
        screen.getByText('No follow-up actions were found in this note.'),
      ).toBeInTheDocument();
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows controlled error on analyze failure', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);

    fetchMock.mockResolvedValueOnce(
      jsonResponse(502, {
        error: { code: 'AI_SERVICE_UNAVAILABLE', message: 'AI unavailable' },
      }),
    );

    render(<App />);
    await user.type(
      screen.getByRole('textbox', { name: /clinical note/i }),
      sampleNoteText,
    );
    await user.click(screen.getByRole('button', { name: /analyze note/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('AI unavailable');
  });
});

describe('action workflow', () => {
  const pendingAction = createAction({
    id: 'action_pending',
    title: 'Repeat CBC blood test',
  });

  async function analyzeWithActions(
    user: ReturnType<typeof userEvent.setup>,
    actions = [pendingAction],
  ) {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, analyzeSuccessResponse(actions)),
    );

    render(<App />);
    await user.type(
      screen.getByRole('textbox', { name: /clinical note/i }),
      sampleNoteText,
    );
    await user.click(screen.getByRole('button', { name: /analyze note/i }));

    await waitFor(() => {
      expect(screen.getByText(pendingAction.title)).toBeInTheDocument();
    });
  }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('confirm updates rendered action to confirmed', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);

    await analyzeWithActions(user);

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        200,
        patchSuccessResponse(
          createAction({
            id: 'action_pending',
            reviewStatus: 'confirmed',
          }),
        ),
      ),
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Confirm action: Repeat CBC blood test',
      }),
    );

    await waitFor(() => {
      expect(screen.getByText('Confirmed')).toBeInTheDocument();
    });

    expect(
      screen.queryByRole('button', {
        name: 'Confirm action: Repeat CBC blood test',
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Reject action: Repeat CBC blood test',
      }),
    ).not.toBeInTheDocument();
  });

  it('reject updates rendered action to rejected', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);

    await analyzeWithActions(user);

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        200,
        patchSuccessResponse(
          createAction({
            id: 'action_pending',
            reviewStatus: 'rejected',
          }),
        ),
      ),
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Reject action: Repeat CBC blood test',
      }),
    );

    await waitFor(() => {
      expect(screen.getByText('Rejected')).toBeInTheDocument();
    });
  });

  it('edit sends only changed editable fields and displays returned action', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);

    await analyzeWithActions(user);

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        200,
        patchSuccessResponse(
          createAction({
            id: 'action_pending',
            title: 'Repeat complete blood count',
          }),
        ),
      ),
    );

    await user.click(
      screen.getByRole('button', { name: 'Edit action: Repeat CBC blood test' }),
    );

    const titleInput = screen.getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Repeat complete blood count');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText('Repeat complete blood count')).toBeInTheDocument();
    });

    expect(getLastPatchBody(fetchMock)).toEqual({
      title: 'Repeat complete blood count',
    });
  });

  it('editing does not automatically confirm an action', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);

    await analyzeWithActions(user);

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        200,
        patchSuccessResponse(
          createAction({
            id: 'action_pending',
            title: 'Updated CBC test',
            reviewStatus: 'pending',
          }),
        ),
      ),
    );

    await user.click(
      screen.getByRole('button', { name: 'Edit action: Repeat CBC blood test' }),
    );

    const titleInput = screen.getByLabelText('Title');
    await user.clear(titleInput);
    await user.type(titleInput, 'Updated CBC test');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText('Updated CBC test')).toBeInTheDocument();
    });

    expect(screen.getByText('Pending review')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Confirm action: Updated CBC test' }),
    ).toBeInTheDocument();
  });

  it('allows a confirmed action to be completed', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    const confirmedAction = createAction({
      id: 'action_confirmed',
      title: 'Repeat CBC blood test',
      reviewStatus: 'confirmed',
    });

    await analyzeWithActions(user, [confirmedAction]);

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        200,
        patchSuccessResponse(
          createAction({
            id: 'action_confirmed',
            reviewStatus: 'confirmed',
            completionStatus: 'completed',
          }),
        ),
      ),
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Mark action completed: Repeat CBC blood test',
      }),
    );

    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });

  it('does not offer complete for pending actions', async () => {
    const user = userEvent.setup();
    await analyzeWithActions(user);

    expect(
      screen.queryByRole('button', {
        name: 'Mark action completed: Repeat CBC blood test',
      }),
    ).not.toBeInTheDocument();
  });

  it('does not offer complete for rejected actions', async () => {
    const user = userEvent.setup();
    const rejectedAction = createAction({
      id: 'action_rejected',
      reviewStatus: 'rejected',
    });

    await analyzeWithActions(user, [rejectedAction]);

    expect(
      screen.queryByRole('button', {
        name: 'Mark action completed: Repeat CBC blood test',
      }),
    ).not.toBeInTheDocument();
  });

  it('preserves previous action data when PATCH fails', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);

    await analyzeWithActions(user);

    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, {
        error: {
          code: 'INVALID_ACTION_TRANSITION',
          message: 'A rejected action cannot be marked as completed.',
        },
      }),
    );

    await user.click(
      screen.getByRole('button', {
        name: 'Confirm action: Repeat CBC blood test',
      }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A rejected action cannot be marked as completed.',
    );
    expect(screen.getByText('Repeat CBC blood test')).toBeInTheDocument();
    expect(screen.getByText('Pending review')).toBeInTheDocument();
  });

  it('disables only the action being updated', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    const firstAction = createAction({
      id: 'action_first',
      title: 'First action',
    });
    const secondAction = createAction({
      id: 'action_second',
      title: 'Second action',
    });
    const deferred = deferredResponse();

    fetchMock.mockResolvedValueOnce(
      jsonResponse(201, analyzeSuccessResponse([firstAction, secondAction])),
    );

    render(<App />);
    await user.type(
      screen.getByRole('textbox', { name: /clinical note/i }),
      sampleNoteText,
    );
    await user.click(screen.getByRole('button', { name: /analyze note/i }));

    await waitFor(() => {
      expect(screen.getByText('First action')).toBeInTheDocument();
    });

    fetchMock.mockReturnValueOnce(deferred.promise);

    const firstConfirm = screen.getByRole('button', {
      name: 'Confirm action: First action',
    });
    const secondConfirm = screen.getByRole('button', {
      name: 'Confirm action: Second action',
    });

    await user.click(firstConfirm);

    await waitFor(() => {
      expect(firstConfirm).toBeDisabled();
    });

    expect(secondConfirm).not.toBeDisabled();
    expect(screen.getByText('Updating...')).toBeInTheDocument();

    deferred.resolve(
      jsonResponse(
        200,
        patchSuccessResponse(
          createAction({
            id: 'action_first',
            title: 'First action',
            reviewStatus: 'confirmed',
          }),
        ),
      ),
    );

    await waitFor(() => {
      expect(screen.getByText('Confirmed')).toBeInTheDocument();
    });
  });

  it('keeps evidence visible after confirm, reject, edit, and complete', async () => {
    const evidence = 'Repeat CBC within seven days for fictional patient.';

    async function runScenario(
      setupMocks: (fetchMock: ReturnType<typeof vi.fn>) => void,
      interact: (user: ReturnType<typeof userEvent.setup>) => Promise<void>,
      initialAction: Action = createAction({ id: 'action_evidence', evidence }),
    ) {
      cleanup();
      vi.stubGlobal('fetch', vi.fn());
      const user = userEvent.setup();
      const fetchMock = vi.mocked(fetch);

      fetchMock.mockResolvedValueOnce(
        jsonResponse(201, analyzeSuccessResponse([initialAction])),
      );
      setupMocks(fetchMock);

      render(<App />);
      await user.type(
        screen.getByRole('textbox', { name: /clinical note/i }),
        sampleNoteText,
      );
      await user.click(screen.getByRole('button', { name: /analyze note/i }));

      await waitFor(() => {
        expect(screen.getByText(evidence)).toBeInTheDocument();
      });

      await interact(user);

      expect(screen.getByText(evidence)).toBeInTheDocument();
    }

    await runScenario(
      (fetchMock) => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse(
            200,
            patchSuccessResponse(
              createAction({
                id: 'action_evidence',
                evidence,
                reviewStatus: 'confirmed',
              }),
            ),
          ),
        );
      },
      async (user) => {
        await user.click(
          screen.getByRole('button', {
            name: 'Confirm action: Repeat CBC blood test',
          }),
        );
        await waitFor(() => {
          expect(screen.getByText('Confirmed')).toBeInTheDocument();
        });
      },
    );

    await runScenario(
      (fetchMock) => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse(
            200,
            patchSuccessResponse(
              createAction({
                id: 'action_evidence',
                evidence,
                reviewStatus: 'rejected',
              }),
            ),
          ),
        );
      },
      async (user) => {
        await user.click(
          screen.getByRole('button', {
            name: 'Reject action: Repeat CBC blood test',
          }),
        );
        await waitFor(() => {
          expect(screen.getByText('Rejected')).toBeInTheDocument();
        });
      },
    );

    await runScenario(
      (fetchMock) => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse(
            200,
            patchSuccessResponse(
              createAction({
                id: 'action_evidence',
                title: 'Updated CBC test',
                evidence,
              }),
            ),
          ),
        );
      },
      async (user) => {
        await user.click(
          screen.getByRole('button', {
            name: 'Edit action: Repeat CBC blood test',
          }),
        );
        const titleInput = screen.getByLabelText('Title');
        await user.clear(titleInput);
        await user.type(titleInput, 'Updated CBC test');
        await user.click(screen.getByRole('button', { name: /save changes/i }));
        await waitFor(() => {
          expect(screen.getByText('Updated CBC test')).toBeInTheDocument();
        });
      },
    );

    await runScenario(
      (fetchMock) => {
        fetchMock.mockResolvedValueOnce(
          jsonResponse(
            200,
            patchSuccessResponse(
              createAction({
                id: 'action_evidence',
                evidence,
                reviewStatus: 'confirmed',
                completionStatus: 'completed',
              }),
            ),
          ),
        );
      },
      async (user) => {
        await user.click(
          screen.getByRole('button', {
            name: 'Mark action completed: Repeat CBC blood test',
          }),
        );
        await waitFor(() => {
          expect(screen.getByText('Completed')).toBeInTheDocument();
        });
      },
      createAction({
        id: 'action_evidence',
        evidence,
        reviewStatus: 'confirmed',
      }),
    );
  });

  it('shows needsReview and uncertaintyReason', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.mocked(fetch);
    const reviewAction = createAction({
      id: 'action_review',
      needsReview: true,
      uncertaintyReason: 'The note says soon and does not provide an exact deadline.',
    });

    await analyzeWithActions(user, [reviewAction]);

    expect(screen.getByText('Needs review')).toBeInTheDocument();
    expect(
      screen.getByText('The note says soon and does not provide an exact deadline.'),
    ).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        200,
        patchSuccessResponse(
          createAction({
            id: 'action_review',
            reviewStatus: 'confirmed',
            needsReview: true,
            uncertaintyReason:
              'The note says soon and does not provide an exact deadline.',
          }),
        ),
      ),
    );

    await user.click(
      screen.getByRole('button', { name: 'Confirm action: Repeat CBC blood test' }),
    );

    await waitFor(() => {
      expect(screen.getByText('Confirmed')).toBeInTheDocument();
    });

    expect(screen.getByText('Needs review')).toBeInTheDocument();
    expect(
      screen.getByText('The note says soon and does not provide an exact deadline.'),
    ).toBeInTheDocument();
  });
});
