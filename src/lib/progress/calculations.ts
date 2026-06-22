/**
 * Calcula el tonelaje de un ejercicio: suma(peso[i] * reps[i]) para cada set.
 * Los valores son strings porque así los almacena Supabase en los arrays.
 */
export function calculateExerciseTonnage(weights: string[], reps: string[]): number {
  let total = 0;
  for (let i = 0; i < weights.length; i++) {
    const w = parseFloat(weights[i] ?? "0");
    const r = parseFloat(reps[i] ?? "0");
    if (!isNaN(w) && !isNaN(r)) total += w * r;
  }
  return total;
}

/**
 * Devuelve el peso máximo levantado en un ejercicio dado el array de pesos por set.
 */
export function getMaxWeight(weights: string[]): number {
  if (weights.length === 0) return 0;
  return Math.max(0, ...weights.map((w) => parseFloat(w) || 0));
}

/**
 * Convierte una fecha "YYYY-MM-DD" al formato de semana ISO "YYYY-Wxx".
 * La semana ISO empieza el lunes y la primera semana del año es la que contiene el primer jueves.
 */
export function getISOWeek(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00Z");
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/**
 * Formatea una fecha "YYYY-MM-DD" como etiqueta corta en español: "15 jun".
 */
export function formatProgressDateLabel(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00Z");
  return date.toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * Convierte una semana ISO "YYYY-Wnn" a la fecha del lunes en español: "25 may".
 */
export function getWeekMondayLabel(isoWeek: string): string {
  const [year, week] = isoWeek.split("-W").map(Number);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() || 7) - 1) + (week - 1) * 7);
  return monday.toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: "UTC" });
}
