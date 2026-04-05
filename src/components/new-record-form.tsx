"use client";

import { assignees, leadSources, sectors, serviceStages, statuses } from "@/lib/demo-data";
import { createRecord } from "@/lib/records-client";
import { RecordStatus, ServiceStage } from "@/lib/types";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

const REQUIRED_FIELDS = ["customer", "title"] as const;

type FormState = {
  customer: string;
  phone: string;
  sector: string;
  source: string;
  assignee: string;
  status: string;
  serviceStage: string;
  title: string;
  date: string;
  amount: string;
  note: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const initialForm: FormState = {
  customer: "",
  phone: "",
  sector: sectors[0],
  source: leadSources[0],
  assignee: assignees[0],
  status: statuses[0],
  serviceStage: serviceStages[0],
  title: "",
  date: "",
  amount: "",
  note: "",
};

export function NewRecordForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initialForm);
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errors = useMemo(() => validateForm(form), [form]);
  const canSubmit = Object.keys(errors).length === 0;
  const completion = useMemo(() => {
    const filledCount = [form.customer, form.phone, form.title, form.date, form.amount, form.note].filter((value) => value.trim()).length;
    return Math.round((filledCount / 6) * 100);
  }, [form]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function touch<K extends keyof FormState>(key: K) {
    setTouched((prev) => ({ ...prev, [key]: true }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    setSubmitError(null);

    if (!canSubmit) return;

    const now = new Date().toISOString();
    const payload = {
      id: `REC-${Date.now().toString().slice(-6)}`,
      customer: form.customer.trim(),
      phone: normalizePhone(form.phone),
      sector: form.sector,
      source: form.source,
      assignee: form.assignee,
      title: form.title.trim(),
      status: form.status as RecordStatus,
      serviceStage: form.serviceStage as ServiceStage,
      date: form.date.trim(),
      amount: normalizeAmount(form.amount),
      note: form.note.trim(),
      createdAt: now,
      updatedAt: now,
    };

    try {
      setIsSubmitting(true);
      await createRecord(payload);
      router.push("/records");
      router.refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Kayıt oluşturulamadı.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const visibleErrorCount = Object.entries(errors).filter(([key]) => submitAttempted || touched[key as keyof FormState]).length;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
      <form onSubmit={onSubmit} className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Kayıt oluşturma akışı</p>
            <h3 className="mt-2 text-2xl font-semibold text-white">Zengin servis veri modeli</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Telefon, kaynak, sorumlu ve audit timestamp alanları artık ayrı tutuluyor; not alanı yalnızca operasyon özeti için kalıyor.
            </p>
          </div>
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            Tamamlanma seviyesi <strong className="ml-1 text-white">%{completion}</strong>
          </div>
        </div>

        {!canSubmit && submitAttempted ? (
          <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            Form gönderilmeden önce <strong>{visibleErrorCount}</strong> alanın düzeltilmesi gerekiyor.
          </div>
        ) : null}

        {submitError ? (
          <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {submitError}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <Field
            label="Müşteri adı"
            value={form.customer}
            onChange={(v) => update("customer", v)}
            onBlur={() => touch("customer")}
            placeholder="Örn: Ayşe Demir"
            error={submitAttempted || touched.customer ? errors.customer : undefined}
          />
          <Field
            label="Telefon"
            value={form.phone}
            onChange={(v) => update("phone", v)}
            onBlur={() => touch("phone")}
            placeholder="05xx xxx xx xx"
            helper="İsteğe bağlı ama girilirse en az 10 rakam olmalı."
            error={submitAttempted || touched.phone ? errors.phone : undefined}
          />
          <SelectField label="Sektör" value={form.sector} onChange={(v) => update("sector", v)} options={sectors} />
          <SelectField label="Durum" value={form.status} onChange={(v) => update("status", v)} options={statuses} />
          <SelectField label="Servis aşaması" value={form.serviceStage} onChange={(v) => update("serviceStage", v)} options={serviceStages} />
          <SelectField label="Lead kaynağı" value={form.source} onChange={(v) => update("source", v)} options={leadSources} />
          <SelectField label="Sorumlu" value={form.assignee} onChange={(v) => update("assignee", v)} options={assignees} />
          <Field
            label="Konu / İş başlığı"
            value={form.title}
            onChange={(v) => update("title", v)}
            onBlur={() => touch("title")}
            placeholder="Talep, servis, randevu veya teklif başlığı"
            wide
            error={submitAttempted || touched.title ? errors.title : undefined}
          />
          <Field
            label="Tarih"
            value={form.date}
            onChange={(v) => update("date", v)}
            onBlur={() => touch("date")}
            placeholder="14 Mar 2026 14:00"
            helper="Serbest format desteklenir; planlamada görünmesi için tarih eklemek iyi olur."
            error={submitAttempted || touched.date ? errors.date : undefined}
          />
          <Field
            label="Tutar"
            value={form.amount}
            onChange={(v) => update("amount", v)}
            onBlur={() => touch("amount")}
            placeholder="₺0"
            helper="İsteğe bağlı. Para veya metin olarak yazılabilir."
            error={submitAttempted || touched.amount ? errors.amount : undefined}
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm text-slate-400">Not</label>
          <textarea
            value={form.note}
            onChange={(e) => update("note", e.target.value)}
            onBlur={() => touch("note")}
            className={`mt-2 min-h-32 w-full rounded-2xl border bg-slate-950/55 px-4 py-3 text-sm outline-none placeholder:text-slate-500 ${
              submitAttempted || touched.note
                ? errors.note
                  ? "border-amber-400/40"
                  : "border-white/10 focus:border-cyan-400/40"
                : "border-white/10 focus:border-cyan-400/40"
            }`}
            placeholder="Kısa müşteri notu, işlem detayı veya iç ekip bilgisi"
          />
          <div className="mt-2 flex items-center justify-between gap-3 text-xs">
            <span className={errors.note && (submitAttempted || touched.note) ? "text-amber-200" : "text-slate-500"}>
              {errors.note && (submitAttempted || touched.note) ? errors.note : "Not alanı 240 karaktere kadar özet odaklı tutulursa kartlarda daha iyi görünür."}
            </span>
            <span className="text-slate-500">{form.note.trim().length}/240 önerilen</span>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? "Kaydediliyor..." : "Kaydı oluştur"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="rounded-2xl border border-white/10 bg-slate-950/55 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
          >
            Vazgeç
          </button>
        </div>
      </form>

      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <div className="rounded-[28px] border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-white/5 to-violet-500/10 p-6 backdrop-blur sm:p-8">
          <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">Canlı önizleme</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Kayıt kartı nasıl görünecek?</h3>

          <div className="mt-5 rounded-[24px] border border-white/10 bg-slate-950/60 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Yeni kayıt taslağı</p>
                <h4 className="mt-2 text-xl font-semibold text-white">{form.customer.trim() || "Müşteri adı bekleniyor"}</h4>
                <p className="mt-2 text-sm text-slate-400">{form.sector}</p>
              </div>
              <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200">{form.status}</span>
            </div>

            <div className="mt-5 space-y-3 text-sm text-slate-300">
              <PreviewRow label="Konu" value={form.title.trim() || "Başlık girilmedi"} />
              <div className="grid gap-3 sm:grid-cols-2">
                <PreviewRow label="Telefon" value={normalizePhone(form.phone) || "Henüz girilmedi"} />
                <PreviewRow label="Sorumlu" value={form.assignee} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <PreviewRow label="Durum" value={form.status} />
                <PreviewRow label="Servis aşaması" value={form.serviceStage} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <PreviewRow label="Tarih" value={form.date.trim() || "Henüz planlanmadı"} />
                <PreviewRow label="Tutar" value={normalizeAmount(form.amount) || "Henüz girilmedi"} />
              </div>
              <PreviewRow label="Kaynak" value={form.source} />
              <PreviewRow label="Not" value={form.note.trim() || "İç not görünmüyor"} multiline />
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Giriş kalitesi</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Kontrol listesi</h3>
          <div className="mt-5 space-y-3">
            {[
              {
                label: "Zorunlu alanlar",
                done: REQUIRED_FIELDS.every((field) => !errors[field]),
                detail: "Müşteri adı ve iş başlığı dolu olmalı.",
              },
              {
                label: "İletişim doğruluğu",
                done: !errors.phone,
                detail: form.phone.trim() ? "Telefon numarası ayrı alanda saklanacak." : "Telefon opsiyonel bırakıldı.",
              },
              {
                label: "Operasyon sahipliği",
                done: Boolean(form.assignee.trim()),
                detail: `Kayıt şu anda ${form.assignee} üstünde görünecek.`,
              },
              {
                label: "Kaynak görünürlüğü",
                done: Boolean(form.source.trim()),
                detail: `Lead kaynağı ${form.source} olarak işlenecek.`,
              },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-white">{item.label}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{item.detail}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs ${
                      item.done ? "bg-emerald-500/10 text-emerald-200" : "bg-amber-500/10 text-amber-200"
                    }`}
                  >
                    {item.done ? "Hazır" : "Eksik"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!form.customer.trim()) {
    errors.customer = "Müşteri adı zorunlu.";
  } else if (form.customer.trim().length < 3) {
    errors.customer = "Müşteri adı en az 3 karakter olmalı.";
  }

  if (form.phone.trim()) {
    const digits = form.phone.replace(/\D/g, "");
    if (digits.length < 10) {
      errors.phone = "Telefon için en az 10 rakam gir.";
    }
  }

  if (!form.title.trim()) {
    errors.title = "İş başlığı zorunlu.";
  } else if (form.title.trim().length < 4) {
    errors.title = "Başlık daha açıklayıcı olmalı.";
  }

  if (form.date.trim() && form.date.trim().length < 5) {
    errors.date = "Tarih bilgisi çok kısa görünüyor.";
  }

  if (form.amount.trim()) {
    const hasDigit = /\d/.test(form.amount);
    if (!hasDigit && form.amount.trim().length < 6) {
      errors.amount = "Tutar kısa metin yerine sayı veya daha açıklayıcı bir ifade olmalı.";
    }
  }

  if (form.note.trim().length > 240) {
    errors.note = "Not çok uzadı; kart görünümü için 240 karakter altında tut.";
  }

  return errors;
}

function normalizePhone(value: string) {
  const trimmed = value.trim();
  return trimmed;
}

function normalizeAmount(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("₺") || /[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(trimmed) ? trimmed : `₺${trimmed}`;
}

function Field({
  label,
  placeholder,
  wide = false,
  value,
  onChange,
  onBlur,
  helper,
  error,
}: {
  label: string;
  placeholder: string;
  wide?: boolean;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  helper?: string;
  error?: string;
}) {
  return (
    <label className={wide ? "lg:col-span-2" : ""}>
      <span className="block text-sm text-slate-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`mt-2 w-full rounded-2xl border bg-slate-950/55 px-4 py-3 text-sm outline-none placeholder:text-slate-500 ${
          error ? "border-amber-400/40" : "border-white/10 focus:border-cyan-400/40"
        }`}
        placeholder={placeholder}
      />
      <span className={`mt-2 block text-xs ${error ? "text-amber-200" : "text-slate-500"}`}>{error || helper || " "}</span>
    </label>
  );
}

function SelectField({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="block text-sm text-slate-400">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm outline-none focus:border-cyan-400/40">
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
    </label>
  );
}

function PreviewRow({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-900/70 p-4">
      <p className="text-slate-500">{label}</p>
      <p className={`mt-2 text-white ${multiline ? "whitespace-pre-wrap leading-6" : "font-medium"}`}>{value}</p>
    </div>
  );
}
