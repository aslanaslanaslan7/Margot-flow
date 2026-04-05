import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDatabaseConfig } from "@/lib/database-config";
import { AuthSession } from "@/lib/types";

const SESSION_COOKIE = "margot_flow_session";
const DEFAULT_EMAIL = "demo@margotflow.local";
const DEFAULT_PASSWORD = "Demo12345!";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const encoder = new TextEncoder();

const FALLBACK_AUTH_SECRET = "margot-flow-pro-dev-secret-change-me";

function getAuthSecret() {
  return process.env.AUTH_SECRET || FALLBACK_AUTH_SECRET;
}

export function getAuthHealth() {
  const configuredEmail = process.env.DEMO_USER_EMAIL || DEFAULT_EMAIL;
  const configuredPassword = process.env.DEMO_USER_PASSWORD || DEFAULT_PASSWORD;
  const databaseConfig = getDatabaseConfig();
  const usingFallbackSecret = getAuthSecret() === FALLBACK_AUTH_SECRET;
  const usingDefaultCredentials = configuredEmail === DEFAULT_EMAIL && configuredPassword === DEFAULT_PASSWORD;
  const checklist = [
    {
      key: "AUTH_SECRET",
      ready: !usingFallbackSecret,
      message: !usingFallbackSecret ? "Custom auth secret configured." : "Fallback development secret is still active.",
    },
    {
      key: "DEMO_USER_EMAIL",
      ready: configuredEmail !== DEFAULT_EMAIL,
      message: configuredEmail !== DEFAULT_EMAIL ? "Login email customized." : "Default demo email is still active.",
    },
    {
      key: "DEMO_USER_PASSWORD",
      ready: configuredPassword !== DEFAULT_PASSWORD,
      message: configuredPassword !== DEFAULT_PASSWORD ? "Login password customized." : "Default demo password is still active.",
    },
    {
      key: "DATABASE_PROVIDER",
      ready: databaseConfig.provider !== "sqlite",
      message:
        databaseConfig.provider !== "sqlite"
          ? `External database provider configured (${databaseConfig.provider}).`
          : `SQLite fallback in use at ${databaseConfig.sqlitePath}. Postgres/Supabase adapter is still pending.`,
    },
  ];

  return {
    usingFallbackSecret,
    usingDefaultCredentials,
    databaseConfig,
    safeForProduction: checklist.every((item) => item.ready),
    checklist,
  };
}

function toBase64Url(input: string) {
  return Buffer.from(input).toString("base64url");
}

function fromBase64Url(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getAuthSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return Buffer.from(signature).toString("base64url");
}

async function secureCompare(a: string, b: string) {
  const left = encoder.encode(a);
  const right = encoder.encode(b);

  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }

  return diff === 0;
}

export function getAuthConfig() {
  return {
    email: process.env.DEMO_USER_EMAIL || DEFAULT_EMAIL,
    password: process.env.DEMO_USER_PASSWORD || DEFAULT_PASSWORD,
  };
}

export async function createSessionCookie(session: AuthSession) {
  const payload = JSON.stringify(session);
  const encodedPayload = toBase64Url(payload);
  const signature = await sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

function isValidSessionPayload(payload: Partial<AuthSession>): payload is AuthSession {
  if (
    !payload.user?.email ||
    !payload.user?.id ||
    !payload.user?.fullName ||
    !payload.user?.role ||
    !payload.user?.status ||
    typeof payload.user?.sessionVersion !== "number"
  ) {
    return false;
  }

  if (!payload.tenant?.id || !payload.tenant?.slug || !payload.tenant?.name || !payload.tenant?.plan || !payload.tenant?.sector) {
    return false;
  }

  if (typeof payload.expiresAt !== "number" || payload.expiresAt < Date.now()) {
    return false;
  }

  return true;
}

export async function verifySessionCookie(sessionValue?: string | null): Promise<AuthSession | null> {
  if (!sessionValue) {
    return null;
  }

  try {
    const [encodedPayload, signature] = sessionValue.split(".");
    if (!encodedPayload || !signature) {
      return null;
    }

    const expectedSignature = await sign(encodedPayload);
    const valid = await secureCompare(signature, expectedSignature);
    if (!valid) {
      return null;
    }

    const payload = JSON.parse(fromBase64Url(encodedPayload)) as Partial<AuthSession>;
    if (!isValidSessionPayload(payload)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function authenticateUser(email: string, password: string) {
  const loadAuthStore = new Function('return import("@/lib/auth-store")') as () => Promise<{
    authenticateUserAgainstStore: (email: string, password: string, sessionTtlSeconds: number) => Promise<AuthSession | null>;
  }>;
  const { authenticateUserAgainstStore } = await loadAuthStore();
  return authenticateUserAgainstStore(email, password, SESSION_TTL_SECONDS);
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const session = await verifySessionCookie(cookieStore.get(authCookie.name)?.value);

  if (!session) {
    return null;
  }

  const loadAuthStore = new Function('return import("@/lib/auth-store")') as () => Promise<{
    validateSessionAgainstStore: (session: AuthSession) => Promise<AuthSession | null>;
  }>;
  const { validateSessionAgainstStore } = await loadAuthStore();
  return validateSessionAgainstStore(session);
}

export async function requireSession() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export const authCookie = {
  name: SESSION_COOKIE,
  maxAge: SESSION_TTL_SECONDS,
};
