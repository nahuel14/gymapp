import { BODY_ZONE_LABELS, EXERCISE_CATEGORY_LABELS } from "@/lib/constants";

export function getBodyZoneLabel(zone: string | null): string {
  if (!zone) return "Sin zona";
  return (BODY_ZONE_LABELS as Record<string, string>)[zone] ?? "Sin zona";
}

export function getCategoryLabel(category: string | null): string {
  if (!category) return "Sin categoría";
  return (EXERCISE_CATEGORY_LABELS as Record<string, string>)[category] ?? "Sin categoría";
}

export type LibraryExercise = {
  id: number;
  name: string;
  body_zone: string | null;
  category: string | null;
};

export function filterExercises(
  exercises: LibraryExercise[],
  searchTerm: string,
  bodyZone?: string | null,
  category?: string | null
): LibraryExercise[] {
  return exercises.filter((ex) => {
    const matchesName =
      !searchTerm ||
      ex.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesZone = !bodyZone || ex.body_zone === bodyZone;
    const matchesCategory = !category || ex.category === category;
    return matchesName && matchesZone && matchesCategory;
  });
}

export function validateExerciseName(name: string): {
  valid: boolean;
  error?: string;
} {
  if (!name.trim()) return { valid: false, error: "El nombre es obligatorio" };
  return { valid: true };
}
