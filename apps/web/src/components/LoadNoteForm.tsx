import { useId, type FormEvent } from 'react';

interface LoadNoteFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  isLoading?: boolean;
  hideLabel?: boolean;
}

export function LoadNoteForm({
  value,
  onChange,
  onSubmit,
  disabled = false,
  isLoading = false,
  hideLabel = false,
}: LoadNoteFormProps) {
  const inputId = useId();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <form className="load-note-form" onSubmit={handleSubmit}>
      <label
        htmlFor={inputId}
        className={hideLabel ? 'load-note-form__label--sr-only' : 'load-note-form__label'}
      >
        Load saved note by ID
      </label>
      <div className="load-note-form__row">
        <input
          id={inputId}
          className="load-note-form__input"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="note_a3f8b2c1d4"
          disabled={disabled || isLoading}
        />
        <button
          type="submit"
          className="load-note-form__button"
          disabled={disabled || isLoading || value.trim() === ''}
        >
          {isLoading ? 'Loading...' : 'Load note'}
        </button>
      </div>
    </form>
  );
}
