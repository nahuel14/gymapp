import { getMonday } from "@/lib/plans/dates";

export type ExportSession = {
  id: number;
  week_number: number;
  day_name: string | null;
  date: string | null;
  order_index: number | null;
};

export type ExportExercise = {
  id: number;
  session_id: number | null;
  order_index: number | null;
  superset_group: number | null;
  target_sets: number | null;
  target_reps: string[] | null;
  target_weight: string[] | null;
  target_rpe: number | null;
  rest_seconds: number | null;
  coach_notes: string | null;
  actual_sets: number | null;
  actual_reps: string[] | null;
  actual_weight: string[] | null;
  actual_rpe: number | null;
  student_notes: string | null;
  exercise?: { name: string | null; exercise_type: string | null } | null;
};

// Mirror la lógica de RoutineCalendarClient: semana calculada desde la fecha real,
// no desde week_number en DB (puede estar desincronizado tras moves/duplicates).
export function effectiveWeek(session: ExportSession, planStartDate: string | null): number {
  if (!session.date || !planStartDate) return session.week_number;
  const sessionMonday = getMonday(session.date);
  const planMonday = getMonday(planStartDate);
  const diffMs =
    new Date(sessionMonday + "T00:00:00").getTime() -
    new Date(planMonday + "T00:00:00").getTime();
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1;
}

export function groupBlocks(exercises: ExportExercise[]) {
  const sorted = [...exercises].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  const blocks: Array<{ letter: string | null; items: ExportExercise[] }> = [];
  let letterIdx = 0;
  const seen = new Map<number, string>();

  for (const ex of sorted) {
    if (ex.superset_group !== null && ex.superset_group !== undefined) {
      if (!seen.has(ex.superset_group)) {
        seen.set(ex.superset_group, String.fromCharCode(65 + (letterIdx++ % 26)));
      }
      const letter = seen.get(ex.superset_group)!;
      const existing = blocks.find((b) => b.letter === letter);
      if (existing) {
        existing.items.push(ex);
      } else {
        blocks.push({ letter, items: [ex] });
      }
    } else {
      blocks.push({ letter: null, items: [ex] });
    }
  }
  return blocks;
}
