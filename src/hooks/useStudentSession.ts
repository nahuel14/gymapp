 "use client";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { Database, Tables } from "@/types/supabase";

type Profile = Pick<Tables<"profiles">, "id" | "role" | "full_name">;
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id as Database["public"]["Tables"]["profiles"]["Row"]["id"])
    .single();

  const typedProfile = profile as Profile | null;

  if (!typedProfile || typedProfile.role !== "STUDENT") {
    return {
      profile: null,
      plan: null,
      session: null,
      exercises: [],
    };
  }

  const { data: plans } = await supabase
    .from("training_plans")
    .select("id, name, start_date, is_active")
    .eq(
      "student_id",
      user.id as Database["public"]["Tables"]["training_plans"]["Row"]["student_id"],
    )
    .eq("is_active", true as never)
    .order("created_at", { ascending: false })
    .limit(1);

  const plan = plans?.[0] ?? null;

  if (!plan) {
    return {
      profile: typedProfile,
      plan: null,
      session: null,
      exercises: [],
    };
  }

  const todayName = getTodayName();

  const { data: rawSessions } = await supabase
    .from("sessions")
    .select("id, day_name, week_number, is_completed, plan_id, order_index")
    .eq("plan_id", plan.id)
    .eq("day_name", todayName as never)
    .order("week_number", { ascending: true })
    .order("order_index", { ascending: true });

  const sessions = (rawSessions ?? []) as Tables<"sessions">[];

  const session = sessions[0] ?? null;

  if (!session) {
    return {
      profile: typedProfile,
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
    .eq(
      "session_id",
      session.id as never,
    )
    .order("order_index", { ascending: true });

  return {
    profile: typedProfile,
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
