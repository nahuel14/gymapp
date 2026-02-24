import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { StudentRoutineViewClient } from "./StudentRoutineViewClient";

type StudentPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function StudentPage({ searchParams }: StudentPageProps) {
  const params = await searchParams;
  
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?view=login");
  }

  return (
    <div className="bg-background">
      <StudentRoutineViewClient />
    </div>
  );
}
