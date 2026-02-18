 "use client";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { Tables } from "@/types/supabase";

type TrainingPlan = Tables<"training_plans">;
type Profile = Tables<"profiles">;

type CoachStudentsResult = {
  coach: Pick<Profile, "full_name" | "id" | "role">;
  students: {
    planId: TrainingPlan["id"];
    planName: TrainingPlan["name"];
    studentId: TrainingPlan["student_id"];
    studentName: string;
    startDate: TrainingPlan["start_date"];
  }[];
};

async function fetchCoachStudents(): Promise<CoachStudentsResult | null> {
  const supabase = createSupabaseBrowserClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "COACH") {
    return null;
  }

  const { data: plans } = await supabase
    .from("training_plans")
    .select("id, name, student_id, is_active, start_date")
    .eq("coach_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (!plans || plans.length === 0) {
    return {
      coach: profile,
      students: [],
    };
  }

  const studentIds = Array.from(
    new Set(plans.map((plan) => plan.student_id).filter(Boolean)),
  ) as string[];

  let studentsById = new Map<string, { full_name: string | null }>();

  if (studentIds.length > 0) {
    const { data: students } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", studentIds);

    if (students) {
      studentsById = new Map(
        students.map((student) => [student.id, { full_name: student.full_name }]),
      );
    }
  }

  const students = plans.map((plan) => {
    const student = studentsById.get(plan.student_id) ?? {
      full_name: null,
    };

    return {
      planId: plan.id,
      planName: plan.name,
      studentId: plan.student_id,
      studentName: student.full_name ?? "Sin nombre",
      startDate: plan.start_date,
    };
  });

  return {
    coach: profile,
    students,
  };
}

export function useCoachStudents() {
  const query = useQuery({
    queryKey: ["coach", "students"],
    queryFn: fetchCoachStudents,
  });

  return query;
}

