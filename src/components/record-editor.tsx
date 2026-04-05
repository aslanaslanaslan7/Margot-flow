"use client";

import { assignees, leadSources, sectors, serviceStages, statuses } from "@/lib/demo-data";
import { RecordItem, RecordStatus } from "@/lib/types";
import { useEffect, useState } from "react";

export function RecordEditor({
  record,
  onClose,
  onSave,
}: {
  record: RecordItem | null;
  onClose: () => void;
  onSave: (record: RecordItem) => void;
}) {
  const [form, setForm] = useState<RecordItem | null>(record);

  useEffect(() => {
    setForm(record);
  }, [record]);

  if (!record || !form) return null;

  function update<K extends keyof RecordItem>(key: K, value: RecordItem[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-auto rounded-[28px] border border-white/10 bg-[#07111f] p-6 text-white shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Kayıt düzenle</p>
            <h3 className="mt-2 text-2xl font-semibold">{record.customer}</h3>
          </div>
          <button onClick={onClose} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm">Kapat</button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Müşteri" value={form.customer} onChange={(v) => update("customer", v)} />
          <Field label="Telefon" value={form.phone} onChange={(v) => update("phone", v)} />
          <Field label="Sektör" value={form.sector} onChange={(v) => update("sector", v)} list={sectors} />
          <Field label="Lead kaynağı" value={form.source} onChange={(v) => update("source", v)} list={leadSources} />
          <Field label="Sorumlu" value={form.assignee} onChange={(v) => update("assignee", v)} list={assignees} />
          <Field label="Durum" value={form.status} onChange={(v) => update("status", v as RecordStatus)} list={statuses} />
          <Field label="Servis aşaması" value={form.serviceStage} onChange={(v) => update("serviceStage", v as RecordItem["serviceStage"])} list={serviceStages} />
          <Field label="Konu" value={form.title} onChange={(v) => update("title", v)} wide />
          <Field label="Tarih" value={form.date} onChange={(v) => update("date", v)} />
          <Field label="Tutar" value={form.amount} onChange={(v) => update("amount", v)} />
        </div>

        <label className="mt-4 block">
          <span className="block text-sm text-slate-400">Not</span>
          <textarea
            value={form.note}
            onChange={(e) => update("note", e.target.value)}
            className="mt-2 min-h-28 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm outline-none"
          />
        </label>

        <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-slate-950/55 p-4 text-sm text-slate-300 sm:grid-cols-2">
          <MetaRow label="Oluşturulma" value={formatAuditDate(form.createdAt)} />
          <MetaRow label="Son güncelleme" value={formatAuditDate(form.updatedAt)} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            onClick={() => onSave(form)}
            className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
          >
            Kaydet
          </button>
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/10 bg-slate-950/55 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
          >
            Vazgeç
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  wide = false,
  list,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
  list?: string[];
}) {
  const listId = list ? `${label}-list` : undefined;
  return (
    <label className={wide ? "lg:col-span-2" : ""}>
      <span className="block text-sm text-slate-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        list={listId}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm outline-none"
      />
      {list ? (
        <datalist id={listId}>
          {list.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      ) : null}
    </label>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 font-medium text-white">{value}</p>
    </div>
  );
}

function formatAuditDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Bilinmiyor";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
