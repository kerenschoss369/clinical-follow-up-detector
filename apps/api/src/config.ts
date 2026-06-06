function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

function readOptionalString(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return undefined;
  }

  return raw.trim();
}

function resolveDefaultDatabasePath(): string {
  return 'data/app.db';
}

export const config = {
  port: readInt('PORT', 3000),
  aiServiceUrl: readOptionalString('AI_SERVICE_URL') ?? 'http://localhost:8000',
  maxNoteLength: readInt('MAX_NOTE_LENGTH', 20_000),
  referenceDateOverride: readOptionalString('REFERENCE_DATE'),
  aiServiceTimeoutMs: readInt('AI_SERVICE_TIMEOUT_MS', 30_000),
  databasePath: readOptionalString('DATABASE_PATH') ?? resolveDefaultDatabasePath(),
} as const;

export function getReferenceDate(): string {
  if (config.referenceDateOverride) {
    return config.referenceDateOverride;
  }

  return new Date().toISOString().slice(0, 10);
}
