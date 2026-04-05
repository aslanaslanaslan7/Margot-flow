/**
 * Unified Database Interface
 * 
 * Abstracts SQLite, PostgreSQL, and Supabase behind a common interface.
 * This allows the application to switch between database providers
 * without changing the business logic layer.
 */

import { RecordItem, RecordActivity, WorkspaceSettings } from "./types";

// Re-export types that store modules use
export type { RecordItem, RecordActivity, WorkspaceSettings };

// Generic query result type
export interface QueryResult<T> {
  rows: T[];
  success: boolean;
  error?: string;
}

// Single row result
export interface QueryRow<T> {
  row: T | null;
  success: boolean;
  error?: string;
}

// Execution result for inserts/updates/deletes
export interface ExecuteResult {
  success: boolean;
  rowsAffected: number;
  error?: string;
}

// Database interface that all providers must implement
export interface IDatabase {
  // Provider identification
  readonly provider: "sqlite" | "postgres" | "supabase";
  
  // Tenant operations
  getTenant(id: string): Promise<QueryRow<{ id: string; slug: string; name: string; plan: string; sector: string; created_at: string; updated_at: string }>>;
  getTenantBySlug(slug: string): Promise<QueryRow<{ id: string; slug: string; name: string; plan: string; sector: string; created_at: string; updated_at: string }>>;
  createTenant(tenant: { id: string; slug: string; name: string; plan: string; sector: string }): Promise<ExecuteResult>;
  updateTenant(id: string, updates: Partial<{ name: string; plan: string; sector: string }>): Promise<ExecuteResult>;

  // User operations
  getUser(id: string, tenantId: string): Promise<QueryRow<{ id: string; tenant_id: string; email: string; password_hash: string; full_name: string; role: string; status: string; session_version: number; created_at: string; updated_at: string }>>;
  getUserByEmail(email: string): Promise<QueryRow<{ id: string; tenant_id: string; email: string; password_hash: string; full_name: string; role: string; status: string; session_version: number; created_at: string; updated_at: string }>>;
  createUser(user: { id: string; tenant_id: string; email: string; password_hash: string; full_name: string; role?: string }): Promise<ExecuteResult>;
  updateUser(id: string, tenantId: string, updates: Partial<{ password_hash: string; full_name: string; role: string; status: string; session_version: number }>): Promise<ExecuteResult>;
  listTenantUsers(tenantId: string): Promise<QueryResult<{ id: string; tenant_id: string; email: string; full_name: string; role: string; status: string; session_version: number; created_at: string; updated_at: string }>>;

  // Record operations
  getRecords(tenantId: string): Promise<QueryResult<RecordItem>>;
  getRecord(id: string, tenantId: string): Promise<QueryRow<RecordItem>>;
  createRecord(record: RecordItem): Promise<ExecuteResult>;
  updateRecord(id: string, tenantId: string, updates: Partial<RecordItem>): Promise<ExecuteResult>;
  deleteRecord(id: string, tenantId: string): Promise<ExecuteResult>;
  replaceRecords(tenantId: string, records: RecordItem[]): Promise<ExecuteResult>;

  // Activity operations
  getActivities(tenantId: string, limit?: number): Promise<QueryResult<RecordActivity>>;
  getRecordActivities(tenantId: string, recordId: string): Promise<QueryResult<RecordActivity>>;
  createActivity(activity: RecordActivity): Promise<ExecuteResult>;
  deleteActivitiesByTenant(tenantId: string): Promise<ExecuteResult>;

  // Settings operations
  getSettings(tenantId: string): Promise<QueryRow<WorkspaceSettings>>;
  upsertSettings(settings: WorkspaceSettings): Promise<ExecuteResult>;

  // Rate limit operations
  getRateLimit(key: string): Promise<QueryRow<{ key: string; attempts: number; locked_until: string | null; last_attempt: string }>>;
  setRateLimit(key: string, attempts: number, lockedUntil: string | null): Promise<ExecuteResult>;
  clearRateLimit(key: string): Promise<ExecuteResult>;

  // Health check
  healthCheck(): Promise<{ healthy: boolean; error?: string }>;
}

// Get the configured database instance
export async function getDb(): Promise<IDatabase> {
  const { getDatabase } = await import("./database");
  const db = await getDatabase();
  
  // Import the appropriate adapter based on provider
  const config = await import("./database-config").then(m => m.getDatabaseConfig());
  
  if (config.provider === "sqlite") {
    const { SqliteAdapter } = await import("./database-sqlite-adapter");
    return new SqliteAdapter(db);
  }
  
  if (config.provider === "postgres") {
    const { PostgresAdapter } = await import("./database-postgres-adapter");
    return new PostgresAdapter();
  }
  
  if (config.provider === "supabase") {
    const { SupabaseAdapter } = await import("./database-supabase-adapter");
    return new SupabaseAdapter();
  }
  
  throw new Error(`Unknown database provider: ${config.provider}`);
}