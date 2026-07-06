 "use client";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { Tables } from "@/types/supabase";

type Exercise = Tables<"exercises">;

async function fetchExercises() {
  const supabase = createSupabaseBrowserClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data } = await supabase
    .from("exercises")
    .select("id, name, body_zone, video_url, created_at, exercise_type")
    .order("name", { ascending: true });

  return (data ?? []) as Exercise[];
}

export function useExercises(initialData?: Exercise[]) {
  const query = useQuery({
    queryKey: ["exercises"],
    queryFn: fetchExercises,
    initialData,
  });

  return query;
}

