 "use client";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { Tables } from "@/types/supabase";

type TrainingPlan = Tables<"training_plans">;
type Profile = Tables<"profiles">;

type CoachStudentsResult = {
  coach: Pick<Profile, "id" | "role"> & { name: string | null; last_name: string | null };
  students: {
    planId: TrainingPlan["id"] | null;
    planName: TrainingPlan["name"] | null;
    studentId: string;
    studentName: string;
    startDate: TrainingPlan["start_date"] | null;
  }[];
};

async function fetchCoachStudents(): Promise<CoachStudentsResult | null> {
  const supabase = createSupabaseBrowserClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, name, last_name")
    .eq("id", user.id)
    .single();

  if (!profile || ((profile as any).role !== "COACH" && (profile as any).role !== "ADMIN")) {
    return null;
  }

  const typedProfile = profile as any;

  // 1. Obtener los IDs de los estudiantes según el rol
  let studentIds: string[] = [];

  if (typedProfile.role === "COACH") {
    const { data: assignments } = await (supabase as any)
      .from("coach_students")
      .select("student_id")
      .eq("coach_id", user.id);
    
    studentIds = assignments?.map((a: any) => a.student_id) || [];
  } else {
    // ADMIN ve todos los estudiantes
    const { data: allStudents } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "STUDENT");
    
    studentIds = allStudents?.map(s => s.id) || [];
  }

  if (studentIds.length === 0) {
    return { coach: typedProfile, students: [] };
  }

  // 2. Obtener perfiles de esos estudiantes
  const { data: studentProfiles } = await supabase
    .from("profiles")
    .select("id, name, last_name")
    .in("id", studentIds);

  // 3. Obtener planes activos de esos estudiantes
  const { data: activePlans } = await supabase
    .from("training_plans")
    .select("id, name, student_id, start_date")
    .eq("is_active", true)
    .in("student_id", studentIds);

  const plansByStudent = new Map(
    activePlans?.map(p => [p.student_id, p]) || []
  );

  const students = (studentProfiles || []).map(p => {
    const plan = plansByStudent.get(p.id);
    return {
      studentId: p.id,
      studentName: `${p.name || ""} ${p.last_name || ""}`.trim() || "Sin nombre",
      planId: plan?.id || null,
      planName: plan?.name || null,
      startDate: plan?.start_date || null,
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

