function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function distributeTemplateSessions(
  startMonday: string,
  selectedDays: number[],
  totalWeeks: number
): Array<{ week: number; date: string; dayName: string }> {
  const sorted = [...selectedDays].sort(
    (a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b)
  );
  const sessions: Array<{ week: number; date: string; dayName: string }> = [];
  const monday = new Date(startMonday + "T00:00:00");

  for (let week = 1; week <= totalWeeks; week++) {
    const weekMonday = new Date(monday);
    weekMonday.setDate(monday.getDate() + (week - 1) * 7);
    for (const dayOfWeek of sorted) {
      const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const sessionDate = new Date(weekMonday);
      sessionDate.setDate(weekMonday.getDate() + offset);
      sessions.push({
        week,
        date: sessionDate.toISOString().split("T")[0],
        dayName: sessionDate.toLocaleDateString("en-US", { weekday: "long" }),
      });
    }
  }
  return sessions;
}

export function shiftSessionDates(
  sessions: { id: number; date: string | null }[],
  offsetDays: number
): { id: number; date: string | null }[] {
  return sessions.map((s) => {
    if (!s.date) return s;
    const d = new Date(s.date + "T00:00:00");
    d.setDate(d.getDate() + offsetDays);
    return { ...s, date: formatDate(d) };
  });
}

export function simulateMoveSession(
  currentSessions: { date: string }[],
  newDate: string
): { success: boolean; new_date: string; new_day_name: string } {
  const hasCollision = currentSessions.some((s) => s.date === newDate);
  if (hasCollision) {
    throw new Error(
      "Ya existe un entrenamiento en esta fecha. Selecciona un dia libre."
    );
  }
  const d = new Date(newDate + "T00:00:00");
  return {
    success: true,
    new_date: newDate,
    new_day_name: d.toLocaleDateString("en-US", { weekday: "long" }),
  };
}

export function simulateMoveSessionWithRange(
  existingSessions: { date: string }[],
  newDate: string,
  planRange: { start_date: string | null; end_date: string | null }
): { success: boolean; new_date: string } {
  if (planRange.start_date && newDate < planRange.start_date) {
    throw new Error("La fecha está fuera del rango del plan.");
  }
  if (planRange.end_date && newDate > planRange.end_date) {
    throw new Error("La fecha está fuera del rango del plan.");
  }
  if (existingSessions.some((s) => s.date === newDate)) {
    throw new Error("Ya existe un entrenamiento en esa fecha.");
  }
  return { success: true, new_date: newDate };
}

export function simulateDuplicateSession(
  existingSessions: { date: string }[],
  targetDate: string,
  planRange: { start_date: string; end_date: string }
): { success: boolean; date: string } {
  if (!targetDate) throw new Error("Seleccioná una fecha destino.");
  if (
    targetDate < planRange.start_date ||
    targetDate > planRange.end_date
  ) {
    throw new Error("La fecha destino está fuera del rango del plan.");
  }
  if (existingSessions.some((s) => s.date === targetDate)) {
    throw new Error("Ya existe un entrenamiento en esa fecha.");
  }
  return { success: true, date: targetDate };
}

export function simulateDeleteSession<T extends { id: number }>(
  sessions: T[],
  sessionId: number
): { sessions: T[]; deleted: boolean } {
  const index = sessions.findIndex((s) => s.id === sessionId);
  if (index === -1) return { sessions, deleted: false };
  return { sessions: sessions.filter((s) => s.id !== sessionId), deleted: true };
}

export function simulateAddSession(
  existingSessions: { date: string; plan_id: number }[],
  newDate: string,
  planId: number,
  planRange: { start_date: string; end_date: string }
): { success: boolean; date: string; plan_id: number } {
  if (!newDate) throw new Error("Seleccioná una fecha.");
  if (newDate < planRange.start_date || newDate > planRange.end_date) {
    throw new Error("La fecha está fuera del rango del plan.");
  }
  if (existingSessions.some((s) => s.date === newDate && s.plan_id === planId)) {
    throw new Error("Ya existe un entrenamiento en esa fecha.");
  }
  return { success: true, date: newDate, plan_id: planId };
}

export function simulateCopyExercises<T extends object>(sourceExercises: T[]): T[] {
  return sourceExercises.map((ex) => ({ ...ex }));
}
