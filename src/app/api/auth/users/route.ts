import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loadAuthStore = new Function('return import("@/lib/auth-store")') as () => Promise<{
    listTenantUsers: (tenantId: string) => Promise<unknown[]>;
  }>;
  const { listTenantUsers } = await loadAuthStore();
  const users = await listTenantUsers(session.tenant.id);

  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "owner" && session.user.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    action?: "set-status" | "revoke-sessions";
    userId?: string;
    status?: "active" | "disabled";
  };

  if (!body.userId) {
    return NextResponse.json({ error: "User id is required" }, { status: 400 });
  }

  const loadAuthStore = new Function('return import("@/lib/auth-store")') as () => Promise<{
    listTenantUsers: (tenantId: string) => Promise<unknown[]>;
    setTenantUserStatus: (tenantId: string, actorUserId: string, userId: string, status: "active" | "disabled") => Promise<void>;
    revokeTenantUserSessions: (tenantId: string, actorUserId: string, userId: string) => Promise<void>;
  }>;
  const { listTenantUsers, revokeTenantUserSessions, setTenantUserStatus } = await loadAuthStore();

  if (body.action === "set-status") {
    if (body.status !== "active" && body.status !== "disabled") {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    await setTenantUserStatus(session.tenant.id, session.user.id, body.userId, body.status);
    return NextResponse.json({ users: await listTenantUsers(session.tenant.id) });
  }

  if (body.action === "revoke-sessions") {
    await revokeTenantUserSessions(session.tenant.id, session.user.id, body.userId);
    return NextResponse.json({ users: await listTenantUsers(session.tenant.id) });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
