import "server-only";
import pg from "pg";
const { Pool } = pg;

let pool: pg.Pool | null = null;

export async function getPostgresPool() {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL or POSTGRES_URL environment variable is required for PostgreSQL provider");
  }

  pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  // Test connection
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }

  return pool;
}

export async function closePostgresPool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// PostgreSQL-specific table initialization
export async function initializePostgresTables() {
  const pool = await getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        plan TEXT NOT NULL,
        sector TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'operator',
        status TEXT NOT NULL DEFAULT 'active',
        session_version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS records (
        id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        customer TEXT NOT NULL,
        phone TEXT NOT NULL DEFAULT '',
        sector TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'Diğer',
        assignee TEXT NOT NULL DEFAULT 'Operasyon',
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        service_stage TEXT NOT NULL DEFAULT 'Keşif',
        date TEXT NOT NULL DEFAULT '',
        amount TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (tenant_id, id),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS record_activity (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        record_id TEXT,
        record_customer TEXT NOT NULL,
        type TEXT NOT NULL,
        summary TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workspace_settings (
        tenant_id TEXT PRIMARY KEY,
        stale_record_hours INTEGER NOT NULL,
        high_value_threshold INTEGER NOT NULL,
        planner_horizon_days INTEGER NOT NULL,
        default_daily_capacity INTEGER NOT NULL,
        business_hours_start TEXT NOT NULL,
        business_hours_end TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS login_rate_limits (
        ip_email_key TEXT PRIMARY KEY,
        attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TEXT,
        last_attempt TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_records_tenant_position ON records(tenant_id, position);
      CREATE INDEX IF NOT EXISTS idx_records_tenant_status ON records(tenant_id, status);
      CREATE INDEX IF NOT EXISTS idx_record_activity_tenant_created ON record_activity(tenant_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_record_activity_record_created ON record_activity(tenant_id, record_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
    `);
  } finally {
    client.release();
  }

  return pool;
}