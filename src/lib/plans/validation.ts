export function simulateExtendCollision(
  otherPlans: Array<{ name: string; start_date: string }>,
  currentEndDate: string,
  newEndDate: string
): { success: boolean; newEndDate: string } {
  const conflict = otherPlans.find(
    (p) => p.start_date > currentEndDate && p.start_date <= newEndDate
  );
  if (conflict) {
    throw new Error(
      `No se puede extender: el plan "${conflict.name}" comienza el ${conflict.start_date}.`
    );
  }
  return { success: true, newEndDate };
}

export function checkPlanShiftCollision(
  otherPlans: Array<{ name: string; start_date: string; end_date: string }>,
  newStart: string,
  newEnd: string
): { hasCollision: boolean; conflictPlan?: string } {
  const conflict = otherPlans.find(
    (p) => p.start_date <= newEnd && p.end_date >= newStart
  );
  return conflict
    ? { hasCollision: true, conflictPlan: conflict.name }
    : { hasCollision: false };
}

export function computeEndDateBlocked(
  planHasSessions: boolean,
  newEndDate: string,
  currentEndDate: string
): boolean {
  if (!planHasSessions) return false;
  return newEndDate < currentEndDate;
}

export function hasShiftedSessionOutside(
  sessions: { date: string }[],
  offsetDays: number,
  newEndDate: string
): boolean {
  return sessions.some((s) => {
    const d = new Date(s.date + "T00:00:00");
    d.setDate(d.getDate() + offsetDays);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${mo}-${day}` > newEndDate;
  });
}
