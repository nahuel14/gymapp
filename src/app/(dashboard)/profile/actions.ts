"use server";

import { createSupabaseServerClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function updateOwnProfile(name: string, lastName: string) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const { error } = await supabase
    .from("profiles")
    .update({ name, last_name: lastName } as any)
    .eq("id", user.id as any);

  if (error) throw error;

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return { success: true };
}
