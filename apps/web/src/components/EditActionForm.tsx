import { useEffect, useId, useRef, useState } from 'react';
import type { UpdateActionRequest } from '../types/api';
import type { Action, ActionType, Priority } from '../types/domain';

const ACTION_TYPES: readonly ActionType[] = [
  'appointment',
  'test',
  'medication',
  'treatment',
  'warning',
  'other',
];

const PRIORITIES: readonly Priority[] = ['low', 'medium', 'high', 'urgent'];

interface EditActionFormProps {
  action: Action;
  isUpdating: boolean;
  onSave: (patch: UpdateActionRequest) => void | Promise<void>;
  onCancel: () => void;
}

function formatLabel(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function buildPatch(action: Action, draft: EditDraft): UpdateActionRequest {
  const patch: UpdateActionRequest = {};

  if (draft.title !== action.title) {
    patch.title = draft.title;
  }

  if (draft.type !== action.type) {
    patch.type = draft.type;
  }

  const deadlineText = draft.deadlineText.trim() === '' ? null : draft.deadlineText;
  if (deadlineText !== action.deadlineText) {
    patch.deadlineText = deadlineText;
  }

  const normalizedDeadline =
    draft.normalizedDeadline.trim() === '' ? null : draft.normalizedDeadline;
  if (normalizedDeadline !== action.normalizedDeadline) {
    patch.normalizedDeadline = normalizedDeadline;
  }

  if (draft.priority !== action.priority) {
    patch.priority = draft.priority;
  }

  return patch;
}

interface EditDraft {
  title: string;
  type: ActionType;
  deadlineText: string;
  normalizedDeadline: string;
  priority: Priority;
}

export function EditActionForm({
  action,
  isUpdating,
  onSave,
  onCancel,
}: EditActionFormProps) {
  const titleId = useId();
  const typeId = useId();
  const deadlineTextId = useId();
  const normalizedDeadlineId = useId();
  const priorityId = useId();
  const titleRef = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<EditDraft>({
    title: action.title,
    type: action.type,
    deadlineText: action.deadlineText ?? '',
    normalizedDeadline: action.normalizedDeadline ?? '',
    priority: action.priority,
  });

  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSave = async () => {
    if (draft.title.trim() === '') {
      setValidationError('Title is required.');
      return;
    }

    const patch = buildPatch(action, draft);
    if (Object.keys(patch).length === 0) {
      onCancel();
      return;
    }

    setValidationError(null);
    await onSave(patch);
  };

  return (
    <form
      className="edit-action-form"
      aria-label={`Edit action: ${action.title}`}
      onSubmit={(event) => {
        event.preventDefault();
        void handleSave();
      }}
    >
      <fieldset className="edit-action-form__fieldset" disabled={isUpdating}>
        <legend className="edit-action-form__legend">Edit action</legend>

        <div className="edit-action-form__field">
          <label htmlFor={titleId}>Title</label>
          <input
            ref={titleRef}
            id={titleId}
            type="text"
            value={draft.title}
            onChange={(event) =>
              setDraft((current) => ({ ...current, title: event.target.value }))
            }
          />
        </div>

        <div className="edit-action-form__field">
          <label htmlFor={typeId}>Type</label>
          <select
            id={typeId}
            value={draft.type}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                type: event.target.value as ActionType,
              }))
            }
          >
            {ACTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {formatLabel(type)}
              </option>
            ))}
          </select>
        </div>

        <div className="edit-action-form__field">
          <label htmlFor={deadlineTextId}>Deadline text</label>
          <input
            id={deadlineTextId}
            type="text"
            value={draft.deadlineText}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                deadlineText: event.target.value,
              }))
            }
          />
        </div>

        <div className="edit-action-form__field">
          <label htmlFor={normalizedDeadlineId}>Normalized deadline</label>
          <input
            id={normalizedDeadlineId}
            type="text"
            placeholder="YYYY-MM-DD"
            value={draft.normalizedDeadline}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                normalizedDeadline: event.target.value,
              }))
            }
          />
        </div>

        <div className="edit-action-form__field">
          <label htmlFor={priorityId}>Priority</label>
          <select
            id={priorityId}
            value={draft.priority}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                priority: event.target.value as Priority,
              }))
            }
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {formatLabel(priority)}
              </option>
            ))}
          </select>
        </div>
      </fieldset>

      {validationError ? (
        <p className="edit-action-form__error" role="alert">
          {validationError}
        </p>
      ) : null}

      <div className="edit-action-form__actions">
        <button
          type="submit"
          className="edit-action-form__button edit-action-form__button--save"
          disabled={isUpdating}
        >
          Save changes
        </button>
        <button
          type="button"
          className="edit-action-form__button edit-action-form__button--cancel"
          onClick={onCancel}
          disabled={isUpdating}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
