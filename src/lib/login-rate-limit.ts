import { DatabaseSync } from "node:sqlite";
import { getDatabase } from "@/lib/database";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;

type AttemptRow = {
  key: string;
  count: number;
  first_attempt_at: number;
  locked_until: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  remainingAttempts: number;
};

function getNow() {
  return Date.now();
}

async function ensureDatabase() {
  const db = await getDatabase();
  db.exec(`
    CREATE TABLE IF NOT EXISTS login_rate_limits (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      first_attempt_at INTEGER NOT NULL,
      locked_until INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_login_rate_limits_updated_at ON login_rate_limits(updated_at);
    CREATE INDEX IF NOT EXISTS idx_login_rate_limits_locked_until ON login_rate_limits(locked_until);
  `);

  return db;
}

async function pruneExpiredState(db: DatabaseSync, now: number) {
  db.prepare(
    `DELETE FROM login_rate_limits
     WHERE (locked_until = 0 AND ? - first_attempt_at > ?)
        OR (locked_until > 0 AND locked_until <= ?)`,
  ).run(now, WINDOW_MS, now);
}

export function getRateLimitKey(email: string, ipAddress: string) {
  return `${ipAddress}:${email || "unknown"}`;
}

export async function checkLoginRateLimit(key: string): Promise<RateLimitResult> {
  const now = getNow();
  const db = await ensureDatabase();
  await pruneExpiredState(db, now);

  const state = db
    .prepare(`SELECT key, count, first_attempt_at, locked_until FROM login_rate_limits WHERE key = ?`)
    .get(key) as AttemptRow | undefined;

  if (!state) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remainingAttempts: MAX_ATTEMPTS,
    };
  }

  if (state.locked_until > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((state.locked_until - now) / 1000),
      remainingAttempts: 0,
    };
  }

  if (now - state.first_attempt_at > WINDOW_MS) {
    db.prepare(`DELETE FROM login_rate_limits WHERE key = ?`).run(key);
    return {
      allowed: true,
      retryAfterSeconds: 0,
      remainingAttempts: MAX_ATTEMPTS,
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - state.count),
  };
}

export async function registerFailedLogin(key: string): Promise<RateLimitResult> {
  const now = getNow();
  const db = await ensureDatabase();
  await pruneExpiredState(db, now);

  const current = db
    .prepare(`SELECT key, count, first_attempt_at, locked_until FROM login_rate_limits WHERE key = ?`)
    .get(key) as AttemptRow | undefined;

  if (!current || now - current.first_attempt_at > WINDOW_MS) {
    db.prepare(
      `INSERT INTO login_rate_limits (key, count, first_attempt_at, locked_until, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         count = excluded.count,
         first_attempt_at = excluded.first_attempt_at,
         locked_until = excluded.locked_until,
         updated_at = excluded.updated_at`,
    ).run(key, 1, now, 0, now);

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remainingAttempts: MAX_ATTEMPTS - 1,
    };
  }

  const nextCount = current.count + 1;
  const lockedUntil = nextCount >= MAX_ATTEMPTS ? now + LOCKOUT_MS : 0;

  db.prepare(
    `UPDATE login_rate_limits
     SET count = ?, locked_until = ?, updated_at = ?
     WHERE key = ?`,
  ).run(nextCount, lockedUntil, now, key);

  return {
    allowed: lockedUntil === 0,
    retryAfterSeconds: lockedUntil ? Math.ceil((lockedUntil - now) / 1000) : 0,
    remainingAttempts: Math.max(0, MAX_ATTEMPTS - nextCount),
  };
}

export async function clearLoginRateLimit(key: string) {
  const db = await ensureDatabase();
  db.prepare(`DELETE FROM login_rate_limits WHERE key = ?`).run(key);
}

export function getLoginRateLimitConfig() {
  return {
    maxAttempts: MAX_ATTEMPTS,
    windowMs: WINDOW_MS,
    lockoutMs: LOCKOUT_MS,
  };
}
