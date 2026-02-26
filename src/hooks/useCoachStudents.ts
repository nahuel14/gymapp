 "use client";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { Tables } from "@/types/supabase";

type TrainingPlan = Tables<"training_plans">;
type Profile = Tables<"profiles">;

type CoachStudentsResult = {
  coach: Pick<Profile, "id" | "role"> & { name: string | null; last_name: string | null };
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
    .select("id, role, name, last_name")
    .eq("id", user.id)
    .single();

  if (!profile || ((profile as any).role !== "COACH" && (profile as any).role !== "ADMIN")) {
    return null;
  }

  const typedProfile = profile as any;

  let plansQuery = supabase
    .from("training_plans")
    .select("id, name, student_id, is_active, start_date")
    .eq("is_active", true);

  if ((profile as any).role === "COACH") {
    // Si es COACH, filtrar por la tabla intermedia coach_students
    const { data: studentAssignments } = await (supabase as any)
      .from("coach_students")
      .select("student_id")
      .eq("coach_id", user.id);

    const assignedStudentIds = (studentAssignments as any[])?.map(a => a.student_id) || [];
    
    if (assignedStudentIds.length === 0) {
      return { coach: typedProfile, students: [] };
    }

    plansQuery = plansQuery.in("student_id", assignedStudentIds);
  }
  // Si es ADMIN, no filtramos (ve todos los planes activos)

  const { data: plans } = await plansQuery.order("created_at", { ascending: false });

  if (!plans || plans.length === 0) {
    return {
      coach: typedProfile,
      students: [],
    };
  }

  const studentIds = Array.from(
    new Set(plans.map((plan) => plan.student_id).filter(Boolean)),
  ) as string[];

  let studentsById = new Map<string, { name: string | null; last_name: string | null }>();

  if (studentIds.length > 0) {
    const { data: students } = await supabase
      .from("profiles")
      .select("id, name, last_name")
      .in("id", studentIds);

    if (students) {
      studentsById = new Map(
        (students as any[]).map((student) => [student.id, { name: student.name, last_name: student.last_name }]),
      );
    }
  }

  const students = plans.map((plan) => {
    const student = studentsById.get(plan.student_id) ?? {
      name: null,
      last_name: null,
    };

    return {
      planId: plan.id,
      planName: plan.name,
      studentId: plan.student_id,
      studentName: `${student.name || ""} ${student.last_name || ""}`.trim() || "Sin nombre",
      startDate: plan.start_date,
    };
  });

  return {
    coach: typedProfile,
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

