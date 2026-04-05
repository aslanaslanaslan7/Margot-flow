"use client";

import Link from "next/link";
import { RecordEditor } from "@/components/record-editor";
import { sectors, statuses } from "@/lib/demo-data";
import { deleteRecord, resetRecords, updateRecord } from "@/lib/records-client";
import { isOpenStatus, isToday, parseAmount, parseRecordDate, WORKFLOW_ORDER } from "@/lib/record-analytics";
import { RecordActivity, RecordItem, RecordStatus, RecordsResponse } from "@/lib/types";
import { useMemo, useState } from "react";

const DEFAULT_SECTOR = "Tüm sektörler";
const DEFAULT_STATUS = "Tüm durumlar";

type ViewMode = "cards" | "pipeline";
type SortMode = "updated" | "date-asc" | "date-desc" | "amount-desc" | "customer";
type FilterPreset = "all" | "needs-action" | "today" | "unscheduled" | "high-value" | "completed";

export function RecordsClient({
  initialRecords,
  initialActivities,
}: {
  initialRecords: RecordItem[];
  initialActivities: RecordActivity[];
}) {
  const [records, setRecords] = useState<RecordItem[]>(initialRecords);
  const [activities, setActivities] = useState<RecordActivity[]>(initialActivities);
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState(DEFAULT_SECTOR);
  const [status, setStatus] = useState(DEFAULT_STATUS);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [sortMode, setSortMode] = useState<SortMode>("updated");
  const [preset, setPreset] = useState<FilterPreset>("all");
  const [editing, setEditing] = useState<RecordItem | null>(null);
  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [referenceNow] = useState(() => Date.now());
  const [mutationState, setMutationState] = useState<{ kind: "idle" | "error"; message?: string }>({ kind: "idle" });
  const [isSaving, setIsSaving] = useState(false);

  const preparedRecords = useMemo(() => {
    return records.map((record, index) => ({
      ...record,
      parsedDate: parseRecordDate(record.date),
      numericAmount: parseAmount(record.amount),
      index,
    }));
  }, [records]);

  const filtered = useMemo(() => {
    const byBaseFilters = preparedRecords.filter((record) => {
      const q = query.toLowerCase();
      const matchesQuery =
        !q || [record.customer, record.phone, record.source, record.assignee, record.title, record.note, record.id].some((v) => v.toLowerCase().includes(q));
      const matchesSector = sector === DEFAULT_SECTOR || record.sector === sector;
      const matchesStatus = status === DEFAULT_STATUS || record.status === status;
      return matchesQuery && matchesSector && matchesStatus;
    });

    const byPreset = byBaseFilters.filter((record) => {
      switch (preset) {
        case "needs-action":
          return isOpenStatus(record.status) && (!record.parsedDate || record.parsedDate.getTime() < referenceNow);
        case "today":
          return isToday(record.parsedDate);
        case "unscheduled":
          return !record.parsedDate;
        case "high-value":
          return record.numericAmount >= 5000;
        case "completed":
          return record.status === "Tamamlandı";
        default:
          return true;
      }
    });

    return [...byPreset].sort((a, b) => {
      switch (sortMode) {
        case "date-asc":
          return (a.parsedDate?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.parsedDate?.getTime() ?? Number.MAX_SAFE_INTEGER);
        case "date-desc":
          return (b.parsedDate?.getTime() ?? 0) - (a.parsedDate?.getTime() ?? 0);
        case "amount-desc":
          return b.numericAmount - a.numericAmount;
        case "customer":
          return a.customer.localeCompare(b.customer, "tr");
        default:
          return a.index - b.index;
      }
    });
  }, [preparedRecords, preset, query, referenceNow, sector, sortMode, status]);

  const statusSummary = useMemo(() => {
    return {
      open: records.filter((record) => isOpenStatus(record.status)).length,
      completed: records.filter((record) => record.status === "Tamamlandı").length,
      scheduled: records.filter((record) => record.date.trim()).length,
      unscheduled: records.filter((record) => !record.date.trim()).length,
      today: preparedRecords.filter((record) => isToday(record.parsedDate)).length,
      highValue: preparedRecords.filter((record) => record.numericAmount >= 5000).length,
      needsAction: preparedRecords.filter(
        (record) => isOpenStatus(record.status) && (!record.parsedDate || record.parsedDate.getTime() < referenceNow),
      ).length,
    };
  }, [preparedRecords, records, referenceNow]);

  const pipelineGroups = useMemo(() => {
    return WORKFLOW_ORDER.map((stage) => ({
      stage,
      items: filtered.filter((record) => record.status === stage),
    }));
  }, [filtered]);

  const selectedActivities = useMemo(() => {
    if (!selected) return activities.slice(0, 8);
    return activities.filter((activity) => activity.recordId === selected.id).slice(0, 8);
  }, [activities, selected]);

  async function applyMutation(task: () => Promise<RecordsResponse>) {
    setIsSaving(true);
    setMutationState({ kind: "idle" });

    try {
      const next = await task();
      setRecords(next.records);
      setActivities(next.activities);
      return next;
    } catch (error) {
      setMutationState({
        kind: "error",
        message: error instanceof Error ? error.message : "Kayıt işlemi başarısız oldu.",
      });
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function removeRecord(id: string) {
    const next = await applyMutation(() => deleteRecord(id));
    if (!next) return;
    if (selected?.id === id) setSelected(null);
  }

  async function saveRecord(updated: RecordItem) {
    const next = await applyMutation(() => updateRecord(updated.id, updated));
    if (!next) return;
    const refreshed = next.records.find((item) => item.id === updated.id) ?? updated;
    setSelected(refreshed);
    setEditing(null);
  }

  async function restoreDemoData() {
    const next = await applyMutation(() => resetRecords("seed"));
    if (!next) return;
    setQuery("");
    setSector(DEFAULT_SECTOR);
    setStatus(DEFAULT_STATUS);
    setSortMode("updated");
    setPreset("all");
    setViewMode("cards");
    setSelected(next.records[0] ?? null);
  }

  function clearFilters() {
    setQuery("");
    setSector(DEFAULT_SECTOR);
    setStatus(DEFAULT_STATUS);
    setSortMode("updated");
    setPreset("all");
  }

  async function moveRecord(record: RecordItem, direction: -1 | 1) {
    const index = WORKFLOW_ORDER.indexOf(record.status);
    const target = WORKFLOW_ORDER[index + direction];
    if (!target) return;

    const updated = { ...record, status: target as RecordStatus };
    const next = await applyMutation(() => updateRecord(record.id, updated));
    if (!next) return;
    const refreshed = next.records.find((item) => item.id === updated.id) ?? updated;
    setSelected(refreshed);
    if (editing?.id === updated.id) {
      setEditing(refreshed);
    }
  }

  const hasRecords = records.length > 0;
  const hasActiveFilters =
    Boolean(query) || sector !== DEFAULT_SECTOR || status !== DEFAULT_STATUS || preset !== "all" || sortMode !== "updated";

  const presetCards: Array<{ key: FilterPreset; label: string; value: number; description: string }> = [
    { key: "needs-action", label: "Aksiyon gerekli", value: statusSummary.needsAction, description: "Gecikmiş veya tarihsiz açık kayıtlar" },
    { key: "today", label: "Bugün", value: statusSummary.today, description: "Bugün planı olan kayıtlar" },
    { key: "unscheduled", label: "Tarihsiz", value: statusSummary.unscheduled, description: "Takvime henüz oturmayan işler" },
    { key: "high-value", label: "Yüksek tutar", value: statusSummary.highValue, description: "₺5.000 ve üzeri potansiyel" },
  ];

  return (
    <>
      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Kayıt workspace</p>
              <h3 className="mt-2 text-2xl font-semibold text-white">Arama, filtre, preset ve görünüm kontrolü</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Demo sırasında hızlı segmentlere geçebilmen için üretim odaklı preset filtreler ve sıralama seçenekleri eklendi.
              </p>
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
              {filtered.length} görünür kayıt • {viewMode === "cards" ? "Kart görünümü" : "Pipeline görünümü"}
            </div>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px_180px_200px]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm outline-none placeholder:text-slate-500"
              placeholder="Müşteri, telefon, kaynak, sorumlu veya kayıt ID ara"
            />
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm outline-none"
            >
              <option>{DEFAULT_SECTOR}</option>
              {sectors.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm outline-none"
            >
              <option>{DEFAULT_STATUS}</option>
              {statuses.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm outline-none"
            >
              <option value="updated">Sıralama: varsayılan</option>
              <option value="date-asc">Tarihe göre: yakın → uzak</option>
              <option value="date-desc">Tarihe göre: uzak → yakın</option>
              <option value="amount-desc">Tutara göre: yüksek → düşük</option>
              <option value="customer">Müşteriye göre: A → Z</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <PresetButton label="Tümü" active={preset === "all"} onClick={() => setPreset("all")} count={records.length} />
            {presetCards.map((item) => (
              <PresetButton
                key={item.key}
                label={item.label}
                active={preset === item.key}
                onClick={() => setPreset(item.key)}
                count={item.value}
                description={item.description}
              />
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
            <p>
              <span className="text-white">{filtered.length}</span> kayıt gösteriliyor
              {hasActiveFilters ? " • özel görünüm aktif" : " • tüm liste"}
              {isSaving ? " • server'a kaydediliyor" : " • server-backed workspace"}
            </p>
            <div className="flex flex-wrap gap-2">
              <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-1">
                <button
                  onClick={() => setViewMode("cards")}
                  className={`rounded-xl px-3 py-2 text-sm transition ${
                    viewMode === "cards" ? "bg-white text-slate-950" : "text-slate-300 hover:text-white"
                  }`}
                >
                  Kartlar
                </button>
                <button
                  onClick={() => setViewMode("pipeline")}
                  className={`rounded-xl px-3 py-2 text-sm transition ${
                    viewMode === "pipeline" ? "bg-white text-slate-950" : "text-slate-300 hover:text-white"
                  }`}
                >
                  Pipeline
                </button>
              </div>
              <button
                onClick={clearFilters}
                className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-2 text-sm text-white transition hover:bg-slate-900"
              >
                Filtreleri sıfırla
              </button>
              <button
                onClick={restoreDemoData}
                className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200 transition hover:bg-cyan-500/20"
              >
                Demo datasını geri yükle
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {mutationState.kind === "error" ? (
            <div className="sm:col-span-2 xl:col-span-1 2xl:col-span-2 rounded-[24px] border border-rose-400/20 bg-rose-500/10 p-5 text-sm text-rose-100">
              {mutationState.message}
            </div>
          ) : null}
          <SummaryCard label="Toplam kayıt" value={String(records.length)} sub="Tenant store verisi" />
          <SummaryCard label="Açık süreç" value={String(statusSummary.open)} sub="Yeni + takipte + planlı" />
          <SummaryCard label="Planlı kayıt" value={String(statusSummary.scheduled)} sub="Takvime oturmuş işler" />
          <SummaryCard label="Tamamlanan" value={String(statusSummary.completed)} sub="Kapanan operasyonlar" />
        </div>
      </section>

      {hasRecords ? (
        <section className="grid gap-4 lg:grid-cols-4">
          {presetCards.map((item) => (
            <button
              key={item.key}
              onClick={() => setPreset(item.key)}
              className={`rounded-[24px] border p-5 text-left backdrop-blur transition ${
                preset === item.key
                  ? "border-cyan-400/40 bg-cyan-500/10"
                  : "border-white/10 bg-white/5 hover:border-cyan-400/20"
              }`}
            >
              <p className="text-sm text-slate-400">{item.label}</p>
              <strong className="mt-3 block text-3xl font-semibold text-white">{item.value}</strong>
              <p className="mt-2 text-xs leading-5 text-slate-500">{item.description}</p>
            </button>
          ))}
        </section>
      ) : null}

      {!hasRecords ? (
        <section className="rounded-[28px] border border-dashed border-white/10 bg-white/5 p-8 text-center backdrop-blur sm:p-10">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Kayıt bulunamadı</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">Liste şu anda boş</h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-400">
            Demo verisini geri yükleyebilir veya ilk kaydı oluşturup ürün akışını gerçek kullanım senaryosuna daha yakın test edebilirsin.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={restoreDemoData}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
            >
              Demo verisini yükle
            </button>
            <Link
              href="/records/new"
              className="rounded-2xl border border-white/10 bg-slate-950/55 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
            >
              Yeni kayıt oluştur
            </Link>
          </div>
        </section>
      ) : filtered.length ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_380px]">
          <div>
            {viewMode === "cards" ? (
              <div className="grid gap-4 xl:grid-cols-2">
                {filtered.map((record) => (
                  <RecordCard
                    key={record.id}
                    record={record}
                    selected={selected?.id === record.id}
                    onSelect={() => setSelected(record)}
                    onEdit={() => setEditing(record)}
                    onDelete={() => void removeRecord(record.id)}
                    onMoveBackward={() => void moveRecord(record, -1)}
                    onMoveForward={() => void moveRecord(record, 1)}
                  />
                ))}
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-5">
                {pipelineGroups.map((group) => (
                  <section key={group.stage} className="rounded-[28px] border border-white/10 bg-white/5 p-4 backdrop-blur">
                    <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Aşama</p>
                        <h3 className="mt-1 text-lg font-semibold text-white">{group.stage}</h3>
                      </div>
                      <span className="rounded-full bg-slate-950/55 px-3 py-1 text-xs text-slate-300">{group.items.length}</span>
                    </div>
                    <div className="mt-4 space-y-3">
                      {group.items.length ? (
                        group.items.map((record) => (
                          <button
                            key={record.id}
                            onClick={() => setSelected(record)}
                            className={`w-full rounded-2xl border p-4 text-left transition ${
                              selected?.id === record.id
                                ? "border-cyan-400/40 bg-cyan-500/10"
                                : "border-white/10 bg-slate-950/55 hover:border-cyan-400/30"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-white">{record.customer}</p>
                                <p className="mt-1 text-xs text-slate-500">{record.id}</p>
                              </div>
                              <span className="rounded-full bg-white/5 px-2 py-1 text-[11px] text-slate-300">{record.sector}</span>
                            </div>
                            <p className="mt-3 text-sm text-slate-300">{record.title}</p>
                            <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                              <span>{record.date || "Tarih yok"}</span>
                              <span>{record.amount || "-"}</span>
                            </div>
                          </button>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-500">
                          Bu aşamada kayıt yok.
                        </div>
                      )}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>

          <aside className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8 xl:sticky xl:top-6 xl:self-start">
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Kayıt özeti</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">{selected.customer}</h3>
                    <p className="mt-2 text-sm text-slate-400">
                      {selected.id} • {selected.sector}
                    </p>
                  </div>
                  <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">{selected.status}</span>
                </div>

                <div className="mt-6 rounded-2xl border border-cyan-400/15 bg-cyan-500/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">Workflow kontrolü</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        Kaydı bir sonraki aşamaya taşı veya önceki duruma geri al.
                      </p>
                    </div>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">
                      {WORKFLOW_ORDER.indexOf(selected.status) + 1}/{WORKFLOW_ORDER.length}
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => void moveRecord(selected, -1)}
                      disabled={WORKFLOW_ORDER.indexOf(selected.status) === 0}
                      className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-2 text-sm text-white transition enabled:hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Önceki aşama
                    </button>
                    <button
                      onClick={() => void moveRecord(selected, 1)}
                      disabled={WORKFLOW_ORDER.indexOf(selected.status) === WORKFLOW_ORDER.length - 1}
                      className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200 transition enabled:hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Sonraki aşama
                    </button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {WORKFLOW_ORDER.map((step, index) => {
                      const currentIndex = WORKFLOW_ORDER.indexOf(selected.status);
                      const tone =
                        index < currentIndex
                          ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                          : index === currentIndex
                            ? "border-cyan-400/20 bg-cyan-500/10 text-cyan-200"
                            : "border-white/10 bg-slate-950/55 text-slate-400";
                      return (
                        <span key={step} className={`rounded-full border px-3 py-1 text-xs ${tone}`}>
                          {step}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-6 space-y-3 text-sm text-slate-300">
                  <DetailRow label="İş başlığı" value={selected.title} />
                  <DetailRow label="Telefon" value={selected.phone || "Henüz girilmedi"} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailRow label="Lead kaynağı" value={selected.source || "Henüz girilmedi"} />
                    <DetailRow label="Sorumlu" value={selected.assignee || "Henüz girilmedi"} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailRow label="Durum" value={selected.status} />
                    <DetailRow label="Servis aşaması" value={selected.serviceStage} />
                  </div>
                  <DetailRow label="Planlanan tarih" value={selected.date || "Henüz girilmedi"} />
                  <DetailRow label="Beklenen tutar" value={selected.amount || "Henüz girilmedi"} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailRow label="Oluşturulma" value={formatAuditDate(selected.createdAt)} />
                    <DetailRow label="Son güncelleme" value={formatAuditDate(selected.updatedAt)} />
                  </div>
                  <DetailRow label="Operasyon notu" value={selected.note || "İç not bulunmuyor"} multiline />
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-sm text-slate-400">
                  <p className="font-medium text-white">Önerilen sonraki adım</p>
                  <p className="mt-2 leading-6">{getNextStepCopy(selected.status)}</p>
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">Aktivite geçmişi</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">
                        {selectedActivities.length ? "Bu kayda ait son operasyon hareketleri." : "Bu kayda ait henüz activity log oluşmadı."}
                      </p>
                    </div>
                    <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">{selectedActivities.length} kayıt</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {selectedActivities.length ? (
                      selectedActivities.map((activity) => (
                        <div key={activity.id} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] ${activityTone(activity.type)}`}>{activityLabel(activity.type)}</span>
                            <span className="text-[11px] text-slate-500">{formatAuditDate(activity.createdAt)}</span>
                          </div>
                          <p className="mt-3 text-sm text-white">{activity.summary}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-500">
                        Bu kayda ait henüz geçmiş görünmüyor. İlk düzenleme veya workflow hareketiyle oluşacak.
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={() => setEditing(selected)}
                    className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
                  >
                    Kaydı düzenle
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    className="rounded-2xl border border-white/10 bg-slate-950/55 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
                  >
                    Seçimi temizle
                  </button>
                </div>
              </>
            ) : (
              <div className="flex min-h-72 flex-col items-start justify-center">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Detay paneli</p>
                <h3 className="mt-2 text-2xl font-semibold text-white">Bir kayıt seç</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400">
                  Listeden bir kayıt seçtiğinde burada operasyon özeti, workflow ilerletme, önerilen sonraki adım ve activity geçmişi görünür.
                </p>
                <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-sm text-slate-300">
                  Demo ipucu: önce “Aksiyon gerekli” preset’ine geç, ardından bir kaydı seçip aşama ilerletmesini test et.
                </div>
              </div>
            )}
          </aside>
        </section>
      ) : (
        <section className="rounded-[28px] border border-dashed border-white/10 bg-white/5 p-8 text-center backdrop-blur sm:p-10">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Sonuç bulunamadı</p>
          <h3 className="mt-3 text-2xl font-semibold text-white">Bu görünüm için eşleşen kayıt yok</h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-400">
            Arama ifadesini sadeleştir, preset filtresini “Tümü”ne al, filtreleri sıfırla veya demo datasını geri yükleyerek listeyi yeniden doldur.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={clearFilters}
              className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
            >
              Görünümü sıfırla
            </button>
            <button
              onClick={restoreDemoData}
              className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
            >
              Demo datasını yükle
            </button>
          </div>
        </section>
      )}

      <RecordEditor record={editing} onClose={() => setEditing(null)} onSave={(record) => void saveRecord(record)} />
    </>
  );
}

function PresetButton({
  label,
  active,
  onClick,
  count,
  description,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
  description?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={description}
      className={`rounded-full border px-4 py-2 text-sm transition ${
        active ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-100" : "border-white/10 bg-slate-950/55 text-slate-300 hover:text-white"
      }`}
    >
      {label} <span className="ml-1 text-xs opacity-75">{count}</span>
    </button>
  );
}

function RecordCard({
  record,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onMoveBackward,
  onMoveForward,
}: {
  record: RecordItem;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMoveBackward: () => void;
  onMoveForward: () => void;
}) {
  const currentIndex = WORKFLOW_ORDER.indexOf(record.status);

  return (
    <article
      className={`rounded-[28px] border p-6 backdrop-blur transition ${
        selected ? "border-cyan-400/40 bg-cyan-500/10" : "border-white/10 bg-white/5"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{record.id}</p>
          <h3 className="mt-2 text-xl font-semibold">{record.customer}</h3>
          <p className="mt-2 text-sm text-slate-400">{record.sector}</p>
        </div>
        <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">{record.status}</span>
      </div>

      <div className="mt-6 space-y-3 text-sm text-slate-300">
        <div className="rounded-2xl border border-white/8 bg-slate-950/55 p-4">
          <p className="text-slate-500">Konu</p>
          <p className="mt-2 font-medium text-white">{record.title}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-slate-950/55 p-4">
            <p className="text-slate-500">Tarih</p>
            <p className="mt-2 font-medium text-white">{record.date || "-"}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-slate-950/55 p-4">
            <p className="text-slate-500">Tutar</p>
            <p className="mt-2 font-medium text-white">{record.amount || "-"}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-slate-950/55 p-4">
            <p className="text-slate-500">Telefon</p>
            <p className="mt-2 font-medium text-white">{record.phone || "-"}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-slate-950/55 p-4">
            <p className="text-slate-500">Sorumlu</p>
            <p className="mt-2 font-medium text-white">{record.assignee || "-"}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-slate-950/55 p-4">
            <p className="text-slate-500">Lead kaynağı</p>
            <p className="mt-2 text-white">{record.source || "-"}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-slate-950/55 p-4">
            <p className="text-slate-500">Servis aşaması</p>
            <p className="mt-2 text-white">{record.serviceStage}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-slate-950/55 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-slate-500">Workflow</p>
            <p className="text-xs text-slate-500">{currentIndex + 1}/{WORKFLOW_ORDER.length}</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {WORKFLOW_ORDER.map((step, index) => {
              const tone =
                index < currentIndex
                  ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-200"
                  : index === currentIndex
                    ? "border-cyan-400/20 bg-cyan-500/10 text-cyan-200"
                    : "border-white/10 bg-slate-900/70 text-slate-500";
              return (
                <span key={step} className={`rounded-full border px-3 py-1 text-[11px] ${tone}`}>
                  {step}
                </span>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={onMoveBackward}
              disabled={currentIndex === 0}
              className="rounded-2xl border border-white/10 bg-slate-900/70 px-3 py-2 text-xs text-white transition enabled:hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Geri al
            </button>
            <button
              onClick={onMoveForward}
              disabled={currentIndex === WORKFLOW_ORDER.length - 1}
              className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200 transition enabled:hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              İlerle
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-slate-950/55 p-4">
          <p className="text-slate-500">Not</p>
          <p className="mt-2 text-white">{record.note || "-"}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            onClick={onSelect}
            className="rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-2 text-sm text-white transition hover:bg-slate-900"
          >
            Detay
          </button>
          <button
            onClick={onEdit}
            className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200 transition hover:bg-cyan-500/20"
          >
            Düzenle
          </button>
          <button
            onClick={onDelete}
            className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-500/20"
          >
            Sil
          </button>
        </div>
      </div>
    </article>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 backdrop-blur">
      <p className="text-sm text-slate-400">{label}</p>
      <strong className="mt-3 block text-3xl font-semibold text-white">{value}</strong>
      <p className="mt-2 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

function DetailRow({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
      <p className="text-slate-500">{label}</p>
      <p className={`mt-2 text-white ${multiline ? "whitespace-pre-wrap leading-6" : "font-medium"}`}>{value}</p>
    </div>
  );
}

function getNextStepCopy(status: string) {
  if (status === "Yeni") return "İlk temas yapılıp teklif veya ihtiyaç teyidi notu eklenmeli.";
  if (status === "Takipte") return "Müşteri geri dönüşü veya iç ekip güncellemesi ile kayıt zenginleştirilmeli.";
  if (status === "Planlandı") return "Tarih yaklaşıyorsa ekip ve kaynak planı doğrulanmalı.";
  if (status === "Teslime hazır") return "Teslim veya kapanış adımı sonrası durum 'Tamamlandı' olarak güncellenebilir.";
  return "Kapanış sonrası memnuniyet notu veya çapraz satış fırsatı eklenebilir.";
}

function formatAuditDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Bilinmiyor";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function activityLabel(type: RecordActivity["type"]) {
  if (type === "created") return "Oluşturuldu";
  if (type === "updated") return "Güncellendi";
  if (type === "deleted") return "Silindi";
  if (type === "reset") return "Reset";
  return "Toplu aktarım";
}

function activityTone(type: RecordActivity["type"]) {
  if (type === "created") return "bg-emerald-500/10 text-emerald-200";
  if (type === "updated") return "bg-cyan-500/10 text-cyan-200";
  if (type === "deleted") return "bg-rose-500/10 text-rose-200";
  if (type === "reset") return "bg-amber-500/10 text-amber-200";
  return "bg-violet-500/10 text-violet-200";
}
