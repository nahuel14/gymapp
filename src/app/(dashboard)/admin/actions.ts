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

async function handleRoleTransitionCleanup(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  fromRole: UserRole,
  toRole: UserRole
): Promise<void> {
  if (fromRole === toRole) return;
  const coachRoles = new Set<UserRole>(["COACH", "ADMIN"]);

  if (fromRole === "STUDENT") {
    await (adminClient as any).from("coach_students").delete().eq("student_id", userId);
  } else if (fromRole === "SUPER_STUDENT" && coachRoles.has(toRole)) {
    await (adminClient as any).from("coach_students").delete().eq("student_id", userId);
  } else if (coachRoles.has(fromRole) && !coachRoles.has(toRole)) {
    await (adminClient as any).from("coach_students").delete().eq("coach_id", userId);
  }
}

export async function inviteUser(email: string, fullName: string, role: UserRole) {
  await ensureAdmin();
  const adminClient = createSupabaseAdminClient();

  const [firstName, ...lastNameParts] = fullName.split(" ");
  const lastName = lastNameParts.join(" ");

  const { data: authData, error: authError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { name: firstName, last_name: lastName },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/auth/callback`
  });

  if (authError) throw authError;

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

export async function updateUserAsAdmin(userId: string, name: string, lastName: string, role: UserRole) {
  await ensureAdmin();
  const adminClient = createSupabaseAdminClient();

  const { data: current } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId as any)
    .single();

  const fromRole = (current as any)?.role as UserRole | undefined;

  if (fromRole === "ADMIN" && (role === "STUDENT" || role === "SUPER_STUDENT")) {
    throw new Error("Un administrador no puede cambiar a este rol. Eliminá el usuario y creá uno nuevo.");
  }

  if (fromRole && fromRole !== role) {
    await handleRoleTransitionCleanup(adminClient, userId, fromRole, role);
  }

  const { error } = await adminClient
    .from("profiles")
    .update({
      name,
      last_name: lastName,
      role: role as any
    } as any)
    .eq("id", userId as any);

  if (error) {
    console.error("Error updating user as admin:", error);
    throw new Error(error.message);
  }

  revalidatePath("/admin/dashboard");
  return { success: true };
}

export async function getUserDeleteSummary(userId: string): Promise<{
  role: string;
  planCount: number;
  templateCount: number;
}> {
  await ensureAdmin();
  const adminClient = createSupabaseAdminClient();

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId as any)
    .single();

  const role = (profile as any)?.role ?? "STUDENT";

  if (role === "STUDENT") {
    const { count } = await adminClient
      .from("training_plans")
      .select("id", { count: "exact", head: true })
      .eq("student_id", userId as any)
      .eq("is_template", false as any);
    return { role, planCount: count ?? 0, templateCount: 0 };
  }

  if (role === "SUPER_STUDENT") {
    const [{ count: planCount }, { count: templateCount }] = await Promise.all([
      adminClient
        .from("training_plans")
        .select("id", { count: "exact", head: true })
        .eq("student_id", userId as any)
        .eq("is_template", false as any),
      adminClient
        .from("training_plans")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", userId as any)
        .eq("is_template", true as any),
    ]);
    return { role, planCount: planCount ?? 0, templateCount: templateCount ?? 0 };
  }

  const { count } = await adminClient
    .from("training_plans")
    .select("id", { count: "exact", head: true })
    .eq("coach_id", userId as any)
    .eq("is_template", true as any);
  return { role, planCount: 0, templateCount: count ?? 0 };
}

export async function deleteUser(userId: string) {
  await ensureAdmin();
  const adminClient = createSupabaseAdminClient();

  const { data: profile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", userId as any)
    .single();
  const role = (profile as any)?.role ?? "STUDENT";

  if (role === "ADMIN") {
    const { count } = await adminClient
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "ADMIN" as any);
    if ((count ?? 0) <= 1) {
      throw new Error("No se puede eliminar el único administrador del sistema.");
    }
  }

  if (role === "STUDENT") {
    const { data: plans } = await adminClient
      .from("training_plans")
      .select("id")
      .eq("student_id", userId as any)
      .eq("is_template", false as any);
    const planIds = (plans ?? []).map((p: any) => p.id as number);

    if (planIds.length > 0) {
      const { data: sessions } = await adminClient
        .from("sessions")
        .select("id")
        .in("plan_id", planIds as any);
      const sessionIds = (sessions ?? []).map((s: any) => s.id as number);

      if (sessionIds.length > 0) {
        await adminClient.from("session_exercises").delete().in("session_id", sessionIds as any);
      }
      await adminClient.from("sessions").delete().in("plan_id", planIds as any);
      await adminClient.from("training_plans").delete().in("id", planIds as any);
    }
  } else if (role === "SUPER_STUDENT") {
    const { data: plans } = await adminClient
      .from("training_plans")
      .select("id")
      .eq("student_id", userId as any)
      .eq("is_template", false as any);
    const planIds = (plans ?? []).map((p: any) => p.id as number);

    if (planIds.length > 0) {
      const { data: sessions } = await adminClient
        .from("sessions")
        .select("id")
        .in("plan_id", planIds as any);
      const sessionIds = (sessions ?? []).map((s: any) => s.id as number);

      if (sessionIds.length > 0) {
        await adminClient.from("session_exercises").delete().in("session_id", sessionIds as any);
      }
      await adminClient.from("sessions").delete().in("plan_id", planIds as any);
      await adminClient.from("training_plans").delete().in("id", planIds as any);
    }

    const { data: templates } = await adminClient
      .from("training_plans")
      .select("id")
      .eq("coach_id", userId as any)
      .eq("is_template", true as any);
    const templateIds = (templates ?? []).map((t: any) => t.id as number);

    if (templateIds.length > 0) {
      const { data: sessions } = await adminClient
        .from("sessions")
        .select("id")
        .in("plan_id", templateIds as any);
      const sessionIds = (sessions ?? []).map((s: any) => s.id as number);

      if (sessionIds.length > 0) {
        await adminClient.from("session_exercises").delete().in("session_id", sessionIds as any);
      }
      await adminClient.from("sessions").delete().in("plan_id", templateIds as any);
      await adminClient.from("training_plans").delete().in("id", templateIds as any);
    }

    await adminClient
      .from("training_plans")
      .update({ coach_id: null } as any)
      .eq("coach_id", userId as any)
      .eq("is_template", false as any);
  } else {
    const { data: templates } = await adminClient
      .from("training_plans")
      .select("id")
      .eq("coach_id", userId as any)
      .eq("is_template", true as any);
    const templateIds = (templates ?? []).map((t: any) => t.id as number);

    if (templateIds.length > 0) {
      const { data: sessions } = await adminClient
        .from("sessions")
        .select("id")
        .in("plan_id", templateIds as any);
      const sessionIds = (sessions ?? []).map((s: any) => s.id as number);

      if (sessionIds.length > 0) {
        await adminClient.from("session_exercises").delete().in("session_id", sessionIds as any);
      }
      await adminClient.from("sessions").delete().in("plan_id", templateIds as any);
      await adminClient.from("training_plans").delete().in("id", templateIds as any);
    }

    await adminClient
      .from("training_plans")
      .update({ coach_id: null } as any)
      .eq("coach_id", userId as any)
      .eq("is_template", false as any);
  }

  await (adminClient as any)
    .from("coach_students")
    .delete()
    .or(`coach_id.eq.${userId},student_id.eq.${userId}`);

  await adminClient.from("profiles").delete().eq("id", userId as any);

  const { error } = await adminClient.auth.admin.deleteUser(userId);
  if (error) throw error;

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

export async function reassignTemplate(templateId: number, newCoachId: string) {
  await ensureAdmin();
  const adminClient = createSupabaseAdminClient();

  const { error } = await adminClient
    .from("training_plans")
    .update({ coach_id: newCoachId } as any)
    .eq("id", templateId as any)
    .eq("is_template", true as any);

  if (error) {
    console.error("Error reassigning template:", error);
    throw new Error(error.message);
  }

  revalidatePath("/coach/templates");
  return { success: true };
}
