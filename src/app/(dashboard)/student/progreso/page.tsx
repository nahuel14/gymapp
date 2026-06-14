import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { StudentProgressClient } from "./StudentProgressClient";

export default async function StudentProgressPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth?view=login");

  return <StudentProgressClient studentId={user.id} />;
}
