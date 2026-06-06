import type { UpdateActionRequest } from '../types/api';
import type { Action } from '../types/domain';
import { ActionCard } from './ActionCard';

interface ActionListProps {
  actions: Action[];
  updatingActionIds: string[];
  actionUpdateErrors: Record<string, string>;
  onActionUpdate: (
    actionId: string,
    patch: UpdateActionRequest,
  ) => Promise<void>;
}

export function ActionList({
  actions,
  updatingActionIds,
  actionUpdateErrors,
  onActionUpdate,
}: ActionListProps) {
  if (actions.length === 0) {
    return (
      <div className="action-list action-list--empty" role="status">
        <p>No follow-up actions were found in this note.</p>
      </div>
    );
  }

  return (
    <section className="action-list" aria-label="Extracted actions">
      <h2 className="action-list__title">Extracted actions ({actions.length})</h2>
      <ul className="action-list__items">
        {actions.map((action) => (
          <li key={action.id}>
            <ActionCard
              action={action}
              isUpdating={updatingActionIds.includes(action.id)}
              updateError={actionUpdateErrors[action.id] ?? null}
              onActionUpdate={onActionUpdate}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
