import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (client) return client;

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY (or SUPABASE_SERVICE_KEY) environment variables are required for Supabase provider");
  }

  client = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return client;
}

export async function closeSupabaseClient() {
  client = null;
}

// Supabase-specific table initialization via SQL
export async function initializeSupabaseTables() {
  const supabase = getSupabaseClient();

  // Use the service key for admin operations if available
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!serviceKey) {
    console.warn("SUPABASE_SERVICE_KEY not set - some schema operations may fail");
  }

  // Define schema as SQL to execute
  const schemaSQL = `
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
  `;

  // Execute schema creation (requires service key with DDL permissions)
  // Note: In production, this should be run via Supabase dashboard migrations
  const { error } = await supabase.rpc("exec_sql", { query: schemaSQL });
  
  if (error) {
    // If RPC fails, table creation should be done via Supabase dashboard
    console.warn("Supabase schema initialization via RPC failed:", error.message);
    console.warn("Please run the schema SQL via Supabase dashboard SQL editor");
  }

  return supabase;
}