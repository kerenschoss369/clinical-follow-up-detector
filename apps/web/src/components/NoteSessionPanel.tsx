interface NoteSessionPanelProps {
  noteId: string;
  createdAt: string;
}

export function NoteSessionPanel({ noteId, createdAt }: NoteSessionPanelProps) {
  return (
    <section className="note-session" aria-label="Saved note session">
      <p className="note-session__id">
        <span className="note-session__label">Note ID:</span>{' '}
        <code className="note-session__code">{noteId}</code>
      </p>
      <p className="note-session__meta">
        Saved at {new Date(createdAt).toLocaleString()}
      </p>
    </section>
  );
}
