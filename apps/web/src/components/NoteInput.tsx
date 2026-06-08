import { useId, type ChangeEvent } from 'react';
import { validateNoteText, validateTxtFile } from '../utils/noteValidation';

interface NoteInputProps {
  value: string;
  onChange: (text: string) => void;
  onClientError: (message: string | null) => void;
  disabled?: boolean;
}

export function NoteInput({
  value,
  onChange,
  onClientError,
  disabled = false,
}: NoteInputProps) {
  const textareaId = useId();
  const fileInputId = useId();

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onClientError(null);
    onChange(event.target.value);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const fileError = validateTxtFile(file);
    if (fileError) {
      onClientError(fileError);
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const textError = validateNoteText(content);
      if (textError) {
        onClientError(textError);
        return;
      }

      onClientError(null);
      onChange(content);
    };

    reader.onerror = () => {
      onClientError('The selected file could not be read.');
    };

    reader.readAsText(file);
  };

  return (
    <section className="note-input" aria-label="Clinical note input">
      <label htmlFor={textareaId} className="note-input__label">
        Clinical note
      </label>
      <textarea
        id={textareaId}
        className="note-input__textarea"
        value={value}
        onChange={handleTextChange}
        disabled={disabled}
        rows={12}
        placeholder="Paste fictional clinical note text here..."
      />

      <div className="note-input__file-row">
        <label htmlFor={fileInputId} className="note-input__file-label">
          Or upload a .txt file
        </label>
        <input
          id={fileInputId}
          className="note-input__file"
          type="file"
          accept=".txt"
          onChange={handleFileChange}
          disabled={disabled}
        />
      </div>
    </section>
  );
}
