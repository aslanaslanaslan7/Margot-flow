"use client";

import { isOpenStatus, parseRecordDate, startOfDay } from "@/lib/record-analytics";
import { RecordActivity, RecordItem, WorkspaceSettings } from "@/lib/types";
import { ReactNode, useMemo, useState } from "react";

const DAY_LABELS = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function formatTimelineDate(date: Date) {
  return `${DAY_LABELS[date.getDay()]} • ${date.toLocaleDateString("tr-TR", { day: "2-digit", month: "long" })} • ${date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(date.getTime())) return "zaman bilgisi yok";
  if (diffMs < 60 * 1000) return "az önce";
  if (diffMs < 60 * 60 * 1000) return `${Math.max(1, Math.round(diffMs / (60 * 1000)))} dk önce`;
  if (diffMs < 24 * 60 * 60 * 1000) return `${Math.max(1, Math.round(diffMs / (60 * 60 * 1000)))} sa önce`;
  return `${Math.max(1, Math.round(diffMs / (24 * 60 * 60 * 1000)))} gün önce`;
}

function getPriorityTone(status: string) {
  switch (status) {
    case "Yeni": return "text-amber-200 bg-amber-500/10 border-amber-400/20";
    case "Takipte": return "text-sky-200 bg-sky-500/10 border-sky-400/20";
    case "Planlandı": return "text-violet-200 bg-violet-500/10 border-violet-400/20";
    case "Teslime hazır": return "text-emerald-200 bg-emerald-500/10 border-emerald-400/20";
    default: return "text-slate-200 bg-white/5 border-white/10";
  }
}

function getSlaTone(value: number) {
  if (value >= 85) return "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";
  if (value >= 65) return "border-cyan-400/20 bg-cyan-500/10 text-cyan-100";
  if (value >= 40) return "border-amber-400/20 bg-amber-500/10 text-amber-100";
  return "border-rose-400/20 bg-rose-500/10 text-rose-100";
}

export function PlannerClient({ initialRecords, initialActivities, initialSettings }: { initialRecords: RecordItem[]; initialActivities: RecordActivity[]; initialSettings: WorkspaceSettings }) {
  const [records] = useState<RecordItem[]>(initialRecords);
  const [activities] = useState<RecordActivity[]>(initialActivities);
  const [settings] = useState<WorkspaceSettings>(initialSettings);
  const [now] = useState(() => Date.now());

  const computed = useMemo(() => {
    const enriched = records.map((record) => ({ ...record, parsedDate: parseRecordDate(record.date), updatedAtMs: new Date(record.updatedAt).getTime() }));
    const scheduled = enriched.filter((record) => record.parsedDate).sort((a, b) => a.parsedDate!.getTime() - b.parsedDate!.getTime());
    const unscheduled = enriched.filter((record) => !record.parsedDate && isOpenStatus(record.status));
    const dayStart = startOfDay(new Date());
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const horizonEnd = dayStart + settings.plannerHorizonDays * 24 * 60 * 60 * 1000;
    const staleThreshold = now - settings.staleRecordHours * 60 * 60 * 1000;

    const todayItems = scheduled.filter((record) => {
      const time = record.parsedDate!.getTime();
      return time >= dayStart && time < dayEnd;
    });

    const thisWindowItems = scheduled.filter((record) => {
      const time = record.parsedDate!.getTime();
      return time >= dayStart && time < horizonEnd;
    });

    const overdue = scheduled.filter((record) => record.parsedDate!.getTime() < now && record.status !== "Tamamlandı");
    const lastTouched = [...enriched].filter((record) => Number.isFinite(record.updatedAtMs)).sort((a, b) => b.updatedAtMs - a.updatedAtMs).slice(0, 5);
    const staleOpen = enriched.filter((record) => isOpenStatus(record.status) && (!Number.isFinite(record.updatedAtMs) || record.updatedAtMs < staleThreshold));
    const recentActivities = activities.slice(0, 6);
    const plannedByDay = Array.from({ length: settings.plannerHorizonDays }, (_, offset) => {
      const currentDayStart = dayStart + offset * 24 * 60 * 60 * 1000;
      const currentDayEnd = currentDayStart + 24 * 60 * 60 * 1000;
      const count = scheduled.filter((record) => {
        const time = record.parsedDate!.getTime();
        return time >= currentDayStart && time < currentDayEnd && record.status !== "Tamamlandı";
      }).length;
      return {
        label: new Date(currentDayStart).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }),
        count,
        loadRatio: settings.defaultDailyCapacity ? count / settings.defaultDailyCapacity : 0,
      };
    });
    const busiestDay = plannedByDay.slice().sort((a, b) => b.count - a.count)[0] ?? null;
    const totalCapacity = settings.defaultDailyCapacity * settings.plannerHorizonDays;
    const utilization = totalCapacity > 0 ? Math.round((thisWindowItems.length / totalCapacity) * 100) : 0;
    const assigneeCapacity = Math.max(1, totalCapacity);
    const assigneeLoad = Array.from(
      enriched.reduce((map, record) => {
        if (!isOpenStatus(record.status)) return map;
        const key = record.assignee?.trim() || "Operasyon";
        const current = map.get(key) ?? { assignee: key, total: 0, today: 0, overdue: 0, unscheduled: 0 };
        current.total += 1;
        if (!record.parsedDate) current.unscheduled += 1;
        else {
          const time = record.parsedDate.getTime();
          if (time >= dayStart && time < dayEnd) current.today += 1;
          if (time < now && record.status !== "Tamamlandı") current.overdue += 1;
        }
        map.set(key, current);
        return map;
      }, new Map<string, { assignee: string; total: number; today: number; overdue: number; unscheduled: number }>()).values(),
    )
      .map((item) => ({ ...item, loadRatio: item.total / assigneeCapacity }))
      .sort((a, b) => b.overdue - a.overdue || b.today - a.today || b.total - a.total)
      .slice(0, 6);
    const slaScore = Math.max(0, Math.min(100, Math.round(100 - overdue.length * 14 - unscheduled.length * 8 - staleOpen.length * 7 - plannedByDay.filter((day) => day.loadRatio > 1).length * 5)));

    return {
      todayItems,
      thisWindowItems,
      overdue,
      unscheduled,
      nextUp: scheduled.slice(0, 6),
      lastTouched,
      staleOpen,
      recentActivities,
      lastActivity: recentActivities[0] ?? null,
      statusMovesToday: activities.filter((activity) => activity.summary.includes("durum ")).length,
      slaScore,
      plannedByDay,
      busiestDay,
      utilization,
      assigneeLoad,
    };
  }, [activities, now, records, settings.defaultDailyCapacity, settings.plannerHorizonDays, settings.staleRecordHours]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Bugün planlı" value={String(computed.todayItems.length)} sub="Aynı gün operasyon görünümü" />
        <StatCard label={`${settings.plannerHorizonDays} gün ufuk`} value={String(computed.thisWindowItems.length)} sub="Ayarlarla belirlenen plan penceresi" />
        <StatCard label="Geciken iş" value={String(computed.overdue.length)} sub="Tamamlanmamış geçmiş kayıt" tone="warning" />
        <StatCard label="Tarihsiz kayıt" value={String(computed.unscheduled.length)} sub="Planlanmayı bekleyen açık işler" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Operasyon takvimi</p>
              <h3 className="mt-2 text-2xl font-semibold">Sıradaki planlı işler</h3>
            </div>
            <span className="rounded-full border border-white/10 bg-slate-950/55 px-3 py-1 text-xs text-slate-300">{settings.plannerHorizonDays} günlük görünüm</span>
          </div>

          <div className="space-y-3">
            {computed.nextUp.length ? computed.nextUp.map((record) => <article key={record.id} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.2em] text-slate-500">{record.id}</p><h4 className="mt-2 text-lg font-semibold text-white">{record.customer}</h4><p className="mt-1 text-sm text-slate-400">{record.title}</p></div><span className={`rounded-full border px-3 py-1 text-xs ${getPriorityTone(record.status)}`}>{record.status}</span></div><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-sm text-cyan-200">{record.parsedDate ? formatTimelineDate(record.parsedDate) : "Tarihsiz kayıt"}</p><p className="mt-1 text-sm text-slate-500">{record.sector} • {record.amount || "Tutar girilmedi"}</p></div><div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">{record.note || "Not yok"}</div></div></article>) : <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-400">Henüz tarihli kayıt yok. Yeni kayıt oluşturup tarih alanını doldurduğunda planner otomatik çalışır.</div>}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.25em] text-slate-400">Planner SLA</p><h3 className="mt-2 text-2xl font-semibold">Son aksiyon ve tempo</h3></div><span className={`rounded-full border px-3 py-1 text-xs ${getSlaTone(computed.slaScore)}`}>SLA • {computed.slaScore}</span></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <MiniStat label="Durum hareketi" value={String(computed.statusMovesToday)} />
              <MiniStat label="Sessiz açık kayıt" value={String(computed.staleOpen.length)} warning={computed.staleOpen.length > 0} />
              <MiniStat label="Eşik" value={`${settings.staleRecordHours} sa`} />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <MiniStat label="Günlük kapasite" value={`${settings.defaultDailyCapacity} iş`} warning={computed.utilization > 100} />
              <MiniStat label="Mesai" value={`${settings.businessHoursStart}-${settings.businessHoursEnd}`} />
              <MiniStat label="Ufuk doluluğu" value={`%${Math.min(999, computed.utilization)}`} warning={computed.utilization > 100} />
            </div>
            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/55 p-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">En son activity</p>{computed.lastActivity ? <><p className="mt-3 font-medium text-white">{computed.lastActivity.recordCustomer}</p><p className="mt-1 text-sm text-slate-400">{computed.lastActivity.summary}</p><p className="mt-2 text-xs text-slate-500">{formatRelativeTime(computed.lastActivity.createdAt)}</p></> : <p className="mt-3 text-sm text-slate-400">Henüz activity kaydı yok.</p>}</div>
          </div>

          <Panel title="Aksiyon gerektiren kayıtlar" eyebrow="Focus listesi">{computed.overdue.length ? computed.overdue.slice(0, 4).map((record) => <div key={record.id} className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4"><p className="font-medium text-white">{record.customer}</p><p className="mt-1 text-sm text-amber-100">{record.title}</p><p className="mt-2 text-xs text-amber-200">Gecikmiş • {record.date}</p></div>) : <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Harika: gecikmiş açık kayıt görünmüyor.</div>}</Panel>

          <Panel title="Kapasite baskısı" eyebrow="Plan yoğunluğu">{computed.plannedByDay.length ? computed.plannedByDay.map((day) => <div key={day.label} className={`rounded-2xl border p-4 ${day.loadRatio > 1 ? "border-amber-400/20 bg-amber-500/10" : "border-white/10 bg-slate-950/55"}`}><div className="flex items-center justify-between gap-4"><div><p className="font-medium text-white">{day.label}</p><p className="mt-1 text-sm text-slate-400">Kapasite {settings.defaultDailyCapacity} iş • Mesai {settings.businessHoursStart}-{settings.businessHoursEnd}</p></div><span className={`rounded-full px-3 py-1 text-xs ${day.loadRatio > 1 ? "bg-amber-950/60 text-amber-100" : "bg-white/5 text-slate-300"}`}>{day.count} iş</span></div><div className="mt-3 h-2 rounded-full bg-slate-900/70"><div className={`h-2 rounded-full ${day.loadRatio > 1 ? "bg-gradient-to-r from-amber-400 to-rose-400" : "bg-gradient-to-r from-cyan-400 to-emerald-400"}`} style={{ width: `${Math.min(100, Math.round(day.loadRatio * 100))}%` }} /></div></div>) : <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">Henüz kapasite hesabı için planlı kayıt yok.</div>}{computed.busiestDay ? <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-sm text-slate-300"><span className="font-medium text-white">En yoğun gün:</span> {computed.busiestDay.label} • {computed.busiestDay.count} iş</div> : null}</Panel>

          <Panel title="Sorumlu bazlı kapasite" eyebrow="Ekip dengesi">{computed.assigneeLoad.length ? computed.assigneeLoad.map((item) => <div key={item.assignee} className={`rounded-2xl border p-4 ${item.overdue || item.unscheduled ? "border-amber-400/20 bg-amber-500/10" : "border-white/10 bg-slate-950/55"}`}><div className="flex items-start justify-between gap-4"><div><p className="font-medium text-white">{item.assignee}</p><p className="mt-1 text-sm text-slate-400">{item.total} açık iş • bugün {item.today} • tarihsiz {item.unscheduled}</p></div><span className={`rounded-full px-3 py-1 text-xs ${item.overdue ? "bg-amber-950/60 text-amber-100" : "bg-white/5 text-slate-300"}`}>{Math.round(item.loadRatio * 100)}% yük</span></div><div className="mt-3 h-2 rounded-full bg-slate-900/70"><div className={`h-2 rounded-full ${item.overdue || item.unscheduled ? "bg-gradient-to-r from-amber-400 to-rose-400" : "bg-gradient-to-r from-cyan-400 to-emerald-400"}`} style={{ width: `${Math.min(100, Math.round(item.loadRatio * 100))}%` }} /></div><div className="mt-3 flex flex-wrap gap-2 text-xs">{item.overdue ? <span className="rounded-full border border-amber-400/20 bg-amber-950/60 px-3 py-1 text-amber-100">{item.overdue} gecikmiş</span> : null}{item.unscheduled ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">{item.unscheduled} tarih bekliyor</span> : null}{!item.overdue && !item.unscheduled ? <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-100">Dengeli akış</span> : null}</div></div>) : <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">Henüz ekip bazlı kapasite gösterecek açık kayıt yok.</div>}</Panel>

          <Panel title="Ekip ritmi" eyebrow="Son dokunulan kayıtlar">{computed.lastTouched.length ? computed.lastTouched.map((record) => <div key={record.id} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-medium text-white">{record.customer}</p><p className="mt-1 text-sm text-slate-400">{record.title}</p></div><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">{formatRelativeTime(record.updatedAt)}</span></div></div>) : <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">Henüz güncellenmiş kayıt görünmüyor.</div>}</Panel>

          <Panel title="Tarih bekleyen işler" eyebrow="Plan boşlukları">{computed.unscheduled.length ? computed.unscheduled.slice(0, 5).map((record) => <div key={record.id} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-medium text-white">{record.customer}</p><p className="mt-1 text-sm text-slate-400">{record.title}</p></div><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">{record.status}</span></div></div>) : <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">Tüm açık kayıtların plan tarihi var.</div>}</Panel>

          <Panel title="Son operasyon hareketleri" eyebrow="Activity akışı">{computed.recentActivities.length ? computed.recentActivities.map((activity) => <div key={activity.id} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-medium text-white">{activity.recordCustomer}</p><p className="mt-1 text-sm text-slate-400">{activity.summary}</p></div><span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">{formatRelativeTime(activity.createdAt)}</span></div></div>) : <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">Activity log boş.</div>}</Panel>
        </div>
      </section>
    </div>
  );
}

function Panel({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8"><p className="text-xs uppercase tracking-[0.25em] text-slate-400">{eyebrow}</p><h3 className="mt-2 text-2xl font-semibold">{title}</h3><div className="mt-6 space-y-3">{children}</div></div>;
}

function StatCard({ label, value, sub, tone = "default" }: { label: string; value: string; sub: string; tone?: "default" | "warning" }) {
  return <div className={`rounded-[24px] border p-5 backdrop-blur ${tone === "warning" ? "border-amber-400/20 bg-amber-500/10" : "border-white/10 bg-white/5"}`}><p className="text-sm text-slate-400">{label}</p><strong className="mt-3 block text-3xl font-semibold text-white">{value}</strong><p className="mt-2 text-xs text-slate-500">{sub}</p></div>;
}

function MiniStat({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className={`rounded-2xl border p-4 ${warning ? "border-amber-400/20 bg-amber-500/10 text-amber-100" : "border-white/10 bg-slate-950/55 text-slate-200"}`}><p className="text-xs uppercase tracking-[0.2em] opacity-70">{label}</p><strong className="mt-3 block text-lg font-semibold">{value}</strong></div>;
}
