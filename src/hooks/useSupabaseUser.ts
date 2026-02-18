 "use client";
import { useQuery } from "@tanstack/react-query";
import { createSupabaseBrowserClient } from "@/lib/supabase";

async function fetchCurrentUser() {
  const supabase = createSupabaseBrowserClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export function useSupabaseUser() {
  const query = useQuery({
    queryKey: ["supabase", "user"],
    queryFn: fetchCurrentUser,
  });

  return query;
}

