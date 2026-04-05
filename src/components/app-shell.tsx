"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AuthSession } from "@/lib/types";

const navItems = [
  { href: "/dashboard", label: "Dashboard", shortLabel: "Panel", icon: "◫", hint: "Canlı operasyon özeti" },
  { href: "/records", label: "Kayıtlar", shortLabel: "Kayıt", icon: "▣", hint: "Müşteri ve iş akışları" },
  { href: "/planner", label: "Planner", shortLabel: "Plan", icon: "◷", hint: "Takvim ve kapasite" },
  { href: "/records/new", label: "Yeni Kayıt", shortLabel: "Yeni", icon: "+", hint: "Hızlı kayıt oluştur" },
  { href: "/settings", label: "Ayarlar", shortLabel: "Ayar", icon: "⚙", hint: "Şirket ve ürün ayarları" },
];

export function AppShell({
  title,
  subtitle,
  session,
  children,
}: {
  title: string;
  subtitle: string;
  session: AuthSession;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const activeItem = navItems.find((item) => pathname === item.href) ?? navItems[0];

  return (
    <main className="min-h-screen bg-[#07111f] pb-28 text-white lg:pb-6">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[260px_1fr] lg:px-8 lg:py-6">
        <aside className="rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)]">
          <div className="mb-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Margot Flow</p>
                <h1 className="mt-3 text-2xl font-semibold">Professional Console</h1>
              </div>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                {session.tenant.plan === "demo" ? "Live demo" : session.tenant.plan}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Çok sektörlü müşteri, iş emri ve operasyon yönetim paneli.
            </p>
          </div>

          <div className="mb-4 rounded-2xl border border-white/10 bg-slate-950/55 p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Aktif workspace</p>
            <p className="mt-2 text-base font-semibold text-white">{session.tenant.name}</p>
            <p className="mt-1 text-sm text-slate-400">
              {session.user.fullName} • {session.user.role}
            </p>
            <p className="mt-3 text-xs text-cyan-200">{session.tenant.slug} • {session.tenant.sector}</p>
          </div>

          <div className="mb-6 rounded-2xl border border-cyan-400/15 bg-cyan-500/10 p-4 lg:hidden">
            <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">Aktif ekran</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-white">{activeItem.label}</p>
                <p className="mt-1 text-sm text-cyan-100/80">{activeItem.hint}</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-sm text-white">
                {activeItem.icon}
              </span>
            </div>
          </div>

          <nav className="hidden gap-2 lg:grid">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-2xl border px-4 py-3 text-sm transition ${
                    active
                      ? "border-cyan-400/40 bg-cyan-500/10 text-white shadow-[0_0_0_1px_rgba(34,211,238,0.08)]"
                      : "border-white/8 bg-slate-950/50 text-slate-200 hover:border-cyan-400/40 hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className={`mt-1 text-xs ${active ? "text-cyan-100/80" : "text-slate-500"}`}>{item.hint}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs ${active ? "bg-white/10 text-cyan-100" : "bg-white/5 text-slate-400"}`}>
                      {item.icon}
                    </span>
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-100">
            V1 hedefi: auth, tenant veri modeli, CRUD, mobil navigasyon, deploy.
          </div>
        </aside>

        <section className="space-y-6">
          <header className="rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Yönetim paneli</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
                  <span className="rounded-full border border-white/10 bg-slate-950/55 px-3 py-1 text-xs text-slate-300">
                    {activeItem.hint}
                  </span>
                </div>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">{subtitle}</p>
                <p className="mt-3 text-xs text-slate-500">
                  Oturum: {session.user.email} • Tenant: {session.tenant.slug}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/records"
                  className="inline-flex rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-900"
                >
                  Kayıtlara dön
                </Link>
                <Link
                  href="/records/new"
                  className="inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
                >
                  Yeni kayıt oluştur
                </Link>
                <form action="/api/auth/logout" method="post">
                  <button
                    type="submit"
                    className="inline-flex rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/20"
                  >
                    Çıkış yap
                  </button>
                </form>
              </div>
            </div>
          </header>

          {children}
        </section>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[rgba(2,6,23,0.88)] px-3 py-3 backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-7xl grid-cols-5 gap-2">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-16 flex-col items-center justify-center rounded-2xl border px-2 py-2 text-center text-[11px] transition ${
                  active
                    ? "border-cyan-400/40 bg-cyan-500/12 text-cyan-100"
                    : "border-white/8 bg-white/5 text-slate-400"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                <span className="mt-2 leading-tight">{item.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </main>
  );
}
