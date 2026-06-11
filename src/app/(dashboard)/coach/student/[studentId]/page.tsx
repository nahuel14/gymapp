import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { CoachStudentDetailClient } from "../CoachStudentDetailClient";

type PageProps = {
  params: Promise<{
    studentId: string;
  }>;
};

export default async function CoachStudentPage({ params }: PageProps) {
  const { studentId } = await params;
  
  // Seguridad en el servidor
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

  if (!profile || (profile.role !== "COACH" && profile.role !== "ADMIN" && profile.role !== "SUPER_STUDENT")) {
    redirect("/auth?view=login");
  }

  if (profile.role === "SUPER_STUDENT" && studentId !== user.id) {
    redirect("/coach/templates");
  }

  return <CoachStudentDetailClient studentId={studentId} viewerRole={profile.role as "COACH" | "ADMIN" | "SUPER_STUDENT"} />;
}
