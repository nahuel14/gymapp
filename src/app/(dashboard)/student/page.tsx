import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { TablesInsert } from "@/types/supabase";
import {
  BODY_ZONE_LABELS,
  EXERCISE_CATEGORY_LABELS,
} from "@/lib/constants";
import { revalidatePath } from "next/cache";
import { StudentPlanSummaryClient } from "./StudentPlanSummaryClient";

type StudentPageProps = {
  searchParams?: {
    error?: string;
  };
};

function getTodayName() {
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
    new Date(),
  );
}

function parseRepsString(reps: string | null, sets: number | null) {
  if (!reps || !sets || sets <= 0) {
    return [];
  }

  const parts = reps.split("|").map((part) => {
    const value = Number(part.trim());
    if (Number.isNaN(value)) {
      return null;
    }
    return value;
  });

  const result: number[] = [];

  for (let index = 0; index < sets; index += 1) {
    const fromString = parts[index];
    if (typeof fromString === "number") {
      result.push(fromString);
    } else if (parts.length > 0 && typeof parts[parts.length - 1] === "number") {
      result.push(parts[parts.length - 1] as number);
    } else {
      result.push(0);
    }
  }

  return result;
}

function getRpeColor(rpe: number | null) {
  if (!rpe) {
    return "bg-zinc-200 text-zinc-700";
  }
  if (rpe >= 1 && rpe <= 6) {
    return "bg-emerald-100 text-emerald-800";
  }
  if (rpe >= 7 && rpe <= 8) {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-red-100 text-red-800";
}

async function logWorkout(formData: FormData) {
  "use server";

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const sessionExerciseIdValue = formData.get("session_exercise_id");
  const totalSetsValue = formData.get("total_sets");

  const sessionExerciseId =
    typeof sessionExerciseIdValue === "string"
      ? Number(sessionExerciseIdValue)
      : NaN;
  const totalSets =
    typeof totalSetsValue === "string" ? Number(totalSetsValue) : NaN;

  if (!Number.isFinite(sessionExerciseId) || !Number.isFinite(totalSets)) {
    redirect("/student?error=invalidInput");
  }

  const inserts: TablesInsert<"workout_logs">[] = [];

  for (let index = 1; index <= totalSets; index += 1) {
    const weightValue = formData.get(`weight_kg_${index}`);
    const repsValue = formData.get(`reps_performed_${index}`);
    const rpeValue = formData.get(`rpe_actual_${index}`);

    const hasAnyValue = weightValue || repsValue || rpeValue;

    if (!hasAnyValue) {
      continue;
    }

    const weight =
      typeof weightValue === "string" && weightValue.trim().length > 0
        ? Number(weightValue)
        : null;
    const reps =
      typeof repsValue === "string" && repsValue.trim().length > 0
        ? Number(repsValue)
        : null;
    const rpe =
      typeof rpeValue === "string" && rpeValue.trim().length > 0
        ? Number(rpeValue)
        : null;

    inserts.push({
      session_exercise_id: sessionExerciseId,
      set_number: index,
      weight_kg: Number.isFinite(weight as number) ? weight : null,
      reps_performed: Number.isFinite(reps as number) ? reps : null,
      rpe_actual: Number.isFinite(rpe as number) ? rpe : null,
      student_id: user.id,
    });
  }

  if (inserts.length === 0) {
    redirect("/student?error=empty");
  }

  const { error } = await supabase.from("workout_logs").insert(inserts as any);

  if (error) {
    redirect("/student?error=save");
  }

  revalidatePath("/student");
  redirect("/student");
}

async function getStudentContext() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = (await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id as any)
    .single()) as any;

  if (!profile || profile.role !== "STUDENT") {
    redirect("/login");
  }

  const { data: plans } = (await supabase
    .from("training_plans")
    .select("id, name, start_date, is_active")
    .eq("student_id", user.id as any)
    .eq("is_active", true as any)
    .order("created_at", { ascending: false })
    .limit(1)) as any;

  const plan = plans?.[0] ?? null;

  if (!plan) {
    return {
      profile,
      plan: null,
      session: null,
      exercises: [],
    };
  }

  const todayName = getTodayName();

  const { data: rawSessions } = await supabase
    .from("sessions")
    .select("id, day_name, week_number, is_completed")
    .eq("plan_id", plan.id)
    .eq("day_name", todayName as any)
    .order("week_number", { ascending: true })
    .order("order_index", { ascending: true });

  const sessions = (rawSessions ?? []) as any[];

  const session = sessions?.[0] ?? null;

  if (!session) {
    return {
      profile,
      plan,
      session: null,
      exercises: [],
    };
  }

  const { data: sessionExercises } = await supabase
    .from("session_exercises")
    .select(
      "id, sets, reps, rest_seconds, rpe_target, coach_notes, order_index, exercise:exercises(name, body_zone, category)",
    )
    .eq("session_id", session.id)
    .order("order_index", { ascending: true });

  return {
    profile,
    plan,
    session,
    exercises: sessionExercises ?? [],
  };
}

export default async function StudentPage({ searchParams }: StudentPageProps) {
  const { profile, plan, session, exercises } = await getStudentContext();

  const errorKey = searchParams?.error;

  let errorMessage = "";

  if (errorKey === "save") {
    errorMessage = "Ocurrió un error al guardar tu entrenamiento.";
  } else if (errorKey === "empty") {
    errorMessage = "Completa al menos una serie antes de guardar.";
  } else if (errorKey === "invalidInput") {
    errorMessage = "Los datos enviados no son válidos.";
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Sesión de hoy
        </h1>
        <p className="text-sm text-zinc-500">
          {profile.full_name
            ? `Hola, ${profile.full_name}.`
            : "Hola, preparado para entrenar hoy."}
        </p>
      </header>

      <StudentPlanSummaryClient />

      {errorMessage ? (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {!plan ? (
        <div className="rounded-lg bg-white p-6 text-sm text-zinc-600 shadow-sm">
          No tienes un plan de entrenamiento activo asignado.
        </div>
      ) : null}

      {plan && !session ? (
        <div className="rounded-lg bg-white p-6 text-sm text-zinc-600 shadow-sm">
          No hay una sesión programada para hoy en tu plan actual.
        </div>
      ) : null}

      {plan && session ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-1 rounded-lg bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Plan activo
            </p>
            <p className="text-sm font-semibold text-zinc-900">{plan.name}</p>
            <p className="text-xs text-zinc-500">
              Semana {session.week_number} · {session.day_name}
            </p>
          </div>

          <div className="space-y-4">
            {(exercises as any[]).map((exercise) => {
              const sets = exercise.sets ?? 0;
              const targetReps = parseRepsString(exercise.reps, exercise.sets);

              return (
                <form
                  key={exercise.id}
                  action={logWorkout}
                  className="rounded-lg bg-white p-4 shadow-sm"
                >
                  <input
                    type="hidden"
                    name="session_exercise_id"
                    value={exercise.id}
                  />
                  <input
                    type="hidden"
                    name="total_sets"
                    value={sets}
                  />

                  <div className="flex flex-col gap-1 border-b border-zinc-100 pb-3">
                    <div className="flex items-baseline justify-between">
                      <div>
                        <p className="text-sm font-semibold text-zinc-900">
                          {exercise.exercise?.name ?? "Ejercicio"}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {exercise.exercise?.body_zone
                            ? (BODY_ZONE_LABELS as any)[
                                exercise.exercise.body_zone as any
                              ]
                            : null}
                          {exercise.exercise?.body_zone &&
                          exercise.exercise.category
                            ? " · "
                            : null}
                          {exercise.exercise?.category
                            ? (EXERCISE_CATEGORY_LABELS as any)[
                                exercise.exercise.category as any
                              ]
                            : null}
                        </p>
                      </div>
                      {exercise.rpe_target ? (
                        <span className="text-xs font-medium text-zinc-500">
                          RPE objetivo {exercise.rpe_target}
                        </span>
                      ) : null}
                    </div>
                    {exercise.coach_notes ? (
                      <p className="text-xs text-zinc-500">
                        Nota del coach: {exercise.coach_notes}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-2">
                    {Array.from({ length: sets }).map((_, index) => {
                      const setNumber = index + 1;
                      const target = targetReps[index] ?? null;

                      return (
                        <div
                          key={setNumber}
                          className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                              {setNumber}
                            </span>
                            <div className="text-xs text-zinc-600">
                              <p>
                                Serie objetivo:{" "}
                                {target ? `${target} reps` : "Sin objetivo"}
                              </p>
                              {exercise.rest_seconds ? (
                                <p className="text-[11px] text-zinc-400">
                                  Descanso {exercise.rest_seconds} s
                                </p>
                              ) : null}
                            </div>
                          </div>

                          <div className="flex flex-1 items-center justify-end gap-2">
                            <input
                              name={`weight_kg_${setNumber}`}
                              type="number"
                              step="0.5"
                              placeholder="Kg"
                              className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                            />
                            <input
                              name={`reps_performed_${setNumber}`}
                              type="number"
                              placeholder="Reps"
                              className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                            />
                            <input
                              name={`rpe_actual_${setNumber}`}
                              type="number"
                              min={1}
                              max={10}
                              placeholder="RPE"
                              className="w-14 rounded-md border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
                            />
                            <div
                              className={`ml-1 rounded-full px-2 py-1 text-[11px] font-medium ${getRpeColor(
                                exercise.rpe_target,
                              )}`}
                            >
                              RPE
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex justify-end">
                    <button
                      type="submit"
                      className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-zinc-800"
                    >
                      Guardar ejercicio
                    </button>
                  </div>
                </form>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
