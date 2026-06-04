function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function calculatePlanDates(startDate: string, durationWeeks: number) {
  const chosenStart = new Date(startDate + "T00:00:00");
  const startDay = chosenStart.getDay();
  const diffToMonday = startDay === 0 ? -6 : 1 - startDay;
  chosenStart.setDate(chosenStart.getDate() + diffToMonday);
  const startDateStr = chosenStart.toISOString().split("T")[0];

  const exactEnd = new Date(chosenStart);
  exactEnd.setDate(chosenStart.getDate() + Math.max(durationWeeks, 1) * 7 - 1);
  const endDateStr = exactEnd.toISOString().split("T")[0];

  const getDayNameInEnglish = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "long" });
  };

  return {
    start_date: startDateStr,
    end_date: endDateStr,
    generated_day_name: getDayNameInEnglish(startDateStr),
  };
}

export function calculateExtendedEnd(currentEndDate: string, additionalWeeks: number): string {
  if (additionalWeeks < 1) throw new Error("Debe agregar al menos 1 semana");
  const d = new Date(currentEndDate + "T00:00:00");
  d.setDate(d.getDate() + additionalWeeks * 7);
  const dow = d.getDay();
  if (dow !== 0) d.setDate(d.getDate() + (7 - dow));
  return d.toISOString().split("T")[0];
}

export function calcEndDateLocal(mondayStr: string, weeks: number): string {
  const start = new Date(mondayStr + "T00:00:00");
  start.setDate(start.getDate() + Math.max(weeks, 1) * 7 - 1);
  return formatDate(start);
}

export function shiftWeekLocal(dateStr: string, weeks: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + weeks * 7);
  return formatDate(d);
}

export function getMonday(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return formatDate(d);
}
