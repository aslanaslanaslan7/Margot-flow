import Link from "next/link";

const sectors = [
  {
    name: "Güzellik & Kuaför",
    metric: "84 aktif müşteri",
    detail: "Randevu, paket satış ve müşteri geçmişi",
  },
  {
    name: "Teknik Servis",
    metric: "31 açık iş emri",
    detail: "Cihaz kabul, durum takibi ve teslim yönetimi",
  },
  {
    name: "Emlak & Danışmanlık",
    metric: "19 sıcak lead",
    detail: "Lead havuzu, geri arama ve portföy eşleştirme",
  },
  {
    name: "Genel İşletme",
    metric: "127 kayıt işlendi",
    detail: "Talep, teklif ve müşteri operasyonu tek panelde",
  },
];

const pipeline = [
  { label: "Yeni", value: 18, tone: "from-sky-500/20 to-sky-500/5 text-sky-200" },
  { label: "Takipte", value: 27, tone: "from-amber-500/20 to-amber-500/5 text-amber-200" },
  { label: "Planlandı", value: 14, tone: "from-violet-500/20 to-violet-500/5 text-violet-200" },
  { label: "Tamamlandı", value: 46, tone: "from-emerald-500/20 to-emerald-500/5 text-emerald-200" },
];

const records = [
  {
    customer: "Zehra Kaya",
    sector: "Güzellik",
    title: "Protez tırnak yenileme",
    status: "Randevu yarın 14:00",
    amount: "₺2.400",
  },
  {
    customer: "Mert Yılmaz",
    sector: "Servis",
    title: "MacBook fan değişimi",
    status: "Parça geldi, teslim bekliyor",
    amount: "₺3.850",
  },
  {
    customer: "Elif Acar",
    sector: "Emlak",
    title: "2+1 kiralık daire talebi",
    status: "Akşam aranacak",
    amount: "Komisyon adayı",
  },
];

const features = [
  "Çok sektörlü veri modeli",
  "Mobil öncelikli kullanım",
  "Müşteri + talep + randevu + iş emri akışı",
  "Durum bazlı operasyon yönetimi",
  "Takım ve şube ölçeklenmesine uygun mimari",
  "Supabase/Vercel ile canlıya alınmaya hazır altyapı",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/5 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="p-6 sm:p-8 lg:p-10">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Margot Flow</p>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-5xl">
                    Çok sektörlü, mobil odaklı operasyon paneli.
                  </h1>
                </div>
                <div className="hidden rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200 sm:block">
                  Professional SaaS V1
                </div>
              </div>

              <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Küçük ve orta ölçekli işletmeler için tasarlanmış müşteri, talep, randevu ve iş emri yönetimi.
                Aynı çekirdek ürün; güzellik salonu, teknik servis, emlak ofisi ve genel işletme için uyarlanabilir.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
                >
                  Giriş yap ve demoyu başlat
                </Link>
                <Link
                  href="/settings"
                  className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Ürün planı
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                <StatCard label="Aktif işletme" value="128" sub="4 sektör / tek altyapı" />
                <StatCard label="Aylık işlem" value="18.2K" sub="mobil ve web uyumlu" />
                <StatCard label="Müşteri memnuniyeti" value="%96" sub="hızlı ve sade kullanım" />
              </div>
            </div>

            <div className="border-t border-white/10 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),_transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.96))] p-6 sm:p-8 lg:border-t-0 lg:border-l">
              <div className="rounded-[24px] border border-white/10 bg-slate-950/70 p-5 shadow-lg shadow-cyan-950/20">
                <div className="mb-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Bugün</p>
                    <h2 className="mt-2 text-xl font-semibold">Yönetim Özeti</h2>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                    Sistem aktif
                  </span>
                </div>

                <div className="space-y-3">
                  {pipeline.map((item) => (
                    <div key={item.label} className={`rounded-2xl border border-white/10 bg-gradient-to-r ${item.tone} p-4`}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-300">{item.label}</span>
                        <strong className="text-lg font-semibold text-white">{item.value}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Sektörler</p>
                <h2 className="mt-2 text-2xl font-semibold">Tek ürün, çok kullanım senaryosu</h2>
              </div>
              <span className="text-sm text-slate-400">Dinamik alan yapısı</span>
            </div>

            <div className="grid gap-3">
              {sectors.map((sector) => (
                <div key={sector.name} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4 transition hover:border-cyan-400/40 hover:bg-slate-950">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-medium">{sector.name}</h3>
                      <p className="mt-1 text-sm text-slate-400">{sector.detail}</p>
                    </div>
                    <span className="rounded-full bg-white/6 px-3 py-1 text-xs text-cyan-200">{sector.metric}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8">
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Canlı akış</p>
                <h2 className="mt-2 text-2xl font-semibold">Örnek kayıtlar</h2>
              </div>
              <span className="text-sm text-slate-400">Mobil kart görünümü</span>
            </div>

            <div className="space-y-3">
              {records.map((record) => (
                <div key={record.customer} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-base font-medium">{record.customer}</p>
                      <p className="mt-1 text-sm text-slate-400">{record.sector}</p>
                    </div>
                    <span className="rounded-full bg-white/8 px-3 py-1 text-xs text-slate-300">{record.amount}</span>
                  </div>
                  <p className="mt-4 text-sm font-medium text-white">{record.title}</p>
                  <p className="mt-2 text-sm text-cyan-200">{record.status}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Ürün omurgası</p>
            <h2 className="mt-2 text-2xl font-semibold">Profesyonel sürümde hazır olacak çekirdek</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {features.map((feature) => (
                <div key={feature} className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-4 text-sm text-slate-200">
                  {feature}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-cyan-400/20 bg-gradient-to-br from-cyan-400/10 via-white/5 to-violet-400/10 p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-200">Sıradaki faz</p>
            <h2 className="mt-2 text-2xl font-semibold">Backend ve oturum sistemi</h2>
            <ul className="mt-6 space-y-3 text-sm leading-7 text-slate-200">
              <li>• Next.js + TypeScript ürün yapısı hazır</li>
              <li>• Sonraki adım: Supabase auth + database bağlantısı</li>
              <li>• Tenant/company bazlı veri ayrımı kurulacak</li>
              <li>• CRUD ekranları gerçek veri ile beslenecek</li>
              <li>• Deploy hedefi: Vercel</li>
            </ul>
            <div className="mt-8 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
              Bu ekran artık demo hissinden çıktı; profesyonel ürün landing + dashboard hibrit bir başlangıç iskeleti.
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <strong className="mt-3 block text-2xl font-semibold text-white">{value}</strong>
      <p className="mt-2 text-xs text-slate-500">{sub}</p>
    </div>
  );
}
