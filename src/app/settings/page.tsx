import { AppShell } from "@/components/app-shell";
import { SettingsClient } from "@/components/settings-client";
import { getAuthHealth, requireSession } from "@/lib/auth";
import { getTenantWorkspace } from "@/lib/records-store";
import { listTenantUsers } from "@/lib/auth-store";

export default async function SettingsPage() {
  const session = await requireSession();
  const workspace = await getTenantWorkspace(session);
  const authHealth = getAuthHealth();
  const initialUsers = await listTenantUsers(session.tenant.id);

  return (
    <AppShell
      session={session}
      title="Ayarlar"
      subtitle={`Bu ekran artık ${session.tenant.slug} workspace'i için veri sağlığı, JSON export/import, hızlı kurtarma, planner eşik yönetimi ve kullanıcı erişim kontrolünü topluyor.`}
    >
      <SettingsClient initialRecords={workspace.records} initialSettings={workspace.settings} authHealth={authHealth} initialUsers={initialUsers} currentUserId={session.user.id} currentUserRole={session.user.role} />
    </AppShell>
  );
}
