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

  if (!profile || (profile.role !== "COACH" && profile.role !== "ADMIN")) {
    redirect("/auth?view=login");
  }

  return <CoachStudentDetailClient studentId={studentId} />;
}
