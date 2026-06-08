import { LoadNoteForm } from './LoadNoteForm';
import { NoteInput } from './NoteInput';

interface NoteSourcePanelProps {
  loadNoteId: string;
  onLoadNoteIdChange: (value: string) => void;
  onLoadNote: () => void;
  noteText: string;
  onNoteTextChange: (text: string) => void;
  onClientError: (message: string | null) => void;
  disabled?: boolean;
  isLoadingNote?: boolean;
}

export function NoteSourcePanel({
  loadNoteId,
  onLoadNoteIdChange,
  onLoadNote,
  noteText,
  onNoteTextChange,
  onClientError,
  disabled = false,
  isLoadingNote = false,
}: NoteSourcePanelProps) {
  return (
    <section className="note-source" aria-labelledby="note-source-heading">
      <h2 id="note-source-heading" className="note-source__heading">
        Choose how to provide a note
      </h2>
      <p className="note-source__intro">Pick one of the two options below.</p>

      <ol className="note-source__options">
        <li className="note-source-option">
          <div className="note-source-option__header">
            <span className="note-source-option__number" aria-hidden="true">
              1
            </span>
            <h3 className="note-source-option__title">
              Paste note text or upload a .txt file
            </h3>
          </div>
          <NoteInput
            value={noteText}
            onChange={onNoteTextChange}
            onClientError={onClientError}
            disabled={disabled}
          />
        </li>

        <li className="note-source-option">
          <div className="note-source-option__header">
            <span className="note-source-option__number" aria-hidden="true">
              2
            </span>
            <h3 className="note-source-option__title">Load saved note by ID</h3>
          </div>
          <LoadNoteForm
            value={loadNoteId}
            onChange={onLoadNoteIdChange}
            onSubmit={onLoadNote}
            disabled={disabled}
            isLoading={isLoadingNote}
            hideLabel
          />
        </li>
      </ol>
    </section>
  );
}
