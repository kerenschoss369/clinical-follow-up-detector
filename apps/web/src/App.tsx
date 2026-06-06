import { useState } from 'react';
import './App.css';
import { AnalyzeButton } from './components/AnalyzeButton';
import { ActionList } from './components/ActionList';
import { NoteInput } from './components/NoteInput';
import { UpdateActionError, updateAction } from './services/actionsApi';
import { AnalyzeNoteError, analyzeNote } from './services/notesApi';
import type { AnalysisState, UpdateActionRequest } from './types/api';
import { validateNoteText } from './utils/noteValidation';

function App() {
  const [noteText, setNoteText] = useState('');
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
  const textValidationError = validateNoteText(noteText);
  const isAnalyzeDisabled = textValidationError !== null;

  const handleAnalyze = async () => {
    const validationError = validateNoteText(noteText);
    if (validationError) {
      setClientValidationError(validationError);
      return;
    }

    setClientValidationError(null);
    setAnalysisState({ status: 'loading' });
    setUpdatingActionIds([]);
    setActionUpdateErrors({});

    try {
      const result = await analyzeNote(noteText);
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
        <NoteInput
          value={noteText}
          onChange={setNoteText}
          onClientError={setClientValidationError}
          disabled={isLoading}
        />

        {clientValidationError ? (
          <p className="app__validation-error" role="alert">
            {clientValidationError}
          </p>
        ) : null}

        <AnalyzeButton
          disabled={isAnalyzeDisabled}
          isLoading={isLoading}
          onClick={handleAnalyze}
        />

        {analysisState.status === 'loading' ? (
          <p className="app__loading" role="status" aria-live="polite">
            Analyzing note...
          </p>
        ) : null}

        {analysisState.status === 'error' ? (
          <p className="app__error" role="alert">
            {analysisState.message}
          </p>
        ) : null}

        {analysisState.status === 'success' ? (
          <ActionList
            actions={analysisState.actions}
            updatingActionIds={updatingActionIds}
            actionUpdateErrors={actionUpdateErrors}
            onActionUpdate={handleActionUpdate}
          />
        ) : null}
      </main>
    </div>
  );
}

export default App;
