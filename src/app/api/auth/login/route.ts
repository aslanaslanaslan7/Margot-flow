import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { authCookie, authenticateUser, createSessionCookie, getAuthHealth } from "@/lib/auth";
import {
  checkLoginRateLimit,
  clearLoginRateLimit,
  getLoginRateLimitConfig,
  getRateLimitKey,
  registerFailedLogin,
} from "@/lib/login-rate-limit";

export const runtime = "nodejs";

function getClientIpAddress(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") || "unknown";
}

function withSecurityHeaders(response: NextResponse, retryAfterSeconds?: number) {
  const authHealth = getAuthHealth();
  const rateLimitConfig = getLoginRateLimitConfig();

  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Auth-Default-Config", authHealth.safeForProduction ? "hardened" : "demo");
  response.headers.set("X-RateLimit-Limit", String(rateLimitConfig.maxAttempts));

  if (typeof retryAfterSeconds === "number" && retryAfterSeconds > 0) {
    response.headers.set("Retry-After", String(retryAfterSeconds));
  }

  return response;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const next = String(formData.get("next") || "/dashboard");
  const redirectPath = next.startsWith("/") ? next : "/dashboard";
  const clientIp = getClientIpAddress(request);
  const rateLimitKey = getRateLimitKey(email, clientIp);
  const rateLimitStatus = await checkLoginRateLimit(rateLimitKey);

  if (!rateLimitStatus.allowed) {
    return withSecurityHeaders(
      NextResponse.redirect(
        new URL(`/login?error=rate_limited&next=${encodeURIComponent(redirectPath)}`, request.url),
      ),
      rateLimitStatus.retryAfterSeconds,
    );
  }

  const session = await authenticateUser(email, password);
  if (!session) {
    const failedAttempt = await registerFailedLogin(rateLimitKey);
    const errorCode = failedAttempt.allowed ? "invalid_credentials" : "rate_limited";

    return withSecurityHeaders(
      NextResponse.redirect(new URL(`/login?error=${errorCode}&next=${encodeURIComponent(redirectPath)}`, request.url)),
      failedAttempt.retryAfterSeconds,
    );
  }

  await clearLoginRateLimit(rateLimitKey);

  const cookieStore = await cookies();
  cookieStore.set(authCookie.name, await createSessionCookie(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: authCookie.maxAge,
  });

  return withSecurityHeaders(NextResponse.redirect(new URL(redirectPath, request.url)));
}
