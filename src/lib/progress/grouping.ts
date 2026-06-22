import type { TonnageWeek, AttendanceWeek, StrengthPoint } from "@/app/api/progress/[studentId]/route";

const MONTHS_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] as const;

function getMondayDate(isoWeek: string): Date {
  const [year, week] = isoWeek.split("-W").map(Number);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (week - 1) * 7);
  return monday;
}

function toMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toMonthLabel(date: Date): string {
  return `${MONTHS_ES[date.getUTCMonth()]} '${String(date.getUTCFullYear()).slice(2)}`;
}

export function groupTonnageByMonth(weeks: TonnageWeek[]): TonnageWeek[] {
  const map = new Map<string, { tonnage: number; label: string }>();
  for (const w of weeks) {
    const date = getMondayDate(w.week);
    const key = toMonthKey(date);
    if (!map.has(key)) map.set(key, { tonnage: 0, label: toMonthLabel(date) });
    map.get(key)!.tonnage += w.tonnage;
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { tonnage, label }]) => ({ label, week: key, tonnage: Math.round(tonnage) }));
}

export function groupAttendanceByMonth(weeks: AttendanceWeek[]): AttendanceWeek[] {
  const map = new Map<string, { completed: number; total: number; label: string }>();
  for (const w of weeks) {
    const date = getMondayDate(w.week);
    const key = toMonthKey(date);
    if (!map.has(key)) map.set(key, { completed: 0, total: 0, label: toMonthLabel(date) });
    const entry = map.get(key)!;
    entry.completed += w.completed;
    entry.total += w.total;
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, { completed, total, label }]) => ({ label, week: key, completed, total }));
}

export function groupStrengthByMonth(points: StrengthPoint[]): StrengthPoint[] {
  const map = new Map<string, { maxWeight: number; label: string; date: string }>();
  for (const p of points) {
    const date = new Date(p.date + "T12:00:00Z");
    const key = toMonthKey(date);
    if (!map.has(key)) map.set(key, { maxWeight: 0, label: toMonthLabel(date), date: p.date });
    const entry = map.get(key)!;
    if (p.maxWeight > entry.maxWeight) {
      entry.maxWeight = p.maxWeight;
      entry.date = p.date;
    }
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, { maxWeight, label, date }]) => ({ date, label, maxWeight }));
}
