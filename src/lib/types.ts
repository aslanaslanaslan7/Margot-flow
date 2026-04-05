export type RecordStatus = "Yeni" | "Takipte" | "Planlandı" | "Teslime hazır" | "Tamamlandı";
export type ServiceStage = "Keşif" | "Teklif" | "Randevu" | "Sahada" | "İşlemde" | "Kalite kontrol" | "Teslim";

export type RecordItem = {
  id: string;
  customer: string;
  phone: string;
  sector: string;
  source: string;
  assignee: string;
  title: string;
  status: RecordStatus;
  serviceStage: ServiceStage;
  date: string;
  amount: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type RecordActivityType = "created" | "updated" | "deleted" | "reset" | "replaced" | "settings_updated";

export type RecordActivity = {
  id: string;
  tenantId: string;
  recordId: string | null;
  recordCustomer: string;
  type: RecordActivityType;
  summary: string;
  createdAt: string;
};

export type WorkspaceSettings = {
  staleRecordHours: number;
  highValueThreshold: number;
  plannerHorizonDays: number;
  defaultDailyCapacity: number;
  businessHoursStart: string;
  businessHoursEnd: string;
};

export type RecordsResponse = {
  records: RecordItem[];
  activities: RecordActivity[];
  settings: WorkspaceSettings;
};

export type UserRole = "owner" | "manager" | "operator";

export type TenantContext = {
  id: string;
  slug: string;
  name: string;
  plan: "demo" | "starter" | "growth";
  sector: string;
};

export type UserProfile = {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: "active" | "disabled";
  sessionVersion: number;
};

export type AuthSession = {
  user: UserProfile;
  tenant: TenantContext;
  expiresAt: number;
};
