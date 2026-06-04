export function resolveSuperset(
  exercises: { id: number; superset_group: number | null }[],
  sourceId: number,
  targetId: number
): { id: number; superset_group: number | null }[] {
  const ex1 = exercises.find((e) => e.id === sourceId);
  const ex2 = exercises.find((e) => e.id === targetId);
  if (!ex1 || !ex2) return exercises.map((e) => ({ ...e }));

  let groupNumber: number;
  if (ex1.superset_group !== null) {
    groupNumber = ex1.superset_group;
  } else if (ex2.superset_group !== null) {
    groupNumber = ex2.superset_group;
  } else {
    const maxGroup = Math.max(
      0,
      ...exercises.map((e) => e.superset_group ?? 0)
    );
    groupNumber = maxGroup + 1;
  }

  const groupsToMerge = [ex1.superset_group, ex2.superset_group].filter(
    (g): g is number => g !== null && g !== groupNumber
  );

  return exercises.map((e) => {
    if (e.id === sourceId || e.id === targetId)
      return { ...e, superset_group: groupNumber };
    if (groupsToMerge.includes(e.superset_group as number))
      return { ...e, superset_group: groupNumber };
    return { ...e };
  });
}

export function removeFromSuperset(
  exercises: { id: number; superset_group: number | null }[],
  exerciseId: number
): { id: number; superset_group: number | null }[] {
  return exercises.map((e) =>
    e.id === exerciseId ? { ...e, superset_group: null } : { ...e }
  );
}

export function isSameGroupAsLinking(
  exercises: { id: number; superset_group: number | null }[],
  linkingId: number,
  targetId: number
): boolean {
  const source = exercises.find((e) => e.id === linkingId);
  const target = exercises.find((e) => e.id === targetId);
  if (!source || !target) return false;
  if (source.superset_group === null) return false;
  return source.superset_group === target.superset_group;
}
