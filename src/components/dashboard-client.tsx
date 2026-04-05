"use client";

import { overviewStats, sectorHealth as seedSectorHealth } from "@/lib/demo-data";
import { formatCurrency, isOpenStatus, isToday, parseAmount, parseRecordDate, startOfDay, WORKFLOW_ORDER } from "@/lib/record-analytics";
import { RecordActivity, RecordItem, WorkspaceSettings } from "@/lib/types";
import { ReactNode, useMemo, useState } from "react";

const DAY_LABELS = ["Pzr", "Pzt", "Sal", "Çrş", "Prş", "Cum", "Cts"];

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  if (Number.isNaN(date.getTime())) return "zaman bilgisi yok";
  if (diffMs < 60 * 1000) return "az önce";
  if (diffMs < 60 * 60 * 1000) return `${Math.max(1, Math.round(diffMs / (60 * 1000)))} dk önce`;
  if (diffMs < 24 * 60 * 60 * 1000) return `${Math.max(1, Math.round(diffMs / (60 * 60 * 1000)))} sa önce`;
  return `${Math.max(1, Math.round(diffMs / (24 * 60 * 60 * 1000)))} gün önce`;
}

function getSlaTone(value: number) {
  if (value >= 85) return "text-emerald-100 border-emerald-400/20 bg-emerald-500/10";
  if (value >= 65) return "text-cyan-100 border-cyan-400/20 bg-cyan-500/10";
  if (value >= 40) return "text-amber-100 border-amber-400/20 bg-amber-500/10";
  return "text-rose-100 border-rose-400/20 bg-rose-500/10";
}

export function DashboardClient({ initialRecords, initialActivities, initialSettings }: { initialRecords: RecordItem[]; initialActivities: RecordActivity[]; initialSettings: WorkspaceSettings }) {
  const [records] = useState<RecordItem[]>(initialRecords);
  const [activities] = useState<RecordActivity[]>(initialActivities);
  const [settings] = useState<WorkspaceSettings>(initialSettings);
  const [now] = useState(() => Date.now());

  const enriched = useMemo(() => records.map((record, index) => ({ ...record, index, parsedDate: parseRecordDate(record.date), numericAmount: parseAmount(record.amount), updatedAtMs: new Date(record.updatedAt).getTime() })), [records]);

  const stats = useMemo(() => {
    const activeCount = records.length;
    const openCount = records.filter((r) => isOpenStatus(r.status)).length;
    const todayItems = enriched.filter((r) => isToday(r.parsedDate)).length;
    const weightedPipeline = enriched.filter((record) => record.status !== "Tamamlandı").reduce((sum, record) => sum + record.numericAmount, 0);

    return [
      { label: "Aktif kayıt", value: String(activeCount), sub: "Toplam müşteri/talep" },
      { label: "Açık süreç", value: String(openCount), sub: "Takipte + planlandı" },
      { label: "Bugün planlı", value: String(todayItems), sub: "Aynı gün operasyon yükü" },
      activeCount ? { label: "Açık pipeline", value: formatCurrency(weightedPipeline), sub: "Kapanmamış toplam potansiyel" } : overviewStats[3],
    ];
  }, [enriched, records]);

  const sectorHealth = useMemo(() => !records.length ? seedSectorHealth : seedSectorHealth.map((item) => ({ ...item, active: records.filter((r) => r.sector === item.sector).length })), [records]);

  const actionBoard = useMemo(() => {
    const queue = enriched.filter((record) => record.status !== "Tamamlandı").map((record) => {
      let score = 10;
      const reasons: string[] = [];

      if (!record.parsedDate) {
        score += 35;
        reasons.push("Tarih eksik");
      } else if (record.parsedDate.getTime() < now && !isToday(record.parsedDate)) {
        score += 45;
        reasons.push("Gecikmiş");
      } else if (isToday(record.parsedDate)) {
        score += 28;
        reasons.push("Bugün planlı");
      }

      if (record.status === "Yeni") { score += 18; reasons.push("İlk temas bekliyor"); }
      if (record.status === "Takipte") { score += 14; reasons.push("Geri dönüş gerekli"); }
      if (record.numericAmount >= settings.highValueThreshold) { score += 20; reasons.push("Yüksek değer"); }
      else if (record.numericAmount >= Math.round(settings.highValueThreshold * 0.6)) { score += 10; reasons.push("Değerli fırsat"); }

      return { ...record, score, reasons };
    }).sort((a, b) => b.score - a.score || a.index - b.index).slice(0, 5);

    const bottleneckStage = WORKFLOW_ORDER.filter((stage) => stage !== "Tamamlandı").map((stage) => ({ stage, count: enriched.filter((record) => record.status === stage).length })).sort((a, b) => b.count - a.count)[0];
    const overdue = enriched.filter((record) => record.parsedDate && record.parsedDate.getTime() < now && record.status !== "Tamamlandı").length;
    const unscheduled = enriched.filter((record) => !record.parsedDate && record.status !== "Tamamlandı").length;
    const dueToday = enriched.filter((record) => isToday(record.parsedDate) && record.status !== "Tamamlandı").length;

    return { queue, overdue, unscheduled, dueToday, bottleneckStage, healthScore: Math.max(0, 100 - overdue * 14 - unscheduled * 8) };
  }, [enriched, now, settings.highValueThreshold]);

  const revenueByStage = useMemo(() => {
    const total = enriched.reduce((sum, record) => sum + record.numericAmount, 0);
    return WORKFLOW_ORDER.map((stage) => {
      const value = enriched.filter((record) => record.status === stage).reduce((sum, record) => sum + record.numericAmount, 0);
      const count = enriched.filter((record) => record.status === stage).length;
      return { stage, value, count, share: total > 0 ? Math.round((value / total) * 100) : 0 };
    });
  }, [enriched]);

  const weekLoad = useMemo(() => {
    const start = startOfDay(new Date());
    return Array.from({ length: settings.plannerHorizonDays }, (_, offset) => {
      const dayStart = start + offset * 24 * 60 * 60 * 1000;
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      const items = enriched.filter((record) => {
        const time = record.parsedDate?.getTime();
        return time !== undefined && time >= dayStart && time < dayEnd && record.status !== "Tamamlandı";
      });
      const count = items.length;
      return {
        label: DAY_LABELS[new Date(dayStart).getDay()],
        fullLabel: new Date(dayStart).toLocaleDateString("tr-TR", { day: "2-digit", month: "long" }),
        count,
        amount: items.reduce((sum, item) => sum + item.numericAmount, 0),
        loadRatio: settings.defaultDailyCapacity ? count / settings.defaultDailyCapacity : 0,
      };
    });
  }, [enriched, settings.defaultDailyCapacity, settings.plannerHorizonDays]);

  const assigneeLoad = useMemo(() => {
    const planned = enriched.filter((record) => record.status !== "Tamamlandı");
    const perAssigneeCapacity = Math.max(1, Math.round(settings.defaultDailyCapacity * settings.plannerHorizonDays));

    const grouped = planned.reduce((map, record) => {
      const key = record.assignee?.trim() || "Operasyon";
      const current = map.get(key) ?? { assignee: key, total: 0, scheduled: 0, unscheduled: 0, overdue: 0, highValue: 0, amount: 0 };
      current.total += 1;
      current.amount += record.numericAmount;
      if (record.parsedDate) current.scheduled += 1;
      else current.unscheduled += 1;
      if (record.parsedDate && record.parsedDate.getTime() < now && !isToday(record.parsedDate)) current.overdue += 1;
      if (record.numericAmount >= settings.highValueThreshold) current.highValue += 1;
      map.set(key, current);
      return map;
    }, new Map<string, { assignee: string; total: number; scheduled: number; unscheduled: number; overdue: number; highValue: number; amount: number }>());

    return Array.from(grouped.values())
      .map((item) => ({ ...item, capacityRatio: perAssigneeCapacity ? item.total / perAssigneeCapacity : 0 }))
      .sort((a, b) => b.overdue - a.overdue || b.unscheduled - a.unscheduled || b.total - a.total || b.amount - a.amount)
      .slice(0, 6);
  }, [enriched, now, settings.defaultDailyCapacity, settings.highValueThreshold, settings.plannerHorizonDays]);

  const activityInsights = useMemo(() => {
    const latest = activities.slice(0, 6);
    const activeRecords = enriched.filter((record) => isOpenStatus(record.status));
    const activeCount = Math.max(activeRecords.length, 1);
    const staleThreshold = now - settings.staleRecordHours * 60 * 60 * 1000;
    const staleRecords = activeRecords.filter((record) => !Number.isFinite(record.updatedAtMs) || record.updatedAtMs < staleThreshold);
    const statusMoves = activities.filter((activity) => activity.summary.includes("durum ")).length;
    const slaScore = Math.max(0, Math.min(100, Math.round(100 - (staleRecords.length / activeCount) * 55 - actionBoard.overdue * 10 - actionBoard.unscheduled * 6)));

    return { latest, staleCount: staleRecords.length, touchedToday: enriched.filter((record) => { const updatedAt = new Date(record.updatedAt); return !Number.isNaN(updatedAt.getTime()) && isToday(updatedAt); }).length, statusMoves, slaScore, lastActivity: latest[0] ?? null };
  }, [actionBoard.overdue, actionBoard.unscheduled, activities, enriched, now, settings.staleRecordHours]);

  const maxWeekLoad = Math.max(...weekLoad.map((day) => day.count), 1);
  const busiestDay = weekLoad.slice().sort((a, b) => b.count - a.count)[0] ?? null;
  const capacityWindow = settings.plannerHorizonDays * settings.defaultDailyCapacity;
  const horizonPlannedLoad = weekLoad.reduce((sum, day) => sum + day.count, 0);
  const horizonUtilization = capacityWindow > 0 ? Math.round((horizonPlannedLoad / capacityWindow) * 100) : 0;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{stats.map((item) => <div key={item.label} className="rounded-[24px] border border-white/10 bg-white/5 p-5 backdrop-blur"><p className="text-sm text-slate-400">{item.label}</p><strong className="mt-3 block text-3xl font-semibold">{item.value}</strong><p className="mt-2 text-xs text-slate-500">{item.sub}</p></div>)}</section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[28px] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-white/5 to-violet-500/10 p-6 backdrop-blur sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-[0.25em] text-cyan-200">Operations radar</p><h3 className="mt-2 text-2xl font-semibold">Bugün öncelikli aksiyonlar</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Öncelik puanı artık tenant bazlı yüksek değer eşiğini kullanıyor.</p></div><div className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-right"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Operasyon skoru</p><strong className="mt-2 block text-3xl font-semibold text-white">{actionBoard.healthScore}</strong><p className="mt-1 text-xs text-slate-400">100 üzerinden günlük sağlık puanı</p></div></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-4"><RadarStat label="Geciken iş" value={String(actionBoard.overdue)} tone="warning" /><RadarStat label="Bugün odakta" value={String(actionBoard.dueToday)} tone="info" /><RadarStat label="Plan boşluğu" value={String(actionBoard.unscheduled)} tone="muted" /><RadarStat label="Yüksek değer eşiği" value={`₺${settings.highValueThreshold}`} tone="info" /></div>
          <div className="mt-5 space-y-3">{actionBoard.queue.length ? actionBoard.queue.map((record, index) => <article key={record.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-white/6 px-2.5 py-1 text-[11px] text-slate-300">#{index + 1}</span><span className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-[11px] text-cyan-200">Skor {record.score}</span><span className="rounded-full bg-white/6 px-2.5 py-1 text-[11px] text-slate-300">{record.status}</span></div><h4 className="mt-3 text-lg font-semibold text-white">{record.customer}</h4><p className="mt-1 text-sm text-slate-400">{record.title}</p></div><div className="text-right text-sm text-slate-400"><p>{record.amount || "Tutar yok"}</p><p className="mt-1">{record.date || "Tarih bekliyor"}</p></div></div><div className="mt-4 flex flex-wrap gap-2">{record.reasons.map((reason) => <span key={reason} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">{reason}</span>)}</div></article>) : <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-400">Öncelik listesi için kayıt oluşturulmalı. Şu an dashboard boş görünüyor.</div>}</div>
        </div>

        <div className="space-y-6">
          <Panel eyebrow="Bottleneck" title="Akış sıkışma noktası">{actionBoard.bottleneckStage ? <span className="inline-flex rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">{actionBoard.bottleneckStage.stage} • {actionBoard.bottleneckStage.count}</span> : null}<div className="mt-4 space-y-3">{WORKFLOW_ORDER.map((stage) => { const count = enriched.filter((record) => record.status === stage).length; const max = Math.max(...WORKFLOW_ORDER.map((item) => enriched.filter((record) => record.status === item).length), 1); return <div key={stage}><div className="mb-2 flex items-center justify-between text-sm"><span className="text-slate-300">{stage}</span><span className="text-slate-500">{count} kayıt</span></div><div className="h-2 rounded-full bg-slate-900/70"><div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" style={{ width: `${(count / max) * 100}%` }} /></div></div>; })}</div></Panel>

          <Panel eyebrow="SLA + activity" title="Son aksiyon görünümü"><div className="mb-4 flex flex-wrap items-start justify-between gap-4"><span className={`rounded-full border px-3 py-1 text-xs ${getSlaTone(activityInsights.slaScore)}`}>SLA skoru • {activityInsights.slaScore}</span><span className="rounded-full border border-white/10 bg-slate-950/55 px-3 py-1 text-xs text-slate-300">Sessiz eşik {settings.staleRecordHours} sa</span></div><div className="grid gap-3 sm:grid-cols-3"><RadarStat label="Bugün dokunulan" value={String(activityInsights.touchedToday)} tone="info" /><RadarStat label="Durum hareketi" value={String(activityInsights.statusMoves)} tone="muted" /><RadarStat label="Sessiz kayıt" value={String(activityInsights.staleCount)} tone={activityInsights.staleCount ? "warning" : "info"} /></div><div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/55 p-4"><p className="text-xs uppercase tracking-[0.2em] text-slate-500">Son workspace hareketi</p>{activityInsights.lastActivity ? <><p className="mt-3 font-medium text-white">{activityInsights.lastActivity.recordCustomer}</p><p className="mt-1 text-sm text-slate-300">{activityInsights.lastActivity.summary}</p><p className="mt-2 text-xs text-slate-500">{formatRelativeTime(activityInsights.lastActivity.createdAt)}</p></> : <p className="mt-3 text-sm text-slate-400">Henüz activity log oluşmadı.</p>}</div><div className="mt-4 space-y-3">{activityInsights.latest.length ? activityInsights.latest.map((activity) => <div key={activity.id} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-medium text-white">{activity.recordCustomer}</p><p className="mt-1 text-sm text-slate-400">{activity.summary}</p></div><span className="rounded-full bg-white/6 px-3 py-1 text-[11px] text-slate-300">{formatRelativeTime(activity.createdAt)}</span></div></div>) : <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-400">Activity listesi boş; ilk CRUD hareketinden sonra otomatik dolacak.</div>}</div></Panel>

          <Panel eyebrow={`${settings.plannerHorizonDays} günlük yük`} title="Kapasite görünümü"><div className="mb-4 grid gap-3 sm:grid-cols-3"><RadarStat label="Günlük kapasite" value={`${settings.defaultDailyCapacity} iş`} tone="info" /><RadarStat label="Mesai" value={`${settings.businessHoursStart}-${settings.businessHoursEnd}`} tone="muted" /><RadarStat label="Ufuk doluluğu" value={`%${Math.min(999, horizonUtilization)}`} tone={horizonUtilization > 100 ? "warning" : "info"} /></div><div className="mb-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-sm text-slate-300">{busiestDay ? <><span className="font-medium text-white">En yoğun gün:</span> {busiestDay.fullLabel} • {busiestDay.count} iş</> : "Henüz planlı yük oluşmadı."}</div><div className="grid gap-3 sm:grid-cols-2">{weekLoad.map((day) => <div key={day.fullLabel} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium text-white">{day.label}</p><p className="mt-1 text-xs text-slate-500">{day.fullLabel}</p></div><span className={`rounded-full px-3 py-1 text-xs ${day.loadRatio > 1 ? "bg-amber-500/10 text-amber-200" : "bg-white/6 text-slate-300"}`}>{day.count} iş</span></div><div className="mt-4 h-2 rounded-full bg-slate-900/70"><div className={`h-2 rounded-full ${day.loadRatio > 1 ? "bg-gradient-to-r from-amber-400 to-rose-400" : "bg-gradient-to-r from-emerald-400 to-cyan-400"}`} style={{ width: `${Math.min(100, (day.count / maxWeekLoad) * 100)}%` }} /></div><p className="mt-3 text-xs text-slate-400">{day.amount ? formatCurrency(day.amount) : "Tutar planlanmadı"} • Kapasite {Math.round(day.loadRatio * 100)}%</p></div>)}</div></Panel>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel eyebrow="Sektör dağılımı" title="Operasyon sağlığı"><div className="space-y-3">{sectorHealth.map((item) => <div key={item.sector} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"><div className="flex items-center justify-between gap-4"><div><p className="font-medium">{item.sector}</p><p className="mt-1 text-sm text-slate-400">Aktif süreçler ve canlı müşteri akışı</p></div><span className={`rounded-full px-3 py-1 text-sm ${item.tone}`}>{item.active}</span></div></div>)}</div></Panel>
        <Panel eyebrow="Tutar analizi" title="Workflow bazlı gelir görünümü"><div className="space-y-4">{revenueByStage.map((stage) => <div key={stage.stage} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"><div className="flex items-center justify-between gap-4"><div><p className="font-medium text-white">{stage.stage}</p><p className="mt-1 text-sm text-slate-400">{stage.count} kayıt</p></div><div className="text-right"><p className="font-medium text-white">{stage.value ? formatCurrency(stage.value) : "-"}</p><p className="mt-1 text-xs text-slate-500">%{stage.share} pay</p></div></div><div className="mt-4 h-2 rounded-full bg-slate-900/70"><div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" style={{ width: `${Math.max(stage.share, stage.value ? 6 : 0)}%` }} /></div></div>)}</div></Panel>
      </section>

      <section>
        <Panel eyebrow="Ekip kapasitesi" title="Sorumlu bazlı yük dağılımı">
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <RadarStat label="Kişi başı ideal yük" value={`${settings.defaultDailyCapacity * settings.plannerHorizonDays} iş`} tone="info" />
            <RadarStat label="Takip ufku" value={`${settings.plannerHorizonDays} gün`} tone="muted" />
            <RadarStat label="Aktif sorumlu" value={String(assigneeLoad.length)} tone="info" />
          </div>
          <div className="space-y-3">
            {assigneeLoad.length ? assigneeLoad.map((item) => <div key={item.assignee} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium text-white">{item.assignee}</p><p className="mt-1 text-sm text-slate-400">{item.total} açık iş • {item.scheduled} planlı • {item.unscheduled} tarihsiz</p></div><div className="text-right text-sm text-slate-400"><p>{item.amount ? formatCurrency(item.amount) : "Tutar yok"}</p><p className="mt-1">{Math.round(item.capacityRatio * 100)}% yük</p></div></div><div className="mt-4 h-2 rounded-full bg-slate-900/70"><div className={`h-2 rounded-full ${item.capacityRatio > 1 ? "bg-gradient-to-r from-amber-400 to-rose-400" : "bg-gradient-to-r from-cyan-400 to-emerald-400"}`} style={{ width: `${Math.min(100, Math.round(item.capacityRatio * 100))}%` }} /></div><div className="mt-4 flex flex-wrap gap-2 text-xs">{item.overdue ? <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-amber-100">{item.overdue} gecikmiş</span> : null}{item.highValue ? <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-cyan-100">{item.highValue} yüksek değer</span> : null}{item.unscheduled ? <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-300">{item.unscheduled} tarih bekliyor</span> : null}{!item.overdue && !item.highValue && !item.unscheduled ? <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-emerald-100">Dengeli yük</span> : null}</div></div>) : <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-400">Henüz sorumlu bazlı yük gösterecek açık kayıt yok.</div>}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function Panel({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8"><div className="mb-6"><p className="text-xs uppercase tracking-[0.25em] text-slate-400">{eyebrow}</p><h3 className="mt-2 text-2xl font-semibold">{title}</h3></div>{children}</div>;
}

function RadarStat({ label, value, tone }: { label: string; value: string; tone: "warning" | "info" | "muted" }) {
  const className = tone === "warning" ? "border-amber-400/20 bg-amber-500/10 text-amber-100" : tone === "info" ? "border-cyan-400/20 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-slate-950/55 text-slate-200";
  return <div className={`rounded-2xl border p-4 ${className}`}><p className="text-xs uppercase tracking-[0.2em] opacity-70">{label}</p><strong className="mt-3 block text-3xl font-semibold">{value}</strong></div>;
}
