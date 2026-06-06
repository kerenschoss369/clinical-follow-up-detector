import { MAX_NOTE_LENGTH } from '../constants';

export function validateNoteText(text: string): string | null {
  if (text.trim().length === 0) {
    return 'Note text is required.';
  }

  if (text.length > MAX_NOTE_LENGTH) {
    return 'The note exceeds the maximum allowed length.';
  }

  return null;
}

function hasTxtExtension(filename: string): boolean {
  return filename.toLowerCase().endsWith('.txt');
}

export function validateTxtFile(file: File): string | null {
  if (!hasTxtExtension(file.name)) {
    return 'Only .txt files are supported.';
  }

  if (file.size === 0) {
    return 'The selected file is empty.';
  }

  return null;
}