import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from '../config.js';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  original_text TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS actions (
  id TEXT PRIMARY KEY,
  note_id TEXT NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL,
  deadline_text TEXT,
  normalized_deadline TEXT,
  priority TEXT NOT NULL,
  evidence TEXT NOT NULL,
  needs_review INTEGER NOT NULL,
  uncertainty_reason TEXT,
  review_status TEXT NOT NULL,
  completion_status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (note_id) REFERENCES notes(id)
);
`;

let db: Database.Database | null = null;

function ensureDatabaseDirectory(databasePath: string): void {
  if (databasePath === ':memory:') {
    return;
  }

  const directory = path.dirname(databasePath);
  fs.mkdirSync(directory, { recursive: true });
}

export function initDatabase(databasePath?: string): Database.Database {
  closeDatabase();

  const resolvedPath = databasePath ?? config.databasePath;
  ensureDatabaseDirectory(resolvedPath);

  db = new Database(resolvedPath);
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);

  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database has not been initialized. Call initDatabase() first.');
  }

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function resetDatabase(): void {
  const database = getDatabase();
  database.exec(`
    DELETE FROM actions;
    DELETE FROM notes;
  `);
}
