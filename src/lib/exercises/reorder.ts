export type ExItem = {
  id: number;
  order_index: number;
  superset_group: number | null;
};

type BlockItem =
  | { type: "standalone"; ex: ExItem }
  | { type: "superset"; group: number; exs: ExItem[] };

export function sortByOrderIndex<T extends { order_index: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order_index - b.order_index);
}

export function swapOrderIndex(
  exercises: { id: number; order_index: number }[],
  indexA: number,
  indexB: number
): { id: number; order_index: number }[] {
  const sorted = sortByOrderIndex(exercises);
  if (
    indexA < 0 ||
    indexA >= sorted.length ||
    indexB < 0 ||
    indexB >= sorted.length
  ) {
    return sorted;
  }
  const result = sorted.map((e) => ({ ...e }));
  const tmp = result[indexA].order_index;
  result[indexA].order_index = result[indexB].order_index;
  result[indexB].order_index = tmp;
  return sortByOrderIndex(result);
}

export function canMoveUp(index: number): boolean {
  return index > 0;
}

export function canMoveDown(index: number, total: number): boolean {
  return index < total - 1;
}

export function buildBlocks(exercises: ExItem[]): BlockItem[] {
  const sorted = sortByOrderIndex(exercises);
  const blocks: BlockItem[] = [];
  const seenGroups = new Set<number>();
  for (const ex of sorted) {
    const g = ex.superset_group;
    if (g === null) {
      blocks.push({ type: "standalone", ex });
    } else if (!seenGroups.has(g)) {
      seenGroups.add(g);
      blocks.push({
        type: "superset",
        group: g,
        exs: sorted.filter((e) => e.superset_group === g),
      });
    }
  }
  return blocks;
}

export function reorderItem(
  exercises: ExItem[],
  itemKey:
    | { type: "standalone"; exerciseId: number }
    | { type: "superset"; group: number },
  direction: "up" | "down"
): { id: number; order_index: number }[] {
  const blocks = buildBlocks(exercises);
  const blockIdx =
    itemKey.type === "standalone"
      ? blocks.findIndex(
          (b) => b.type === "standalone" && (b as { type: "standalone"; ex: ExItem }).ex.id === itemKey.exerciseId
        )
      : blocks.findIndex(
          (b) => b.type === "superset" && (b as { type: "superset"; group: number; exs: ExItem[] }).group === itemKey.group
        );

  const noop = sortByOrderIndex(exercises).map((e) => ({
    id: e.id,
    order_index: e.order_index,
  }));
  if (blockIdx === -1) return noop;

  const targetIdx = direction === "up" ? blockIdx - 1 : blockIdx + 1;
  if (targetIdx < 0 || targetIdx >= blocks.length) return noop;

  const newBlocks = [...blocks];
  [newBlocks[blockIdx], newBlocks[targetIdx]] = [
    newBlocks[targetIdx],
    newBlocks[blockIdx],
  ];

  let idx = 1;
  const result: { id: number; order_index: number }[] = [];
  for (const block of newBlocks) {
    if (block.type === "standalone") {
      result.push({ id: (block as { type: "standalone"; ex: ExItem }).ex.id, order_index: idx++ });
    } else {
      for (const ex of (block as { type: "superset"; group: number; exs: ExItem[] }).exs) {
        result.push({ id: ex.id, order_index: idx++ });
      }
    }
  }
  return result.sort((a, b) => a.order_index - b.order_index);
}
