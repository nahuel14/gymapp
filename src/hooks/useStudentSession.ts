 "use client";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { Tables } from "@/types/supabase";

type Profile = Tables<"profiles">;
type TrainingPlan = Tables<"training_plans">;
type Session = Tables<"sessions">;
type SessionExercise = Tables<"session_exercises"> & {
  exercise?: {
    name: string | null;
    body_zone: string | null;
    category: string | null;
  } | null;
};

type StudentSessionResult = {
  profile: Profile | null;
  plan: TrainingPlan | null;
  session: Session | null;
  exercises: SessionExercise[];
};

function getTodayName() {
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
    new Date(),
  );
}

async function fetchStudentSession(): Promise<StudentSessionResult> {
  const supabase = createSupabaseBrowserClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      profile: null,
      plan: null,
      session: null,
      exercises: [],
    };
  }

  const { data: profile } = (await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id as any)
    .single()) as any;

  if (!profile || profile.role !== "STUDENT") {
    return {
      profile: null,
      plan: null,
      session: null,
      exercises: [],
    };
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

  const { data: rawSessions } = (await supabase
    .from("sessions")
    .select("id, day_name, week_number, is_completed")
    .eq("plan_id", plan.id)
    .eq("day_name", todayName as any)
    .order("week_number", { ascending: true })
    .order("order_index", { ascending: true })) as any;

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
    exercises: (sessionExercises ?? []) as SessionExercise[],
  };
}

export function useStudentSession() {
  const query = useQuery({
    queryKey: ["student", "session", "today"],
    queryFn: fetchStudentSession,
  });

  return query;
}
