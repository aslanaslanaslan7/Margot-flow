/**
 * SQLite Database Adapter
 * Implements IDatabase interface for SQLite
 */

import { getDatabase } from "./database";
import { getDatabaseConfig } from "./database-config";
import type { IDatabase, QueryResult, QueryRow, ExecuteResult } from "./database-interface";
import type { RecordItem, RecordActivity, WorkspaceSettings } from "./types";

export class SqliteAdapter implements IDatabase {
  readonly provider = "sqlite" as const;

  private async getDb() {
    return getDatabase();
  }

  async getTenant(id: string): Promise<QueryRow<any>> {
    try {
      const db = await this.getDb();
      const row = db.prepare("SELECT * FROM tenants WHERE id = ?").get(id);
      return { row: row || null, success: true };
    } catch (error) {
      return { row: null, success: false, error: String(error) };
    }
  }

  async getTenantBySlug(slug: string): Promise<QueryRow<any>> {
    try {
      const db = await this.getDb();
      const row = db.prepare("SELECT * FROM tenants WHERE slug = ?").get(slug);
      return { row: row || null, success: true };
    } catch (error) {
      return { row: null, success: false, error: String(error) };
    }
  }

  async createTenant(tenant: { id: string; slug: string; name: string; plan: string; sector: string }): Promise<ExecuteResult> {
    try {
      const db = await this.getDb();
      db.prepare("INSERT INTO tenants (id, slug, name, plan, sector) VALUES (?, ?, ?, ?, ?)").run(tenant.id, tenant.slug, tenant.name, tenant.plan, tenant.sector);
      return { success: true, rowsAffected: 1 };
    } catch (error) {
      return { success: false, rowsAffected: 0, error: String(error) };
    }
  }

  async updateTenant(id: string, updates: Partial<{ name: string; plan: string; sector: string }>): Promise<ExecuteResult> {
    try {
      const db = await this.getDb();
      const fields = Object.keys(updates).map(k => `${k} = ?`).join(", ");
      const values = Object.values(updates);
      db.prepare(`UPDATE tenants SET ${fields} WHERE id = ?`).run(...values, id);
      return { success: true, rowsAffected: 1 };
    } catch (error) {
      return { success: false, rowsAffected: 0, error: String(error) };
    }
  }

  async getUser(id: string, tenantId: string): Promise<QueryRow<any>> {
    try {
      const db = await this.getDb();
      const row = db.prepare("SELECT * FROM users WHERE id = ? AND tenant_id = ?").get(id, tenantId);
      return { row: row || null, success: true };
    } catch (error) {
      return { row: null, success: false, error: String(error) };
    }
  }

  async getUserByEmail(email: string): Promise<QueryRow<any>> {
    try {
      const db = await this.getDb();
      const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
      return { row: row || null, success: true };
    } catch (error) {
      return { row: null, success: false, error: String(error) };
    }
  }

  async createUser(user: { id: string; tenant_id: string; email: string; password_hash: string; full_name: string; role?: string }): Promise<ExecuteResult> {
    try {
      const db = await this.getDb();
      db.prepare("INSERT INTO users (id, tenant_id, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?, ?)").run(user.id, user.tenant_id, user.email, user.password_hash, user.full_name, user.role || "user");
      return { success: true, rowsAffected: 1 };
    } catch (error) {
      return { success: false, rowsAffected: 0, error: String(error) };
    }
  }

  async updateUser(id: string, tenantId: string, updates: Partial<{ password_hash: string; full_name: string; role: string; status: string; session_version: number }>): Promise<ExecuteResult> {
    try {
      const db = await this.getDb();
      const fields = Object.keys(updates).map(k => `${k} = ?`).join(", ");
      const values = Object.values(updates);
      db.prepare(`UPDATE users SET ${fields} WHERE id = ? AND tenant_id = ?`).run(...values, id, tenantId);
      return { success: true, rowsAffected: 1 };
    } catch (error) {
      return { success: false, rowsAffected: 0, error: String(error) };
    }
  }

  async listTenantUsers(tenantId: string): Promise<QueryResult<any>> {
    try {
      const db = await this.getDb();
      const rows = db.prepare("SELECT id, tenant_id, email, full_name, role, status, session_version, created_at, updated_at FROM users WHERE tenant_id = ?").all(tenantId);
      return { rows, success: true };
    } catch (error) {
      return { rows: [], success: false, error: String(error) };
    }
  }

  async getRecords(tenantId: string): Promise<QueryResult<RecordItem>> {
    try {
      const db = await this.getDb();
      const rows = db.prepare("SELECT * FROM records WHERE tenant_id = ?").all(tenantId) as RecordItem[];
      return { rows, success: true };
    } catch (error) {
      return { rows: [], success: false, error: String(error) };
    }
  }

  async getRecord(id: string, tenantId: string): Promise<QueryRow<RecordItem>> {
    try {
      const db = await this.getDb();
      const row = db.prepare("SELECT * FROM records WHERE id = ? AND tenant_id = ?").get(id, tenantId);
      return { row: row || null, success: true };
    } catch (error) {
      return { row: null, success: false, error: String(error) };
    }
  }

  async createRecord(record: RecordItem): Promise<ExecuteResult> {
    try {
      const db = await this.getDb();
      db.prepare("INSERT INTO records (id, tenant_id, title, category, amount, currency, date, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(record.id, record.tenant_id, record.title, record.category, record.amount, record.currency, record.date, record.status, record.notes, record.created_at, record.updated_at);
      return { success: true, rowsAffected: 1 };
    } catch (error) {
      return { success: false, rowsAffected: 0, error: String(error) };
    }
  }

  async updateRecord(id: string, tenantId: string, updates: Partial<RecordItem>): Promise<ExecuteResult> {
    try {
      const db = await this.getDb();
      const fields = Object.keys(updates).map(k => `${k} = ?`).join(", ");
      const values = Object.values(updates);
      db.prepare(`UPDATE records SET ${fields} WHERE id = ? AND tenant_id = ?`).run(...values, id, tenantId);
      return { success: true, rowsAffected: 1 };
    } catch (error) {
      return { success: false, rowsAffected: 0, error: String(error) };
    }
  }

  async deleteRecord(id: string, tenantId: string): Promise<ExecuteResult> {
    try {
      const db = await this.getDb();
      db.prepare("DELETE FROM records WHERE id = ? AND tenant_id = ?").run(id, tenantId);
      return { success: true, rowsAffected: 1 };
    } catch (error) {
      return { success: false, rowsAffected: 0, error: String(error) };
    }
  }

  async replaceRecords(tenantId: string, records: RecordItem[]): Promise<ExecuteResult> {
    try {
      const db = await this.getDb();
      db.prepare("DELETE FROM records WHERE tenant_id = ?").run(tenantId);
      for (const record of records) {
        db.prepare("INSERT INTO records (id, tenant_id, title, category, amount, currency, date, status, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(record.id, record.tenant_id, record.title, record.category, record.amount, record.currency, record.date, record.status, record.notes, record.created_at, record.updated_at);
      }
      return { success: true, rowsAffected: records.length };
    } catch (error) {
      return { success: false, rowsAffected: 0, error: String(error) };
    }
  }

  async getActivities(tenantId: string, limit = 50): Promise<QueryResult<RecordActivity>> {
    try {
      const db = await this.getDb();
      const rows = db.prepare("SELECT * FROM activities WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?").all(tenantId, limit) as RecordActivity[];
      return { rows, success: true };
    } catch (error) {
      return { rows: [], success: false, error: String(error) };
    }
  }

  async getRecordActivities(tenantId: string, recordId: string): Promise<QueryResult<RecordActivity>> {
    try {
      const db = await this.getDb();
      const rows = db.prepare("SELECT * FROM activities WHERE tenant_id = ? AND record_id = ? ORDER BY created_at DESC").all(tenantId, recordId) as RecordActivity[];
      return { rows, success: true };
    } catch (error) {
      return { rows: [], success: false, error: String(error) };
    }
  }

  async createActivity(activity: RecordActivity): Promise<ExecuteResult> {
    try {
      const db = await this.getDb();
      db.prepare("INSERT INTO activities (id, tenant_id, record_id, action, details, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(activity.id, activity.tenant_id, activity.record_id, activity.action, activity.details, activity.created_at);
      return { success: true, rowsAffected: 1 };
    } catch (error) {
      return { success: false, rowsAffected: 0, error: String(error) };
    }
  }

  async deleteActivitiesByTenant(tenantId: string): Promise<ExecuteResult> {
    try {
      const db = await this.getDb();
      db.prepare("DELETE FROM activities WHERE tenant_id = ?").run(tenantId);
      return { success: true, rowsAffected: 1 };
    } catch (error) {
      return { success: false, rowsAffected: 0, error: String(error) };
    }
  }

  async getSettings(tenantId: string): Promise<QueryRow<WorkspaceSettings>> {
    try {
      const db = await this.getDb();
      const row = db.prepare("SELECT * FROM settings WHERE tenant_id = ?").get(tenantId) as WorkspaceSettings | undefined;
      return { row: row || null, success: true };
    } catch (error) {
      return { row: null, success: false, error: String(error) };
    }
  }

  async upsertSettings(settings: WorkspaceSettings): Promise<ExecuteResult> {
    try {
      const db = await this.getDb();
      db.prepare("INSERT OR REPLACE INTO settings (tenant_id, currency, locale, timezone, dashboard_layout, theme) VALUES (?, ?, ?, ?, ?, ?)").run(settings.tenant_id, settings.currency, settings.locale, settings.timezone, settings.dashboard_layout, settings.theme);
      return { success: true, rowsAffected: 1 };
    } catch (error) {
      return { success: false, rowsAffected: 0, error: String(error) };
    }
  }

  async getRateLimit(key: string): Promise<QueryRow<{ key: string; attempts: number; locked_until: string | null; last_attempt: string }>> {
    try {
      const db = await this.getDb();
      const row = db.prepare("SELECT * FROM rate_limits WHERE key = ?").get(key) as any;
      return { row: row || null, success: true };
    } catch (error) {
      return { row: null, success: false, error: String(error) };
    }
  }

  async setRateLimit(key: string, attempts: number, lockedUntil: string | null): Promise<ExecuteResult> {
    try {
      const db = await this.getDb();
      db.prepare("INSERT OR REPLACE INTO rate_limits (key, attempts, locked_until, last_attempt) VALUES (?, ?, ?, ?)").run(key, attempts, lockedUntil, new Date().toISOString());
      return { success: true, rowsAffected: 1 };
    } catch (error) {
      return { success: false, rowsAffected: 0, error: String(error) };
    }
  }

  async clearRateLimit(key: string): Promise<ExecuteResult> {
    try {
      const db = await this.getDb();
      db.prepare("DELETE FROM rate_limits WHERE key = ?").run(key);
      return { success: true, rowsAffected: 1 };
    } catch (error) {
      return { success: false, rowsAffected: 0, error: String(error) };
    }
  }

  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const db = await this.getDb();
      db.prepare("SELECT 1").get();
      return { healthy: true };
    } catch (error) {
      return { healthy: false, error: String(error) };
    }
  }
}