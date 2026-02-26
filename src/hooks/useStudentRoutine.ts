 "use client";

import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { Database, Tables } from "@/types/supabase";

type Profile = Pick<Tables<"profiles">, "id" | "role" | "name" | "last_name">;
type TrainingPlan = Pick<
  Tables<"training_plans">,
  "id" | "name" | "start_date" | "is_active"
>;
type Session = Tables<"sessions">;
type SessionExercise = Tables<"session_exercises"> & {
  exercise?: {
    name: string | null;
    body_zone: string | null;
    category: string | null;
  } | null;
};

type RoutineResult = {
  profile: Profile | null;
  plan: TrainingPlan | null;
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

  // 2. Plan activo
  const { data: plans } = await supabase
    .from("training_plans")
    .select("id, name, start_date, is_active")
    .eq("student_id", studentId as any)
    .eq("is_active", true as any)
    .order("created_at", { ascending: false })
    .limit(1);

  const plan = plans?.[0] ?? null;

  if (!plan) {
    return {
      profile: typedProfile,
      plan: null,
      sessions: [],
      exercisesBySession: {},
    };
  }

  // 3. Todas las sesiones del plan
  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("plan_id", plan.id)
    .order("week_number", { ascending: true })
    .order("order_index", { ascending: true });

  const typedSessions = (sessions ?? []) as Session[];

  // 4. Ejercicios de todas las sesiones
  const sessionIds = typedSessions.map((s) => s.id);
  
  if (sessionIds.length === 0) {
    return {
      profile: typedProfile,
      plan,
      sessions: typedSessions,
      exercisesBySession: {},
    };
  }

  const { data: sessionExercises } = await supabase
    .from("session_exercises")
    .select(
      "*, exercise:exercises(name, body_zone, category)",
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
