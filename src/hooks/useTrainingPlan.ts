 "use client";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase";

async function fetchActiveTrainingPlan() {
  const supabase = createSupabaseBrowserClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const today = new Date().toISOString().split("T")[0];

  const { data: plans } = await supabase
    .from("training_plans")
    .select("id, name, start_date, end_date")
    .eq("student_id", user.id)
    .eq("is_template", false)
    .not("start_date", "is", null)
    .order("start_date", { ascending: false });

  if (!plans || plans.length === 0) return null;

  return (
    plans.find(
      (p) => p.start_date! <= today && (p.end_date == null || p.end_date >= today)
    ) ?? plans[0]
  );
}

export function useActiveTrainingPlan() {
  const query = useQuery({
    queryKey: ["trainingPlan", "active"],
    queryFn: fetchActiveTrainingPlan,
  });

  return query;
}
