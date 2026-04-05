const MONTHS: Record<string, number> = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};

export const WORKFLOW_ORDER = ["Yeni", "Takipte", "Planlandı", "Teslime hazır", "Tamamlandı"];

export function parseRecordDate(value: string): Date | null {
  const normalized = value.trim();
  if (!normalized) return null;

  const match = normalized.match(/^(\d{1,2})\s+([A-Za-z]{3})(?:\s+(\d{4}))?(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!match) return null;

  const [, dayRaw, monthRaw, yearRaw, hourRaw, minuteRaw] = match;
  const month = MONTHS[monthRaw];
  if (month === undefined) return null;

  const now = new Date();
  const year = yearRaw ? Number(yearRaw) : now.getFullYear();
  const day = Number(dayRaw);
  const hours = hourRaw ? Number(hourRaw) : 9;
  const minutes = minuteRaw ? Number(minuteRaw) : 0;

  const parsed = new Date(year, month, day, hours, minutes, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseAmount(value: string) {
  const normalized = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isToday(date: Date | null) {
  if (!date) return false;
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
}

export function isOpenStatus(status: string) {
  return ["Yeni", "Takipte", "Planlandı", "Teslime hazır"].includes(status);
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 0,
  }).format(value);
}
