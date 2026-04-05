export const overviewStats = [
  { label: "Aktif kayıt", value: "128", sub: "Toplam müşteri/talep" },
  { label: "Açık süreç", value: "41", sub: "Takipte + planlandı" },
  { label: "Bugün teslim", value: "12", sub: "Güncel operasyon" },
  { label: "Aylık ciro", value: "₺248K", sub: "Örnek sektör karması" },
];

export const sectorHealth = [
  { sector: "Güzellik", active: 34, tone: "text-pink-200 bg-pink-500/10" },
  { sector: "Teknik Servis", active: 28, tone: "text-sky-200 bg-sky-500/10" },
  { sector: "Emlak", active: 19, tone: "text-violet-200 bg-violet-500/10" },
  { sector: "Genel İşletme", active: 47, tone: "text-emerald-200 bg-emerald-500/10" },
];

const now = "2026-03-20T07:00:00.000Z";

export const records = [
  {
    id: "REC-1001",
    customer: "Zehra Kaya",
    phone: "+90 530 111 22 33",
    sector: "Güzellik",
    source: "Instagram reklamı",
    assignee: "Derya",
    title: "Protez tırnak yenileme",
    status: "Planlandı",
    serviceStage: "Randevu",
    date: "14 Mar 14:00",
    amount: "₺2.400",
    note: "Müşteri renk referanslarını WhatsApp'tan paylaştı.",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "REC-1002",
    customer: "Mert Yılmaz",
    phone: "+90 532 444 55 66",
    sector: "Teknik Servis",
    source: "Google Maps",
    assignee: "Onur",
    title: "MacBook fan değişimi",
    status: "Teslime hazır",
    serviceStage: "Kalite kontrol",
    date: "13 Mar 20:30",
    amount: "₺3.850",
    note: "Parça takıldı, stres testi tamamlandı.",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "REC-1003",
    customer: "Elif Acar",
    phone: "+90 555 987 12 12",
    sector: "Emlak",
    source: "Sahibinden",
    assignee: "Melis",
    title: "2+1 kiralık daire talebi",
    status: "Takipte",
    serviceStage: "Keşif",
    date: "13 Mar 21:15",
    amount: "Komisyon adayı",
    note: "Akşam araması planlandı, bütçe üst sınırı 35K.",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "REC-1004",
    customer: "Atlas Mimarlık",
    phone: "+90 212 555 80 80",
    sector: "Genel İşletme",
    source: "Referans",
    assignee: "Ece",
    title: "Kurumsal teklif talebi",
    status: "Yeni",
    serviceStage: "Teklif",
    date: "14 Mar 10:00",
    amount: "₺18.000",
    note: "Sunum dosyası beklentisi var, karar verici pazartesi dahil olacak.",
    createdAt: now,
    updatedAt: now,
  },
] as const;

export const statuses = ["Yeni", "Takipte", "Planlandı", "Teslime hazır", "Tamamlandı"];
export const serviceStages = ["Keşif", "Teklif", "Randevu", "Sahada", "İşlemde", "Kalite kontrol", "Teslim"];
export const sectors = ["Güzellik", "Teknik Servis", "Emlak", "Genel İşletme"];
export const leadSources = ["Instagram reklamı", "Google Maps", "Sahibinden", "Referans", "Web formu", "WhatsApp", "Diğer"];
export const assignees = ["Derya", "Onur", "Melis", "Ece", "Operasyon", "Satış"];
