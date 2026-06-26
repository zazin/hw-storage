import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface ImageRecord {
  id: string;
  key: string;
  filename: string;
  content_type: string;
  size: number;
  created_at: string;
}

export interface ReportRecord {
  id: string;
  key: string;
  filename: string;
  size: number;
  created_at: string;
}

const DB_PATH = process.env.DB_PATH || "./data/app.db";

// Ensure the directory for the SQLite file exists.
mkdirSync(dirname(DB_PATH), { recursive: true });

// Reuse a single connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { __db?: Database.Database };

export const db =
  globalForDb.__db ?? new Database(DB_PATH);
if (!globalForDb.__db) globalForDb.__db = db;

db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS images (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL,
    filename TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL,
    filename TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
`);

export function insertImage(rec: ImageRecord): void {
  db.prepare(
    `INSERT INTO images (id, key, filename, content_type, size, created_at)
     VALUES (@id, @key, @filename, @content_type, @size, @created_at)`,
  ).run(rec);
}

export function listImages(): ImageRecord[] {
  return db
    .prepare(`SELECT * FROM images ORDER BY created_at DESC`)
    .all() as ImageRecord[];
}

export function getImage(id: string): ImageRecord | undefined {
  return db.prepare(`SELECT * FROM images WHERE id = ?`).get(id) as
    | ImageRecord
    | undefined;
}

export function insertReport(rec: ReportRecord): void {
  db.prepare(
    `INSERT INTO reports (id, key, filename, size, created_at)
     VALUES (@id, @key, @filename, @size, @created_at)`,
  ).run(rec);
}

export function listReports(): ReportRecord[] {
  return db
    .prepare(`SELECT * FROM reports ORDER BY created_at DESC`)
    .all() as ReportRecord[];
}

export function getReport(id: string): ReportRecord | undefined {
  return db.prepare(`SELECT * FROM reports WHERE id = ?`).get(id) as
    | ReportRecord
    | undefined;
}
