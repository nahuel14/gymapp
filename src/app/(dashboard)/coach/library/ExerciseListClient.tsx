 "use client";
import type { Tables } from "@/types/supabase";
import { BODY_ZONE_LABELS, EXERCISE_CATEGORY_LABELS } from "@/lib/constants";
import { useExercises } from "@/hooks/useExercises";

type Exercise = Tables<"exercises">;

type Props = {
  initialExercises: Exercise[];
};

export function ExerciseListClient({ initialExercises }: Props) {
  const { data: exercises } = useExercises(initialExercises);

  if (!exercises || exercises.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no has creado ningún ejercicio.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {exercises.map((exercise) => (
        <div
          key={exercise.id}
          className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
        >
          <div>
            <p className="text-sm font-medium text-foreground">
              {exercise.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {exercise.body_zone
                ? BODY_ZONE_LABELS[exercise.body_zone]
                : "Sin zona"}
              {" · "}
              {exercise.category
                ? EXERCISE_CATEGORY_LABELS[exercise.category]
                : "Sin categoría"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

