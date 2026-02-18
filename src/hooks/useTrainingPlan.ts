 "use client";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase";

async function fetchActiveTrainingPlan() {
  const supabase = createSupabaseBrowserClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: plans } = await supabase
    .from("training_plans")
    .select("id, name, start_date, is_active")
    .eq("student_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1);

  return plans?.[0] ?? null;
}

export function useActiveTrainingPlan() {
  const query = useQuery({
    queryKey: ["trainingPlan", "active"],
    queryFn: fetchActiveTrainingPlan,
  });

  return query;
}

