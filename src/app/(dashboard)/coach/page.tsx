import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
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
    redirect("/login");
  }

  const { data: profile } = (await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id as any)
    .single()) as any;

  if (!profile || profile.role !== "COACH") {
    redirect("/login");
  }
}

export default async function CoachPage({ searchParams }: CoachPageProps) {
  await ensureCoach();

  return <CoachDashboardClient errorKey={searchParams?.error} />;
}
