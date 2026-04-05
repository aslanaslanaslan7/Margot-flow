import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { AuthSession, TenantContext, UserProfile } from "@/lib/types";
import { AdminUserSummary } from "@/types/admin";
import { getDatabase } from "@/lib/database";
const DEFAULT_EMAIL = "demo@margotflow.local";
const DEFAULT_PASSWORD = "Demo12345!";
const DEFAULT_TENANT: TenantContext = {
  id: "tenant_demo_hq",
  slug: "margot-demo-hq",
  name: "Margot Demo HQ",
  plan: "demo",
  sector: "Multi-sector operations",
};
const DEFAULT_USER: Omit<UserProfile, "email" | "status" | "sessionVersion"> = {
  id: "user_demo_owner",
  fullName: "Demo Operator",
  role: "owner",
};

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  session_version: number;
  password_hash: string;
  tenant_id: string;
  tenant_slug: string;
  tenant_name: string;
  tenant_plan: string;
  tenant_sector: string;
};

type UserAdminRow = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  session_version: number;
  created_at: string;
  updated_at: string;
};

function getProvisioningConfig() {
  return {
    email: (process.env.DEMO_USER_EMAIL || DEFAULT_EMAIL).trim().toLowerCase(),
    password: process.env.DEMO_USER_PASSWORD || DEFAULT_PASSWORD,
    tenant: {
      ...DEFAULT_TENANT,
      name: process.env.DEMO_TENANT_NAME?.trim() || DEFAULT_TENANT.name,
      slug: process.env.DEMO_TENANT_SLUG?.trim() || DEFAULT_TENANT.slug,
      sector: process.env.DEMO_TENANT_SECTOR?.trim() || DEFAULT_TENANT.sector,
      plan: (process.env.DEMO_TENANT_PLAN?.trim() as TenantContext["plan"]) || DEFAULT_TENANT.plan,
    },
    user: {
      ...DEFAULT_USER,
      fullName: process.env.DEMO_USER_FULL_NAME?.trim() || DEFAULT_USER.fullName,
      role: (process.env.DEMO_USER_ROLE?.trim() as UserProfile["role"]) || DEFAULT_USER.role,
      status: "active" as const,
    },
  };
}

function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, storedHash: string) {
  const [salt, expectedHash] = storedHash.split(":");
  if (!salt || !expectedHash) return false;

  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, "hex");
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

function mapUserRowToSession(row: UserRow, expiresAt: number): AuthSession {
  return {
    user: {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      role: row.role as UserProfile["role"],
      status: row.status === "disabled" ? "disabled" : "active",
      sessionVersion: row.session_version,
    },
    tenant: {
      id: row.tenant_id,
      slug: row.tenant_slug,
      name: row.tenant_name,
      plan: row.tenant_plan as TenantContext["plan"],
      sector: row.tenant_sector,
    },
    expiresAt,
  };
}

async function ensureDatabase() {
  const db = await getDatabase();
  db.exec(`
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
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      session_version INTEGER NOT NULL DEFAULT 1,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);
  `);

  try {
    db.exec(`ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`);
  } catch {}

  try {
    db.exec(`ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1`);
  } catch {}

  return db;
}

export async function ensureAuthProvisioning() {
  const db = await ensureDatabase();
  const config = getProvisioningConfig();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO tenants (id, slug, name, plan, sector, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       slug = excluded.slug,
       name = excluded.name,
       plan = excluded.plan,
       sector = excluded.sector,
       updated_at = excluded.updated_at`,
  ).run(config.tenant.id, config.tenant.slug, config.tenant.name, config.tenant.plan, config.tenant.sector, now, now);

  const existing = db
    .prepare(`SELECT id, email, full_name, role, status, session_version, password_hash, tenant_id FROM users WHERE id = ?`)
    .get(config.user.id) as {
      id: string;
      email: string;
      full_name: string;
      role: string;
      status: string;
      session_version: number;
      password_hash: string;
      tenant_id: string;
    } | undefined;

  const nextPasswordHash = !existing || existing.email !== config.email || !verifyPassword(config.password, existing.password_hash)
    ? hashPassword(config.password)
    : existing.password_hash;

  db.prepare(
    `INSERT INTO users (id, tenant_id, email, full_name, role, status, session_version, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       tenant_id = excluded.tenant_id,
       email = excluded.email,
       full_name = excluded.full_name,
       role = excluded.role,
       status = excluded.status,
       password_hash = excluded.password_hash,
       updated_at = excluded.updated_at`,
  ).run(
    config.user.id,
    config.tenant.id,
    config.email,
    config.user.fullName,
    config.user.role,
    config.user.status,
    existing?.session_version ?? 1,
    nextPasswordHash,
    now,
    now,
  );
}

export async function authenticateUserAgainstStore(email: string, password: string, sessionTtlSeconds: number) {
  await ensureAuthProvisioning();
  const db = await ensureDatabase();
  const normalizedEmail = email.trim().toLowerCase();
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.full_name, u.role, u.status, u.session_version, u.password_hash,
              t.id as tenant_id, t.slug as tenant_slug, t.name as tenant_name, t.plan as tenant_plan, t.sector as tenant_sector
       FROM users u
       INNER JOIN tenants t ON t.id = u.tenant_id
       WHERE u.email = ?`,
    )
    .get(normalizedEmail) as UserRow | undefined;

  if (!row || row.status !== "active" || !verifyPassword(password, row.password_hash)) {
    return null;
  }

  return mapUserRowToSession(row, Date.now() + sessionTtlSeconds * 1000);
}

export async function validateSessionAgainstStore(session: AuthSession) {
  const db = await ensureDatabase();
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.full_name, u.role, u.status, u.session_version, u.password_hash,
              t.id as tenant_id, t.slug as tenant_slug, t.name as tenant_name, t.plan as tenant_plan, t.sector as tenant_sector
       FROM users u
       INNER JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = ?`,
    )
    .get(session.user.id) as UserRow | undefined;

  if (!row || row.status !== "active") {
    return null;
  }

  if (row.session_version !== session.user.sessionVersion || row.tenant_id !== session.tenant.id) {
    return null;
  }

  return mapUserRowToSession(row, session.expiresAt);
}

function mapUserAdminRow(row: UserAdminRow): AdminUserSummary {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role as UserProfile["role"],
    status: row.status === "disabled" ? "disabled" : "active",
    sessionVersion: row.session_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listTenantUsers(tenantId: string) {
  await ensureAuthProvisioning();
  const db = await ensureDatabase();
  const rows = db
    .prepare(
      `SELECT id, email, full_name, role, status, session_version, created_at, updated_at
       FROM users
       WHERE tenant_id = ?
       ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, created_at ASC`,
    )
    .all(tenantId) as UserAdminRow[];

  return rows.map(mapUserAdminRow);
}

async function getTenantUserOrThrow(tenantId: string, userId: string) {
  const db = await ensureDatabase();
  const row = db
    .prepare(`SELECT id, role, status, session_version FROM users WHERE tenant_id = ? AND id = ?`)
    .get(tenantId, userId) as { id: string; role: string; status: string; session_version: number } | undefined;

  if (!row) {
    throw new Error("User not found in tenant.");
  }

  return row;
}

export async function setTenantUserStatus(tenantId: string, actorUserId: string, userId: string, status: "active" | "disabled") {
  const db = await ensureDatabase();
  const target = await getTenantUserOrThrow(tenantId, userId);

  if (actorUserId === userId && status === "disabled") {
    throw new Error("Current user cannot disable themselves.");
  }

  if (target.role === "owner" && status === "disabled") {
    throw new Error("Owner user cannot be disabled from the admin panel.");
  }

  db.prepare(`UPDATE users SET status = ?, updated_at = ? WHERE tenant_id = ? AND id = ?`)
    .run(status, new Date().toISOString(), tenantId, userId);
}

export async function revokeTenantUserSessions(tenantId: string, actorUserId: string, userId: string) {
  const db = await ensureDatabase();
  await getTenantUserOrThrow(tenantId, actorUserId);
  await getTenantUserOrThrow(tenantId, userId);

  db.prepare(`UPDATE users SET session_version = session_version + 1, updated_at = ? WHERE tenant_id = ? AND id = ?`)
    .run(new Date().toISOString(), tenantId, userId);
}
