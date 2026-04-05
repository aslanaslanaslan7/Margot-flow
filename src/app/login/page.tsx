type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

const errorMessages: Record<string, string> = {
  invalid_credentials: "E-posta veya şifre hatalı.",
  rate_limited: "Çok fazla başarısız giriş denemesi yapıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = params.next && params.next.startsWith("/") ? params.next : "/dashboard";
  const errorMessage = params.error ? errorMessages[params.error] ?? "Giriş sırasında bir hata oluştu." : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07111f] px-4 py-10 text-white">
      <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-8">
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Margot Flow Pro</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Giriş yap</h1>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Bu sürümde dashboard ve operasyon ekranları oturum korumalı çalışır. Demo erişimi için giriş yap.
        </p>

        <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-sm text-cyan-100">
          <p className="font-medium text-white">Demo kullanıcı</p>
          <p className="mt-2">E-posta: demo@margotflow.local</p>
          <p>Şifre: Demo12345!</p>
        </div>

        <form action="/api/auth/login" method="post" className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />

          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">E-posta</span>
            <input
              name="email"
              type="email"
              autoComplete="email"
              defaultValue="demo@margotflow.local"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40"
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm text-slate-300">Şifre</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              defaultValue="Demo12345!"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/40"
              required
            />
          </label>

          {errorMessage ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {errorMessage}
            </div>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
          >
            Dashboard&apos;a gir
          </button>
        </form>
      </div>
    </main>
  );
}
