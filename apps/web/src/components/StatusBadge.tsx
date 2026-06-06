type StatusBadgeVariant =
  | 'type'
  | 'priority'
  | 'needsReview'
  | 'pending'
  | 'confirmed'
  | 'rejected'
  | 'open'
  | 'completed';

interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  value: string;
}

export function StatusBadge({ variant, value }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${variant}`}>{value}</span>;
}
