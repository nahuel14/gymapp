export function toggleExercise(
  expandedIds: Set<number>,
  id: number
): Set<number> {
  const next = new Set(expandedIds);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

export function expandAll(exercises: { id: number }[]): Set<number> {
  return new Set(exercises.map((e) => e.id));
}

export function collapseAll(): Set<number> {
  return new Set<number>();
}

export function isExerciseExpanded(
  expandedIds: Set<number>,
  id: number,
  isEditing: boolean
): boolean {
  return expandedIds.has(id) || isEditing;
}

export function shouldShowTodayButton(
  currentMonday: string,
  todayMonday: string
): boolean {
  return currentMonday !== todayMonday;
}

export function shouldMarkSessionComplete(
  data: Record<string, unknown>
): boolean {
  const sets = data.actual_sets as number | null | undefined;
  return !!(sets && sets > 0);
}
