import { DatabaseSync } from "node:sqlite";
import { assignees, leadSources, records as seedRecords, serviceStages } from "@/lib/demo-data";
import { AuthSession, RecordActivity, RecordActivityType, RecordItem, RecordsResponse, WorkspaceSettings } from "@/lib/types";
import { columnExists, getDatabase } from "@/lib/database";
const ACTIVITY_LIMIT = 40;
const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  staleRecordHours: 48,
  highValueThreshold: 5000,
  plannerHorizonDays: 7,
  defaultDailyCapacity: 6,
  businessHoursStart: "09:00",
  businessHoursEnd: "18:00",
};

type RecordRow = {
  id: string;
  tenant_id: string;
  customer: string;
  phone: string;
  sector: string;
  source: string;
  assignee: string;
  title: string;
  status: string;
  service_stage: string;
  date: string;
  amount: string;
  note: string;
  position: number;
  created_at: string;
  updated_at: string;
};

type ActivityRow = {
  id: string;
  tenant_id: string;
  record_id: string | null;
  record_customer: string;
  type: string;
  summary: string;
  created_at: string;
};

type WorkspaceSettingsRow = {
  tenant_id: string;
  stale_record_hours: number;
  high_value_threshold: number;
  planner_horizon_days: number;
  default_daily_capacity: number;
  business_hours_start: string;
  business_hours_end: string;
  created_at: string;
  updated_at: string;
};

function cloneSeedRecords() {
  return seedRecords.map((record) => ({ ...record }));
}

function clampInteger(value: unknown, min: number, max: number, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeBusinessHour(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return fallback;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function normalizeWorkspaceSettings(settings?: Partial<WorkspaceSettings> | null): WorkspaceSettings {
  const businessHoursStart = normalizeBusinessHour(settings?.businessHoursStart, DEFAULT_WORKSPACE_SETTINGS.businessHoursStart);
  const businessHoursEnd = normalizeBusinessHour(settings?.businessHoursEnd, DEFAULT_WORKSPACE_SETTINGS.businessHoursEnd);
  const safeBusinessHoursEnd = toMinutes(businessHoursEnd) > toMinutes(businessHoursStart) ? businessHoursEnd : DEFAULT_WORKSPACE_SETTINGS.businessHoursEnd;

  return {
    staleRecordHours: clampInteger(settings?.staleRecordHours, 6, 168, DEFAULT_WORKSPACE_SETTINGS.staleRecordHours),
    highValueThreshold: clampInteger(settings?.highValueThreshold, 500, 500000, DEFAULT_WORKSPACE_SETTINGS.highValueThreshold),
    plannerHorizonDays: clampInteger(settings?.plannerHorizonDays, 3, 30, DEFAULT_WORKSPACE_SETTINGS.plannerHorizonDays),
    defaultDailyCapacity: clampInteger(settings?.defaultDailyCapacity, 1, 40, DEFAULT_WORKSPACE_SETTINGS.defaultDailyCapacity),
    businessHoursStart,
    businessHoursEnd: safeBusinessHoursEnd,
  };
}

function ensureRecordColumns(db: DatabaseSync) {
  const migrations: Array<{ column: string; sql: string }> = [
    { column: "phone", sql: "ALTER TABLE records ADD COLUMN phone TEXT NOT NULL DEFAULT ''" },
    { column: "source", sql: `ALTER TABLE records ADD COLUMN source TEXT NOT NULL DEFAULT '${leadSources[leadSources.length - 1]}'` },
    { column: "assignee", sql: `ALTER TABLE records ADD COLUMN assignee TEXT NOT NULL DEFAULT '${assignees[assignees.length - 1]}'` },
    { column: "service_stage", sql: `ALTER TABLE records ADD COLUMN service_stage TEXT NOT NULL DEFAULT '${serviceStages[0]}'` },
    { column: "created_at", sql: "ALTER TABLE records ADD COLUMN created_at TEXT NOT NULL DEFAULT ''" },
    { column: "updated_at", sql: "ALTER TABLE records ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''" },
  ];

  migrations.forEach(({ column, sql }) => {
    if (!columnExists(db, "records", column)) db.exec(sql);
  });
}

function ensureWorkspaceSettingsColumns(db: DatabaseSync) {
  const migrations: Array<{ column: string; sql: string }> = [
    { column: "default_daily_capacity", sql: `ALTER TABLE workspace_settings ADD COLUMN default_daily_capacity INTEGER NOT NULL DEFAULT ${DEFAULT_WORKSPACE_SETTINGS.defaultDailyCapacity}` },
    { column: "business_hours_start", sql: `ALTER TABLE workspace_settings ADD COLUMN business_hours_start TEXT NOT NULL DEFAULT '${DEFAULT_WORKSPACE_SETTINGS.businessHoursStart}'` },
    { column: "business_hours_end", sql: `ALTER TABLE workspace_settings ADD COLUMN business_hours_end TEXT NOT NULL DEFAULT '${DEFAULT_WORKSPACE_SETTINGS.businessHoursEnd}'` },
  ];

  migrations.forEach(({ column, sql }) => {
    if (!columnExists(db, "workspace_settings", column)) db.exec(sql);
  });
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

    CREATE INDEX IF NOT EXISTS idx_records_tenant_position ON records(tenant_id, position);
    CREATE INDEX IF NOT EXISTS idx_records_tenant_status ON records(tenant_id, status);
    CREATE INDEX IF NOT EXISTS idx_record_activity_tenant_created ON record_activity(tenant_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_record_activity_record_created ON record_activity(tenant_id, record_id, created_at DESC);
  `);

  ensureRecordColumns(db);
  ensureWorkspaceSettingsColumns(db);
  return db;
}

function normalizeRecord(record: RecordItem): RecordItem {
  const createdAt = record.createdAt?.trim() || new Date().toISOString();
  const updatedAt = record.updatedAt?.trim() || createdAt;
  const serviceStage = (serviceStages.includes(record.serviceStage) ? record.serviceStage : "Keşif") as RecordItem["serviceStage"];

  return {
    id: record.id.trim(),
    customer: record.customer.trim(),
    phone: record.phone.trim(),
    sector: record.sector.trim(),
    source: record.source.trim() || "Diğer",
    assignee: record.assignee.trim() || "Operasyon",
    title: record.title.trim(),
    status: record.status.trim() as RecordItem["status"],
    serviceStage,
    date: record.date.trim(),
    amount: record.amount.trim(),
    note: record.note.trim(),
    createdAt,
    updatedAt,
  };
}

function mapRowToRecord(row: RecordRow): RecordItem {
  return {
    id: row.id,
    customer: row.customer,
    phone: row.phone || "",
    sector: row.sector,
    source: row.source || "Diğer",
    assignee: row.assignee || "Operasyon",
    title: row.title,
    status: row.status as RecordItem["status"],
    serviceStage: (serviceStages.includes(row.service_stage) ? row.service_stage : "Keşif") as RecordItem["serviceStage"],
    date: row.date,
    amount: row.amount,
    note: row.note,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

function mapActivityRow(row: ActivityRow): RecordActivity {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    recordId: row.record_id,
    recordCustomer: row.record_customer,
    type: row.type as RecordActivityType,
    summary: row.summary,
    createdAt: row.created_at,
  };
}

function mapSettingsRow(row: WorkspaceSettingsRow | undefined): WorkspaceSettings {
  if (!row) return DEFAULT_WORKSPACE_SETTINGS;
  return normalizeWorkspaceSettings({
    staleRecordHours: row.stale_record_hours,
    highValueThreshold: row.high_value_threshold,
    plannerHorizonDays: row.planner_horizon_days,
    defaultDailyCapacity: row.default_daily_capacity,
    businessHoursStart: row.business_hours_start,
    businessHoursEnd: row.business_hours_end,
  });
}

export function isRecordItem(value: unknown): value is RecordItem {
  if (!value || typeof value !== "object") return false;

  const item = value as Record<string, unknown>;
  return ["id", "customer", "phone", "sector", "source", "assignee", "title", "status", "serviceStage", "date", "amount", "note", "createdAt", "updatedAt"].every(
    (key) => typeof item[key] === "string",
  );
}

export function isWorkspaceSettings(value: unknown): value is WorkspaceSettings {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return ["staleRecordHours", "highValueThreshold", "plannerHorizonDays", "defaultDailyCapacity"].every((key) => typeof item[key] === "number")
    && ["businessHoursStart", "businessHoursEnd"].every((key) => typeof item[key] === "string");
}

function createActivityId() {
  return `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

async function ensureTenant(session: AuthSession) {
  const db = await ensureDatabase();
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
  ).run(session.tenant.id, session.tenant.slug, session.tenant.name, session.tenant.plan, session.tenant.sector, now, now);

  const defaultSettings = normalizeWorkspaceSettings();
  db.prepare(
    `INSERT INTO workspace_settings (tenant_id, stale_record_hours, high_value_threshold, planner_horizon_days, default_daily_capacity, business_hours_start, business_hours_end, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tenant_id) DO NOTHING`,
  ).run(
    session.tenant.id,
    defaultSettings.staleRecordHours,
    defaultSettings.highValueThreshold,
    defaultSettings.plannerHorizonDays,
    defaultSettings.defaultDailyCapacity,
    defaultSettings.businessHoursStart,
    defaultSettings.businessHoursEnd,
    now,
    now,
  );

  const countRow = db.prepare("SELECT COUNT(*) as count FROM records WHERE tenant_id = ?").get(session.tenant.id) as { count: number };
  if (countRow.count > 0) {
    db.prepare(
      `UPDATE records
       SET phone = COALESCE(phone, ''),
           source = CASE WHEN TRIM(COALESCE(source, '')) = '' THEN 'Diğer' ELSE source END,
           assignee = CASE WHEN TRIM(COALESCE(assignee, '')) = '' THEN 'Operasyon' ELSE assignee END,
           service_stage = CASE WHEN TRIM(COALESCE(service_stage, '')) = '' THEN 'Keşif' ELSE service_stage END,
           created_at = CASE WHEN TRIM(COALESCE(created_at, '')) = '' THEN ? ELSE created_at END,
           updated_at = CASE WHEN TRIM(COALESCE(updated_at, '')) = '' THEN COALESCE(NULLIF(created_at, ''), ?) ELSE updated_at END
       WHERE tenant_id = ?`,
    ).run(now, now, session.tenant.id);
    return db;
  }

  const insertSeed = db.prepare(
    `INSERT INTO records (id, tenant_id, customer, phone, sector, source, assignee, title, status, service_stage, date, amount, note, position, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const insertMany = db.transaction((records: RecordItem[]) => {
    records.forEach((record, index) => {
      const normalized = normalizeRecord(record);
      insertSeed.run(
        normalized.id,
        session.tenant.id,
        normalized.customer,
        normalized.phone,
        normalized.sector,
        normalized.source,
        normalized.assignee,
        normalized.title,
        normalized.status,
        normalized.serviceStage,
        normalized.date,
        normalized.amount,
        normalized.note,
        index,
        normalized.createdAt,
        normalized.updatedAt,
      );
    });
  });

  insertMany(cloneSeedRecords());
  return db;
}

function getChangeSummary(previous: RecordItem, next: RecordItem) {
  const changes: string[] = [];
  if (previous.status !== next.status) changes.push(`durum ${previous.status} → ${next.status}`);
  if (previous.assignee !== next.assignee) changes.push(`sorumlu ${previous.assignee || "-"} → ${next.assignee || "-"}`);
  if (previous.serviceStage !== next.serviceStage) changes.push(`servis aşaması ${previous.serviceStage} → ${next.serviceStage}`);
  if (previous.date !== next.date) changes.push(`tarih ${previous.date || "-"} → ${next.date || "-"}`);
  if (previous.amount !== next.amount) changes.push(`tutar ${previous.amount || "-"} → ${next.amount || "-"}`);
  if (previous.source !== next.source) changes.push(`kaynak ${previous.source || "-"} → ${next.source || "-"}`);
  if (previous.phone !== next.phone) changes.push("telefon güncellendi");
  if (previous.title !== next.title) changes.push("iş başlığı güncellendi");
  if (previous.note !== next.note) changes.push("not güncellendi");
  if (!changes.length) return "Kayıt tekrar kaydedildi; alan değişikliği tespit edilmedi.";
  return `Güncellendi: ${changes.slice(0, 4).join(", ")}${changes.length > 4 ? "…" : ""}`;
}

function getSettingsChangeSummary(previous: WorkspaceSettings, next: WorkspaceSettings) {
  const changes: string[] = [];
  if (previous.staleRecordHours !== next.staleRecordHours) changes.push(`sessiz kayıt eşiği ${previous.staleRecordHours} sa → ${next.staleRecordHours} sa`);
  if (previous.highValueThreshold !== next.highValueThreshold) changes.push(`yüksek değer eşiği ₺${previous.highValueThreshold} → ₺${next.highValueThreshold}`);
  if (previous.plannerHorizonDays !== next.plannerHorizonDays) changes.push(`planner ufku ${previous.plannerHorizonDays} gün → ${next.plannerHorizonDays} gün`);
  if (previous.defaultDailyCapacity !== next.defaultDailyCapacity) changes.push(`günlük kapasite ${previous.defaultDailyCapacity} iş → ${next.defaultDailyCapacity} iş`);
  if (previous.businessHoursStart !== next.businessHoursStart || previous.businessHoursEnd !== next.businessHoursEnd) changes.push(`çalışma saati ${previous.businessHoursStart}-${previous.businessHoursEnd} → ${next.businessHoursStart}-${next.businessHoursEnd}`);
  return changes.length ? `Workspace ayarları güncellendi: ${changes.join(", ")}` : "Workspace ayarları tekrar kaydedildi; görünür bir fark yok.";
}

async function insertActivity(
  session: AuthSession,
  input: { recordId?: string | null; recordCustomer: string; type: RecordActivityType; summary: string; createdAt?: string },
) {
  const db = await ensureTenant(session);
  db.prepare(
    `INSERT INTO record_activity (id, tenant_id, record_id, record_customer, type, summary, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(createActivityId(), session.tenant.id, input.recordId ?? null, input.recordCustomer, input.type, input.summary, input.createdAt ?? new Date().toISOString());

  db.prepare(
    `DELETE FROM record_activity
     WHERE tenant_id = ?
       AND id NOT IN (
         SELECT id FROM record_activity WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?
       )`,
  ).run(session.tenant.id, session.tenant.id, ACTIVITY_LIMIT);
}

export async function getTenantRecords(session: AuthSession) {
  const db = await ensureTenant(session);
  const rows = db
    .prepare(
      `SELECT id, tenant_id, customer, phone, sector, source, assignee, title, status, service_stage, date, amount, note, position, created_at, updated_at
       FROM records
       WHERE tenant_id = ?
       ORDER BY position ASC, updated_at DESC`,
    )
    .all(session.tenant.id) as RecordRow[];

  return rows.map(mapRowToRecord);
}

export async function getTenantActivities(session: AuthSession, limit = 20) {
  const db = await ensureTenant(session);
  const rows = db
    .prepare(
      `SELECT id, tenant_id, record_id, record_customer, type, summary, created_at
       FROM record_activity
       WHERE tenant_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .all(session.tenant.id, limit) as ActivityRow[];

  return rows.map(mapActivityRow);
}

export async function getTenantSettings(session: AuthSession) {
  const db = await ensureTenant(session);
  const row = db
    .prepare(
      `SELECT tenant_id, stale_record_hours, high_value_threshold, planner_horizon_days, default_daily_capacity, business_hours_start, business_hours_end, created_at, updated_at
       FROM workspace_settings
       WHERE tenant_id = ?`,
    )
    .get(session.tenant.id) as WorkspaceSettingsRow | undefined;

  return mapSettingsRow(row);
}

export async function getTenantWorkspace(session: AuthSession): Promise<RecordsResponse> {
  const [records, activities, settings] = await Promise.all([getTenantRecords(session), getTenantActivities(session), getTenantSettings(session)]);
  return { records, activities, settings };
}

export async function replaceTenantRecords(session: AuthSession, records: RecordItem[]) {
  const db = await ensureTenant(session);

  const replaceAll = db.transaction((nextRecords: RecordItem[]) => {
    db.prepare("DELETE FROM records WHERE tenant_id = ?").run(session.tenant.id);
    const insert = db.prepare(
      `INSERT INTO records (id, tenant_id, customer, phone, sector, source, assignee, title, status, service_stage, date, amount, note, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );

    nextRecords.forEach((record, index) => {
      const normalized = normalizeRecord(record);
      insert.run(
        normalized.id,
        session.tenant.id,
        normalized.customer,
        normalized.phone,
        normalized.sector,
        normalized.source,
        normalized.assignee,
        normalized.title,
        normalized.status,
        normalized.serviceStage,
        normalized.date,
        normalized.amount,
        normalized.note,
        index,
        normalized.createdAt,
        normalized.updatedAt,
      );
    });
  });

  replaceAll(records);
  return getTenantRecords(session);
}

export async function createTenantRecord(session: AuthSession, record: RecordItem) {
  const current = await getTenantRecords(session);
  const now = new Date().toISOString();
  const normalized = normalizeRecord({ ...record, createdAt: record.createdAt || now, updatedAt: record.updatedAt || now });
  await replaceTenantRecords(session, [normalized, ...current]);
  await insertActivity(session, {
    recordId: normalized.id,
    recordCustomer: normalized.customer,
    type: "created",
    summary: `${normalized.customer} için yeni kayıt oluşturuldu (${normalized.status}).`,
    createdAt: normalized.updatedAt,
  });
  return getTenantWorkspace(session);
}

export async function updateTenantRecord(session: AuthSession, recordId: string, patch: RecordItem) {
  const current = await getTenantRecords(session);
  const existing = current.find((record) => record.id === recordId);
  const updatedAt = new Date().toISOString();
  const next = current.map((record) =>
    record.id !== recordId
      ? record
      : normalizeRecord({
          ...patch,
          createdAt: existing?.createdAt || patch.createdAt,
          updatedAt,
        }),
  );

  const updatedRecord = next.find((record) => record.id === recordId);
  await replaceTenantRecords(session, next);

  if (existing && updatedRecord) {
    await insertActivity(session, {
      recordId: updatedRecord.id,
      recordCustomer: updatedRecord.customer,
      type: "updated",
      summary: getChangeSummary(existing, updatedRecord),
      createdAt: updatedRecord.updatedAt,
    });
  }

  return getTenantWorkspace(session);
}

export async function deleteTenantRecord(session: AuthSession, recordId: string) {
  const current = await getTenantRecords(session);
  const deletedRecord = current.find((record) => record.id === recordId);
  await replaceTenantRecords(session, current.filter((record) => record.id !== recordId));

  if (deletedRecord) {
    await insertActivity(session, {
      recordId: deletedRecord.id,
      recordCustomer: deletedRecord.customer,
      type: "deleted",
      summary: `${deletedRecord.customer} kaydı listeden kaldırıldı.`,
    });
  }

  return getTenantWorkspace(session);
}

export async function resetTenantRecords(session: AuthSession, mode: "seed" | "empty") {
  await replaceTenantRecords(session, mode === "seed" ? cloneSeedRecords() : []);
  await insertActivity(session, {
    recordId: null,
    recordCustomer: mode === "seed" ? "Demo veri" : "Boş workspace",
    type: "reset",
    summary: mode === "seed" ? "Tenant kayıtları demo veriyle yeniden kuruldu." : "Tenant kayıtları tamamen temizlendi.",
  });
  return getTenantWorkspace(session);
}

export async function replaceTenantWorkspace(session: AuthSession, records: RecordItem[]) {
  await replaceTenantRecords(session, records);
  await insertActivity(session, {
    recordId: null,
    recordCustomer: "Toplu aktarım",
    type: "replaced",
    summary: `${records.length} kayıtla toplu içeri aktarma uygulandı.`,
  });
  return getTenantWorkspace(session);
}

export async function updateTenantSettings(session: AuthSession, settings: WorkspaceSettings) {
  const db = await ensureTenant(session);
  const current = await getTenantSettings(session);
  const next = normalizeWorkspaceSettings(settings);
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE workspace_settings
     SET stale_record_hours = ?, high_value_threshold = ?, planner_horizon_days = ?, default_daily_capacity = ?, business_hours_start = ?, business_hours_end = ?, updated_at = ?
     WHERE tenant_id = ?`,
  ).run(next.staleRecordHours, next.highValueThreshold, next.plannerHorizonDays, next.defaultDailyCapacity, next.businessHoursStart, next.businessHoursEnd, now, session.tenant.id);

  await insertActivity(session, {
    recordId: null,
    recordCustomer: "Workspace ayarları",
    type: "settings_updated",
    summary: getSettingsChangeSummary(current, next),
    createdAt: now,
  });

  return getTenantWorkspace(session);
}
