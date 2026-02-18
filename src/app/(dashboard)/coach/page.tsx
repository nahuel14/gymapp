import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { Database } from "@/types/supabase";
import { CoachDashboardClient } from "./CoachDashboardClient";

export type CoachPageProps = {
  searchParams?: {
    error?: string;
  };
};

async function ensureCoach() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?view=login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id as never)
    .single();

  const coachProfile =
    profile as
      | {
          role: Database["public"]["Enums"]["user_role"] | null;
          full_name: string | null;
        }
      | null;

  if (!coachProfile || coachProfile.role !== "COACH") {
    redirect("/auth?view=login");
  }
}

export default async function CoachPage({ searchParams }: CoachPageProps) {
  await ensureCoach();

  return (
    <div className="bg-background">
      <CoachDashboardClient errorKey={searchParams?.error} />
    </div>
  );
}
