 "use server";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

export async function addWeekToPlan(planId: number, nextWeekNumber: number) {
  const supabase = await createSupabaseServerClient();

  // 1. Verificar permisos (opcional pero recomendado)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  // 2. Crear al menos un día por defecto en esa semana para que sea visible
  const { error } = await supabase
    .from("sessions")
    .insert({
      plan_id: planId,
      week_number: nextWeekNumber,
      day_name: "Monday",
      order_index: 1,
      is_completed: false
    });

  if (error) throw error;
  
  revalidatePath("/coach/student/[studentId]", "page");
  revalidatePath("/student", "page");
  return { success: true };
}

export async function addDayToWeek(planId: number, weekNumber: number, nextOrderIndex: number, dayName: string = "Monday") {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("sessions")
    .insert({
      plan_id: planId,
      week_number: weekNumber,
      day_name: dayName,
      order_index: nextOrderIndex,
      is_completed: false
    });

  if (error) throw error;

  revalidatePath("/coach/student/[studentId]", "page");
  revalidatePath("/student", "page");
  return { success: true };
}

export async function addExerciseToSession(sessionId: number, exerciseId: number, sets: number, reps: string, rpe: number, rest: number, notes: string) {
  const supabase = await createSupabaseServerClient();

  // Obtener el último order_index
  const { data: existing } = await supabase
    .from("session_exercises")
    .select("order_index")
    .eq("session_id", sessionId)
    .order("order_index", { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.order_index ?? 0) + 1;

  const { error } = await supabase
    .from("session_exercises")
    .insert({
      session_id: sessionId,
      exercise_id: exerciseId,
      sets,
      reps,
      rpe_target: rpe,
      rest_seconds: rest,
      coach_notes: notes,
      order_index: nextOrder
    });

  if (error) throw error;

  revalidatePath("/coach/student/[studentId]", "page");
  revalidatePath("/student", "page");
  return { success: true };
}

export async function deleteExerciseFromSession(exerciseSessionId: number) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("session_exercises")
    .delete()
    .eq("id", exerciseSessionId);

  if (error) throw error;

  revalidatePath("/coach/student/[studentId]", "page");
  revalidatePath("/student", "page");
  return { success: true };
}

export async function createTrainingPlan(studentId: string, planName: string, startDate: string) {
  // 1. Cliente normal: Lee las cookies y averigua quién está logueado
  const supabaseAuth = await createSupabaseServerClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  
  if (!user) throw new Error("No autenticado");

  // 2. Cliente administrador: Usa la llave maestra para saltar la seguridad (RLS)
  const supabaseAdmin = createSupabaseAdminClient();

  // Desactivar planes anteriores del estudiante
  await supabaseAdmin
    .from("training_plans")
    .update({ is_active: false } as any)
    .eq("student_id", studentId as any);

  // Insertar nuevo plan
  const { data: plan, error } = await supabaseAdmin
    .from("training_plans")
    .insert({
      student_id: studentId,
      coach_id: user.id, // Acá usamos el ID que sacamos en el paso 1
      name: planName,
      start_date: startDate,
      is_active: true
    } as any)
    .select()
    .single();

  if (error) throw error;

  revalidatePath("/coach");
  return { success: true, planId: plan.id };
}

export async function updateExerciseInSession(
  id: number, 
  data: { 
    sets: number; 
    reps: string; 
    rpe_target: number; 
    rest_seconds: number; 
    coach_notes: string 
  }
) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("session_exercises")
    .update(data)
    .eq("id", id);

  if (error) throw error;

  revalidatePath("/coach/student/[studentId]", "page");
  revalidatePath("/student", "page");
  return { success: true };
}
