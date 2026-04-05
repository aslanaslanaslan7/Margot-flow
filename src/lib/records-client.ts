import { RecordsResponse, RecordItem, WorkspaceSettings } from "@/lib/types";

async function parseResponse(response: Response) {
  const data = (await response.json()) as Partial<RecordsResponse> & { error?: string };

  if (!response.ok) {
    throw new Error(data.error || "Kayıt işlemi başarısız oldu.");
  }

  return {
    records: data.records ?? [],
    activities: data.activities ?? [],
    settings: data.settings ?? getDefaultWorkspaceSettings(),
  };
}

export function getDefaultWorkspaceSettings(): WorkspaceSettings {
  return {
    staleRecordHours: 48,
    highValueThreshold: 5000,
    plannerHorizonDays: 7,
    defaultDailyCapacity: 6,
    businessHoursStart: "09:00",
    businessHoursEnd: "18:00",
  };
}

export async function createRecord(record: RecordItem) {
  const response = await fetch("/api/records", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ record }),
  });

  return parseResponse(response);
}

export async function updateRecord(recordId: string, record: RecordItem) {
  const response = await fetch("/api/records", {
    method: "PUT",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recordId, record }),
  });

  return parseResponse(response);
}

export async function deleteRecord(recordId: string) {
  const response = await fetch(`/api/records?id=${encodeURIComponent(recordId)}`, {
    method: "DELETE",
    cache: "no-store",
  });

  return parseResponse(response);
}

export async function replaceRecords(records: RecordItem[]) {
  const response = await fetch("/api/records", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "replace", records }),
  });

  return parseResponse(response);
}

export async function resetRecords(mode: "seed" | "empty") {
  const response = await fetch("/api/records", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reset", mode }),
  });

  return parseResponse(response);
}

export async function updateWorkspaceSettings(settings: WorkspaceSettings) {
  const response = await fetch("/api/records", {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "update-settings", settings }),
  });

  return parseResponse(response);
}
