export function getNoteIdFromUrl(): string | null {
  const noteId = new URLSearchParams(window.location.search).get('noteId');
  if (!noteId || noteId.trim() === '') {
    return null;
  }
  return noteId.trim();
}

export function setNoteIdInUrl(noteId: string): void {
  const url = new URL(window.location.href);
  url.searchParams.set('noteId', noteId);
  window.history.replaceState(null, '', url);
}
