# Margot Flow Pro

Profesyonel, çok sektörlü SaaS ürün iskeleti.

## Teknoloji
- Next.js
- TypeScript
- Tailwind CSS
- App Router

## Hedef ürün
Mobil öncelikli, çok sektörlü müşteri ve operasyon yönetim sistemi:
- güzellik / kuaför
- teknik servis
- emlak / danışmanlık
- genel işletme

## Mevcut durum
Bu sürümde:
- premium landing + dashboard hibrit ana ekran
- çok sektörlü ürün konumlandırması
- profesyonel SaaS görsel dili
- canlı ürüne dönüştürmeye uygun temel yapı
- kayıt ekranında filtreler, özet kartları, detay paneli ve demo veri geri yükleme akışı

## Çalıştırma
```bash
npm install
npm run dev
```

Sonra tarayıcıda aç:
- http://localhost:3000

## Ortam değişkenleri
`.env.local` oluşturup aşağıdakileri tanımlayabilirsiniz:

```bash
AUTH_SECRET=replace-with-a-long-random-secret
DEMO_USER_EMAIL=demo@margotflow.local
DEMO_USER_PASSWORD=Demo12345!
DATABASE_PROVIDER=sqlite
SQLITE_PATH=./data/margot-flow.db
```

> Not: Production ortamında varsayılan secret / demo credential kullanmayın.

### Deploy readiness

Ayarlar ekranında server-side bir `Deploy readiness` kartı bulunur.
Canlıya çıkmadan önce aşağıdaki üç maddenin tamamı `Hazır` görünmelidir:

- `AUTH_SECRET` fallback development secret olmamalı
- `DEMO_USER_EMAIL` varsayılan demo email olmamalı
- `DEMO_USER_PASSWORD` varsayılan demo şifre olmamalı
- `DATABASE_PROVIDER` SQLite fallback yerine external provider hedefini göstermeli (`postgres` / `supabase`)

## Veri katmanı
Bu sürümde tenant kayıtları ve auth provisioning `data/margot-flow.db` içindeki SQLite veritabanısında tutulur.

- tekil DB wiring: `src/lib/database.ts` artık auth, records ve login rate-limit katmanlarının ortak entry point'i; SQLite bağlantısı ve provider config tek yerde toplanır
- tablo: `tenants`
- tablo: `users` (`status`, `session_version` ile forced logout / disable senaryolarına hazır)
- tablo: `records`
- tablo: `record_activity`
- auth katmanı: login artık env değerlerini doğrudan karşılaştırmak yerine SQLite içindeki provisioned `users` kaydına karşı hash doğrulaması yapar
- login rate limit: brute-force koruması artık process-memory yerine SQLite içindeki `login_rate_limits` tablosunda tutulur; app restart sonrası da lockout penceresi korunur
- session guard: server-side oturum kontrolü artık DB içindeki `users.status` ve `session_version` alanlarına da bakar; disable edilen veya revoke edilen kullanıcı mevcut cookie ile içeride kalamaz
- settings ekranı artık tenant kullanıcılarını da listeler; owner/manager rolü kullanıcı disable/enable edebilir ve seçili kullanıcı için `session_version` artırarak tüm aktif oturumları anında düşürebilir
- seed/provision davranışı: ilk auth denemesinde demo tenant + demo user otomatik provision edilir; env ile email/şifre değiştirilirse DB kaydı buna senkron kalır
- records domain alanları: `phone`, `source`, `assignee`, `created_at`, `updated_at`
- activity log: create / update / delete / reset / bulk replace hareketleri SQLite üzerinde zaman damgalı tutulur
- migration davranışı: mevcut SQLite dosyasında eksik kolonlar ilk açılışta otomatik eklenir
- seed davranışı: yeni tenant ilk erişimde demo kayıtlarla initialize edilir
- API artık workspace cevabında `records + activities + settings` döner; kayıt ekranı operasyon geçmişini, dashboard/planner ise kalıcı tenant ayarlarını gerçek veriden besler
- workspace settings alanları: `staleRecordHours`, `highValueThreshold`, `plannerHorizonDays`, `defaultDailyCapacity`, `businessHoursStart`, `businessHoursEnd`

> Not: Bu katman hâlâ tek makine / tek node deploy için uygundur. Yeni `DATABASE_PROVIDER` config yüzeyi Postgres/Supabase geçişine hazırlık sağlar; ancak external adapter henüz implement edilmediği için production multi-instance kurulumda sonraki kritik adım hâlâ gerçek Postgres/Supabase entegrasyonudur.

## Operasyon görünürlüğü
- dashboard günlük operasyon öncelikleri yanında sorumlu bazlı yük dağılımını da gösterir
- sorumlu kartları açık iş, planlı/tarihsiz yük, geciken işler ve yüksek değerli fırsatları tek blokta özetler
- planner ekranı günlük kapasite baskısına ek olarak `Sorumlu bazlı kapasite` paneliyle ekip dengesi görünümü sunar

## Sonraki faz
- SQLite katmanını Supabase/Postgres'e taşımak
- tenant/company veri modeli ve user provisioning
- kayıt listesi ve detay sayfaları için daha zengin alanlar ✅ (phone, lead source, assignee, createdAt, updatedAt)
- rol sistemi
- deploy (Vercel)
