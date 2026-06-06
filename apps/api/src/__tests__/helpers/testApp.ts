import type { Express } from 'express';
import { createApp } from '../../../dist/app.js';
import {
  closeDatabase,
  getDatabase,
  initDatabase,
} from '../../../dist/db/database.js';

export function setupTestApp(): Express {
  initDatabase(':memory:');
  return createApp();
}

export function teardownTestDatabase(): void {
  closeDatabase();
}

export function resetTestDatabase(): void {
  const database = getDatabase();
  database.exec(`
    DELETE FROM actions;
    DELETE FROM notes;
  `);
}

export function countNotes(): number {
  const row = getDatabase()
    .prepare('SELECT COUNT(*) AS count FROM notes')
    .get() as { count: number };
  return row.count;
}

export function countActions(): number {
  const row = getDatabase()
    .prepare('SELECT COUNT(*) AS count FROM actions')
    .get() as { count: number };
  return row.count;
}
