import { AppShell } from "@/components/app-shell";
import { NewRecordForm } from "@/components/new-record-form";
import { requireSession } from "@/lib/auth";

export default async function NewRecordPage() {
  const session = await requireSession();

  return (
    <AppShell
      session={session}
      title="Yeni Kayıt"
      subtitle={`Form, ${session.tenant.name} için anlık doğrulama, giriş kalite kontrolü ve canlı kayıt önizlemesi ile daha güvenli bir kayıt akışı sunuyor.`}
    >
      <NewRecordForm />
    </AppShell>
  );
}
