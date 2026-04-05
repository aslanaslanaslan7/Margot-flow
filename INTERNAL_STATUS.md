# 2026-03-19 07:00 software block

Tamamlananlar:
- `src/lib/auth.ts` içinde demo kimlik doğrulama, imzalı session cookie üretimi/doğrulaması ve auth config eklendi.
- `src/app/login/page.tsx` ile çalışan login ekranı eklendi.
- `src/app/api/auth/login/route.ts` ve `src/app/api/auth/logout/route.ts` ile login/logout akışı kuruldu.
- `middleware.ts` ile `/dashboard`, `/records`, `/planner`, `/settings` ve alt rotaları korumaya alındı; yetkisiz kullanıcı login ekranına yönlendiriliyor.
- `src/components/app-shell.tsx` içine çıkış yap butonu eklendi.
- Landing sayfadaki CTA `/login` akışına bağlandı.
- Eski çakışan route dosyaları kaldırıldı.
- Doğrulama: `npm run lint` ✅, `npm run build` ✅

Yeni ilerleme (2026-03-19 09:00 bloğu):
- Session cookie payload'ı artık yalnızca email değil; `user + tenant + expiresAt` içeren typed auth session taşıyor.
- `src/lib/types.ts` içine `AuthSession`, `UserProfile`, `TenantContext` tipleri eklendi.
- `src/lib/auth.ts` içine `getCurrentSession()` ve `requireSession()` eklendi; protected sayfalar server-side session okuyup render ediyor.
- `AppShell` artık aktif kullanıcı/tenant/workspace bilgisini sidebar ve header'da gösteriyor.
- `dashboard`, `records`, `planner`, `settings`, `records/new` sayfaları session-aware hale getirildi.
- Doğrulama: `npm run lint` ✅, `npm run build` ✅

Yeni ilerleme (2026-03-19 11:00 bloğu):
- `src/lib/records-store.ts` eklendi; tenant bazlı JSON-backed workspace store kuruldu (`data/records-store.json`). Seed kayıtlar ilk erişimde server-side initialize ediliyor.
- `src/app/api/records/route.ts` ile authenticated CRUD/reset/replace API katmanı kuruldu.
- `src/lib/records-client.ts` ile istemci tarafı fetch helper'ları eklendi.
- `records`, `planner`, `settings`, `dashboard` sayfaları artık initial veriyi server-side `getTenantRecords()` ile alıyor.
- `RecordsClient`, `NewRecordForm`, `PlannerClient`, `SettingsClient`, `DashboardClient` localStorage demo modelinden çıkarıldı; tenant store kullanan gerçek ürün akışına taşındı.
- Settings ekranındaki export/import/reset akışları artık tenant store'u yönetiyor; browser-local demo davranışı kaldırıldı.
- Doğrulama: `npm run lint` ✅, `npm run build` ✅

Yeni ilerleme (2026-03-19 13:00 bloğu):
- `src/lib/login-rate-limit.ts` eklendi; login endpoint için IP+email anahtarlı memory-backed brute-force koruması kuruldu (5 deneme / 15 dk pencere, 15 dk lockout).
- `src/app/api/auth/login/route.ts` artık `NextRequest` kullanıyor; rate limit kontrolü, `Retry-After`, `Cache-Control: no-store`, auth-config health header'ları eklendi.
- Başarılı girişte rate limit state temizleniyor; başarısız denemelerde `invalid_credentials` ve `rate_limited` ayrımı yapılıyor.
- `src/lib/auth.ts` içine auth health kontrolü eklendi; fallback secret ve varsayılan demo credential kullanımı production readiness açısından görünür hale getirildi.
- `src/app/login/page.tsx` rate-limit hata mesajını kullanıcıya gösteriyor.
- `.env.example` ve `README.md` production secret / credential sertleştirme notlarıyla güncellendi.
- Doğrulama: `npm run lint` ✅, `npm run build` ✅

Yeni ilerleme (2026-03-20 07:00 bloğu):
- `src/lib/records-store.ts` JSON dosya deposundan çıkarıldı; tenant kayıtları artık `data/margot-flow.db` içindeki SQLite veritabanısında tutuluyor.
- `tenants` ve `records` tabloları, index'ler ve first-access seed davranışı eklendi; `/api/records` sözleşmesi korunarak mevcut UI kırılmadan DB-backed hale getirildi.
- Tenant metadata her erişimde upsert ediliyor; kayıtlar `position` alanıyla sıralı saklanıyor.
- README veri katmanı notları SQLite gerçekliği ve bir sonraki Postgres/Supabase adımıyla güncellendi.
- Doğrulama: `npm run lint` ✅, `npm run build` ✅

Yeni ilerleme (2026-03-20 09:00 bloğu):
- Record domain modeli genişletildi: `phone`, `source`, `assignee`, `createdAt`, `updatedAt` alanları hem TypeScript tiplerine hem SQLite store katmanına eklendi.
- SQLite için hafif migration davranışı eklendi; mevcut `data/margot-flow.db` dosyalarında eksik kolonlar otomatik açılıyor ve eski kayıtlar güvenli default + timestamp backfill ile normalize ediliyor.
- Yeni kayıt formu artık telefonu note içine gömmüyor; kaynak/sorumlu seçimleri ve audit alanlarıyla gerçek operasyon verisi üretiyor.
- Records listesi ve edit modalı yeni alanları gösteriyor; arama artık telefon/kaynak/sorumlu üzerinden de çalışıyor.
- Doğrulama: `npm run lint` ✅, `npm run build` ✅

Yeni ilerleme (2026-03-20 11:00 bloğu):
- SQLite üstünde yeni `record_activity` tablosu, index'leri ve retention davranışı eklendi; create/update/delete/reset/bulk replace hareketleri artık kalıcı olarak loglanıyor.
- `src/lib/records-store.ts` içinde field-aware change summary üretimi eklendi; durum, sorumlu, tarih, tutar, kaynak, telefon, başlık ve not değişiklikleri insan okunur activity metnine dönüyor.
- `/api/records` sözleşmesi workspace response modeline genişletildi; endpoint artık `records + activities` döndürüyor.
- `RecordsClient` seçilen kayda ait activity timeline'ı sidebar'da gösteriyor; workflow ilerletme ve edit aksiyonları artık görünür operasyon geçmişi bırakıyor.
- `SettingsClient` yeni workspace response modeline uyarlandı; import/reset akışları activity-log genişlemesinden sonra da çalışır durumda.
- README veri katmanı notları `record_activity` gerçekliğiyle güncellendi.
- Doğrulama: `npm run lint` ✅, `npm run build` ✅

Yeni ilerleme (2026-03-20 13:00 bloğu):
- `dashboard` ve `planner` sayfaları artık `getTenantWorkspace()` ile tek seferde `records + activities` alıyor; bu iki ekran da activity-aware hale geldi.
- Dashboard içine yeni SLA / son aksiyon bölümü eklendi; son workspace hareketi, son activity listesi, bugün dokunulan kayıt sayısı, durum hareketleri ve sessiz kayıt sayısı görünüyor.
- Planner içine operasyon temposu kartı, son dokunulan kayıtlar listesi ve activity akışı eklendi; geciken/tarihsiz/sessiz açık kayıtlar üzerinden SLA skoru hesaplanıyor.
- Böylece bir önceki blokta sadece records ekranında görünen audit trail, yönetim ekranlarına da taşınmış oldu.
- Doğrulama: `npm run lint` ✅, `npm run build` ✅

Yeni ilerleme (2026-03-21 07:00 bloğu):
- `src/lib/auth.ts` içinde session cookie doğrulaması sertleştirildi; bozuk base64, hatalı JSON veya kurcalanmış payload artık middleware/API tarafını kırmak yerine güvenli biçimde `null` dönüyor.
- Session payload doğrulaması `isValidSessionPayload()` type guard'ına ayrıldı; auth akışı daha okunur ve bakım yapılabilir hale geldi.
- `src/app/api/auth/logout/route.ts` logout sırasında cookie'yi aynı güvenlik bayraklarıyla explicit olarak expire edecek şekilde güncellendi; `Cache-Control: no-store` da eklendi.
- Doğrulama: `npm run lint` ✅, `npm run build` ✅

Yeni ilerleme (2026-03-21 09:00 bloğu):
- `src/components/settings-client.tsx` import akışı düzeltildi; eski snapshot formatları ile güncel genişletilmiş record modeli (`phone`, `source`, `assignee`, `createdAt`, `updatedAt`) artık tek yerden normalize edilerek içeri alınabiliyor.
- Böylece settings ekranındaki JSON import, service data model genişledikten sonra sessizce bozulma / 400 payload hatası üretme riskinden çıkarıldı; legacy export'lar da geriye dönük uyumlu kaldı.
- Settings tarafında başarılı reset/import/replace işlemlerinden sonra `router.refresh()` tetikleniyor; server component verileri tekrar senkronize oluyor.
- `src/lib/records-client.ts` içindeki tüm mutation fetch'lerine `cache: "no-store"` eklendi; planner/settings/records akışlarında stale response riski azaltıldı.
- Doğrulama: `npm run lint` ✅, `npm run build` ✅

Yeni ilerleme (2026-03-21 11:00 bloğu):
- Tenant bazlı `workspace_settings` SQLite tablosu eklendi; planner/dashboard davranışı için `staleRecordHours`, `highValueThreshold`, `plannerHorizonDays` değerleri artık kalıcı tutuluyor.
- `/api/records` sözleşmesi genişletildi; workspace response artık `records + activities + settings` döndürüyor ve `update-settings` action'ı ile ayarlar server üzerinden kaydediliyor.
- Settings ekranı yalnız veri sağlığı merkezi olmaktan çıkarıldı; planner eşiklerini düzenleyen gerçek bir kontrol paneline dönüştü. JSON export artık settings'i de içeriyor.
- Dashboard ve planner ekranları hardcoded threshold'ları bırakıp tenant ayarlarını kullanacak şekilde bağlandı; yüksek değer skoru, sessiz kayıt eşiği ve plan ufku artık ayarlardan besleniyor.
- Workspace settings değişiklikleri activity log'a `settings_updated` olarak yazılıyor; bu sayede operasyonel eşiklerde yapılan değişiklikler audit trail içinde görünür hale geldi.
- Doğrulama: `npm run lint` ✅, `npm run build` ✅

Yeni ilerleme (2026-03-22 07:00 bloğu):
- `src/lib/auth-store.ts` eklendi; SQLite içinde `users` tablosu ve ilk login sırasında çalışan auth provisioning akışı kuruldu.
- Demo kullanıcı artık env değerleriyle doğrudan string karşılaştırması yerine scrypt-hashed parola ile DB üzerinden doğrulanıyor; session payload gerçek user+tenant kaydından üretiliyor.
- `src/app/api/auth/login/route.ts` async DB-backed auth akışına geçirildi; mevcut rate-limit ve secure cookie davranışı korunarak sellable v1 için daha gerçek provisioning omurgası kuruldu.
- README veri katmanı notları auth + users tablosunu kapsayacak şekilde güncellendi.
- Doğrulama: `npm run lint` ⏳, `npm run build` ⏳

Yeni ilerleme (2026-03-22 09:00 bloğu):
- `users` tablosu `status` ve `session_version` alanlarıyla genişletildi; mevcut SQLite dosyaları için hafif migration (`ALTER TABLE ... ADD COLUMN`) davranışı eklendi.
- Session payload artık `user.status` ve `user.sessionVersion` taşıyor; imzalı cookie tek başına yeterli değil, server-side auth guard DB ile tekrar doğrulama yapıyor.
- `getCurrentSession()` artık cookie imzasını doğruladıktan sonra SQLite içindeki kullanıcı kaydını yeniden okuyor; disabled user, silinmiş user, tenant mismatch veya session version mismatch durumlarında oturum düşüyor.
- Böylece forced logout / session revocation omurgası ilk kez kapanmış oldu: DB tarafında kullanıcı devre dışı bırakılırsa veya `session_version` artırılırsa mevcut cookie ile protected page/API erişimi sürdürülemiyor.
- Doğrulama: `npm run lint` ✅, `npm run build` ✅

Yeni ilerleme (2026-03-22 11:00 bloğu):
- `workspace_settings` modeli zenginleştirildi; yeni kalıcı alanlar `default_daily_capacity`, `business_hours_start`, `business_hours_end` SQLite tarafına eklendi ve mevcut DB dosyaları için hafif migration davranışı yazıldı.
- `src/lib/types.ts`, `records-store` ve `/api/records` doğrulama zinciri genişletildi; tenant settings artık sadece eşik değil kapasite + mesai bilgisi de taşıyor.
- `settings` ekranı yeni günlük kapasite ve mesai başlangıç/bitiş alanlarını yönetiyor; export/import snapshot akışı da bu alanları koruyacak şekilde genişletildi.
- `dashboard` kapasite görünümü artık tenant ayarlarından günlük kapasite, mesai aralığı, ufuk doluluğu ve aşırı yüklenen gün sinyallerini hesaplıyor.
- `planner` SLA/tempo bölümü ile yeni `Kapasite baskısı` paneli aynı ayarları kullanıyor; plan yoğunluğu artık sadece tarih listesi değil, kapasite baskısı olarak da görünür.
- README veri katmanı notları `records + activities + settings` workspace contract'ı ve yeni settings alanlarıyla güncellendi.
- Doğrulama: `npm run lint` ✅, `npm run build` ✅

Yeni ilerleme (2026-03-22 13:00 bloğu):
- `src/app/api/auth/users/route.ts` eklendi; tenant içindeki kullanıcıları listeleyen ve owner/manager için iki yönetim aksiyonu açan bir admin endpoint kuruldu: `set-status` (active/disabled) ve `revoke-sessions` (`session_version` bump).
- `src/lib/auth-store.ts` tenant kullanıcı yönetimiyle genişletildi; `listTenantUsers`, `setTenantUserStatus`, `revokeTenantUserSessions` fonksiyonları eklendi. Böylece sabah açılan DB-backed session revocation omurgası artık panelden kullanılabilir hale geldi.
- `settings` ekranı kullanıcı erişim kontrolü kartı kazandı; aktif tenant kullanıcıları rol/durum/session_version ile listeleniyor, uygun yetkideki kullanıcılar seçili hesabı pasife alabiliyor veya tüm aktif oturumlarını anında düşürebiliyor.
- Güvenlik korkulukları eklendi: current user kendini disable edemiyor, owner kullanıcı admin panelinden disable edilemiyor ve yönetim aksiyonları tenant boundary içinde kalıyor.
- README deploy-readiness / veri katmanı notları tenant user admin yüzeyini kapsayacak şekilde güncellendi.
- Doğrulama: `npm run lint` ✅, `npm run build` ✅

Yeni ilerleme (2026-03-23 07:00 bloğu):
- `src/lib/login-rate-limit.ts` process-memory `Map` modelinden çıkarıldı; brute-force koruması artık SQLite içindeki yeni `login_rate_limits` tablosunda tutuluyor.
- Login endpoint async DB-backed rate-limit akışına geçirildi; başarısız denemeler, lockout süresi ve başarı sonrası temizleme aynı davranışı korurken app restart sonrasında da state kaybolmuyor.
- `PRAGMA journal_mode = WAL` + index'lerle tek makine üstünde daha dayanıklı ve tekrar başlatmaya toleranslı bir auth koruma omurgası kuruldu.
- README veri katmanı notları yeni `login_rate_limits` gerçekliğini yansıtacak şekilde güncellendi.
- Doğrulama: `npm run lint` ⏳, `npm run build` ⏳

Yeni ilerleme (2026-03-23 09:00 bloğu):
- `src/lib/database.ts` eklendi; auth store, records store ve login rate-limit artık tekil DB entry point üzerinden aynı SQLite bağlantısını/paylaşılan config yüzeyini kullanıyor.
- Böylece `data/margot-flow.db` yolunun ve provider kararının üç ayrı dosyada dağılmış kopyaları kaldırıldı; ileride Postgres/Supabase adaptörü eklendiğinde tek yerden geçirilebilecek bir wiring omurgası oluştu.
- `DATABASE_PROVIDER` ve `SQLITE_PATH` env yüzeyi tanımlandı. Şimdilik uygulama yalnızca SQLite provider'ını gerçekten çalıştırıyor; `postgres`/`supabase` seçildiğinde net bir "henüz wired değil" hatası veriyor. Yani yanlış sessiz fallback riski azaltıldı.
- `getAuthHealth()` / deploy readiness checklist'i artık DB provider durumunu da görünür kılıyor; SQLite fallback ile external provider hedefi arasındaki fark ayarlar ekranında işaretleniyor.
- README veri katmanı ve env örnekleri yeni ortak DB wiring yüzeyini yansıtacak şekilde güncellendi.
- Doğrulama: `npm run lint` ⏳, `npm run build` ⏳

Sıradaki en kritik işler:
1. SQLite katmanını deploy-ready Postgres/Supabase adaptörüne taşımak ve migration stratejisi eklemek.
2. Login rate limit katmanını gerçek multi-instance deploy için shared external store'a (Postgres/Redis) taşımak.
3. Dashboard/planner için role-aware ekip metrikleri ve assignee bazlı gerçek kapasite modeli eklemek.
4. Tenant/user provisioning'i demo tek kullanıcı modelinden çıkartıp gerçek multi-user invite/create akışına taşımak.

Yeni ilerleme (2026-03-23 11:00 bloğu):
- Record domain modeli service workflow açısından genişletildi: `RecordItem` içine zorunlu `serviceStage` alanı ve buna karşılık gelen typed `ServiceStage` enum'u eklendi.
- SQLite `records` tablosuna `service_stage` kolonu eklendi; mevcut veritabanıları için hafif migration + backfill davranışı tanımlandı. Böylece eski tenant kayıtları otomatik olarak `Keşif` aşamasına normalize oluyor.
- Seed/demo kayıtları gerçek servis akışını temsil edecek aşamalarla güncellendi (`Keşif`, `Teklif`, `Randevu`, `Kalite kontrol` vb.).
- Yeni kayıt formu ve edit modalı artık servis aşamasını ayrı alan olarak topluyor; records detay/kart görünümü de bu alanı gösteriyor. Böylece yalnızca genel status değil, operasyonun hangi servis adımında olduğu da takip edilebiliyor.
- Settings ekranındaki JSON import normalizer'ı yeni `serviceStage` alanını da destekleyecek şekilde genişletildi; eski snapshot'lar güvenli default ile içeri alınmaya devam ediyor.
- Doğrulama: `npm run build` ✅

Yeni ilerleme (2026-03-23 13:00 bloğu):
- `dashboard` tarafına yeni sorumlu bazlı yük dağılımı görünümü eklendi; açık iş, planlı/tarihsiz yük, geciken işler ve yüksek değerli fırsatlar kişi bazında aynı panelde görünür oldu.
- `planner` artık `Sorumlu bazlı kapasite` paneli taşıyor; ekip dengesini kişi başı açık yük, bugünlük iş, gecikme ve plan boşluğu üzerinden okuyabiliyor.
- Böylece dün/today boyunca eklenen kapasite ayarları, assignee alanı ve service workflow zenginleşmesi ilk kez gerçek operasyon ekranlarında role-aware olmasa da ekip-aware bir planlama yüzeyine dönüştü.
- README operasyon görünürlüğü notları güncellendi.
- Doğrulama: `npm run lint` ✅, `npm run build` ✅

Yeni ilerleme (2026-04-05 07:00 bloğu):
- PostgreSQL ve Supabase adapter stub'ları eklendi (`database-postgres.ts`, `database-supabase.ts`).
- `pg` ve `@supabase/supabase-js` paketleri yüklendi; `@types/pg` eklendi.
- `database.ts` artık provider'a göre uygun adapter'ı seçiyor; SQLite default'ta kalıyor, postgres/supabase seçildiğinde net hata mesajı veriyor (setup talimatlarıyla).
- `.env.example` DATABASE_PROVIDER, DATABASE_URL, SUPABASE_URL/KEY değişkenleriyle güncellendi.
- Build: `npm run lint` ✅, `npm run build` ✅

Sıradaki en kritik işler:
1. PostgreSQL adapter'ını runtime'a bağla (tam query abstraction).
2. Supabase adapter'ını runtime'a bağla.
3. Login rate limit katmanını multi-instance deploy için (Redis/Postgres) taşı.
4. Dashboard/planner için role-aware ekip metrikleri.
5. Tenant/user provisioning'i multi-user invite akışına taşı.
