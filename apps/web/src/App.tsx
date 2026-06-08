import { useEffect, useState } from 'react';
import './App.css';
import { AnalyzeButton } from './components/AnalyzeButton';
import { ActionList } from './components/ActionList';
import { NoteSourcePanel } from './components/NoteSourcePanel';
import { NoteSessionPanel } from './components/NoteSessionPanel';
import { UpdateActionError, updateAction } from './services/actionsApi';
import { AnalyzeNoteError, GetNoteError, analyzeNote, getNote } from './services/notesApi';
import type { AnalysisState, UpdateActionRequest } from './types/api';
import { validateNoteText } from './utils/noteValidation';
import { getNoteIdFromUrl, setNoteIdInUrl } from './utils/noteUrl';

function App() {
  const [noteText, setNoteText] = useState('');
  const [loadNoteId, setLoadNoteId] = useState('');
  const [clientValidationError, setClientValidationError] = useState<string | null>(
    null,
  );
  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    status: 'idle',
  });
  const [updatingActionIds, setUpdatingActionIds] = useState<string[]>([]);
  const [actionUpdateErrors, setActionUpdateErrors] = useState<
    Record<string, string>
  >({});

  const isLoading = analysisState.status === 'loading';
  const isAnalyzing =
    analysisState.status === 'loading' && analysisState.operation === 'analyze';
  const isLoadingNote =
    analysisState.status === 'loading' && analysisState.operation === 'load';
  const textValidationError = validateNoteText(noteText);
  const isAnalyzeDisabled = textValidationError !== null;

  const loadSavedNote = async (noteId: string) => {
    const trimmedId = noteId.trim();
    if (trimmedId === '') {
      return;
    }

    setClientValidationError(null);
    setAnalysisState({ status: 'loading', operation: 'load' });
    setUpdatingActionIds([]);
    setActionUpdateErrors({});

    try {
      const result = await getNote(trimmedId);
      setNoteText(result.note.text);
      setLoadNoteId(result.note.id);
      setNoteIdInUrl(result.note.id);
      setAnalysisState({
        status: 'success',
        note: {
          id: result.note.id,
          createdAt: result.note.createdAt,
        },
        actions: result.actions,
      });
    } catch (error) {
      const message =
        error instanceof GetNoteError
          ? error.message
          : 'The saved note could not be loaded. Please try again.';
      setAnalysisState({ status: 'error', message });
    }
  };

  useEffect(() => {
    const noteIdFromUrl = getNoteIdFromUrl();
    if (!noteIdFromUrl) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setClientValidationError(null);
      setAnalysisState({ status: 'loading', operation: 'load' });
      setUpdatingActionIds([]);
      setActionUpdateErrors({});

      try {
        const result = await getNote(noteIdFromUrl);
        if (cancelled) {
          return;
        }

        setNoteText(result.note.text);
        setLoadNoteId(result.note.id);
        setNoteIdInUrl(result.note.id);
        setAnalysisState({
          status: 'success',
          note: {
            id: result.note.id,
            createdAt: result.note.createdAt,
          },
          actions: result.actions,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        const message =
          error instanceof GetNoteError
            ? error.message
            : 'The saved note could not be loaded. Please try again.';
        setAnalysisState({ status: 'error', message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleAnalyze = async () => {
    const validationError = validateNoteText(noteText);
    if (validationError) {
      setClientValidationError(validationError);
      return;
    }

    setClientValidationError(null);
    setAnalysisState({ status: 'loading', operation: 'analyze' });
    setUpdatingActionIds([]);
    setActionUpdateErrors({});

    try {
      const result = await analyzeNote(noteText);
      setLoadNoteId(result.note.id);
      setNoteIdInUrl(result.note.id);
      setAnalysisState({
        status: 'success',
        note: result.note,
        actions: result.actions,
      });
    } catch (error) {
      const message =
        error instanceof AnalyzeNoteError
          ? error.message
          : 'The note could not be analyzed. Please try again.';
      setAnalysisState({ status: 'error', message });
    }
  };

  const handleActionUpdate = async (
    actionId: string,
    patch: UpdateActionRequest,
  ): Promise<void> => {
    if (updatingActionIds.includes(actionId)) {
      return;
    }

    if (analysisState.status !== 'success') {
      return;
    }

    setUpdatingActionIds((current) => [...current, actionId]);
    setActionUpdateErrors((current) => {
      const next = { ...current };
      delete next[actionId];
      return next;
    });

    try {
      const result = await updateAction(actionId, patch);
      setAnalysisState((current) => {
        if (current.status !== 'success') {
          return current;
        }

        return {
          ...current,
          actions: current.actions.map((action) =>
            action.id === result.action.id ? result.action : action,
          ),
        };
      });
    } catch (error) {
      const message =
        error instanceof UpdateActionError
          ? error.message
          : 'The action could not be updated. Please try again.';
      setActionUpdateErrors((current) => ({
        ...current,
        [actionId]: message,
      }));
      throw error;
    } finally {
      setUpdatingActionIds((current) =>
        current.filter((id) => id !== actionId),
      );
    }
  };

  return (
    <div className="app">
      <header className="app__header">
        <h1>Clinical Follow-Up Detector</h1>
        <p className="app__subtitle">
          Analyze fictional clinical notes and extract explicit follow-up actions for
          human review.
        </p>
      </header>

      <main className="app__main">
        <section className="app__input-section" aria-label="Note input">
          <NoteSourcePanel
            loadNoteId={loadNoteId}
            onLoadNoteIdChange={setLoadNoteId}
            onLoadNote={() => void loadSavedNote(loadNoteId)}
            noteText={noteText}
            onNoteTextChange={setNoteText}
            onClientError={setClientValidationError}
            disabled={isLoading}
            isLoadingNote={isLoadingNote}
          />

          {clientValidationError ? (
            <p className="app__validation-error" role="alert">
              {clientValidationError}
            </p>
          ) : null}

          <AnalyzeButton
            disabled={isAnalyzeDisabled}
            isLoading={isAnalyzing}
            onClick={handleAnalyze}
          />

          {isAnalyzing ? (
            <p className="app__loading" role="status" aria-live="polite">
              Analyzing note...
            </p>
          ) : null}

          {isLoadingNote ? (
            <p className="app__loading" role="status" aria-live="polite">
              Loading saved note...
            </p>
          ) : null}

          {analysisState.status === 'error' ? (
            <p className="app__error" role="alert">
              {analysisState.message}
            </p>
          ) : null}
        </section>

        {analysisState.status === 'success' ? (
          <section className="app__results-section" aria-label="Analysis results">
            <NoteSessionPanel
              noteId={analysisState.note.id}
              createdAt={analysisState.note.createdAt}
            />
            <ActionList
              actions={analysisState.actions}
              updatingActionIds={updatingActionIds}
              actionUpdateErrors={actionUpdateErrors}
              onActionUpdate={handleActionUpdate}
            />
          </section>
        ) : null}
      </main>
    </div>
  );
}

export default App;
