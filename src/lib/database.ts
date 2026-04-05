import "server-only";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getDatabaseConfig } from "@/lib/database-config";

let database: DatabaseSync | null = null;

async function ensureSqliteDatabase() {
  if (database) return database;

  const config = getDatabaseConfig();
  const resolvedSqlitePath = path.isAbsolute(config.sqlitePath) ? config.sqlitePath : path.join(process.cwd(), config.sqlitePath);
  await mkdir(path.dirname(resolvedSqlitePath), { recursive: true });

  const instance = new DatabaseSync(resolvedSqlitePath);
  instance.exec(`PRAGMA journal_mode = WAL;`);
  database = instance;
  return instance;
}

export async function getDatabase() {
  const config = getDatabaseConfig();

  if (config.provider !== "sqlite") {
    // Multi-database support: PostgreSQL and Supabase adapters are available but require
    // additional configuration. For now, throw a clear error with setup instructions.
    if (config.provider === "postgres") {
      throw new Error(
        `PostgreSQL provider selected but not wired for runtime. To enable:\n` +
        `1. Set DATABASE_URL or POSTGRES_URL environment variable\n` +
        `2. Run migrations: CREATE TABLE statements in database-postgres.ts\n` +
        `3. Ensure app has pg driver installed\n` +
        `Keep DATABASE_PROVIDER=sqlite for local development.`,
      );
    }
    if (config.provider === "supabase") {
      throw new Error(
        `Supabase provider selected but not wired for runtime. To enable:\n` +
        `1. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables\n` +
        `2. Run schema via Supabase dashboard SQL editor\n` +
        `Keep DATABASE_PROVIDER=sqlite for local development.`,
      );
    }
    throw new Error(
      `DATABASE_PROVIDER=${config.provider} is not supported. Current app supports: sqlite`,
    );
  }

  return ensureSqliteDatabase();
}

export function columnExists(db: DatabaseSync, table: string, column: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return rows.some((row) => row.name === column);
}

export async function getDatabaseProvider() {
  const config = getDatabaseConfig();
  return config.provider;
}