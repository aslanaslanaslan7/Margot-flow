"use client";

import { assignees, leadSources, sectors, serviceStages, statuses } from "@/lib/demo-data";
import { getDefaultWorkspaceSettings, replaceRecords, resetRecords, updateWorkspaceSettings } from "@/lib/records-client";
import { parseAmount, parseRecordDate } from "@/lib/record-analytics";
import { RecordItem, RecordsResponse, UserRole, WorkspaceSettings } from "@/lib/types";
import { AdminUserSummary } from "@/types/admin";
import { useRouter } from "next/navigation";
import { ChangeEvent, useMemo, useRef, useState } from "react";

type ImportState =
  | { kind: "idle" }
  | { kind: "success"; message: string }
  | { kind: "error"; message: string };

type LegacyImportRecord = Partial<Record<keyof RecordItem, unknown>> & {
  id?: unknown;
  customer?: unknown;
  sector?: unknown;
  title?: unknown;
  status?: unknown;
  date?: unknown;
  amount?: unknown;
  note?: unknown;
};

function isLegacyImportRecord(value: unknown): value is LegacyImportRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return ["id", "customer", "sector", "title", "status", "date", "amount", "note"].every((key) => typeof item[key] === "string");
}

function normalizeImportedRecord(value: LegacyImportRecord): RecordItem {
  const now = new Date().toISOString();

  return {
    id: String(value.id ?? "").trim(),
    customer: String(value.customer ?? "").trim(),
    phone: typeof value.phone === "string" ? value.phone.trim() : "",
    sector: String(value.sector ?? "").trim(),
    source: typeof value.source === "string" && value.source.trim() ? value.source.trim() : leadSources[leadSources.length - 1],
    assignee: typeof value.assignee === "string" && value.assignee.trim() ? value.assignee.trim() : assignees[assignees.length - 1],
    title: String(value.title ?? "").trim(),
    status: String(value.status ?? "").trim() as RecordItem["status"],
    serviceStage:
      (typeof value.serviceStage === "string" && serviceStages.includes(value.serviceStage)
        ? value.serviceStage
        : serviceStages[0]) as RecordItem["serviceStage"],
    date: String(value.date ?? "").trim(),
    amount: String(value.amount ?? "").trim(),
    note: String(value.note ?? "").trim(),
    createdAt: typeof value.createdAt === "string" && value.createdAt.trim() ? value.createdAt.trim() : now,
    updatedAt: typeof value.updatedAt === "string" && value.updatedAt.trim() ? value.updatedAt.trim() : now,
  };
}

type AuthHealth = {
  usingFallbackSecret: boolean;
  usingDefaultCredentials: boolean;
  safeForProduction: boolean;
  checklist: { key: string; ready: boolean; message: string }[];
};

export function SettingsClient({ initialRecords, initialSettings, authHealth, initialUsers, currentUserId, currentUserRole }: { initialRecords: RecordItem[]; initialSettings: WorkspaceSettings; authHealth: AuthHealth; initialUsers: AdminUserSummary[]; currentUserId: string; currentUserRole: UserRole }) {
  const router = useRouter();
  const [records, setRecords] = useState<RecordItem[]>(initialRecords);
  const [settings, setSettings] = useState<WorkspaceSettings>(initialSettings ?? getDefaultWorkspaceSettings());
  const [importState, setImportState] = useState<ImportState>({ kind: "idle" });
  const [users, setUsers] = useState<AdminUserSummary[]>(initialUsers);
  const [userActionState, setUserActionState] = useState<ImportState>({ kind: "idle" });
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const metrics = useMemo(() => {
    const duplicates = new Set<string>();
    const seen = new Set<string>();
    let scheduled = 0;
    let unscheduled = 0;
    let completed = 0;
    let open = 0;
    let missingAmount = 0;
    const sectorCounts = new Map<string, number>();
    const statusCounts = new Map<string, number>();
    let totalPotential = 0;

    records.forEach((record) => {
      if (seen.has(record.id)) duplicates.add(record.id);
      seen.add(record.id);

      const parsedDate = parseRecordDate(record.date);
      const parsedAmount = parseAmount(record.amount);

      if (parsedDate) scheduled += 1;
      else unscheduled += 1;

      if (!record.amount.trim()) missingAmount += 1;
      if (record.status === "Tamamlandı") completed += 1;
      else open += 1;

      totalPotential += parsedAmount;
      sectorCounts.set(record.sector, (sectorCounts.get(record.sector) ?? 0) + 1);
      statusCounts.set(record.status, (statusCounts.get(record.status) ?? 0) + 1);
    });

    const missingSectorDefinitions = [...sectorCounts.keys()].filter((sector) => !sectors.includes(sector));
    const missingStatusDefinitions = [...statusCounts.keys()].filter((status) => !statuses.includes(status));

    return {
      total: records.length,
      scheduled,
      unscheduled,
      completed,
      open,
      missingAmount,
      duplicateIds: [...duplicates],
      totalPotential,
      sectorCounts: [...sectorCounts.entries()].sort((a, b) => b[1] - a[1]),
      statusCounts: [...statusCounts.entries()].sort((a, b) => b[1] - a[1]),
      missingSectorDefinitions,
      missingStatusDefinitions,
      healthScore: Math.max(0, 100 - duplicates.size * 25 - unscheduled * 8 - missingAmount * 4 - missingSectorDefinitions.length * 12 - missingStatusDefinitions.length * 12),
    };
  }, [records]);

  async function applyWorkspaceMutation(nextAction: () => Promise<RecordsResponse>, successMessage: string) {
    try {
      const next = await nextAction();
      setRecords(next.records);
      setSettings(next.settings);
      setImportState({ kind: "success", message: successMessage });
      router.refresh();
    } catch (error) {
      setImportState({ kind: "error", message: error instanceof Error ? error.message : "Workspace işlemi başarısız oldu." });
    }
  }

  function restoreDemoData() {
    void applyWorkspaceMutation(() => resetRecords("seed"), "Demo verisi server store üzerinden geri yüklendi.");
  }

  function clearWorkspace() {
    void applyWorkspaceMutation(() => resetRecords("empty"), "Tenant workspace'i temizlendi.");
  }

  function exportRecords() {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: "margot-flow-pro",
      version: 2,
      settings,
      records,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `margot-flow-pro-workspace-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setImportState({ kind: "success", message: "Workspace JSON dışa aktarıldı." });
  }

  async function importRecords(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as { records?: unknown; settings?: unknown } | unknown[];
      const incoming = Array.isArray(parsed) ? parsed : parsed.records;

      if (!Array.isArray(incoming) || !incoming.every(isLegacyImportRecord)) {
        throw new Error("Dosya biçimi desteklenmiyor. Beklenen yapı: legacy veya güncel kayıt listesi içeren JSON snapshot.");
      }

      const normalized = incoming.map(normalizeImportedRecord);
      await applyWorkspaceMutation(() => replaceRecords(normalized), `${normalized.length} kayıt server store'a aktarıldı.`);

      if (!Array.isArray(parsed) && parsed.settings && typeof parsed.settings === "object") {
        const snapshotSettings = parsed.settings as Record<string, unknown>;
        const merged = {
          staleRecordHours: Number(snapshotSettings.staleRecordHours ?? settings.staleRecordHours),
          highValueThreshold: Number(snapshotSettings.highValueThreshold ?? settings.highValueThreshold),
          plannerHorizonDays: Number(snapshotSettings.plannerHorizonDays ?? settings.plannerHorizonDays),
          defaultDailyCapacity: Number(snapshotSettings.defaultDailyCapacity ?? settings.defaultDailyCapacity),
          businessHoursStart: typeof snapshotSettings.businessHoursStart === "string" ? snapshotSettings.businessHoursStart : settings.businessHoursStart,
          businessHoursEnd: typeof snapshotSettings.businessHoursEnd === "string" ? snapshotSettings.businessHoursEnd : settings.businessHoursEnd,
        };
        await applyWorkspaceMutation(() => updateWorkspaceSettings(merged), "Workspace ayarları da snapshot içinden geri yüklendi.");
      }
    } catch (error) {
      setImportState({ kind: "error", message: error instanceof Error ? error.message : "İçe aktarma başarısız oldu." });
    } finally {
      event.target.value = "";
    }
  }

  const canManageUsers = currentUserRole === "owner" || currentUserRole === "manager";

  async function runUserAdminAction(payload: { action: "set-status"; userId: string; status: "active" | "disabled" } | { action: "revoke-sessions"; userId: string }, successMessage: string) {
    setPendingUserId(payload.userId);
    try {
      const response = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string; users?: AdminUserSummary[] };
      if (!response.ok) {
        throw new Error(data.error || "Kullanıcı işlemi başarısız oldu.");
      }

      setUsers(data.users ?? []);
      setUserActionState({ kind: "success", message: successMessage });
      router.refresh();
    } catch (error) {
      setUserActionState({ kind: "error", message: error instanceof Error ? error.message : "Kullanıcı işlemi başarısız oldu." });
    } finally {
      setPendingUserId(null);
    }
  }

  function updateNumberSetting(key: keyof WorkspaceSettings, value: string) {
    const numeric = Number(value);
    setSettings((current) => ({ ...current, [key]: Number.isFinite(numeric) ? numeric : current[key] }));
  }

  function saveSettings() {
    void applyWorkspaceMutation(() => updateWorkspaceSettings(settings), "Planner, dashboard, kapasite ve mesai ayarları tenant bazında kaydedildi.");
  }

  function resetSettingsToDefault() {
    const defaults = getDefaultWorkspaceSettings();
    setSettings(defaults);
    void applyWorkspaceMutation(() => updateWorkspaceSettings(defaults), "Workspace eşikleri varsayılana döndürüldü.");
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Workspace sağlık skoru" value={String(metrics.healthScore)} sub="Veri bütünlüğü + plan netliği" tone="highlight" />
        <StatCard label="Toplam kayıt" value={String(metrics.total)} sub="Tenant store'daki aktif kayıtlar" />
        <StatCard label="Planlı kayıt" value={String(metrics.scheduled)} sub="Planner ekranında görünür" />
        <StatCard label="Açık potansiyel" value={formatCurrency(metrics.totalPotential)} sub="Parse edilebilen toplam tutar" />
      </section>

      <section className={`rounded-[28px] border p-6 backdrop-blur sm:p-8 ${authHealth.safeForProduction ? "border-emerald-400/20 bg-emerald-500/10" : "border-amber-400/20 bg-amber-500/10"}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-300">Deploy readiness</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Canlıya çıkış kontrol listesi</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-200/80">
              Production deploy öncesi auth secret ve giriş bilgileri güvenli değerlere çekilmeli. Bu kart env durumunu server tarafından doğrular.
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${authHealth.safeForProduction ? "bg-emerald-950/60 text-emerald-100" : "bg-amber-950/60 text-amber-100"}`}>
            {authHealth.safeForProduction ? "Production-ready auth" : "Aksiyon gerekli"}
          </span>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {authHealth.checklist.map((item) => (
            <div key={item.key} className={`rounded-2xl border p-4 ${item.ready ? "border-emerald-400/20 bg-slate-950/35" : "border-amber-400/20 bg-slate-950/45"}`}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">{item.key}</p>
                <span className={`rounded-full px-2.5 py-1 text-[11px] ${item.ready ? "bg-emerald-500/10 text-emerald-200" : "bg-amber-500/10 text-amber-200"}`}>
                  {item.ready ? "Hazır" : "Eksik"}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{item.message}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <div className="rounded-[28px] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-white/5 to-violet-500/10 p-6 backdrop-blur sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">Workspace kontrol merkezi</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Server-backed veriyi yönet, taşı ve sıfırla</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                  Demo öncesi veri bozulursa tek tıkla geri dönmek, JSON dışa almak veya başka cihazdan tenant store içine seed yüklemek artık mümkün.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Veri durumu</p>
                <strong className="mt-2 block text-3xl font-semibold text-white">{metrics.total}</strong>
                <p className="mt-1 text-xs text-slate-400">kayıt yönetiliyor</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <ActionButton label="JSON dışa aktar" description="Mevcut kayıtları dosya olarak indir" onClick={exportRecords} />
              <ActionButton label="JSON içe aktar" description="Kaydedilmiş workspace snapshot'ını tenant store'a yükle" onClick={() => inputRef.current?.click()} />
              <ActionButton label="Demo datasını geri yükle" description="Seed kayıtları server store'a tek tıkla geri getir" onClick={restoreDemoData} />
            </div>

            <input ref={inputRef} type="file" accept="application/json" onChange={importRecords} className="hidden" />
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Planner eşikleri</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Dashboard ve planner davranışını tenant bazında ayarla</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">Bu değerler artık SQLite içinde saklanıyor; refresh sonrası kaybolmuyor, activity log&apos;a düşüyor ve kapasite/mesai kartlarını doğrudan etkiliyor.</p>
              </div>
              {importState.kind !== "idle" ? <StateBadge state={importState} /> : null}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <NumberField label="Sessiz kayıt eşiği (saat)" value={settings.staleRecordHours} min={6} max={168} onChange={(value) => updateNumberSetting("staleRecordHours", value)} hint="Bu süreden eski açık kayıtlar riskli sayılır." />
              <NumberField label="Yüksek değer eşiği (₺)" value={settings.highValueThreshold} min={500} max={500000} onChange={(value) => updateNumberSetting("highValueThreshold", value)} hint="Öncelik skorunda yüksek değer olarak kabul edilir." />
              <NumberField label="Planner ufku (gün)" value={settings.plannerHorizonDays} min={3} max={30} onChange={(value) => updateNumberSetting("plannerHorizonDays", value)} hint="Haftalık yük görünümünün kaç gün ileri baktığını belirler." />
              <NumberField label="Günlük ekip kapasitesi" value={settings.defaultDailyCapacity} min={1} max={40} onChange={(value) => updateNumberSetting("defaultDailyCapacity", value)} hint="Planner yoğunluk kartları bunu günlük ideal iş limiti kabul eder." />
              <TimeField label="Mesai başlangıcı" value={settings.businessHoursStart} onChange={(value) => setSettings((current) => ({ ...current, businessHoursStart: value }))} hint="Takvim ve kapasite kartlarında görünen operasyon başlangıcı." />
              <TimeField label="Mesai bitişi" value={settings.businessHoursEnd} onChange={(value) => setSettings((current) => ({ ...current, businessHoursEnd: value }))} hint="Bitiş saati başlangıçtan sonra olmalıdır; server bu kuralı normalize eder." />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={saveSettings} className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20">
                Ayarları kaydet
              </button>
              <button onClick={resetSettingsToDefault} className="rounded-2xl border border-white/10 bg-slate-950/55 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900">
                Varsayılanlara dön
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Dağılım özeti</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Sektör ve durum görünümü</h3>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <MetricList title="Sektörler" items={metrics.sectorCounts} empty="Henüz sektör verisi yok." />
              <MetricList title="Durumlar" items={metrics.statusCounts} empty="Henüz durum verisi yok." />
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8">
            <p className="font-medium text-white">Hızlı uyarılar</p>
            <p className="mt-1 text-sm text-slate-400">Demo öncesi kontrol edilmesi gereken veri sinyalleri</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <WarningTile label="Tarihsiz kayıt" value={String(metrics.unscheduled)} tone={metrics.unscheduled ? "warn" : "ok"} />
              <WarningTile label="Tutarsız ID" value={String(metrics.duplicateIds.length)} tone={metrics.duplicateIds.length ? "warn" : "ok"} />
              <WarningTile label="Tutar eksik" value={String(metrics.missingAmount)} tone={metrics.missingAmount ? "warn" : "ok"} />
              <WarningTile label="Tanımsız alan değeri" value={String(metrics.missingSectorDefinitions.length + metrics.missingStatusDefinitions.length)} tone={metrics.missingSectorDefinitions.length + metrics.missingStatusDefinitions.length ? "warn" : "ok"} />
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Kullanıcı erişim kontrolü</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Tenant kullanıcılarını yönet</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">Owner/manager rolü kullanıcıyı disable edebilir veya session version artırarak seçili kullanıcının tüm aktif oturumlarını anında düşürebilir.</p>
              </div>
              {userActionState.kind !== "idle" ? <StateBadge state={userActionState} /> : null}
            </div>

            <div className="mt-5 space-y-3">
              {users.map((user) => {
                const isSelf = user.id === currentUserId;
                const isPending = pendingUserId === user.id;
                const canDisable = canManageUsers && !isSelf && user.role !== "owner";
                const canRevoke = canManageUsers;

                return (
                  <div key={user.id} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-white">{user.fullName}</p>
                          <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">{user.role}</span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] ${user.status === "active" ? "bg-emerald-500/10 text-emerald-200" : "bg-amber-500/10 text-amber-200"}`}>
                            {user.status === "active" ? "Aktif" : "Pasif"}
                          </span>
                          {isSelf ? <span className="rounded-full bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-100">Bu oturum</span> : null}
                        </div>
                        <p className="mt-2 text-sm text-slate-400">{user.email}</p>
                        <p className="mt-1 text-xs text-slate-500">session_version: {user.sessionVersion} · son güncelleme: {new Date(user.updatedAt).toLocaleString("tr-TR")}</p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={!canRevoke || isPending}
                          onClick={() => void runUserAdminAction({ action: "revoke-sessions", userId: user.id }, `${user.fullName} için tüm aktif oturumlar düşürüldü.`)}
                          className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Oturumları düşür
                        </button>
                        <button
                          disabled={!canDisable || isPending}
                          onClick={() => void runUserAdminAction({ action: "set-status", userId: user.id, status: user.status === "active" ? "disabled" : "active" }, user.status === "active" ? `${user.fullName} pasife alındı.` : `${user.fullName} tekrar aktive edildi.`)}
                          className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {user.status === "active" ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Riskli işlem</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Workspace&apos;i temizle</h3>
              </div>
              <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-xs text-rose-200">Dikkat</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">Bu buton tenant store&apos;u temizler. Seed dosyaları etkilenmez; istersen hemen ardından demo datayı geri yükleyebilirsin.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={clearWorkspace} className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-5 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20">Tenant kayıtlarını temizle</button>
              <button onClick={restoreDemoData} className="rounded-2xl border border-white/10 bg-slate-950/55 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900">Ardından demo datayı yükle</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function StateBadge({ state }: { state: Exclude<ImportState, { kind: "idle" }> }) {
  return <span className={`rounded-full px-3 py-1 text-xs ${state.kind === "success" ? "bg-emerald-500/10 text-emerald-200" : "bg-rose-500/10 text-rose-200"}`}>{state.message}</span>;
}

function NumberField({ label, value, min, max, hint, onChange }: { label: string; value: number; min: number; max: number; hint: string; onChange: (value: string) => void }) {
  return (
    <label className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-sm text-slate-300">
      <span className="block font-medium text-white">{label}</span>
      <input type="number" value={value} min={min} max={max} onChange={(event) => onChange(event.target.value)} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none" />
      <span className="mt-2 block text-xs text-slate-500">{hint}</span>
    </label>
  );
}

function TimeField({ label, value, hint, onChange }: { label: string; value: string; hint: string; onChange: (value: string) => void }) {
  return (
    <label className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-sm text-slate-300">
      <span className="block font-medium text-white">{label}</span>
      <input type="time" value={value} onChange={(event) => onChange(event.target.value)} className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none" />
      <span className="mt-2 block text-xs text-slate-500">{hint}</span>
    </label>
  );
}

function StatCard({ label, value, sub, tone = "default" }: { label: string; value: string; sub: string; tone?: "default" | "highlight" }) {
  return <div className={`rounded-[24px] border p-5 backdrop-blur ${tone === "highlight" ? "border-cyan-400/20 bg-cyan-500/10" : "border-white/10 bg-white/5"}`}><p className="text-sm text-slate-400">{label}</p><strong className="mt-3 block text-3xl font-semibold text-white">{value}</strong><p className="mt-2 text-xs text-slate-500">{sub}</p></div>;
}

function ActionButton({ label, description, onClick }: { label: string; description: string; onClick: () => void }) {
  return <button onClick={onClick} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-left transition hover:border-cyan-400/30 hover:bg-slate-900"><p className="font-medium text-white">{label}</p><p className="mt-1 text-sm leading-6 text-slate-400">{description}</p></button>;
}

function WarningTile({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" }) {
  return <div className={`rounded-2xl border p-4 ${tone === "warn" ? "border-amber-400/20 bg-amber-500/10" : "border-emerald-400/20 bg-emerald-500/10"}`}><p className="text-sm text-slate-300">{label}</p><strong className="mt-2 block text-2xl font-semibold text-white">{value}</strong></div>;
}

function MetricList({ title, items, empty }: { title: string; items: [string, number][]; empty: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-white">{title}</p>
      <div className="mt-3 space-y-3">
        {items.length ? items.map(([label, count]) => <div key={label} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm text-slate-300">{label}</span><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">{count}</span></div></div>) : <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-500">{empty}</div>}
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  if (!value) return "-";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(value);
}
