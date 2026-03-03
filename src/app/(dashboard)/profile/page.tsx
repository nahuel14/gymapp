import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase";
import { ProfileClient } from "./ProfileClient";

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth?view=login");
  }

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("email, name, last_name")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/auth?view=login");
  }

  return (
    <div className="min-h-screen bg-background">
      <ProfileClient 
        initialData={{
          email: profile.email || user.email || "",
          name: profile.name || "",
          last_name: profile.last_name || "",
        }} 
      />
    </div>
  );
}
