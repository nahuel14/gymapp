 "use client";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase";
import type { Tables } from "@/types/supabase";

type Profile = Tables<"profiles">;

async function fetchUserProfile() {
  const supabase = createSupabaseBrowserClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile as Profile | null;
}

export function useUserProfile() {
  const query = useQuery({
    queryKey: ["supabase", "profile"],
    queryFn: fetchUserProfile,
  });

  return query;
}

