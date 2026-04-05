import { AppShell } from "@/components/app-shell";
import { RecordsClient } from "@/components/records-client";
import { requireSession } from "@/lib/auth";
import { getTenantWorkspace } from "@/lib/records-store";

export default async function RecordsPage() {
  const session = await requireSession();
  const workspace = await getTenantWorkspace(session);

  return (
    <AppShell
      session={session}
      title="Kayıtlar"
      subtitle={`Müşteri, talep, randevu ve iş emirlerini ${session.tenant.name} tenant'ı içinde kart bazlı, mobil öncelikli bir akışta yönet.`}
    >
      <RecordsClient initialRecords={workspace.records} initialActivities={workspace.activities} />
    </AppShell>
  );
}
