export type TemplateSession = {
  id: number;
  plan_id: number;
  week_number: number;
  day_name: string;
  order_index: number;
};

export function parseDayNumber(dayName: string): number {
  const match = dayName.match(/D[íi]a\s+(\d+)/i);
  return match ? parseInt(match[1], 10) : 0;
}

export function isTemplateUniform(sessions: TemplateSession[]): boolean {
  if (sessions.length === 0) return true;
  const weekMap = new Map<number, Set<string>>();
  for (const s of sessions) {
    if (!weekMap.has(s.week_number)) weekMap.set(s.week_number, new Set());
    weekMap.get(s.week_number)!.add(s.day_name);
  }
  const sets = [...weekMap.values()];
  const ref = sets[0];
  return sets.every((set) => {
    if (set.size !== ref.size) return false;
    for (const d of ref) if (!set.has(d)) return false;
    return true;
  });
}

export function addDayToAllWeeks(sessions: TemplateSession[]): TemplateSession[] {
  if (sessions.length === 0) {
    return [{ id: 1, plan_id: 1, week_number: 1, day_name: "Día 1", order_index: 1 }];
  }
  const weekNumbers = [...new Set(sessions.map((s) => s.week_number))].sort(
    (a, b) => a - b
  );
  const maxDay = Math.max(0, ...sessions.map((s) => parseDayNumber(s.day_name)));
  const newDayName = `Día ${maxDay + 1}`;
  const maxOrderIndex = Math.max(0, ...sessions.map((s) => s.order_index));
  const nextId = Math.max(0, ...sessions.map((s) => s.id)) + 1;
  const newSessions: TemplateSession[] = weekNumbers.map((wk, i) => ({
    id: nextId + i,
    plan_id: sessions[0].plan_id,
    week_number: wk,
    day_name: newDayName,
    order_index: maxOrderIndex + i + 1,
  }));
  return [...sessions, ...newSessions];
}

export function removeDayFromAllWeeks(sessions: TemplateSession[]): {
  sessions: TemplateSession[];
  success: boolean;
  reason?: string;
} {
  const maxDay = Math.max(0, ...sessions.map((s) => parseDayNumber(s.day_name)));
  if (maxDay <= 1) return { sessions, success: false, reason: "min_days" };
  const filtered = sessions.filter((s) => parseDayNumber(s.day_name) !== maxDay);
  return { sessions: filtered, success: true };
}

export function addWeekToTemplate(sessions: TemplateSession[]): TemplateSession[] {
  if (sessions.length === 0) {
    return [{ id: 1, plan_id: 1, week_number: 1, day_name: "Día 1", order_index: 1 }];
  }
  const weekNumbers = [...new Set(sessions.map((s) => s.week_number))].sort(
    (a, b) => a - b
  );
  const maxWeek = Math.max(...weekNumbers);
  const maxOrderIndex = Math.max(0, ...sessions.map((s) => s.order_index));
  const firstWeekSessions = sessions
    .filter((s) => s.week_number === weekNumbers[0])
    .sort((a, b) => parseDayNumber(a.day_name) - parseDayNumber(b.day_name));
  const dayNames = firstWeekSessions.map((s) => s.day_name);
  const nextId = Math.max(0, ...sessions.map((s) => s.id)) + 1;
  const newSessions: TemplateSession[] = dayNames.map((dn, i) => ({
    id: nextId + i,
    plan_id: sessions[0].plan_id,
    week_number: maxWeek + 1,
    day_name: dn,
    order_index: maxOrderIndex + i + 1,
  }));
  return [...sessions, ...newSessions];
}

export function removeWeekFromTemplate(
  sessions: TemplateSession[],
  weekNumber: number
): { sessions: TemplateSession[]; success: boolean; reason?: string } {
  const weekNumbers = [...new Set(sessions.map((s) => s.week_number))].sort(
    (a, b) => a - b
  );
  if (weekNumbers.length <= 1)
    return { sessions, success: false, reason: "min_weeks" };
  const filtered = sessions.filter((s) => s.week_number !== weekNumber);
  const remaining = weekNumbers
    .filter((wk) => wk !== weekNumber)
    .sort((a, b) => a - b);
  const renumbered = filtered.map((s) => {
    const newWeek = remaining.indexOf(s.week_number) + 1;
    return newWeek > 0 ? { ...s, week_number: newWeek } : s;
  });
  return { sessions: renumbered, success: true };
}

export function swapWeeks(
  sessions: TemplateSession[],
  weekA: number,
  weekB: number
): TemplateSession[] {
  return sessions.map((s) => {
    if (s.week_number === weekA) return { ...s, week_number: weekB };
    if (s.week_number === weekB) return { ...s, week_number: weekA };
    return { ...s };
  });
}

export function swapDays(
  sessions: TemplateSession[],
  dayIndexA: number,
  dayIndexB: number
): TemplateSession[] {
  const weekNumbers = [...new Set(sessions.map((s) => s.week_number))].sort(
    (a, b) => a - b
  );
  const result = sessions.map((s) => ({ ...s }));

  for (const wk of weekNumbers) {
    const wkSorted = result
      .filter((s) => s.week_number === wk)
      .sort((a, b) => {
        const nA = parseInt(String(a.day_name).replace(/\D/g, ""), 10) || 0;
        const nB = parseInt(String(b.day_name).replace(/\D/g, ""), 10) || 0;
        return nA - nB || a.id - b.id;
      });

    const sA = wkSorted[dayIndexA];
    const sB = wkSorted[dayIndexB];
    if (!sA || !sB) continue;

    const idxA = result.findIndex((s) => s.id === sA.id);
    const idxB = result.findIndex((s) => s.id === sB.id);

    const tmpName = result[idxA].day_name;
    const tmpOrder = result[idxA].order_index;
    result[idxA].day_name = result[idxB].day_name;
    result[idxA].order_index = result[idxB].order_index;
    result[idxB].day_name = tmpName;
    result[idxB].order_index = tmpOrder;
  }
  return result;
}

export function normalizeSessionDayNames(
  sessions: TemplateSession[]
): TemplateSession[] {
  const weekNumbers = [...new Set(sessions.map((s) => s.week_number))].sort(
    (a, b) => a - b
  );
  const result: TemplateSession[] = [];
  for (const wk of weekNumbers) {
    const wkSessions = sessions
      .filter((s) => s.week_number === wk)
      .sort((a, b) => {
        const nA = parseInt(String(a.day_name).replace(/\D/g, ""), 10) || 0;
        const nB = parseInt(String(b.day_name).replace(/\D/g, ""), 10) || 0;
        return nA - nB || a.id - b.id;
      });
    wkSessions.forEach((s, i) =>
      result.push({ ...s, day_name: `Día ${i + 1}` })
    );
  }
  return result;
}

export function filterTemplatesByCoach(
  templates: Array<{ id: number; coach_id: string; is_template: boolean }>,
  userId: string,
  role: "COACH" | "ADMIN"
): typeof templates {
  if (role === "ADMIN") return templates.filter((t) => t.is_template);
  return templates.filter((t) => t.is_template && t.coach_id === userId);
}

export function remainingWeeks(sessions: TemplateSession[]): number[] {
  return [...new Set(sessions.map((s) => s.week_number))].sort(
    (a, b) => a - b
  );
}

export function buildInitialTemplate(
  weeks: number,
  daysPerWeek: number
): TemplateSession[] {
  const result: TemplateSession[] = [];
  let id = 1;
  let orderIndex = 1;
  for (let w = 1; w <= weeks; w++) {
    for (let d = 1; d <= daysPerWeek; d++) {
      result.push({
        id: id++,
        plan_id: 1,
        week_number: w,
        day_name: `Día ${d}`,
        order_index: orderIndex++,
      });
    }
  }
  return result;
}

export function removeSelectedDay(
  sessions: TemplateSession[],
  sessionIds: number[]
): { sessions: TemplateSession[]; success: boolean; reason?: string } {
  const weekNumbers = [...new Set(sessions.map((s) => s.week_number))];
  const minDaysAfter = Math.min(
    ...weekNumbers.map((wk) => {
      const total = sessions.filter((s) => s.week_number === wk).length;
      const removing = sessions.filter(
        (s) => s.week_number === wk && sessionIds.includes(s.id)
      ).length;
      return total - removing;
    })
  );
  if (minDaysAfter < 1) return { sessions, success: false, reason: "min_days" };
  const filtered = sessions.filter((s) => !sessionIds.includes(s.id));

  const weekNums = [...new Set(filtered.map((s) => s.week_number))];
  const renumbered = filtered.map((s) => ({ ...s }));
  for (const wk of weekNums) {
    const wkSessions = renumbered
      .filter((s) => s.week_number === wk)
      .sort((a, b) => {
        const nA = parseInt(a.day_name.replace(/\D/g, ""), 10) || 0;
        const nB = parseInt(b.day_name.replace(/\D/g, ""), 10) || 0;
        return nA - nB || a.id - b.id;
      });
    wkSessions.forEach((s, i) => {
      s.day_name = `Día ${i + 1}`;
    });
  }
  return { sessions: renumbered, success: true };
}

export function getEditorModeState(
  reorderingWeeks: boolean,
  reorderingDays: boolean
) {
  return {
    showWeekActions: !reorderingDays && !reorderingWeeks,
    showWeekListo: !reorderingDays && reorderingWeeks,
    showDayActions: !reorderingWeeks && !reorderingDays,
    showDayListo: !reorderingWeeks && reorderingDays,
  };
}
