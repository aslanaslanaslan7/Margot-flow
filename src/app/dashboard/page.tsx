import { AppShell } from "@/components/app-shell";
import { DashboardClient } from "@/components/dashboard-client";
import { requireSession } from "@/lib/auth";
import { getTenantWorkspace } from "@/lib/records-store";

export default async function DashboardPage() {
  const session = await requireSession();
  const workspace = await getTenantWorkspace(session);

  return (
    <AppShell
      session={session}
      title="Dashboard"
      subtitle={`Şube, sektör ve ekip performansını tek panelde gör. Aktif tenant: ${session.tenant.name}. Bu yapı artık tenant bazlı planner eşikleriyle gerçek operasyon davranışına daha yakın çalışıyor.`}
    >
      <DashboardClient initialRecords={workspace.records} initialActivities={workspace.activities} initialSettings={workspace.settings} />
    </AppShell>
  );
}
