import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { AdminDashboardClient } from "./AdminDashboardClient";
import { getAllProfiles, getCoachStudentAssignments } from "@/app/actions/admin";

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?view=login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id as any)
    .single();

  if (!profile || profile.role !== "ADMIN") {
    redirect("/auth?view=login");
  }

  const profiles = await getAllProfiles();
  const assignments = await getCoachStudentAssignments();

  return (
    <div className="min-h-screen bg-background">
      <AdminDashboardClient 
        profiles={profiles} 
        assignments={assignments} 
      />
    </div>
  );
}
