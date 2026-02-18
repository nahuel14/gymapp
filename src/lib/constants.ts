import type { Database } from "@/types/supabase";

type BodyZone = Database["public"]["Enums"]["body_zone"];
type ExerciseCategory = Database["public"]["Enums"]["exercise_category"];

export const BODY_ZONE_LABELS: Record<BodyZone, string> = {
  LOWER_BODY: "Tren Inferior",
  UPPER_BODY: "Tren Superior",
  CORE: "Zona Media",
  FULL_BODY: "Cuerpo Completo",
  CARDIO: "Cardio",
  MOBILITY: "Movilidad",
};

export const EXERCISE_CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  MAIN: "Principal",
  BALANCE: "Equilibrador",
  AUX: "Auxiliar",
  MOBILITY: "Movilidad",
};
