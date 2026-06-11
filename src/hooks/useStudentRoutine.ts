 "use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { Tables } from "@/types/supabase";

type Profile = Pick<Tables<"profiles">, "id" | "role" | "name" | "last_name">;
type TrainingPlan = Pick<
  Tables<"training_plans">,
  "id" | "name" | "start_date" | "end_date"
>;
type Session = Tables<"sessions">;
type SessionExercise = Tables<"session_exercises"> & {
  exercise?: {
    name: string | null;
    body_zone: string | null;
    category: string | null;
    video_url: string | null;
  } | null;
};

type RoutineResult = {
  profile: Profile | null;
  plan: TrainingPlan | null;
  allPlans: TrainingPlan[];
  sessions: Session[];
  exercisesBySession: Record<number, SessionExercise[]>;
};

async function fetchStudentRoutine(studentId: string): Promise<RoutineResult> {
  const supabase = createSupabaseBrowserClient();

  // 1. Perfil del estudiante
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, name, last_name")
    .eq("id", studentId as any)
    .single();

  const typedProfile = profile as Profile | null;

  // 2. Todos los planes del estudiante
  const { data: allPlansData } = await supabase
    .from("training_plans")
    .select("id, name, start_date, end_date")
    .eq("student_id", studentId as any)
    .eq("is_template", false)
    .order("start_date", { ascending: false });

  const allPlans = (allPlansData ?? []) as TrainingPlan[];

  // Encontrar el plan vigente por rango de fechas
  const today = new Date().toISOString().split("T")[0];
  const plan =
    allPlans.find(
      (p) =>
        p.start_date != null &&
        p.start_date <= today &&
        (p.end_date == null || p.end_date >= today)
    ) ??
    allPlans[0] ??
    null;

  if (allPlans.length === 0) {
    return {
      profile: typedProfile,
      plan: null,
      allPlans: [],
      sessions: [],
      exercisesBySession: {},
    };
  }

  // 3. Sesiones de TODOS los planes del alumno (no solo el vigente)
  const allPlanIds = allPlans.map((p) => p.id);
  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .in("plan_id", allPlanIds as any)
    .order("week_number", { ascending: true })
    .order("order_index", { ascending: true });

  const typedSessions = (sessions ?? []) as Session[];

  // 4. Ejercicios de todas las sesiones
  const sessionIds = typedSessions.map((s) => s.id);

  if (sessionIds.length === 0) {
    return {
      profile: typedProfile,
      plan,
      allPlans: allPlans,
      sessions: typedSessions,
      exercisesBySession: {},
    };
  }

  const { data: sessionExercises } = await supabase
    .from("session_exercises")
    .select(
      "*, exercise:exercises(name, body_zone, video_url)",
    )
    .in("session_id", sessionIds)
    .order("order_index", { ascending: true });

  const typedExercises = (sessionExercises ?? []) as SessionExercise[];

  const exercisesBySession: Record<number, SessionExercise[]> = {};
  typedExercises.forEach((ex) => {
    if (ex.session_id) {
      if (!exercisesBySession[ex.session_id]) {
        exercisesBySession[ex.session_id] = [];
      }
      exercisesBySession[ex.session_id].push(ex);
    }
  });

  return {
    profile: typedProfile,
    plan,
    allPlans: allPlans,
    sessions: typedSessions,
    exercisesBySession,
  };
}

export function useStudentRoutine(studentId: string) {
  return useQuery({
    queryKey: ["student", "routine", studentId],
    queryFn: () => fetchStudentRoutine(studentId),
    enabled: !!studentId,
  });
}

