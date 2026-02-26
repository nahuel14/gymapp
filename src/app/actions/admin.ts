 "use server";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/supabase";

type UserRole = Database["public"]["Enums"]["user_role"];

async function ensureAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error("No autenticado");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id as any)
    .single();

  if (!profile || profile.role !== "ADMIN") {
    throw new Error("No tienes permisos de administrador");
  }
  
  return { supabase, adminUser: user };
}

export async function inviteUser(email: string, fullName: string, role: UserRole) {
  await ensureAdmin();
  const adminClient = createSupabaseAdminClient();

  const [firstName, ...lastNameParts] = fullName.split(" ");
  const lastName = lastNameParts.join(" ");

  // 1. Invitar al usuario vía Supabase Auth
  const { data: authData, error: authError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { name: firstName, last_name: lastName },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
  });

  if (authError) throw authError;

  // 2. El trigger de la base de datos debería crear el perfil, 
  // pero lo forzamos/actualizamos para asegurar el nombre y el rol correcto.
  const { error: profileError } = await adminClient
    .from("profiles")
    .upsert({
      id: authData.user.id,
      email: email,
      name: firstName,
      last_name: lastName,
      role: role as any
    } as any, { onConflict: 'id' });

  if (profileError) throw profileError;

  revalidatePath("/admin/dashboard");
  return { success: true, userId: authData.user.id };
}

export async function getAllProfiles() {
  const { supabase } = await ensureAdmin();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function updateUserRole(userId: string, newRole: UserRole) {
  await ensureAdmin();
  const adminClient = createSupabaseAdminClient();

  const { error } = await adminClient
    .from("profiles")
    .update({ role: newRole } as any)
    .eq("id", userId as any);

  if (error) {
    console.error("Error updating role:", error);
    throw new Error(error.message);
  }

  revalidatePath("/admin/dashboard");
  return { success: true };
}

export async function getCoachStudentAssignments() {
  const { supabase } = await ensureAdmin();

  const { data, error } = await (supabase as any)
    .from("coach_students")
    .select("coach_id, student_id");

  if (error) throw error;
  return data as { coach_id: string; student_id: string }[];
}

export async function assignCoachToStudent(coachId: string, studentId: string) {
  await ensureAdmin();
  const adminClient = createSupabaseAdminClient();

  const { error } = await (adminClient as any)
    .from("coach_students")
    .insert({ coach_id: coachId, student_id: studentId });

  if (error) {
    console.error("Error assigning coach:", error);
    throw new Error(error.message);
  }

  revalidatePath("/admin/dashboard");
  return { success: true };
}

export async function removeCoachFromStudent(coachId: string, studentId: string) {
  await ensureAdmin();
  const adminClient = createSupabaseAdminClient();

  const { error } = await (adminClient as any)
    .from("coach_students")
    .delete()
    .eq("coach_id", coachId)
    .eq("student_id", studentId);

  if (error) {
    console.error("Error removing coach:", error);
    throw new Error(error.message);
  }

  revalidatePath("/admin/dashboard");
  return { success: true };
}
