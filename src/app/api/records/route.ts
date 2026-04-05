import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/auth";
import {
  createTenantRecord,
  deleteTenantRecord,
  getTenantWorkspace,
  isRecordItem,
  isWorkspaceSettings,
  replaceTenantWorkspace,
  resetTenantRecords,
  updateTenantRecord,
  updateTenantSettings,
} from "@/lib/records-store";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workspace = await getTenantWorkspace(session);
  return NextResponse.json(workspace);
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    action?: string;
    record?: unknown;
    records?: unknown;
    settings?: unknown;
    mode?: "seed" | "empty";
  };

  if (body.action === "reset") {
    const workspace = await resetTenantRecords(session, body.mode === "empty" ? "empty" : "seed");
    return NextResponse.json(workspace);
  }

  if (body.action === "replace") {
    if (!Array.isArray(body.records) || !body.records.every(isRecordItem)) {
      return NextResponse.json({ error: "Invalid records payload" }, { status: 400 });
    }

    const workspace = await replaceTenantWorkspace(session, body.records);
    return NextResponse.json(workspace);
  }

  if (body.action === "update-settings") {
    if (!isWorkspaceSettings(body.settings)) {
      return NextResponse.json({ error: "Invalid workspace settings payload" }, { status: 400 });
    }

    const workspace = await updateTenantSettings(session, body.settings);
    return NextResponse.json(workspace);
  }

  if (!isRecordItem(body.record)) {
    return NextResponse.json({ error: "Invalid record payload" }, { status: 400 });
  }

  const workspace = await createTenantRecord(session, body.record);
  return NextResponse.json(workspace, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { recordId?: string; record?: unknown };
  if (!body.recordId || !isRecordItem(body.record)) {
    return NextResponse.json({ error: "Invalid update payload" }, { status: 400 });
  }

  const workspace = await updateTenantRecord(session, body.recordId, body.record);
  return NextResponse.json(workspace);
}

export async function DELETE(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const recordId = request.nextUrl.searchParams.get("id");
  if (!recordId) {
    return NextResponse.json({ error: "Record id is required" }, { status: 400 });
  }

  const workspace = await deleteTenantRecord(session, recordId);
  return NextResponse.json(workspace);
}
