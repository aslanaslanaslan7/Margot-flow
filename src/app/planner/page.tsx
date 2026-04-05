import { AppShell } from "@/components/app-shell";
import { PlannerClient } from "@/components/planner-client";
import { requireSession } from "@/lib/auth";
import { getTenantWorkspace } from "@/lib/records-store";

export default async function PlannerPage() {
  const session = await requireSession();
  const workspace = await getTenantWorkspace(session);

  return (
    <AppShell
      session={session}
      title="Planner"
      subtitle={`Tarih girilmiş kayıtları ${session.tenant.name} operasyon ajandasına çevir, geciken işleri ayıkla ve yoğunluğu günlük/haftalık düzeyde gör. Sessiz kayıt eşiği ve planner ufku artık ayarlardan yönetiliyor.`}
    >
      <PlannerClient initialRecords={workspace.records} initialActivities={workspace.activities} initialSettings={workspace.settings} />
    </AppShell>
  );
}
